import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const output = path.resolve('validation', 'international-ui-130');
await mkdir(output, { recursive: true });
const fixtures = {
  ru: JSON.parse(await readFile(path.resolve('validation/cdek-php-live.json'), 'utf8')),
  en: JSON.parse(await readFile(path.resolve('artifacts/international-live/en-www-atlassian-com-research.json'), 'utf8')),
  es: JSON.parse(await readFile(path.resolve('artifacts/international-live/es-www-correos-es-research.json'), 'utf8')),
  zh: JSON.parse(await readFile(path.resolve('validation/live-midea-php.json'), 'utf8')),
};
const targets = {
  ru: 'https://www.cdek.ru/', en: 'https://www.atlassian.com/', es: 'https://www.correos.es/',
  zh: 'https://www.midea.com.cn/', hi: 'https://www.atlassian.com/', ar: 'https://www.atlassian.com/',
};
const languages = ['ru', 'en', 'es', 'zh', 'hi', 'ar'];
const results = [];
process.env.VITE_RESEARCH_ENDPOINT = 'http://127.0.0.1:7192/research';
const api = http.createServer((request, response) => {
  const language = new URL(request.url, 'http://127.0.0.1:7192').searchParams.get('lang') || 'ru';
  const base = fixtures[language] || fixtures.en;
  const data = ['hi', 'ar'].includes(language) ? { ...base, language } : base;
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(data));
});
await new Promise((resolve, reject) => api.listen(7192, '127.0.0.1', resolve).once('error', reject));
const vite = await createServer({ server: { host: '127.0.0.1', port: 7191, strictPort: true } });
const baseUrl = 'http://127.0.0.1:7191/';
const call = async (action, args) => {
  const response = await fetch('http://127.0.0.1:10086/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args, session: 'baiagent-international-release' }),
  });
  const data = await response.json();
  if (!data.ok && action !== 'find_tab') throw new Error(`${action}: ${JSON.stringify(data)}`);
  return data.data;
};
const evaluate = async code => {
  const result = await call('evaluate', { code });
  if (typeof result.value !== 'string') return result.value;
  try { return JSON.parse(result.value); } catch { return result.value; }
};
const waitFor = async (expression, timeout = 20000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timeout: ${expression}`);
};
const setInput = async (selector, value, textArea = false) => evaluate(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  if (!input) return false;
  Object.getOwnPropertyDescriptor(${textArea ? 'HTMLTextAreaElement' : 'HTMLInputElement'}.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
const layout = async () => evaluate(`(() => ({
  lang: document.documentElement.lang,
  dir: document.documentElement.dir,
  company: document.querySelector('.result-dashboard h1')?.textContent || '',
  viewport: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  offerings: document.querySelectorAll('.offering-card').length,
  download: document.querySelector('a[href*="BAIagent-Director-Setup-Windows"]')?.href || ''
}))()`);
const assertLayout = (page, language, view) => {
  assert.equal(page.lang.split('-')[0], language, `${language}/${view}: язык документа`);
  assert.equal(page.dir, language === 'ar' ? 'rtl' : 'ltr', `${language}/${view}: направление`);
  assert.equal(page.overflow, false, `${language}/${view}: переполнение ${page.scrollWidth} > ${page.viewport}`);
  assert.ok(page.company.trim(), `${language}/${view}: компания не показана`);
};
const click = selector => evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.click(); return true; })()`);
const closeDrawer = async () => {
  await click('.drawer-header button');
  await waitFor("!document.querySelector('.evidence-drawer')");
};
const viewport = (width, height) => call('cdp', { method: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: 1, mobile: width < 600 } });

