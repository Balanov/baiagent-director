import { describe, expect, it } from 'vitest';
import { competitorNameFrom, createMarketSearchPlan, isCompetitorCandidate, isRelevantIndustryEvidence, isRelevantMarketNews } from '../shared/market-plan.js';
import { answerAdvisor, createMarketIntelligence } from '../shared/advisor.js';
import { advisorPrompt, parseAdvisorResponse } from '../electron/advisor-context.mjs';
import { createBusinessProfile } from '../shared/business.js';

const own = { id: 'site-1', kind: 'company-site', url: 'https://soap.example/', title: 'Мыловар', text: 'Собственное производство мыла. Изготавливаем хозяйственное мыло для оптовых покупателей.' };
const profile = { industry: { id: 'manufacturing' } };

describe('market intelligence plan', () => {
  it('uses the actual product instead of the company name and generic industry', () => {
    const plan = createMarketSearchPlan({ sources: [own] }, profile);
    expect(plan.subject).toBe('мыло');
    expect(plan.competitorQueries[0]).toContain('мыло производитель поставщик');
    expect(plan.competitorQueries.join(' ')).not.toContain('Мыловар');
  });
  it('accepts a relevant direct manufacturer and rejects an aggregator', () => {
    const plan = createMarketSearchPlan({ sources: [own] }, profile);
    const direct = { title: 'Фабрика мыла — производство и опт', url: 'https://factory.example/', text: 'Производим натуральное мыло и поставляем продукцию оптом.' };
    expect(isCompetitorCandidate(direct, plan, own.url)).toBe(true);
    expect(isCompetitorCandidate({ ...direct, url: 'https://optsbyt.ru/catalog' }, plan, own.url)).toBe(false);
    expect(isCompetitorCandidate({ ...direct, title: '120 поставщиков мыла в России' }, plan, own.url)).toBe(false);
    expect(isCompetitorCandidate({ ...direct, title: 'Косметика без мыла' }, plan, own.url)).toBe(false);
    const catalog = { title: 'Мыло оптом — каталог и цены', url: 'https://supplier-catalog.example/', text: 'Каталог натурального мыла по выгодной цене. Купить оптом с доставкой.' };
    expect(isCompetitorCandidate(catalog, plan, own.url)).toBe(true);
    expect(isCompetitorCandidate({ ...catalog, url: 'https://www.ozon.ru/category/soap' }, plan, own.url)).toBe(false);
  });
  it('keeps only fresh subject-relevant market news', () => {
    const plan = createMarketSearchPlan({ sources: [own] }, profile);
    const fresh = new Date(Date.now() - 86400000).toUTCString();
    const old = new Date(Date.now() - 600 * 86400000).toUTCString();
    const item = { title: 'Производители мыла обсуждают сырьё', text: 'Рынок мыла и производство в России.', publishedAt: fresh };
    expect(isRelevantMarketNews(item, plan)).toBe(true);
    expect(isRelevantMarketNews({ ...item, publishedAt: old }, plan)).toBe(false);
    expect(isRelevantMarketNews({ ...item, title: 'Рынок металла', text: 'Производство стали выросло.' }, plan)).toBe(false);
  });
  it('does not let unrelated steel text change a cybersecurity market', () => {
    const source = { ...own, text: 'Кибербезопасность для бизнеса. В новости упомянута металлопродукция и сталь.' };
    const plan = createMarketSearchPlan({ sources: [source] }, { industry: { id: 'cybersecurity' } });
    expect(plan.subject).toBe('кибербезопасность');
  });
  it('uses independent company mentions when the homepage has no readable text', () => {
    const emptyOwn = { ...own, text: '' };
    const mention = { id: 'web-1', kind: 'search-snippet', title: 'СДЭК', text: 'Логистический оператор доставки документов и грузов для бизнеса.', url: 'https://encyclopedia.example/cdek' };
    const plan = createMarketSearchPlan({ sources: [emptyOwn, mention] }, { industry: { id: 'logistics' } });
    expect(plan.subject).toBe('доставка для бизнеса');
    expect(plan.competitorQueries[0]).toContain('логистика');
  });
  it('decodes competitor brands and never reduces a company name to its legal form', () => {
    expect(competitorNameFrom({ siteName: '&#1044;&#1086;&#1089;&#1090;&#1072;&#1074;&#1080;&#1089;&#1090;&#1072;' })).toBe('Достависта');
    expect(competitorNameFrom({ title: 'ООО Логистика Запад - Доставка для бизнеса', url: 'https://log-zapad.ru/' })).toBe('Логистика Запад');
    expect(competitorNameFrom({ title: 'Логистика для бизнеса - аутсорсинг', url: 'https://www.dellin.ru/' })).toBe('DELLIN');
    expect(competitorNameFrom({ title: 'SearchInform: информационная безопасность предприятия', url: 'https://searchinform.ru/' })).toBe('SearchInform');
    expect(competitorNameFrom({ title: 'CH', url: 'https://ch.rusles-35.ru/catalog/' })).toBe('rusles-35');
    expect(competitorNameFrom({ title: 'WWW', url: 'https://www.supplier.ru/' })).toBe('supplier');
    expect(competitorNameFrom({ title: 'Розжиг', url: 'https://yarmaco.ru/' })).toBe('YARMACO');
  });
  it('recognises a specific service market and creates independent evidence queries', () => {
    const source = { ...own, text: 'Стоматологическая клиника. Лечение зубов, имплантация и протезирование для частных клиентов.' };
    const plan = createMarketSearchPlan({ sources: [source] }, { industry: { id: 'healthcare' } });
    expect(plan.subject).toBe('стоматологические услуги');
    expect(plan.competitorQueries[0]).toContain('стоматологические услуги компания');
    expect(plan.evidenceQueries.map(item => item.kind)).toEqual(['industry-snippet', 'customer-snippet', 'market-price-snippet']);
  });
  it('keeps industry, customer and price evidence in separate relevant contours', () => {
    const plan = createMarketSearchPlan({ sources: [own] }, profile);
    const industry = { title: 'Рынок мыла: динамика спроса', text: 'Исследование рынка мыла показывает изменение спроса и объёма производства.' };
    const customers = { title: 'Как выбрать мыло', text: 'Покупатели мыла обращают внимание на состав, качество и отзывы клиентов.' };
    const prices = { title: 'Цены на мыло', text: 'Сравнение стоимости мыла и тарифов поставщиков за упаковку.' };
    expect(isRelevantIndustryEvidence(industry, plan, 'industry-snippet')).toBe(true);
    expect(isRelevantIndustryEvidence(customers, plan, 'customer-snippet')).toBe(true);
    expect(isRelevantIndustryEvidence(prices, plan, 'market-price-snippet')).toBe(true);
    expect(isRelevantIndustryEvidence({ title: 'Рынок стали', text: 'Динамика спроса на сталь и объём производства металлопроката.' }, plan, 'industry-snippet')).toBe(false);
  });
  it('recognises a law firm instead of treating bankruptcy and credit mentions as banking', () => {
    const source = { ...own, title: 'Адвокатское бюро', text: 'Юридические услуги и правовая поддержка бизнеса. Практики: разрешение споров, банкротство, сопровождение кредитных сделок и налоговое консультирование.' };
    const result = createBusinessProfile({ companyName: 'Адвокатское бюро', sources: [source] });
    expect(result.industry.id).toBe('professional');
    const plan = createMarketSearchPlan({ sources: [source] }, result);
    expect(plan.subject).toBe('юридические услуги');
    expect(plan.competitorQueries[0]).toContain('юридические услуги');
  });
});

