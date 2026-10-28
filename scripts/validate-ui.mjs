import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createEvidenceBasedFallback } from '../shared/fallback.js';

const now = new Date().toISOString();
const image = label => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="50%" y="52%" text-anchor="middle" font-family="Arial" font-size="22" fill="#2468a2">${label}</text></svg>`)}`;
const sources = [
  { id: 'site-1', kind: 'company-site', companyName: 'АгроТех', url: 'https://agrotech.example/', title: 'АгроТех', contentOrigin: 'full-page', retrievedAt: now, text: 'Производим сельскохозяйственную технику и поставляем запасные части для farms. Трактор А-100 — 1 250 000 ₽. Культиватор К-40 — 380 000 ₽. Плуг П-12 — 95 000 ₽. Сервисный осмотр техники. Публикуем цены и условия заказа. Связаться с менеджером можно по почте sales@agrotech.example.' },
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
  requestedUrl: 'https://agrotech.example/', companyName: 'АгроТех', companyLogo: null, sources, offerings,
  reviews: [{ sourceId: 'web-2', sourceTitle: 'Отзывы об АгроТех', url: sources[2].url, quote: sources[2].text }],
  competitors: [{ name: 'ТехноПоле', sourceId: 'web-1', sourceTitle: 'ТехноПоле', url: sources[1].url, quote: sources[1].text }],
  news: [{ sourceId: 'web-4', title: sources[4].title, sourceTitle: sources[4].title, url: sources[4].url, quote: sources[4].text, publishedAt: now }],
  alternatives: [], marketContext: { industry: 'manufacturing', subject: 'сельскохозяйственная техника' }, warnings: [], createdAt: now,
};
const response = { research, analysis: createEvidenceBasedFallback(sources, research.requestedUrl, research) };
assert.ok(response.analysis.opportunities.length > 0, 'Fixture must produce opportunities');

