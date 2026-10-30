import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.UI_PLAYWRIGHT_MODULE || 'playwright');
import { createEvidenceBasedFallback } from '../shared/fallback.js';

const now = new Date().toISOString();
const image = label => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="100%" height="100%" rx="24" fill="#eaf3ff"/><text x="50%" y="52%" text-anchor="middle" font-family="Arial" font-size="32" fill="#2468a2">${label}</text></svg>`)}`;
const sources = [
  { id: 'site-1', kind: 'company-site', companyName: 'АгроТех', url: 'https://agrotech.example/', title: 'АгроТех', contentOrigin: 'full-page', retrievedAt: now, text: 'Производим сельскохозяйственную технику и поставляем запасные части. Трактор А-100 — 1 250 000 ₽. Культиватор К-40 — 380 000 ₽. Плуг П-12 — 95 000 ₽. Сервисный осмотр техники. Публикуем цены и условия заказа. Связаться с менеджером можно по почте sales@agrotech.example.' },
  { id: 'web-1', kind: 'competitor-candidate', url: 'https://competitor.example/', title: 'ТехноПоле', contentOrigin: 'full-page', retrievedAt: now, text: 'Производим сельскохозяйственную технику и поставляем оборудование для farms.' },
  { id: 'web-2', kind: 'review-snippet', url: 'https://reviews.example/agrotech', title: 'Отзывы об АгроТех', contentOrigin: 'search-snippet', retrievedAt: now, text: 'АгроТех: рейтинг 4,6 из 5. 28 отзывов. Клиенты отмечают качество и доставку.' },
  { id: 'web-3', kind: 'search-snippet', url: 'https://news.example/agrotech-partner', title: 'АгроТех расширил партнёрскую сеть', contentOrigin: 'full-page', retrievedAt: now, text: 'АгроТех расширил партнёрскую сеть и рассказал о поставках клиентам в новых регионах.' },
  { id: 'web-4', kind: 'news-snippet', url: 'https://industry.example/equipment', title: 'Производители техники обсуждают спрос', contentOrigin: 'search-snippet', retrievedAt: now, publishedAt: now, text: 'Производители сельскохозяйственной техники обсуждают спрос и поставки комплектующих.' },
];
const offerings = [
  { name: 'Трактор А-100', kind: 'product', price: '1 250 000 ₽', image: image('А-100'), quote: 'Трактор А-100 — 1 250 000 ₽', sourceId: 'site-1', sourceTitle: 'АгроТех', url: 'https://agrotech.example/a100' },
  { name: 'Культиватор К-40', kind: 'product', price: '380 000 ₽', image: image('К-40'), quote: 'Культиватор К-40 — 380 000 ₽', sourceId: 'site-1', sourceTitle: 'АгроТех', url: 'https://agrotech.example/k40' },
  { name: 'Плуг П-12', kind: 'product', price: '95 000 ₽', image: image('П-12'), quote: 'Плуг П-12 — 95 000 ₽', sourceId: 'site-1', sourceTitle: 'АгроТех', url: 'https://agrotech.example/p12' },
  { name: 'Сервисный осмотр', kind: 'service', price: null, image: image('Сервис'), quote: 'Сервисный осмотр техники', sourceId: 'site-1', sourceTitle: 'АгроТех', url: 'https://agrotech.example/service' },
];
const research = {
  requestedUrl: 'https://agrotech.example/', companyName: 'АгроТех', companyLogo: image('АгроТех'), sources, offerings,
  reviews: [{ sourceId: 'web-2', sourceTitle: 'Отзывы об АгроТех', url: sources[2].url, quote: sources[2].text }],
  competitors: [{ name: 'ТехноПоле', sourceId: 'web-1', sourceTitle: 'ТехноПоле', url: sources[1].url, quote: sources[1].text }],
  news: [{ sourceId: 'web-4', title: sources[4].title, sourceTitle: sources[4].title, url: sources[4].url, quote: sources[4].text, publishedAt: now }],
  alternatives: [], marketContext: { industry: 'manufacturing', subject: 'сельскохозяйственная техника' }, warnings: [], createdAt: now,
};
const response = { research, analysis: createEvidenceBasedFallback(sources, research.requestedUrl, research) };
assert.ok(response.analysis.opportunities.length > 0, 'Фикстура должна давать направления');