try {
  await vite.listen();
  const existing = await call('find_tab', { url: baseUrl });
  await call('navigate', { url: baseUrl, newTab: !existing?.success });
  await waitFor("document.querySelector('form input')");
  for (const language of languages) {
    await viewport(1440, 960);
    await call('navigate', { url: `${baseUrl}?lang=${language}&release=1.3.0`, newTab: false });
    await waitFor("document.querySelector('form input')");
    const initial = await evaluate(`(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      download: document.querySelector('a[href*="BAIagent-Director-Setup-Windows"]')?.href || ''
    }))()`);
    assert.equal(initial.lang.split('-')[0], language, `${language}: исходный язык`);
    assert.equal(initial.dir, language === 'ar' ? 'rtl' : 'ltr', `${language}: исходное направление`);
    assert.equal(initial.overflow, false, `${language}: переполнение начальной страницы`);
    assert.ok(initial.download.includes('1.3.0'), `${language}: старая ссылка на установщик`);
    assert.equal(await setInput('form input', targets[language]), true, `${language}: поле сайта`);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("document.querySelector('.result-dashboard')", 30000);
    await new Promise(resolve => setTimeout(resolve, 900));
    const audit = await layout();
    assertLayout(audit, language, 'desktop/audit');
    await call('screenshot', { format: 'png', path: path.join(output, `${language}-audit-desktop.png`) });
    results.push({ language, step: 'audit', viewport: 'desktop', ...audit });

    if (language !== 'ru') {
      await click('.audit-footer-links button');
      await waitFor("document.querySelector('.evidence-drawer')");
      const sources = await evaluate("document.querySelectorAll('.evidence-drawer .drawer-sources article').length");
      assert.ok(sources > 0, `${language}: пустой список источников`);
      await closeDrawer();
      await click('.audit-company-header .soft-action');
      await waitFor("document.querySelector('.evidence-drawer')");
      await closeDrawer();

      if (language === 'en') {
        await click('.advisor-suggestions button');
        await waitFor("document.querySelector('.advisor-message.is-advisor')");
        assert.ok(await evaluate("document.querySelector('.advisor-message.is-advisor p').textContent.length > 20"), 'Советник не ответил');
      }

      await click('.advisor-next');
      await waitFor("document.querySelector('.direction-list')");
      if (language === 'en') {
        const before = await evaluate("document.querySelectorAll('.direction-card').length");
        await click('.hypothesis-actions button');
        await waitFor("document.querySelector('.hypothesis-composer')");
        await setInput('#intl-brief', 'Test a weekly follow-up for demo requests that received no reply', true);
        await setInput('#intl-constraints', 'Two-week pilot; one sales owner; no automatic discounts', true);
        await evaluate("document.querySelector('.hypothesis-composer').requestSubmit()");
        await waitFor(`document.querySelectorAll('.direction-card').length === ${before + 1}`);
        assert.equal(await evaluate("document.querySelector('.hypothesis-composer') === null"), true, 'Форма гипотезы не закрылась');
      }
      const direction = await layout();
      assertLayout(direction, language, 'desktop/direction');
      await click('.advisor-next');
      await waitFor("document.querySelector('.plan-step-list')");
      assert.ok(await evaluate("document.querySelectorAll('.plan-step-list li').length > 0"), `${language}: пустой план`);
      const plan = await layout();
      assertLayout(plan, language, 'desktop/plan');
      await click('.advisor-next');
      await waitFor("document.querySelector('.pilot-card-list')");
      assert.equal(await evaluate("document.querySelectorAll('.pilot-card-list article').length"), 3, `${language}: структура пилота`);
      const pilot = await layout();
      assertLayout(pilot, language, 'desktop/pilot');
      results.push({ language, step: 'pilot', viewport: 'desktop', ...pilot });
      if (language === 'en') {
        await click('.rail-navigation button:last-child');
        await waitFor("document.querySelector('.documents-privacy')");
        assert.ok(await evaluate("document.querySelector('.documents-privacy').textContent.length > 20"), 'Нет объяснения локальных документов');
        await click('.rail-brand');
        await waitFor("document.querySelector('.audit-company-header')");
        await click('.new-audit-trigger');
        await waitFor("document.querySelector('.new-audit-dialog')");
        assert.ok(await evaluate("document.querySelector('.new-audit-warning').textContent.length > 20"), 'Нет предупреждения нового аудита');
        await click('.new-audit-cancel');
      }
    }

    await viewport(390, 844);
    await call('navigate', { url: `${baseUrl}?lang=${language}&release=1.3.0`, newTab: false });
    await waitFor("document.querySelector('form input')");
    await setInput('form input', targets[language]);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("document.querySelector('.result-dashboard')", 30000);
    await new Promise(resolve => setTimeout(resolve, 600));
    const mobile = await layout();
    assertLayout(mobile, language, 'mobile/audit');
    await call('screenshot', { format: 'png', path: path.join(output, `${language}-audit-mobile.png`) });
    results.push({ language, step: 'audit', viewport: 'mobile', ...mobile });
    console.log(JSON.stringify({ language, desktop: audit.company, mobileOverflow: mobile.overflow, direction: mobile.dir }));
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ conclusion: 'success', results }, null, 2));
  console.log('INTERNATIONAL_UI_VALIDATION_PASSED');
} finally {
  await call('cdp', { method: 'Emulation.clearDeviceMetricsOverride', params: {} }).catch(() => {});
  await vite.close();
  await new Promise(resolve => api.close(resolve));
}
