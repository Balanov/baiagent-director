const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = process.env.BAIAGENT_WINDOWS_OUTPUT || 'release';
const profile = path.join(root, 'artifacts', `packaged-profile-${output.replace(/\W+/g, '-')}`);
const executable = path.join(root, output, 'win-unpacked', 'BAIagent Director.exe');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await (await fetch('http://127.0.0.1:9225/json/list')).json();
      const page = targets.find(target => target.type === 'page' && target.url.includes('index.html'));
      if (page) return page;
    } catch {}
    await delay(250);
  }
  throw new Error('Packaged application did not expose its window');
}

async function main() {
  // Профиль сохраняется между попытками: прерванная загрузка модели продолжается, а не начинается заново.
  await fs.mkdir(profile, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, ['--remote-debugging-port=9225', `--user-data-dir=${profile}`], { env, stdio: 'inherit' });
  let socket;
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
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Renderer evaluation failed');
      return result.result.value;
    };
    await call('Page.enable');
    for (let attempt = 0; attempt < 40 && !(await evaluate('Boolean(document.querySelector("#company-url"))')); attempt += 1) await delay(250);
    const desktop = await evaluate('Boolean(window.director?.isDesktop)');
    if (!desktop) throw new Error('Desktop bridge is unavailable in packaged application');
    await evaluate(`(() => {
      const input = document.querySelector('#company-url');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://baiagent.ru/');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.launch-form').requestSubmit();
    })()`);
    let meta = '';
    let workingCaptured = false;
    const activityMessages = new Set();
    const draftValues = new Set();
    // 12 минут включают подтверждённую первичную загрузку модели 2,5 ГБ и локальный анализ.
    for (let attempt = 0; attempt < 2400; attempt += 1) {
      const state = await evaluate('({ mode: document.querySelector(".result-view")?.dataset.analysisMode || "", error: document.querySelector(".inline-error")?.textContent || "", activity: document.querySelector(".live-activity strong")?.textContent || "", percent: Number(document.querySelector(".progress-track")?.getAttribute("aria-label")?.replace(/\\D/g, "") || 0) })');
      if (state.activity) activityMessages.add(state.activity);
      if (state.activity.includes('знаков')) draftValues.add(Number(state.activity.replace(/\D/g, '')));
      if (state.activity && !workingCaptured && state.percent >= 85) {
        const working = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await fs.writeFile(path.join(root, 'artifacts', 'ui-v06-packaged-working.png'), Buffer.from(working.data, 'base64'));
        workingCaptured = true;
      }
      if (attempt > 0 && attempt % 200 === 0) console.log(`Packaged analysis still running: ${state.percent}%, ${state.activity}`);
      if (state.mode.startsWith('qwen')) { meta = `Локальный ИИ-анализ: ${state.mode}`; break; }
      if (state.mode === 'evidence-rules') throw new Error('Packaged Qwen fell back to evidence rules');
      if (state.error) throw new Error(`Packaged application error: ${state.error}`);
      await delay(300);
    }
    if (!meta) throw new Error('Packaged Qwen analysis timed out');
    if (!workingCaptured || activityMessages.size < 2 || draftValues.size < 2 || Math.max(...draftValues) <= 0) throw new Error('Real analysis activity was not visibly updated');
    const contract = await evaluate(`({
      offerings: document.querySelectorAll('.offering-card').length,
      categories: document.querySelectorAll('.opportunity-categories button').length,
      agentsHidden: !document.querySelector('.agent-solution'),
      drawerHidden: !document.querySelector('.evidence-drawer'),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      verticalScroll: document.documentElement.scrollHeight > window.innerHeight
    })`);
    if (contract.offerings < 4 || contract.categories !== 3 || !contract.agentsHidden || !contract.drawerHidden || contract.horizontalOverflow) throw new Error(`Packaged result contract failed: ${JSON.stringify(contract)}`);
    const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(root, 'artifacts', 'ui-v06-packaged-result.png'), Buffer.from(screenshot.data, 'base64'));
    console.log(`Packaged smoke passed: ${meta}; ${JSON.stringify(contract)}`);
  } finally {
    if (socket) socket.close();
    if (child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await delay(500);
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
