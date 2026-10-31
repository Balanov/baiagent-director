const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const versionSlug = version.replace(/\./g, '');
const output = process.env.BAIAGENT_WINDOWS_OUTPUT || 'release-signed';
const enterprise = process.env.BAIAGENT_SMOKE_PRODUCT === 'enterprise';
const product = enterprise ? 'enterprise' : 'director';
const executableName = enterprise ? 'Balanov.PRO Enterprise.exe' : 'BAIagent Director.exe';
const profile = path.join(root, 'artifacts', `packaged-profile-${output.replace(/\W+/g, '-')}`);
const executable = process.env.BAIAGENT_EXECUTABLE
  ? path.resolve(process.env.BAIAGENT_EXECUTABLE)
  : path.join(root, output, 'win-unpacked', executableName);
const evidence = path.join(root, 'validation', `packaged-${versionSlug}`, product);
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
      // Electron may throttle requestAnimationFrame in a hidden test window; never block evidence capture on it.
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

    const dialogues = {};
    const waitDialogue = async before => {
      await delay(250);
      const deadline = Date.now() + 300000;
      let state;
      while (Date.now() < deadline) {
        state = await evaluate(`({
          busy:Boolean(document.querySelector('.advisor-thinking')),
          count:document.querySelectorAll('.advisor-message').length,
          text:document.querySelector('.advisor-message.is-advisor:last-of-type')?.textContent||'',
          citations:document.querySelectorAll('.advisor-message.is-advisor:last-of-type .message-citations button').length,
          journal:[...document.querySelectorAll('.advisor-message.is-advisor')].map(node=>node.textContent).filter(text=>text.includes('Журнал действий')).at(-1)||''
        })`);
        if (!state.busy && state.count >= before + 2 && state.text) return state;
        await delay(1000);
      }
      throw new Error(`Диалог не завершился: ${JSON.stringify(state)}`);
    };
    const askLocal = async question => {
      const before = await evaluate(`document.querySelectorAll('.advisor-message').length`);
      await evaluate(`(() => { const input = document.querySelector('.advisor-input input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(question)}); input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('.advisor-input').requestSubmit(); })()`);
      const response = await waitDialogue(before);
      assert.ok(response.text && !/Не смог завершить/.test(response.text), `Диалог: ${JSON.stringify(response)}`);
      console.log('LOCAL_CHAT', JSON.stringify({ question, ...response }));
      return response;
    };

    const chat = await askLocal('Что говорят клиенты? Ответь одним коротким предложением со ссылкой на источник. Если отзывы не найдены, прямо скажи.');
    assert.ok(chat.citations > 0, 'Локальный советник не вернул проверяемых источников');
    assert.doesNotMatch(chat.text, /Мини-отель|гостиница/i, 'В отзывы ресторана попал другой тип бизнеса с тем же именем');
    dialogues.factual = chat;
    checks.push('real-local-chat-with-citations');
    checkpoint('local-chat-complete');
    await screenshot('local-chat');

    dialogues.greeting = await askLocal('Эй');
    assert.match(dialogues.greeting.text, /Здравствуйте! Я ваш ИИ-советник/);
    checks.push('greeting-is-dialogue-not-factual-error');

    dialogues.recommendation = await askLocal('И что с этим делать?');
    assert.match(dialogues.recommendation.text, /начн|рекоменд|предла|шаг|выбер/i);
    checks.push('contextual-next-step-recommendation');

    if (!enterprise) {
      await clickText('.advisor-next', 'Перейти к гипотезам');
      dialogues.createdHypothesis = await askLocal('Добавь гипотезу: проверить наборы для завтрака в офисе');
      const created = await evaluate(`({
        selected:document.querySelector('.direction-card.is-selected')?.textContent||'',
        journal:[...document.querySelectorAll('.advisor-message.is-advisor')].map(node=>node.textContent).filter(text=>text.includes('Журнал действий')).at(-1)||''
      })`);
      assert.match(created.selected, /завтрак/i, JSON.stringify(created));
      assert.match(created.journal, /Выполнено:.*Гипотеза/);
      checks.push('chat-created-and-selected-real-hypothesis');
      await screenshot('created-hypothesis');
    } else {
      await clickText('.advisor-next', 'Перейти к гипотезам');
      await evaluate(`(() => {
        const card = [...document.querySelectorAll('.direction-card')].find(item => /отзыв|репутац|клиент/i.test(item.textContent));
        if (!card) throw new Error('Релевантная гипотеза не найдена');
        card.click();
      })()`);
    }
    await clickText('.rail-navigation button', 'План');
    assert.ok(await evaluate(`document.querySelectorAll('.plan-step-list > *').length > 0`), 'Не построен план для выбранной гипотезы');
    await clickText('.rail-navigation button', 'Пилот');
    assert.match(await evaluate(`document.querySelector('.advisor-step-actions')?.textContent || ''`), /Подключить 0 руб\./);
    checks.push('direction-plan-pilot');
    await screenshot('pilot');
    let enterpriseContract;
    let selfService;
    if (enterprise) {
      await clickText('.advisor-next', 'Подключить 0 руб.');
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
    } else {
      await clickText('.advisor-next', 'Подключить 0 руб.');
      await clickText('.onboarding-support summary', 'Хотите сначала всё сделать сами?');
      selfService = await evaluate(`({
        open:document.querySelector('.onboarding-support')?.open||false,
        phases:document.querySelectorAll('.self-service-plan > li').length,
        text:document.querySelector('.onboarding-support')?.textContent||'',
        selfLinks:document.querySelectorAll('.onboarding-support a[href*="xray"]').length
      })`);
      assert.ok(selfService.open && selfService.phases >= 4, JSON.stringify(selfService));
      assert.match(selfService.text, /Внутренний бюджет/);
      assert.equal(selfService.selfLinks, 0, 'Самостоятельный план ссылается на текущий советник');
      checks.push('self-service-plan-inside-current-advisor');
      await screenshot('self-service-plan');
      const before = await evaluate(`document.querySelectorAll('.advisor-message').length`);
      await clickText('.onboarding-support .onboarding-primary', 'Обсудить план с советником');
      dialogues.selfService = await waitDialogue(before);
      assert.match(dialogues.selfService.text, /Бюджет/);
      assert.match(dialogues.selfService.text, /Остановить/);
      checks.push('self-service-consultation-real-local-model');
    }
    const report = { status: 'passed', checkedAt: new Date().toISOString(), version, product, executable, output, mode, chat, dialogues, selfService, contract, enterpriseContract, checks, activity: [...activity], screenshots, limitation: 'Проверен путь локальной модели через Ollama. Встроенная GGUF-модель и подпись установщика проверяются отдельно.' };
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
