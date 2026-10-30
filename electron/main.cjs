const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const sessions = new Map();

async function analyzeFor(event, research) {
  const { analyzeWithQwen } = await import('./qwen.mjs');
  const analysis = await analyzeWithQwen(research, {
    userDataPath: app.getPath('userData'),
    onProgress: progress => event.sender.send('director:progress', progress),
  });
  const customOpportunities = (sessions.get(event.sender.id)?.analysis.opportunities || []).filter(item => item.origin === 'user');
  const result = { research, analysis: { ...analysis, opportunities: [...analysis.opportunities, ...customOpportunities.filter(custom => !analysis.opportunities.some(item => item.id === custom.id))] } };
  sessions.set(event.sender.id, result);
  return result;
}

function createWindow() {
  const enterpriseIndex = path.join(__dirname, '..', 'dist-enterprise', 'index.html');
  const enterprise = app.isPackaged && fsSync.existsSync(enterpriseIndex);
  const window = new BrowserWindow({
    width: 1240, height: 840, minWidth: 920, minHeight: 640,
    backgroundColor: '#f4f8ff', title: enterprise ? 'Balanov.PRO Enterprise' : 'BAIagent — ИИ-советник для бизнеса',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.VITE_DEV_SERVER_URL) window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else if (app.isPackaged) window.loadFile(enterprise ? enterpriseIndex : path.join(__dirname, '..', 'dist', 'index.html'));
  else window.loadURL('http://127.0.0.1:5173');
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle('director:research', async (event, url) => {
    const { researchCompany } = await import('./research.mjs');
    const research = await researchCompany(url, progress => event.sender.send('director:progress', progress));
    return analyzeFor(event, research);
  });
  ipcMain.handle('director:add-documents', async event => {
    const current = sessions.get(event.sender.id);
    if (!current) throw new Error('Сначала запустите исследование сайта');
    const picked = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Документы', extensions: ['txt', 'md', 'csv', 'json', 'pdf', 'docx'] }] });
    if (picked.canceled || !picked.filePaths.length) return { status: 'canceled' };
    const { readLocalDocuments } = await import('./files.mjs');
    const documents = await readLocalDocuments(picked.filePaths);
    if (!documents.length) throw new Error('Не удалось извлечь текст из выбранных документов');
    const existing = new Set(current.research.sources.map(source => source.url));
    const additions = documents.filter(document => !existing.has(document.url));
    if (!additions.length) return { status: 'completed', result: current, addedCount: 0 };
    const firstId = current.research.sources.filter(source => source.kind === 'local-document').length + 1;
    const research = {
      ...current.research,
      sources: [...current.research.sources, ...additions.map((document, index) => ({ ...document, id: `local-${firstId + index}` }))],
    };
    const result = await analyzeFor(event, research);
    return { status: 'completed', result, addedCount: additions.length };
  });
  ipcMain.handle('director:add-folder', async event => {
    const current = sessions.get(event.sender.id);
    if (!current) throw new Error('Сначала запустите исследование сайта');
    const picked = await dialog.showOpenDialog({ title: 'Выберите рабочую папку', buttonLabel: 'Проверить папку', properties: ['openDirectory'] });
    if (picked.canceled || !picked.filePaths.length) return { status: 'canceled' };
    event.sender.send('director:progress', { stage: 'pages', message: 'Считаю документы только в выбранной папке' });
    const { scanLocalFolder, readLocalDocuments } = await import('./files.mjs');
    const scan = await scanLocalFolder(picked.filePaths[0]);
    if (!scan.filePaths.length) throw new Error('В выбранной папке нет поддерживаемых документов размером до 8 МБ');
    const confirmation = await dialog.showMessageBox({
      type: 'question',
      title: 'Разрешить чтение документов?',
      message: `Найдено документов: ${scan.totalSupported}`,
      detail: `${scan.root}\n\nПрограмма прочитает до ${scan.filePaths.length} самых свежих файлов. Только эта папка, только чтение, без отправки документов в облачную модель.`,
      buttons: ['Отмена', 'Разрешить и изучить'], defaultId: 0, cancelId: 0, noLink: true,
    });
    if (confirmation.response !== 1) return { status: 'canceled' };
    event.sender.send('director:progress', { stage: 'pages', message: `Читаю ${scan.filePaths.length} документов из разрешённой папки` });
    const documents = await readLocalDocuments(scan.filePaths);
    if (!documents.length) throw new Error('Не удалось извлечь текст из выбранных документов');
    const research = {
      ...current.research,
      sources: [
        ...current.research.sources.filter(source => source.kind !== 'local-document'),
        ...documents.map((document, index) => ({ ...document, id: `local-${index + 1}` })),
      ],
    };
    const result = await analyzeFor(event, research);
    return { status: 'completed', result, addedCount: documents.length };
  });
  ipcMain.handle('director:forget-folder', async event => {
    const current = sessions.get(event.sender.id);
    if (!current) throw new Error('Нет данных исследования');
    const sources = current.research.sources.filter(source => source.kind !== 'local-document');
    const removedCount = current.research.sources.length - sources.length;
    if (!removedCount) return { status: 'completed', result: current, removedCount: 0 };
    const result = await analyzeFor(event, { ...current.research, sources });
    return { status: 'completed', result, removedCount };
  });
  ipcMain.handle('director:advisor', async (event, payload = {}) => {
    const current = sessions.get(event.sender.id);
    if (!current) throw new Error('Сначала запустите исследование сайта');
    const question = String(payload.question || '').trim().slice(0, 1200);
    if (!question) throw new Error('Напишите вопрос советнику');
    const history = (Array.isArray(payload.history) ? payload.history : []).slice(-8).map(message => ({ role: message.role === 'user' ? 'user' : 'advisor', text: String(message.text || message.answer || '').slice(0, 1200) }));
    const opportunity = current.analysis.opportunities.find(item => item.id === payload.opportunityId) || current.analysis.opportunities[0];
    const { chatWithQwen } = await import('./qwen.mjs');
    return chatWithQwen({ question, history, research: current.research, analysis: current.analysis, opportunity, userDataPath: app.getPath('userData') });
  });
  ipcMain.handle('director:create-hypothesis', async (event, payload = {}) => {
    const current = sessions.get(event.sender.id);
    if (!current) throw new Error('Сначала запустите исследование сайта');
    const input = { brief: String(payload.brief || '').trim().slice(0, 1600), constraints: String(payload.constraints || '').trim().slice(0, 2000) };
    if (!input.brief) throw new Error('Опишите идею или поручение для новой гипотезы');
    const history = (Array.isArray(payload.history) ? payload.history : []).slice(-8).map(message => ({ role: message.role === 'user' ? 'user' : 'advisor', text: String(message.text || message.answer || '').slice(0, 1200) }));
    const { createHypothesisWithQwen } = await import('./qwen.mjs');
    const created = await createHypothesisWithQwen({ input, history, research: current.research, analysis: current.analysis, userDataPath: app.getPath('userData') });
    const result = { ...current, analysis: { ...current.analysis, opportunities: [...current.analysis.opportunities, created.opportunity] } };
    sessions.set(event.sender.id, result);
    return { status: 'completed', result, opportunityId: created.opportunity.id, mode: created.mode };
  });
  ipcMain.handle('director:reset-session', event => {
    sessions.delete(event.sender.id);
    return { status: 'completed' };
  });
  ipcMain.handle('director:save-pilot', async (event, opportunityId) => {
    const current = sessions.get(event.sender.id);
    if (!current) throw new Error('Нет данных исследования');
    const opportunity = current.analysis.opportunities.find(item => item.id === opportunityId);
    if (!opportunity) throw new Error('Выбранное направление больше недоступно');
    const { buildPilotPlan } = await import('../shared/verification.js');
    const content = buildPilotPlan(current.analysis, opportunity, current.research.sources);
    const picked = await dialog.showSaveDialog({ title: 'Сохранить план пилота', defaultPath: 'BAIagent-pilot.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (picked.canceled || !picked.filePath) return { status: 'canceled', saved: false };
    await fs.writeFile(picked.filePath, content, 'utf8');
    return { status: 'completed', saved: true, path: picked.filePath };
  });
  ipcMain.handle('director:open-external', async (_event, url) => {
    if (!/^https:\/\//.test(url)) throw new Error('Разрешены только HTTPS-ссылки');
    await shell.openExternal(url);
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
