import { describe, expect, it } from 'vitest';
import { parseModelJson, verifyAnalysis, buildPilotPlan } from '../shared/verification.js';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { companyNameFrom, extractOfferings, isRelevantSearchResult, normalizeCompanyUrl, parsePage } from '../electron/research.mjs';
import { scanLocalFolder } from '../electron/files.mjs';
import { dedupeOfferings, extractPrice, verifyMarketItems } from '../shared/market.js';
import * as cheerio from 'cheerio';
import { AGENT_CATALOG, applicationUrl } from '../src/Ecosystem.jsx';
import fs from 'node:fs/promises';
import path from 'node:path';

const sources = [{ id: 'site-1', kind: 'company-site', url: 'https://example.com', title: 'Example', text: 'Мы производим мебель. Стоимость указана в прайс-листе. Менеджер отвечает на обращения.' }];
const opportunity = { title: 'Ускорить ответы', why: 'Проверяемая гипотеза', action: 'Подготовить пилот', metric: 'Время ответа', confidence: 'low', unknowns: ['Нет реальных обращений'], evidence: [{ sourceId: 'site-1', quote: 'Менеджер отвечает на обращения.' }] };

describe('evidence verification', () => {
  it('accepts an exact source quote', () => {
    const result = verifyAnalysis({ companyName: 'Example', summary: 'По источникам', opportunities: [opportunity] }, sources);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].evidence[0].url).toBe('https://example.com');
    expect(result.opportunities[0].status).toBe('hypothesis');
  });
  it('rejects a fabricated quote', () => {
    const fake = { ...opportunity, evidence: [{ sourceId: 'site-1', quote: 'Клиенты теряют миллионы каждый месяц.' }] };
    expect(verifyAnalysis({ opportunities: [fake] }, sources).opportunities).toHaveLength(0);
  });
  it('rejects an unknown source id', () => {
    const fake = { ...opportunity, evidence: [{ sourceId: 'unknown', quote: 'Менеджер отвечает на обращения.' }] };
    expect(verifyAnalysis({ opportunities: [fake] }, sources).opportunities).toHaveLength(0);
  });
  it.each([
    ['title', 'Экономия 42 процента'],
    ['why', 'Компания обрабатывает 100 задач'],
    ['action', 'Провести пилот на 100 задачах'],
    ['metric', 'Сократить время на 20 процентов'],
    ['unknowns', ['Проверить 50 документов']],
  ])('rejects unsupported numbers in %s', (field, value) => {
    const fake = { ...opportunity, [field]: value };
    expect(verifyAnalysis({ opportunities: [fake] }, sources).opportunities).toHaveLength(0);
  });
  it('does not treat digits inside a verified brand name as a numeric business claim', () => {
    const branded = { ...opportunity, title: 'Сравнить предложение с 100yuristov' };
    expect(verifyAnalysis({ opportunities: [branded] }, sources).opportunities).toHaveLength(1);
  });
  it('keeps the researched company name instead of a model-invented name', () => {
    const namedSources = [{ ...sources[0], companyName: 'baiagent' }];
    const result = verifyAnalysis({ companyName: 'OpenAI', opportunities: [opportunity] }, namedSources);
    expect(result.companyName).toBe('baiagent');
  });
  it('parses a fenced JSON response', () => {
    expect(parseModelJson('```json\n{"companyName":"Example"}\n```').companyName).toBe('Example');
  });
  it('builds a pilot from the selected verified opportunity', () => {
    const analysis = verifyAnalysis({ companyName: 'Example', opportunities: [opportunity] }, sources);
    const plan = buildPilotPlan(analysis, analysis.opportunities[0], sources);
    expect(plan).toContain('14 дней');
    expect(plan).toContain('https://example.com');
    expect(plan).toContain('проверяемая гипотеза');
  });
});