const mode = process.env.UI_MODE === 'enterprise' ? 'enterprise' : 'advisor';
const target = process.env.UI_TARGET === 'production' ? 'production' : 'development';
const basePath = mode === 'enterprise' ? '/ai-audit/' : target === 'production' ? '/advisor/' : '/';
const appUrl = `http://127.0.0.1:7100${basePath}`;
const serverArgs = ['node_modules/vite/bin/vite.js'];
if (target === 'production') serverArgs.push('preview', '--outDir', mode === 'enterprise' ? 'dist-enterprise' : 'dist-advisor');
serverArgs.push('--host', '127.0.0.1', '--port', '7100', '--strictPort');
if (target === 'production' || mode === 'enterprise') serverArgs.push('--mode', mode);
const server = spawn(process.execPath, serverArgs, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
let browser;
const screenshot = name => `validation/workspace-110/${mode}-${target}-${name}.png`;
await mkdir('validation/workspace-110', { recursive: true });
const checks = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const result = await fetch(appUrl); if (result.ok) { ready = true; break; } } catch { /* Vite ещё запускается. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Сервер проверки не запустился: ${serverLog}`);
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://baiagent.ru/xray/api/research.php**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(research) }));
  const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, label);
  const closeDrawer = async () => { await page.locator('.evidence-drawer').getByRole('button', { name: 'Закрыть', exact: true }).click(); };
  const step = async label => { await page.locator('.advisor-step-actions').getByRole('button', { name: label, exact: true }).click(); };
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  assert.match(await page.locator('body').textContent(), /1\.1\.0/);
  await page.locator('#company-url').fill('agrotech.example');
  await page.getByRole('button', { name: mode === 'enterprise' ? 'Провести аудит бесплатно' : 'Разобрать мой бизнес', exact: true }).click();
  await page.locator('.result-dashboard').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.audit-company-name h1').textContent(), 'АгроТех');
  assert.equal(await page.locator('.offering-card').count(), 4);
  assert.equal(await page.locator('.workspace-rail').count(), 0, 'На первом аудите меню скрыто');
  assert.ok(await page.locator('.offering-card img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), 'Изображения карточек должны загружаться');
  await noOverflow('Горизонтальное переполнение на десктопе');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('audit-desktop'), fullPage: true });
  checks.push('company-products-images');

  await page.getByRole('button', { name: 'Ещё о компании', exact: true }).click();
  await page.locator('.company-drawer-facts').waitFor();
  assert.match(await page.locator('.evidence-drawer').textContent(), /АгроТех/);
  await closeDrawer();
  await page.getByRole('button', { name: 'Все предложения', exact: true }).click();
  assert.equal(await page.locator('.drawer-offerings > article').count(), 4);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('offerings-desktop'), fullPage: true });
  await closeDrawer();
  await page.locator('.audit-footer-links').getByRole('button', { name: /Отзывы/ }).click();
  assert.match(await page.locator('.evidence-drawer').textContent(), /28 отзывов|4,6/);
  await closeDrawer();
  await page.locator('.audit-footer-links').getByRole('button', { name: /^\d+ источников$/ }).click();
  await page.getByRole('tab', { name: /Веб/ }).click();
  assert.ok(await page.locator('.drawer-sources > article').count() >= 4);
  await closeDrawer();
  checks.push('evidence-drawers');

  await page.getByRole('button', { name: 'Начать новый аудит компании', exact: true }).click();
  await page.locator('.new-audit-dialog').waitFor();
  assert.match(await page.locator('.new-audit-warning').textContent(), /удаляются безвозвратно/);
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  if (mode === 'advisor') {
    await page.getByRole('button', { name: 'Что продаёт компания?', exact: true }).click();
    assert.ok(await page.locator('.message-citations button').count() > 0, 'Ответ навигатора должен иметь цитату');
  }
  checks.push('new-audit-and-advisor');

  await page.locator('.audit-footer-links').getByRole('button', { name: /Документы/ }).click();
  await page.locator('.document-registry').waitFor();
  assert.equal(await page.locator('.document-empty').count(), 1, 'Нельзя имитировать несуществующие документы');
  const download = await page.locator('.document-actions a').getAttribute('href');
  assert.match(download, /1\.1\.0/);
  await noOverflow('Горизонтальное переполнение документов');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('documents-desktop'), fullPage: true });
  await page.locator('.rail-navigation').getByRole('button', { name: 'Аудит', exact: true }).click();
  checks.push('documents-and-rail');

  await step('Перейти к гипотезам');
  assert.equal(await page.locator('.direction-card').count(), 3);
  await page.locator('.direction-card').nth(1).click();
  assert.equal(await page.locator('.direction-card[aria-pressed="true"]').count(), 1);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('direction-desktop'), fullPage: true });
  await step('Перейти к плану');
  assert.ok(await page.locator('.plan-step-list > li').count() > 0);
  await page.locator('.workspace-inline-actions').getByRole('button', { name: 'План и доказательства', exact: true }).click();
  await page.locator('.audit-contract').waitFor();
  await page.locator('.audit-acceptance summary').click();
  assert.equal(await page.locator('.audit-acceptance-cases article').count(), 6);
  assert.equal(await page.locator('.audit-controls article').count(), 4);
  assert.match(await page.locator('.pilot-blueprint').textContent(), /Целевое значение согласовать после исходного замера/);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('plan-contract-desktop'), fullPage: true });
  await closeDrawer();
  await step('Перейти к пилоту');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('pilot-desktop'), fullPage: true });
  checks.push('direction-plan-pilot');

  await step('Подключить 0 руб.');
  if (mode === 'enterprise') {
    await page.locator('.enterprise-panel').waitFor();
    assert.match(await page.locator('.enterprise-panel').textContent(), /₽/);
    assert.match(await page.locator('.enterprise-panel').textContent(), /Бесплатный аудит процессов/);
    assert.equal(await page.locator('.enterprise-panel__architecture article').count(), 5);
  } else {
    await page.locator('.native-onboarding').waitFor();
    assert.match(await page.locator('.native-onboarding').textContent(), /Последующее внедрение и абонентская плата — по прайсу/);
    assert.match(await page.locator('.native-onboarding').textContent(), /ничего не отправится автоматически/);
    assert.equal(await page.locator('.onboarding-primary').textContent(), 'Подключить 0 руб.');
  }
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('connect-desktop'), fullPage: true });
  await closeDrawer();
  checks.push('zero-rubles-connect');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.rail-navigation').getByRole('button', { name: 'Аудит', exact: true }).click();
  await noOverflow('Горизонтальное переполнение на мобильном');
  const mobileImages = await page.locator('.offering-card img').evaluateAll(images => images.map(image => {
    const rect = image.getBoundingClientRect();
    return { loaded: image.complete && image.naturalWidth > 0, width: rect.width, height: rect.height };
  }));
  assert.ok(mobileImages.every(image => image.loaded && image.width >= 64 && image.height >= 60), `Мобильные изображения должны быть видимыми: ${JSON.stringify(mobileImages)}`);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('audit-mobile'), fullPage: true });
  await page.locator('.audit-footer-links').getByRole('button', { name: /Отзывы/ }).click();
  await noOverflow('Горизонтальное переполнение панели на мобильном');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: screenshot('reviews-mobile'), fullPage: false });
  await closeDrawer();
  assert.deepEqual(errors, [], `Ошибки браузера: ${errors.join('; ')}`);
  const report = { status: 'passed', mode, target, checkedAt: new Date().toISOString(), checks, offeringImages: 4, hypotheses: 3, acceptanceCases: 6, controls: 4, browserErrors: errors };
  await writeFile(`validation/workspace-110/${mode}-${target}-verification.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill();
  await exited;
}
