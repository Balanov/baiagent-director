const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = process.env.BAIAGENT_WINDOWS_OUTPUT || 'release-111-node';
const enterprise = process.env.BAIAGENT_SMOKE_PRODUCT === 'enterprise';
const product = enterprise ? 'enterprise' : 'director';
const executableName = enterprise ? 'Balanov.PRO Enterprise.exe' : 'BAIagent Director.exe';
const profile = path.join(root, 'artifacts', `packaged-profile-${output.replace(/\W+/g, '-')}`);
const executable = process.env.BAIAGENT_EXECUTABLE
  ? path.resolve(process.env.BAIAGENT_EXECUTABLE)
  : path.join(root, output, 'win-unpacked', executableName);
const evidence = path.join(root, 'validation', 'packaged-111', product);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const targets = await (await fetch('http://127.0.0.1:9225/json/list')).json();
      const page = targets.find(target => target.type === 'page' && target.url.includes('index.html'));
      if (page) return page;
    } catch {}
    await delay(250);
  }
  throw new Error('Собранное приложение не открыло рабочее окно');
}

async function main() {
  await fs.mkdir(profile, { recursive: true });
  await fs.mkdir(evidence, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, ['--remote-debugging-port=9225', `--user-data-dir=${profile}`], { env, stdio: 'inherit' });
  let socket;
  const checks = [];
  const screenshots = [];
  const activity = new Set();
  if (process.env.BAIAGENT_RESEARCH_RESULT) throw new Error('Replay отключён: проверка установщика выполняет только реальное исследование');
  const startedAt = Date.now();
  const checkpoint = name => console.log(`CHECKPOINT ${name} ${Math.round((Date.now() - startedAt) / 1000)}s`);
  try {
    const target = await waitForTarget();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Ошибка интерфейса');
      return result.result.value;
    };
    const screenshot = async name => {
      await call('Page.bringToFront');
      await evaluate('document.fonts.ready');
      await delay(1110);
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const image = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(evidence, `${name}.png`);
      await fs.writeFile(file, Buffer.from(image.data, 'base64'));
      screenshots.push(file);
    };
    const clickText = async (selector, text) => evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.textContent.includes(${JSON.stringify(text)})); if (!button) throw new Error('Нет кнопки: ' + ${JSON.stringify(text)}); button.click(); })()`);
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (let attempt = 0; attempt < 80 && !(await evaluate('Boolean(document.querySelector("#company-url"))')); attempt += 1) await delay(250);
    assert.equal(await evaluate('Boolean(window.director?.isDesktop)'), true, 'Локальный мост недоступен');
    assert.equal(await evaluate('typeof window.director?.advisor'), 'function');
    checks.push('desktop-bridge');
    checkpoint('desktop-bridge');
    await evaluate(`(() => {
      const input = document.querySelector('#company-url');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://teremok.ru/');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.launch-form').requestSubmit();
    })()`);
    let mode = '';
    const deadline = Date.now() + 480000;
    let lastLog = 0;
    while (Date.now() < deadline) {
      const state = await evaluate('({ mode: document.querySelector(".result-view")?.dataset.analysisMode || "", error: document.querySelector(".inline-error")?.textContent || "", activity: document.querySelector(".live-activity strong")?.textContent || "", percent: Number(document.querySelector(".progress-track")?.getAttribute("aria-label")?.replace(/\\D/g, "") || 0) })');
      if (state.activity) activity.add(state.activity);
      if (Date.now() - lastLog > 15000) { console.log('Собранная версия:', JSON.stringify(state)); lastLog = Date.now(); }
      if (state.mode) { mode = state.mode; break; }
      if (state.error) throw new Error(state.error);
      await delay(500);
    }
    if (!mode) throw new Error('Исследование собранной версии не завершилось за отведённое время');
    if (!mode.startsWith('qwen')) throw new Error(`Вместо локальной модели сработал резервный алгоритм: ${mode}`);
    checks.push(`real-analysis:${mode}`);
    assert.ok(activity.size >= 2, 'Не показаны фактические этапы исследования');
    checkpoint('audit-complete');
    await screenshot('audit');
    const contract = await evaluate(`({
      company: document.querySelector('.audit-company-name h1')?.textContent || '',
      offerings: document.querySelectorAll('.offering-card').length,
      images: [...document.querySelectorAll('.offering-card img')].map(img=>({src:img.currentSrc,loaded:img.complete&&img.naturalWidth>0})),
      opportunities: document.querySelectorAll('.direction-card').length,
      advisor: document.querySelector('.advisor-status')?.textContent || '',
      overflow: document.documentElement.scrollWidth > innerWidth
    })`);
    assert.ok(contract.company.length > 1 && contract.offerings >= 4, JSON.stringify(contract));
    assert.ok(contract.images.every(image => image.loaded), 'Часть изображений не загрузилась');
    assert.equal(contract.overflow, false);
    checks.push('audit-and-images');

    let chat;
    if (process.env.BAIAGENT_SMOKE_SKIP_CHAT !== '1') {
      await evaluate(`(() => { const input = document.querySelector('.advisor-input input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Что говорят клиенты? Ответь одним коротким предложением со ссылкой на источник. Если отзывы не найдены, прямо скажи.'); input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('.advisor-input').requestSubmit(); })()`);
      const chatDeadline = Date.now() + 300000;
      while (Date.now() < chatDeadline) {
        chat = await evaluate(`({busy:Boolean(document.querySelector('.advisor-thinking')),text:document.querySelector('.advisor-message.is-advisor:last-of-type')?.textContent||'',citations:document.querySelectorAll('.message-citations button').length})`);
        if (!chat.busy && chat.text) break;
        await delay(1000);
      }
      console.log('LOCAL_CHAT', JSON.stringify(chat));
      await fs.writeFile(path.join(evidence, 'last-chat.json'), JSON.stringify(chat, null, 2));
      await screenshot('local-chat');
      assert.ok(chat.text && !chat.busy && !/Не смог завершить/.test(chat.text), `Диалог: ${JSON.stringify(chat)}`);
      assert.ok(chat.citations > 0, 'Локальный советник не вернул проверяемых источников');
      checks.push('real-local-chat-with-citations');
      checkpoint('local-chat-complete');
    } else {
      checks.push('chat-covered-by-live-director-run');
    }
    await clickText('.advisor-step-actions button', 'Перейти к гипотезам');
    await clickText('.rail-navigation button', 'Выбор');
    await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.direction-card')];
      const card = ${enterprise ? "cards.find(item => /отзыв|репутац|клиент/i.test(item.textContent))" : 'cards[1]'};
      if (!card) throw new Error('Релевантная гипотеза не найдена');
      card.click();
    })()`);
    await clickText('.rail-navigation button', 'План');
    assert.ok(await evaluate(`document.querySelectorAll('.plan-step-list > *').length > 0`), 'Не построен план для выбранной гипотезы');
    await clickText('.rail-navigation button', 'Пилот');
    assert.match(await evaluate(`document.querySelector('.advisor-step-actions')?.textContent || ''`), /Подключить 0 руб\./);
    checks.push('direction-plan-pilot');
    await screenshot('pilot');
    let enterpriseContract;
    if (enterprise) {
      await clickText('.advisor-step-actions button', 'Подключить 0 руб.');
      await delay(300);
      enterpriseContract = await evaluate(`({
        brand: document.querySelector('.enterprise-panel__brand')?.textContent || '',
        services: document.querySelectorAll('.enterprise-panel__service').length,
        cases: document.querySelectorAll('.enterprise-panel__case').length,
        prices: [...document.querySelectorAll('.enterprise-panel__price-list strong')].map(node => node.textContent),
        architecture: document.querySelector('.enterprise-panel__architecture')?.textContent || ''
      })`);
      assert.match(enterpriseContract.brand, /Balanov\.PRO/);
      assert.ok(enterpriseContract.services > 0 && enterpriseContract.prices.some(price => price.includes('₽')), JSON.stringify(enterpriseContract));
      assert.ok(enterpriseContract.architecture.length > 30, 'Отсутствует архитектура enterprise-внедрения');
      checks.push('enterprise-vendor-prices-and-architecture');
      await screenshot('enterprise');
    }
    const report = { status: 'passed', checkedAt: new Date().toISOString(), version: '1.1.1', product, executable, output, mode, chat, contract, enterpriseContract, checks, activity: [...activity], screenshots, limitation: 'Проверен путь локальной модели через Ollama. Встроенная GGUF-модель и подпись установщика проверяются отдельно.' };
    await fs.writeFile(path.join(evidence, 'verification.json'), JSON.stringify(report, null, 2));
    console.log('PACKAGED_SMOKE_PASSED', JSON.stringify({ mode, checks }));
  } finally {
    if (socket) socket.close();
    if (child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await delay(500);
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