describe('fallback and URL handling', () => {
  it('creates only evidence-linked fallback opportunities', () => {
    const result = createEvidenceBasedFallback(sources, 'https://example.com');
    expect(result.opportunities.length).toBeGreaterThan(0);
    for (const item of result.opportunities) expect(item.evidence.length).toBeGreaterThan(0);
  });
  it('keeps the matching phrase inside a shortened evidence quote', () => {
    const longSource = [{ ...sources[0], text: `${'Описание компании. '.repeat(30)} Стоимость указана в прайс-листе. ${'Дополнительные сведения. '.repeat(20)}` }];
    const result = createEvidenceBasedFallback(longSource, 'https://example.com');
    expect(result.opportunities[0].evidence[0].quote).toMatch(/Стоимость указана в прайс-листе/);
  });
  it('does not attach unrelated evidence to fallback opportunities', () => {
    const priceOnly = [{ ...sources[0], text: 'Стоимость указана в прайс-листе компании.' }];
    const result = createEvidenceBasedFallback(priceOnly, 'https://example.com');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].title).toMatch(/стоимости/);
  });
  it('turns reviews into an operating hypothesis without presenting market signals as process proof', () => {
    const own = {
      id: 'site-furniture', kind: 'company-site', url: 'https://furniture.example/', title: 'Мебельная фабрика', companyName: 'Мебельная фабрика',
      text: 'Мы производим мебель для дома и бизнеса. Кресло «Атлант» имеет усиленный каркас и подходит для ежедневного использования.',
    };
    const customer = { id: 'market-customer', kind: 'customer-snippet', url: 'https://guide.example/furniture', title: 'Как выбрать кресло', text: 'Покупатели мебели сравнивают кресла по удобству, качеству материалов, гарантии и отзывам клиентов.' };
    const prices = { id: 'market-price', kind: 'market-price-snippet', url: 'https://market.example/furniture', title: 'Цены на кресла', text: 'Стоимость кресел зависит от материалов, комплектации, объёма заказа и условий доставки.' };
    const review = { id: 'review-1', kind: 'review-snippet', url: 'https://reviews.example/factory', title: 'Отзывы о фабрике', text: 'Клиенты отмечают качество мебели, но просят быстрее отвечать на вопросы о доставке.' };
    const offering = { name: 'Кресло «Атлант»', displayName: 'Кресло «Атлант»', sourceId: own.id, quote: 'Кресло «Атлант» имеет усиленный каркас и подходит для ежедневного использования.' };
    const result = createEvidenceBasedFallback([own, customer, prices, review], own.url, {
      companyName: own.companyName,
      offerings: [offering],
      reviews: [{ sourceId: review.id, sourceTitle: review.title, url: review.url, quote: review.text }],
    });
    const cost = result.opportunities.find(item => item.category === 'cost');
    const offeringHypothesis = result.opportunities.find(item => item.category === 'offering');
    expect(cost.title).toContain('отзывов');
    expect(cost.action).toContain('владелец');
    expect(cost.evidence[0].sourceId).toBe(review.id);
    expect(offeringHypothesis.why).toContain('критериям');
    expect(offeringHypothesis.evidence.every(item => item.sourceId === own.id)).toBe(true);
    expect(offeringHypothesis.processEvidence.status).toBe('industry-hypothesis');
    expect(offeringHypothesis.processEvidence.note).toContain('не как существующий порядок или проблема компании');
    expect(result.opportunities.every(item => !/рынок вырос|спрос вырос/i.test(`${item.why} ${item.action}`))).toBe(true);
  });
  it('normalizes a company domain', () => {
    expect(normalizeCompanyUrl('example.com')).toBe('https://example.com/');
  });
  it('rejects credentials and non-http protocols', () => {
    expect(() => normalizeCompanyUrl('https://user:pass@example.com')).toThrow();
    expect(() => normalizeCompanyUrl('file:///etc/passwd')).toThrow();
  });
  it('replaces a generic AI title with the actual site identity', () => {
    expect(companyNameFrom({ title: 'Ai — ИИ-агенты для вашего бизнеса' }, 'https://baiagent.ru/')).toBe('baiagent');
  });
  it('rejects generic AI search results and keeps company mentions', () => {
    const openAI = { title: 'OpenAI', url: 'https://openai.com/', text: 'Advanced AI research' };
    const mention = { title: 'BAIagent profile', url: 'https://example.org/company', text: 'Profile of baiagent.ru' };
    expect(isRelevantSearchResult(openAI, 'https://baiagent.ru/')).toBe(false);
    expect(isRelevantSearchResult(mention, 'https://baiagent.ru/')).toBe(true);
  });
});

