const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'artifacts');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const fixtureName = process.env.BAIAGENT_UI_FIXTURE || 'research-mmk-v07-external.json';
  const fixture = JSON.parse(await fs.readFile(path.join(artifacts, fixtureName), 'utf8'));
  const api = http.createServer(async (_request, response) => {
    await delay(120);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify(fixture.research));
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  process.env.VITE_RESEARCH_ENDPOINT = `http://127.0.0.1:${api.address().port}/research`;
  const { createServer } = await import('vite');
  const vite = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 5179, strictPort: false } });
  await vite.listen();
  const address = vite.httpServer.address();
  let window;
  try {
    await app.whenReady();
    window = new BrowserWindow({ width: 1440, height: 1000, minWidth: 360, minHeight: 640, show: true, backgroundColor: '#f4f8ff' });
    const url = `http://127.0.0.1:${address.port}/`;
    const evaluate = code => window.webContents.executeJavaScript(code, true);
    const screenshot = async name => { await delay(500); await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'); return fs.writeFile(path.join(artifacts, name), await window.webContents.capturePage().then(image => image.toPNG())); };
    const layout = () => evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})`);
    const waitFor = async (selector, timeout = 12000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
        await delay(80);
      }
      throw new Error(`Timeout waiting for ${selector}`);
    };

    await window.loadURL(url);
    await evaluate('document.fonts.ready');
    await screenshot('ui-v07-desktop-idle.png');
    const idleDesktop = await layout();
    if (idleDesktop.scrollWidth > idleDesktop.width) throw new Error(`Desktop idle horizontal overflow: ${JSON.stringify(idleDesktop)}`);

    window.setSize(390, 844);
    await window.loadURL(url);
    await screenshot('ui-v07-mobile-idle.png');
    const idleMobile = await layout();
    if (idleMobile.scrollWidth > idleMobile.width) throw new Error(`Mobile idle horizontal overflow: ${JSON.stringify(idleMobile)}`);

    window.setSize(1440, 1000);
    await window.loadURL(url);
    await evaluate(`(() => { const input=document.querySelector('#company-url'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://mmk-soap.ru'); input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('.launch-form').requestSubmit(); })()`);
    await waitFor('.result-dashboard', 20000);
    await delay(400);
    const contract = await evaluate(`({company:document.querySelector('.recognition-card h1')?.textContent,logo:document.querySelector('.recognition-icon img')?.src,offerings:document.querySelectorAll('.offering-card').length,categories:document.querySelectorAll('.opportunity-categories button').length,sources:document.querySelector('.recognition-actions')?.textContent,summary:document.querySelector('.management-summary')?.textContent})`);
    if (contract.offerings < 6 || contract.categories !== 3 || !contract.logo?.includes('mmk-logo.svg') || !contract.company?.includes('Московский')) throw new Error(`Result contract failed: ${JSON.stringify(contract)}`);
    const resultDesktop = await layout();
    if (resultDesktop.scrollWidth > resultDesktop.width) throw new Error(`Desktop result horizontal overflow: ${JSON.stringify(resultDesktop)}`);
    await screenshot('ui-v07-desktop-result.png');

    const dockLabels = ['Рынок', 'Отзывы', 'Альтернативы', 'SWOT', 'Проверка', '24 решения'];
    const drawerResults = [];
    for (let index = 0; index < dockLabels.length; index += 1) {
      await evaluate(`document.querySelectorAll('.insight-dock > button')[${index}].click()`);
      await waitFor('.evidence-drawer');
      const state = await evaluate(`({title:document.querySelector('.drawer-header h2')?.textContent,text:document.querySelector('.drawer-body')?.textContent.slice(0,240),overflow:document.documentElement.scrollWidth>innerWidth})`);
      if (!state.text || state.overflow) throw new Error(`Drawer ${dockLabels[index]} failed: ${JSON.stringify(state)}`);
      drawerResults.push(state.title);
      await evaluate(`document.querySelector('.drawer-header > button').click()`);
    }

    await evaluate(`document.querySelector('.management-summary button').click()`);
    await waitFor('.advisor-chat');
    await evaluate(`document.querySelector('.advisor-suggestions button').click()`);
    await waitFor('.advisor-message.is-advisor');
    const advisor = await evaluate(`({messages:document.querySelectorAll('.advisor-message').length,citations:document.querySelectorAll('.message-citations button').length,text:document.querySelector('.advisor-message.is-advisor p')?.textContent})`);
    if (advisor.messages !== 2 || advisor.citations < 1 || !advisor.text) throw new Error(`Advisor failed: ${JSON.stringify(advisor)}`);
    await screenshot('ui-v07-advisor.png');
    await evaluate(`document.querySelector('.drawer-header > button').click()`);

    await evaluate(`document.querySelector('.recommendation-links button:last-child').click()`);
    await waitFor('.recommendation-links button:last-child');
    const saved = await evaluate(`document.querySelector('.recommendation-links')?.textContent.includes('План сохранён')`);
    if (!saved) throw new Error('Pilot download state failed');

    await evaluate(`document.querySelectorAll('.insight-dock > button')[0].click()`);
    window.setSize(390, 844);
    await delay(250);
    const drawerMobile = await layout();
    if (drawerMobile.scrollWidth > drawerMobile.width) throw new Error(`Mobile drawer horizontal overflow: ${JSON.stringify(drawerMobile)}`);
    await screenshot('ui-v07-mobile-drawer.png');
    await evaluate(`document.querySelector('.drawer-header > button').click()`);
    await delay(150);
    const resultMobile = await layout();
    if (resultMobile.scrollWidth > resultMobile.width) throw new Error(`Mobile result horizontal overflow: ${JSON.stringify(resultMobile)}`);
    await screenshot('ui-v07-mobile-result.png');

    console.log(`UI smoke passed: ${JSON.stringify({ fixtureName, contract, drawerResults, advisor, idleDesktop, idleMobile, resultDesktop, resultMobile, saved })}`);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await vite.close();
    await new Promise(resolve => api.close(resolve));
  }
}

main().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
