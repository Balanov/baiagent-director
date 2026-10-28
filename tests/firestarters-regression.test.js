import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companySearchName, isRelevantSearchResult, isReviewMaterial, parsePage } from '../electron/research.mjs';
import { competitorNameFrom, createMarketSearchPlan, isCompetitorCandidate, isRelevantMarketNews, marketSubject } from '../shared/market-plan.js';

const catalogHtml = readFileSync(new URL('./fixtures/firestarters-catalog.html', import.meta.url), 'utf8');

function researchWithCatalog() {
  const catalog = parsePage(catalogHtml, 'https://firestarters.ru/catalog/', 'site-catalog');
  return {
    companyName: 'ООО «Имидж-Боровичи»',
    offerings: catalog.offerings,
    sources: [{ ...catalog, text: `${catalog.text} упаковка упаковка упаковка упаковка` }],
  };
}

describe('firestarters.ru regression', () => {
  it('extracts the real catalog cards and their own images', () => {
    const research = researchWithCatalog();
    expect(research.offerings.map(item => item.name)).toEqual(expect.arrayContaining(['Спички', 'Древесные роллы', 'Древесные брикеты']));
    expect(research.offerings).toHaveLength(11);
    for (const item of research.offerings) {
      expect(item.image).toMatch(/^https:\/\/firestarters\.ru\//);
      expect(item.image).not.toMatch(/placeholder|1x1/i);
    }
  });

  it('prioritizes actual products over incidental packaging copy', () => {
    const research = researchWithCatalog();
    const profile = { industry: { id: 'manufacturing' } };
    expect(marketSubject(research, profile)).toEqual({ industry: 'manufacturing', subject: 'товары для розжига' });
    const plan = createMarketSearchPlan(research, profile);
    expect(plan.competitorQueries[0]).toContain('товары для розжига');
    expect(isRelevantMarketNews({ title: 'ВАРПЭ: Рыбный рынок и упаковка', text: 'Рыбный рынок, аптечный рынок и биопластик.', publishedAt: new Date().toISOString() }, plan)).toBe(false);
  });

  it('searches by the distinctive company name without the legal form', () => {
    expect(companySearchName('ООО «Имидж-Боровичи»')).toBe('Имидж-Боровичи');
    expect(isRelevantSearchResult({ url: 'https://example.org/company', title: 'Имидж-Боровичи', text: 'Сведения о производителе' }, 'https://firestarters.ru/', 'ООО «Имидж-Боровичи»')).toBe(true);
  });

  it('keeps direct suppliers and industry news but rejects marketplaces and metaphors', () => {
    const plan = createMarketSearchPlan(researchWithCatalog(), { industry: { id: 'manufacturing' } });
    const supplier = { title: 'Средства для розжига оптом', url: 'https://supplier.example/catalog', text: 'Каталог средств для розжига и спичек. Купить оптом по цене поставщика.' };
    expect(isCompetitorCandidate(supplier, plan, 'https://firestarters.ru/')).toBe(true);
    expect(isCompetitorCandidate({ ...supplier, url: 'https://www.ozon.ru/category/rozzhig' }, plan, 'https://firestarters.ru/')).toBe(false);
    const fresh = new Date().toISOString();
    expect(isRelevantMarketNews({ title: 'Кыргызстан может наладить собственное производство спичек', text: 'Новое производство спичек.', publishedAt: fresh }, plan)).toBe(true);
    expect(isRelevantMarketNews({ title: 'Военные заводы Европы горят как спички', text: 'Военные заводы горят как спички.', publishedAt: fresh }, plan)).toBe(false);
  });

  it('rejects Avito, own IMAGE products and brand analytics instead of padding the evidence', () => {
    const research = researchWithCatalog();
    research.sources[0].title = 'Производство спичек и средств для розжига в России - IMAGE';
    const plan = createMarketSearchPlan(research, { industry: { id: 'manufacturing' } });
    const supplier = { title: 'Спички для пикника 30 шт Image', url: 'https://trofey.ru/catalog/spichki_image/', text: 'Спички для пикника 30 шт Image. Купить товар для розжига по цене интернет-магазина.' };
    expect(plan.ownAliases).toContain('IMAGE');
    expect(isCompetitorCandidate(supplier, plan, 'https://firestarters.ru/')).toBe(false);
    expect(isCompetitorCandidate({ ...supplier, title: 'Спички и средства для розжига', text: 'Купить спички и средства для розжига по цене продавца.', url: 'https://www.avito.ru/catalog/rozzhig' }, plan, 'https://firestarters.ru/')).toBe(false);
    expect(isReviewMaterial({ title: 'Аналитика, продажи бренда', url: 'https://wildbox.ru/brand-analytics/image', text: 'Средняя оценка товаров и 0 отзывов. Объём продаж бренда за неделю.' })).toBe(false);
  });

  it('uses real base brands instead of CH, WWW and generic category names', () => {
    expect(competitorNameFrom({ title: 'CH', url: 'https://ch.rusles-35.ru/catalog/' })).toBe('rusles-35');
    expect(competitorNameFrom({ title: 'WWW', url: 'https://www.supplier.ru/' })).toBe('supplier');
    expect(competitorNameFrom({ title: 'Розжиг', url: 'https://yarmaco.ru/' })).toBe('YARMACO');
  });
});