describe('evidence-based advisor', () => {
  const research = {
    companyName: 'Мыловар', sources: [own, { id: 'web-1', kind: 'competitor-candidate', url: 'https://factory.example/', title: 'Фабрика', text: 'Производим мыло оптом.' }, { id: 'web-2', kind: 'review-snippet', url: 'https://reviews.example/', title: 'Отзывы', text: 'Рейтинг 4,6. 128 отзывов. Клиенты отмечают качество и доставку.' }],
    offerings: [], competitors: [{ name: 'Фабрика', url: 'https://factory.example/', sourceId: 'web-1', sourceTitle: 'Фабрика', quote: 'Производим мыло оптом.' }],
    reviews: [{ sourceId: 'web-2', sourceTitle: 'Отзывы', url: 'https://reviews.example/', quote: 'Рейтинг 4,6. 128 отзывов. Клиенты отмечают качество и доставку.' }],
  };
  it('answers from the competitor contour even without comparable offerings', () => {
    const answer = answerAdvisor('Кто конкуренты?', research);
    expect(answer.answer).toContain('Фабрика');
    expect(answer.citations[0].sourceId).toBe('web-1');
  });
  it('surfaces ratings, review counts and experience themes', () => {
    const market = createMarketIntelligence(research);
    expect(market.reviews[0]).toMatchObject({ rating: '4,6', count: 128 });
    expect(market.reviews[0].themes).toEqual(expect.arrayContaining(['качество', 'доставка']));
    expect(answerAdvisor('Что в отзывах?', research).answer).toContain('128 отзывов');
  });
  it('does not use reviews from another product sector as software-company evidence', () => {
    const software = {
      companyName: 'Example Software', requestedUrl: 'https://software.example/',
      sources: [{ id: 'site-soft', kind: 'company-site', url: 'https://software.example/', title: 'Example Software', text: 'Разработчик программного обеспечения. Облачная платформа для совместной работы.' }],
      offerings: [{ name: 'Team Cloud', sourceId: 'site-soft', quote: 'Облачная платформа Team Cloud.' }],
      reviews: [
        { sourceId: 'web-washing', sourceTitle: 'Example Software — стиральные машины', quote: '12 отзывов о стиральной машине. Покупатели оценивают качество стирки.', url: 'https://reviews.example/washing' },
        { sourceId: 'web-team', sourceTitle: 'Team Cloud — отзывы', quote: '18 отзывов. Используем Team Cloud для совместной работы.', url: 'https://reviews.example/team' },
      ],
    };
    const market = createMarketIntelligence(software);
    expect(market.reviews.map(item => item.sourceId)).toEqual(['web-team']);
  });
  it('does not compare prices of unrelated products', () => {
    const priced = { ...research, offerings: [{ name: 'Мыло А', price: '100 ₽', sourceId: 'site-1' }], alternatives: [{ name: 'Шампунь Б', offeringName: 'Шампунь Б', price: '500 ₽', sourceId: 'web-1' }] };
    expect(createMarketIntelligence(priced).priceComparisons).toHaveLength(0);
  });
  it('builds a bounded dialogue prompt and accepts only real source markers', () => {
    const prompt = advisorPrompt({ question: 'Что делать?', history: [{ role: 'user', text: 'Расскажи о рынке' }], research });
    expect(prompt).toContain('ПРЕДЫДУЩИЙ ДИАЛОГ');
    expect(prompt).toContain('Фабрика');
    const parsed = parseAdvisorResponse('Проверьте фабрику [[web-1]] и выдуманный источник [[fake]].', research);
    expect(parsed.answer).not.toContain('[[');
    expect(parsed.citations).toHaveLength(1);
    expect(parsed.citations[0].sourceId).toBe('web-1');
  });
  it('always keeps user documents ahead of market sources in the local advisor context', () => {
    const local = { id: 'local-1', kind: 'local-document', title: 'План пилота.txt', url: 'local://pilot.txt', text: 'Медианное время первого содержательного ответа — исходная метрика пилота.' };
    const crowdedResearch = {
      ...research,
      sources: [...research.sources, ...Array.from({ length: 12 }, (_, index) => ({ ...own, id: `site-${index + 2}`, title: `Страница ${index + 2}` })), local],
      news: Array.from({ length: 6 }, (_, index) => ({ sourceId: `site-${index + 2}` })),
    };
    const prompt = advisorPrompt({ question: 'Как учесть добавленный документ в пилоте?', research: crowdedResearch });
    expect(prompt).toContain('local-1');
    expect(prompt).toContain('План пилота.txt');
    expect(prompt).toContain('Медианное время первого содержательного ответа');
    const sourceContext = prompt.slice(prompt.indexOf('"sources":'));
    expect(sourceContext.indexOf('local-1')).toBeLessThan(sourceContext.indexOf('web-1'));
  });
  it('renders clean text and does not attach market citations to product explanations', () => {
    const parsed = parseAdvisorResponse('**Документы** обрабатываются локально [[web-1]].', research, null, 'А как именно это сработает с моими документами?');
    expect(parsed.answer).toBe('Документы обрабатываются локально.');
    expect(parsed.citations).toHaveLength(0);
  });
  it('keeps relevant evidence for a business question', () => {
    const parsed = parseAdvisorResponse('Сравните условия [[web-1]].', research, null, 'Что известно о конкурентах?');
    expect(parsed.citations[0]).toMatchObject({ sourceId: 'web-1', url: 'https://factory.example/' });
  });
  it('accepts structured answers only with verbatim evidence', () => {
    const parsed = parseAdvisorResponse(JSON.stringify({
      answer: 'Подтверждено собственное производство мыла.',
      citations: [{ sourceId: 'site-1', quote: 'Собственное производство мыла.' }],
    }), research, null, 'Что производит компания?');
    expect(parsed.answer).toBe('Подтверждено собственное производство мыла.');
    expect(parsed.citations[0]).toMatchObject({ sourceId: 'site-1', quote: 'Собственное производство мыла.' });
    const fabricated = parseAdvisorResponse(JSON.stringify({
      answer: 'Компания предлагает бронирование и доставку.',
      citations: [{ sourceId: 'site-1', quote: 'Бронирование и бесплатная доставка.' }],
    }), research, null, 'Что предлагает компания?');
    expect(fabricated.citations).toEqual([]);
  });
});