await mkdir('validation', { recursive: true });
const mode = process.env.UI_MODE === 'enterprise' ? 'enterprise' : 'advisor';
const target = process.env.UI_TARGET === 'production' ? 'production' : 'development';
const serverArgs = ['node_modules/vite/bin/vite.js'];
if (target === 'production') serverArgs.push('preview', '--outDir', mode === 'enterprise' ? 'dist-enterprise' : 'dist-advisor');
serverArgs.push('--host', '127.0.0.1', '--port', '7100', '--strictPort');
if (target === 'production' || mode === 'enterprise') serverArgs.push('--mode', mode);
const appUrl = `http://127.0.0.1:7100${target === 'production' ? '/advisor/' : '/'}`;
const server = spawn(process.execPath, serverArgs, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
let browser;
const screenshot = name => `validation/${mode}-${target}-${name}.png`;
const noOverflow = async (page, label) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, label);
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { const result = await fetch(appUrl); if (result.ok) { ready = true; break; } } catch { /* Vite is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Vite did not start: ${serverLog}`);
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://baiagent.ru/xray/api/research.php**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(research) }));
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('#company-url').fill('agrotech.example');
  await page.getByRole('button', { name: /Разобрать мой бизнес|Провести аудит бесплатно/ }).click();
  await page.locator('.result-dashboard').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.market-radar-grid > button').count(), 5);
  assert.equal(await page.locator('.opportunity-categories [role="tab"]').count(), 3);
  assert.equal(await page.locator('.offering-card img').count(), 4);
  assert.ok(await page.locator('.offering-card img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), 'Offering images must load');
  await noOverflow(page, 'Desktop horizontal overflow');
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshot('desktop'), fullPage: true });

  await page.getByRole('button', { name: 'План и доказательства' }).click();
  await page.locator('.audit-contract').waitFor();
  await page.locator('.audit-acceptance summary').click();
  assert.equal(await page.locator('.audit-acceptance-cases article').count(), 6);
  assert.equal(await page.locator('.audit-controls article').count(), 4);
  const contract = await page.locator('.audit-contract').textContent();
  for (const text of ['Что потребуется', 'Кто отвечает', 'Граница автономности', 'Сначала более простое решение', 'Подтверждение человеком', 'Trace и наблюдаемость', 'Stop и rollback']) assert.ok(contract.includes(text), `Missing audit contract section: ${text}`);
  assert.match(await page.locator('.pilot-blueprint').textContent(), /Целевое значение согласовать после исходного замера/);
  assert.match(await page.locator('.pilot-blueprint').textContent(), /Остановить/);
  assert.match(await page.locator('.pilot-blueprint').textContent(), /Масштабировать/);
  await noOverflow(page, 'Desktop audit drawer horizontal overflow');
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshot('audit-desktop'), fullPage: true });
  await page.getByRole('button', { name: 'Закрыть' }).click();

  await page.locator('.agent-inline button').click();
  if (mode === 'enterprise') {
    await page.locator('.enterprise-panel').waitFor();
  } else {
    await page.locator('.native-onboarding').waitFor();
    assert.match(await page.locator('.native-onboarding').textContent(), /Последующее внедрение и абонентская плата — по прайсу/);
    assert.match(await page.locator('.native-onboarding').textContent(), /ничего не отправится автоматически/);
    assert.equal(await page.locator('.onboarding-primary').textContent(), 'Подключить за 0 ₽');
  }
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await page.locator('.enterprise-entry').click();
  await page.locator('.enterprise-panel').waitFor();
  assert.equal(await page.locator('.enterprise-panel__primary-action').getAttribute('href'), 'https://balanov.pro/ai-audit#lead-form');
  assert.match(await page.locator('.enterprise-panel__primary-action').getAttribute('target'), /_blank/);
  assert.match(await page.locator('.enterprise-panel').textContent(), /₽/);
  assert.match(await page.locator('.enterprise-panel').textContent(), /Бесплатный аудит процессов/);
  assert.match(await page.locator('.enterprise-panel').textContent(), /не обещается/);
  assert.equal(await page.locator('.enterprise-panel__architecture article').count(), 5);
  await noOverflow(page, 'Desktop enterprise horizontal overflow');
  await page.waitForTimeout(500);
  const processLayout = await page.locator('.enterprise-panel__process-card').evaluate(card => ({ card: card.getBoundingClientRect().width, main: card.querySelector('.enterprise-panel__process-main').getBoundingClientRect().width, title: card.querySelector('h4').getBoundingClientRect().width, display: getComputedStyle(card).display, columns: getComputedStyle(card).gridTemplateColumns }));
  console.log('Enterprise process layout:', JSON.stringify(processLayout));
  assert.ok(processLayout.main > processLayout.card * 0.5, `Desktop enterprise process is squeezed: ${JSON.stringify(processLayout)}`);
  await page.screenshot({ path: screenshot('enterprise-desktop'), fullPage: false });
  await page.locator('.enterprise-panel__primary-action').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshot('enterprise-desktop-bottom'), fullPage: false });
  await page.getByRole('button', { name: 'Закрыть' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await noOverflow(page, 'Mobile horizontal overflow');
  await page.waitForTimeout(500);
  assert.ok(await page.locator('.offering-card img').evaluateAll(images => images.every(image => {
    const rect = image.getBoundingClientRect();
    return image.complete && image.naturalWidth > 0 && rect.width >= 100 && rect.height >= 60;
  })), 'Mobile offering images must be visible, not merely loaded');
  await page.screenshot({ path: screenshot('mobile'), fullPage: true });
  await page.getByRole('button', { name: 'План и доказательства' }).click();
  await page.locator('.audit-acceptance summary').click();
  await noOverflow(page, 'Mobile audit drawer horizontal overflow');
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshot('audit-mobile'), fullPage: false });
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await page.locator('.enterprise-entry').click();
  await page.locator('.enterprise-panel').waitFor();
  await noOverflow(page, 'Mobile enterprise horizontal overflow');
  await page.waitForTimeout(500);
  const mobileProcessLayout = await page.locator('.enterprise-panel__process-card').evaluate(card => ({ card: card.getBoundingClientRect().width, main: card.querySelector('.enterprise-panel__process-main').getBoundingClientRect().width }));
  assert.ok(mobileProcessLayout.main > mobileProcessLayout.card * 0.75, `Mobile enterprise process is squeezed: ${JSON.stringify(mobileProcessLayout)}`);
  await page.screenshot({ path: screenshot('enterprise-mobile'), fullPage: false });
  await page.locator('.enterprise-panel__primary-action').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshot('enterprise-mobile-bottom'), fullPage: false });
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ status: 'ok', mode, target, desktop: '1440x900', mobile: '390x844', radarCards: 5, offeringImages: 4, acceptanceCases: 6, enterpriseArchitecture: 5, onboarding: mode === 'advisor', horizontalOverflow: false, browserErrors: errors.length }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
  await new Promise(resolve => server.once('exit', resolve));
}
