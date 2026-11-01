import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'https://baiagent.ru/xray/';
const output = path.resolve('validation', 'production-currency');
await mkdir(output, { recursive: true });
const call = async (action, args) => {
  const response = await fetch('http://127.0.0.1:10086/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args, session: 'baiagent-international-release' }),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${action}: ${JSON.stringify(data)}`);
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
const read = "() => ({lang:document.documentElement.lang.split('-')[0],promise:document.querySelector('.promises')?.innerText || '',download:document.querySelector('.hero-download small')?.innerText || '',rubleZero:document.body.innerText.includes('0 ₽'),overflow:document.documentElement.scrollWidth > window.innerWidth + 1,viewport:window.innerWidth,scrollWidth:document.documentElement.scrollWidth})";
const currencies = { ru: 'RUB', en: 'USD', zh: 'CNY', hi: 'INR', es: 'EUR', ar: 'SAR' };
const locales = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', hi: 'hi-IN', es: 'es-ES', ar: 'ar-SA' };
const results = [];

try {
  for (const language of Object.keys(currencies)) {
    await call('navigate', { url: `${base}?lang=${language}&currencyFix=20261101`, newTab: true, group_title: 'Публикация BAIagent' });
    await waitFor("document.querySelector('.promises')");
    for (const [view, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844]]) {
      if (view === 'mobile' && !['zh', 'hi'].includes(language)) continue;
      await call('cdp', { method: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: 1, mobile: width < 600 } });
      const page = await evaluate(`(${read})()`);
      const zero = new Intl.NumberFormat(locales[language], { style: 'currency', currency: currencies[language], maximumFractionDigits: 0 }).format(0);
      assert.equal(page.lang, language);
      assert.equal(page.rubleZero, language === 'ru', `${language}: рублевая нулевая цена`);
      assert.ok(page.promise.replace(/\s/g, '').includes(zero.replace(/\s/g, '')), `${language}: ${page.promise} не содержит ${zero}`);
      assert.ok(page.download.replace(/\s/g, '').includes(zero.replace(/\s/g, '')), `${language}: валюта загрузки`);
      assert.equal(page.overflow, false, `${language}/${view}: ${page.scrollWidth} > ${page.viewport}`);
      results.push({ language, view, zero, ...page });
      console.log(JSON.stringify({ language, view, zero, promise: page.promise, overflow: page.overflow }));
    }
  }
  await call('cdp', { method: 'Emulation.clearDeviceMetricsOverride', params: {} });
  await call('navigate', { url: `${base}?lang=ru&currencyFix=20261101`, newTab: false });
  await waitFor("document.querySelector('.language-switcher select')");
  await evaluate("(() => { const select=document.querySelector('.language-switcher select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'zh'); select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()");
  await waitFor("document.documentElement.lang.startsWith('zh')");
  const manual = await evaluate(`(${read})()`);
  assert.equal(manual.lang, 'zh');
  assert.equal(manual.rubleZero, false);
  assert.ok(manual.promise.includes('¥'));
  await evaluate("(() => { history.replaceState({},'', '/xray/'); return localStorage.getItem('baiagent.uiLanguage'); })()");
  await call('cdp', { method: 'Page.reload', params: { ignoreCache: true } });
  await waitFor("document.querySelector('.promises') && document.documentElement.lang.startsWith('zh')");
  const reloaded = await evaluate(`(${read})()`);
  assert.deepEqual(reloaded, manual, 'CNY и китайский язык должны сохраниться после перезагрузки');
  await call('screenshot', { format: 'png', path: path.join(output, 'xray-zh-manual-reloaded.png') });
  results.push({ language: 'ru→zh→reload', ...reloaded });
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ conclusion: 'success', results }, null, 2));
  console.log('PRODUCTION_XRAY_CURRENCY_VALIDATION_PASSED');
} finally {
  await call('cdp', { method: 'Emulation.clearDeviceMetricsOverride', params: {} }).catch(() => {});
}