describe('director evidence map and conversion', () => {
  it('accepts a sourced SWOT hypothesis and rejects a fabricated one', () => {
    const valid = { category: 'strength', title: 'Есть собственное производство', evidence: opportunity.evidence };
    const result = verifyAnalysis({ opportunities: [opportunity], swot: [valid] }, sources);
    expect(result.swot).toHaveLength(1);
    expect(result.swot[0].status).toBe('hypothesis');
    const fake = { ...valid, evidence: [{ sourceId: 'site-1', quote: 'У компании миллион довольных клиентов.' }] };
    expect(verifyAnalysis({ opportunities: [opportunity], swot: [fake] }, sources).swot).toHaveLength(0);
  });
  it('extracts a real product name and its price from the same card', () => {
    const $ = cheerio.load('<main><div class="product-card"><h3>Кресло «Атлант»</h3><span class="price">от 12 000 ₽</span></div></main>');
    const source = { id: 'site-2', title: 'Каталог', url: 'https://example.com/catalog/chair', text: $('body').text().replace(/\s+/g, ' ').trim() };
    const items = extractOfferings($, source, source.text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Кресло «Атлант»');
    expect(items[0].price).toBe('от 12 000 ₽');
    expect(verifyMarketItems(items, [source])).toHaveLength(1);
  });
  it('keeps the real variant in a reconstructed product name', () => {
    const $ = cheerio.load('<main><div class="product-card"><h3>72%</h3><p>Вес: 200 г</p><span class="price">120 ₽</span></div></main>');
    const source = { id: 'site-variant', title: 'Хозяйственное мыло — каталог', url: 'https://example.com/catalog/soap', text: $('body').text().replace(/\s+/g, ' ').trim() };
    const [item] = extractOfferings($, source, source.text);
    expect(item.variant).toBe('200 г');
    expect(item.displayName).toBe('Хозяйственное мыло 72% · 200 г');
  });
  it('prefers the main linked logo over a partner logo', () => {
    const page = parsePage('<html><head><title>Example</title></head><body><header><img class="header-promo" src="/assets/promo.png"><a href="/" class="logo"><img src="/assets/main-logo.svg"></a></header><main><div class="partners"><img class="partners__logo" src="/assets/partner.png"></div></main></body></html>', 'https://example.com/', 'site-logo');
    expect(page.logo).toBe('https://example.com/assets/main-logo.svg');
  });
  it('uses the tariff name instead of a promotional badge', () => {
    const $ = cheerio.load('<main><div class="product-card"><span class="title">Выбор клиентов</span><h3>Optimo</h3><span class="price">510 ₽</span></div></main>');
    const source = { id: 'site-badge', title: 'Тарифы', url: 'https://example.com/pricing', text: $('body').text().replace(/\s+/g, ' ').trim() };
    const items = extractOfferings($, source, source.text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Optimo');
    expect(items[0].price).toBe('510 ₽');
  });
  it('does not borrow a page-level price for an H1 offer', () => {
    const $ = cheerio.load('<main><h1>Тариф «Простой»</h1><section>Другая акция: 500 000 ₽</section></main>');
    const source = { id: 'site-3', title: 'Тариф', url: 'https://example.com/products/tariff', text: $('body').text().replace(/\s+/g, ' ').trim() };
    const items = extractOfferings($, source, source.text);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBeNull();
  });
  it('never invents a price or attaches a price from another card', () => {
    const marketSources = [{ ...sources[0], text: 'Кресло «Атлант». Диван «Лофт» — 45 000 ₽.' }];
    const valid = verifyMarketItems([{ name: 'Кресло «Атлант»', price: null, quote: 'Кресло «Атлант»', sourceId: 'site-1' }], marketSources);
    expect(valid[0].price).toBeNull();
    const wrong = verifyMarketItems([{ name: 'Кресло «Атлант»', price: '45 000 ₽', quote: 'Кресло «Атлант»', sourceId: 'site-1' }], marketSources);
    expect(wrong).toHaveLength(0);
  });
  it('deduplicates repeated offering cards and recognizes currency', () => {
    expect(extractPrice('Стоимость: от 1 250 000 ₽ за проект')).toBe('от 1 250 000 ₽');
    const items = dedupeOfferings([
      { name: 'Аудит продаж', price: null, quote: 'Аудит продаж — длинное описание' },
      { name: 'Аудит продаж', price: null, quote: 'Аудит продаж' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].quote).toBe('Аудит продаж');
  });
  it('removes an unpriced duplicate but preserves distinct real prices', () => {
    const items = dedupeOfferings([
      { name: 'Optimo', price: null, quote: 'Optimo' },
      { name: 'Optimo', price: '510 ₽', quote: 'Optimo 510 ₽' },
      { name: 'Optimo', price: '610 ₽', quote: 'Optimo 610 ₽' },
    ]);
    expect(items).toHaveLength(2);
    expect(items.map(item => item.price)).toEqual(['510 ₽', '610 ₽']);
  });
  it('keeps the three management recommendation categories', () => {
    const result = verifyAnalysis({ opportunities: [opportunity] }, sources);
    expect(['revenue', 'cost', 'offering']).toContain(result.opportunities[0].category);
  });
  it('does not show duplicate recommendation categories', () => {
    const repeated = { ...opportunity, title: 'Увеличить повторные продажи', category: 'revenue' };
    const result = verifyAnalysis({ opportunities: [opportunity, repeated] }, sources);
    expect(result.opportunities).toHaveLength(1);
    expect(new Set(result.opportunities.map(item => item.category)).size).toBe(result.opportunities.length);
  });
  it('keeps all 24 agents and prefills an unsubmitted application', () => {
    expect(AGENT_CATALOG).toHaveLength(24);
    const url = new URL(applicationUrl('ИИ-анализ отзывов', 'Пример', 'Разобрать отзывы', 'https://example.com'));
    expect(url.origin).toBe('https://baiagent.ru');
    expect(url.searchParams.get('director')).toBe('1');
    expect(url.searchParams.get('agent')).toBe('ИИ-анализ отзывов');
    expect(url.searchParams.get('task')).toBe('Разобрать отзывы');
  });
  it('scans only supported documents inside the chosen folder', async () => {
    const fixtures = path.join(process.cwd(), 'artifacts');
    await fs.mkdir(fixtures, { recursive: true });
    const folder = await fs.mkdtemp(path.join(fixtures, 'scan-'));
    try {
      await fs.mkdir(path.join(folder, 'work'));
      await fs.mkdir(path.join(folder, '.hidden'));
      await fs.writeFile(path.join(folder, 'work', 'process.txt'), 'Регламент обработки обращений клиентов.');
      await fs.writeFile(path.join(folder, 'work', 'notes.exe'), 'not a document');
      await fs.writeFile(path.join(folder, '.hidden', 'secret.txt'), 'must not be read');
      const scan = await scanLocalFolder(folder);
      expect(scan.totalSupported).toBe(1);
      expect(scan.filePaths).toHaveLength(1);
      expect(scan.filePaths[0]).toContain('process.txt');
    } finally {
      await fs.rm(folder, { recursive: true, force: true });
    }
  });
});

describe('company recognition and owner-level profile', () => {
  it('uses a short uppercase brand instead of a hostname', () => {
    expect(companyNameFrom({ title: 'www.cdek.ru' }, 'https://www.cdek.ru/')).toBe('CDEK');
  });
  it('rejects a descriptive slogan and prefers a structured company name', () => {
    expect(companyNameFrom({ title: 'Защитные решения кибербезопасности для дома и бизнеса' }, 'https://www.kaspersky.ru/')).toBe('kaspersky');
    expect(companyNameFrom({ title: 'Защитные решения кибербезопасности для дома и бизнеса | Лаборатория Касперского' }, 'https://www.kaspersky.ru/')).toBe('Лаборатория Касперского');
    const page = parsePage('<html><head><meta property="og:site_name" content="Лаборатория Касперского"><title>Защитные решения</title><script type="application/ld+json">{"@type":"Organization","name":"Kaspersky"}</script></head><body>Решения для бизнеса</body></html>', 'https://www.kaspersky.ru/', 'site-k');
    expect(page.organizationName).toBe('Kaspersky');
    expect(companyNameFrom(page, 'https://www.kaspersky.ru/')).toBe('Kaspersky');
  });
  it('keeps external mentions of a short company brand', () => {
    const item = { title: 'CDEK расширяет сеть', url: 'https://example.org/cdek', text: 'Новость о развитии CDEK' };
    expect(isRelevantSearchResult(item, 'https://www.cdek.ru/', 'CDEK')).toBe(true);
  });
  it('does not mistake a retailer with delivery for a logistics operator', () => {
    const own = { id: 'site-retail', kind: 'company-site', url: 'https://example.com', title: 'Магазин электроники', companyName: 'Магазин электроники', text: 'Купить электронику и бытовую технику с доставкой. Каталог товаров для покупателей и для бизнеса.' };
    const result = createEvidenceBasedFallback([own], own.url, { companyName: own.companyName });
    expect(result.profile.industry.id).toBe('retail');
  });
  it('builds an industry, audience and cited external risk without inventing facts', () => {
    const own = { id: 'site-cyber', kind: 'company-site', url: 'https://example.com', title: 'Example Security', companyName: 'Example Security', text: 'Мы разрабатываем решения для кибербезопасности и защиты данных для бизнеса. Продукт Security Control помогает контролировать защищённость.' };
    const external = { id: 'web-risk', kind: 'search-snippet', url: 'https://news.example/security', title: 'Новость', text: 'В новости сообщается о взломе Example Security. Расследование продолжается.' };
    const helping = { id: 'web-help', kind: 'search-snippet', url: 'https://news.example/help', title: 'Исследование', text: 'Example Security помогла расследовать взлом другой компании.' };
    const offering = { name: 'Security Control', displayName: 'Security Control', sourceId: own.id, url: own.url, sourceTitle: own.title, quote: 'Продукт Security Control помогает контролировать защищённость.', price: null };
    const result = createEvidenceBasedFallback([own, external, helping], own.url, { companyName: own.companyName, offerings: [offering] });
    expect(result.profile.industry.id).toBe('cybersecurity');
    expect(result.profile.segments.map(item => item.id)).toContain('business');
    expect(result.profile.risks).toHaveLength(1);
    expect(result.profile.risks[0].quote).toContain('взломе');
    expect(result.profile.risks[0].url).toBe(external.url);
    expect(result.summary).toContain('Security Control');
    expect(result.summary).toContain('кибербезопасности');
    expect(result.summary).not.toMatch(/^\d+ страниц/);
  });
});
