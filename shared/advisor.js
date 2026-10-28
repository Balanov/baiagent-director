import { createBusinessProfile } from './business.js';
import { createMarketSearchPlan, isCompetitorCandidate, isRelevantIndustryEvidence } from './market-plan.js';

export function offeringDisplayName(item = {}) {
  return String(item.displayName || item.name || 'Предложение').trim();
}

export function priceNumber(value = '') {
  const match = String(value).replace(/[\s\u00a0]/g, '').match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

export function money(value) {
  return Number.isFinite(value) ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽` : 'Цена не указана';
}

function reviewInsight(item) {
  const text = String(item.quote || '');
  const fusedRating = text.match(/([0-5][.,]\d)(\d{1,3})\s*оценок/i) || text.match(/([0-5][.,]\d)\s+(\d{1,3})\s*оценок/i);
  const rating = fusedRating?.[1] || text.match(/(?:рейтинг\s*)([0-5](?:[.,]\d)?)/i)?.[1] || text.match(/([0-5][.,]\d)\s*(?=из\s*5)/i)?.[1] || null;
  const count = text.match(/(\d+)\s*отзыв/i)?.[1] || null;
  const themes = [
    [/качеств/i, 'качество'], [/цен[аыуе]|стоимост/i, 'цены'], [/персонал|менеджер|сотрудник|сервис/i, 'сервис'],
    [/доставк|логистик|отгруз/i, 'доставка'], [/возврат|гарант/i, 'возвраты'],
  ].filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  return { ...item, rating, count: count ? Number(count) : null, themes };
}

function sameOffering(left, right) {
  const a = String(left || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const b = String(right || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return a.length >= 5 && b.length >= 5 && (a === b || a.includes(b) || b.includes(a));
}

export function createMarketIntelligence(research = {}) {
  const sources = research.sources || [];
  const offerings = research.offerings || sources.flatMap(source => source.offerings || []);
  const alternatives = research.alternatives || [];
  const reviews = (research.reviews || []).map(reviewInsight);
  const plan = createMarketSearchPlan(research, createBusinessProfile(research));
  const ownUrl = research.requestedUrl || sources.find(source => source.kind === 'company-site')?.url || '';
  const rawCompetitors = research.competitors || sources.filter(source => source.kind === 'competitor-candidate').map(source => ({ name: source.competitorName || source.title, url: source.url, sourceId: source.id, sourceTitle: source.title, quote: source.marketQuote || source.text?.slice(0, 420) }));
  const competitors = rawCompetitors.filter(item => {
    const source = sources.find(candidate => candidate.id === item.sourceId) || item;
    const candidate = { ...source, title: item.sourceTitle || source.title, text: source.text || item.quote, url: item.url || source.url };
    return isCompetitorCandidate(candidate, plan, ownUrl);
  });
  const news = (research.news || sources.filter(source => source.kind === 'news-snippet').map(source => ({ title: source.title, url: source.url, sourceId: source.id, sourceTitle: source.title, quote: source.text, publishedAt: source.publishedAt }))).sort((a, b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0));
  const evidenceFromKinds = kinds => sources.filter(source => kinds.includes(source.kind) && isRelevantIndustryEvidence(source, plan, source.kind)).map(source => ({ sourceId: source.id, url: source.url, sourceTitle: source.title, quote: String(source.text || '').slice(0, 900), kind: source.kind, contentOrigin: source.contentOrigin || 'search-snippet', retrievedAt: source.retrievedAt }));
  const industryEvidence = evidenceFromKinds(['industry-snippet']);
  const customerEvidence = evidenceFromKinds(['customer-snippet']);
  const marketPriceEvidence = evidenceFromKinds(['market-price-snippet']);
  const mentions = evidenceFromKinds(['search-snippet']);
  const ownPrices = offerings.map(item => priceNumber(item.price)).filter(value => Number.isFinite(value));
  const priceComparisons = alternatives.filter(item => item.price && item.offeringName).flatMap(alternative => {
    const own = offerings.find(item => item.price && sameOffering(offeringDisplayName(item), alternative.offeringName));
    return own ? [{ name: alternative.offeringName, own, alternative, ownPrice: priceNumber(own.price), alternativePrice: priceNumber(alternative.price) }] : [];
  }).filter(item => Number.isFinite(item.ownPrice) && Number.isFinite(item.alternativePrice)).slice(0, 6);
  const competitorPrices = priceComparisons.map(item => item.alternativePrice);
  const companyPages = sources.filter(source => source.kind === 'company-site').length;
  const externalPages = sources.filter(source => !['company-site', 'local-document'].includes(source.kind)).length;
  const localDocuments = sources.filter(source => source.kind === 'local-document').length;
  const withPrices = offerings.filter(item => item.price).length;
  const withImages = offerings.filter(item => item.image).length;
  const externalHosts = new Set(sources.filter(source => !['company-site', 'local-document'].includes(source.kind)).map(item => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } }).filter(Boolean));
  const observations = [
    { label: 'Каталог', value: offerings.length, detail: 'предложений с цитатой и страницей-источником' },
    { label: 'Конкуренты', value: competitors.length, detail: 'прямых внешних сайтов в продуктовом поле' },
    { label: 'Отзывы', value: reviews.length, detail: 'материалов с оценками или клиентским опытом' },
    { label: 'Упоминания', value: mentions.length, detail: 'независимых материалов именно о компании' },
    { label: 'Динамика', value: news.length + industryEvidence.length, detail: 'независимых отраслевых материалов' },
  ];
  const gaps = [];
  if (!mentions.length) gaps.push('Независимые упоминания именно о компании не подтверждены: это пробел цифрового следа в данном запуске, а не доказательство их отсутствия.');
  if (!reviews.length) gaps.push('Нет подтверждённых открытых отзывов: репутацию и причины выбора нужно исследовать отдельно.');
  if (!industryEvidence.length && !news.length) gaps.push('Нет независимой отраслевой динамики: выводы о состоянии рынка не делаем только по сайту компании.');
  if (!customerEvidence.length) gaps.push('Критерии выбора и жалобы клиентов отрасли не подтверждены независимыми материалами.');
  if (!competitors.length && !alternatives.length) gaps.push('Нет проверенного конкурентного контура: ценовую позицию и давление конкурентов пока определять нельзя.');
  if (news.length || industryEvidence.length) gaps.push('Отраслевые публикации показывают информационный фон, но не доказывают рост или падение рынка без числового ряда.');
  if (offerings.length && withPrices < offerings.length) gaps.push(`Цена подтверждена у ${withPrices} из ${offerings.length} предложений; остальные нельзя использовать в ценовом сравнении.`);
  if (!priceComparisons.length && alternatives.length) gaps.push('Внешние цены найдены, но сопоставимых пар «свое предложение — альтернатива» нет: диапазон рынка не рассчитываем.');
  if (!localDocuments) gaps.push('Внутренние продажи, маржа, обращения и регламенты не загружены: экономический эффект пока не рассчитан.');
  return {
    observations, gaps, offerings, alternatives, reviews, competitors, news, mentions, priceComparisons,
    industryEvidence, customerEvidence, marketPriceEvidence,
    ownPriceRange: ownPrices.length ? { min: Math.min(...ownPrices), max: Math.max(...ownPrices) } : null,
    competitorPriceRange: competitorPrices.length ? { min: Math.min(...competitorPrices), max: Math.max(...competitorPrices) } : null,
    coverage: { companyPages, externalPages, localDocuments, withPrices, withImages, externalHosts: externalHosts.size, competitors: competitors.length, mentions: mentions.length, news: news.length, industry: industryEvidence.length, customer: customerEvidence.length, marketPrices: marketPriceEvidence.length, fullTextExternal: sources.filter(source => source.contentOrigin === 'full-page').length },
  };
}

function sourceFor(research, id) {
  return (research.sources || []).find(source => source.id === id);
}

function itemLink(item, research) {
  const source = sourceFor(research, item?.sourceId);
  return { sourceId: item?.sourceId, url: item?.url || source?.url, sourceTitle: item?.sourceTitle || source?.title, quote: item?.quote };
}

const ECOSYSTEM_ANSWER = 'Единый путь такой: бесплатный ИИ-советник разбирает компанию и рынок, выбирает конкретный процесс и готовит проверяемый пилот. Windows-версия хранит документы и историю локально, а для свежего поиска нужен интернет. Если подходит готовый агент BAIagent, его стоимость и срок запуска показываются до заявки. Для нестандартной разработки, сложных интеграций и защищённой инфраструктуры подключается Balanov.PRO. «Подключить за 0 ₽» означает только заявку и первичный аудит; последующие работы оплачиваются по согласованному объёму.';

export function answerAdvisor(question, research = {}, analysis = {}, opportunity = null) {
  const query = String(question || '').trim();
  const lower = query.toLowerCase();
  if (!query) return { answer: 'Сформулируйте вопрос о компании, рынке, товарах, отзывах, конкурентах или плане действий.', citations: [] };
  if (/экосистем|baiagent|2aos|a2os|баланов|paritet|паритет|внедрен|поддержк/.test(lower)) return { answer: ECOSYSTEM_ANSWER, citations: [] };
  if (/план|пилот|внедр|с чего|перв.*шаг|действ/.test(lower) && opportunity) return {
    answer: `${opportunity.action} Критерий продолжения: ${opportunity.metric}. ${opportunity.decision || 'Решение принимаем после измерения исходного и пилотного результата.'}`,
    citations: opportunity.evidence || [],
  };
  const market = createMarketIntelligence(research);
  if (/цен|стоим|прайс|дорог|дёшев|дешев/.test(lower)) {
    const priced = market.offerings.filter(item => item.price).slice(0, 6);
    if (!priced.length) return { answer: 'В собранных материалах нет подтверждённых цен. Я не буду подставлять предположения: добавьте прайс или откройте страницы каталога.', citations: [] };
    return { answer: `Подтверждённые цены на сайте: ${priced.map(item => `${offeringDisplayName(item)} — ${item.price}`).join('; ')}. ${market.ownPriceRange ? `Диапазон найденных значений: ${money(market.ownPriceRange.min)}–${money(market.ownPriceRange.max)}. Это диапазон карточек, а не средняя рыночная цена.` : ''}`, citations: priced.map(item => itemLink(item, research)) };
  }
  if (/конкурент|альтернатив|аналог|сопернич/.test(lower)) {
    if (!market.competitors.length && !market.alternatives.length) return { answer: 'Проверенный конкурентный контур в этом исследовании не найден. Это ограничение данных, а не отсутствие конкурентов на рынке. Добавьте сайты известных конкурентов или расширьте внешний поиск.', citations: [] };
    const companies = market.competitors.length ? `Прямые сайты в том же продуктовом поле: ${market.competitors.slice(0, 6).map(item => `${item.name} (${item.url})`).join('; ')}.` : '';
    const offers = market.alternatives.length ? ` Сопоставимые внешние предложения: ${market.alternatives.slice(0, 4).map(item => `${item.name}${item.price ? ` — ${item.price}` : ''}`).join('; ')}.` : '';
    return { answer: `${companies}${offers} Это подтверждённый поисковый контур, а не рейтинг долей рынка. Сравнивайте объём, состав, условия поставки и сервис — не только цену.`.trim(), citations: [...market.competitors.slice(0, 6), ...market.alternatives.slice(0, 4)].map(item => itemLink(item, research)) };
  }
  if (/отзыв|репутац|рейтинг|клиент.*(говор|пиш)/.test(lower)) {
    if (!market.reviews.length) return { answer: 'Подтверждённых отзывов в собранных источниках нет. Нельзя делать вывод ни о положительной, ни об отрицательной репутации. Для следующего шага нужны реальные отзывы, обращения и причины повторных покупок.', citations: [] };
    const facts = market.reviews.slice(0, 5).map(item => `${item.sourceTitle}${item.rating ? `: оценка ${item.rating}` : ''}${item.count ? `, ${item.count} отзывов` : ''}${item.themes.length ? `, темы: ${item.themes.join(', ')}` : ''}`).join('; ');
    return { answer: `Открытые материалы: ${facts}. Это наблюдения по найденным источникам, а не оценка настроения всех клиентов. Проверьте исходные цитаты ниже и добавьте внутренние обращения для полной картины.`, citations: market.reviews.slice(0, 6).map(item => itemLink(item, research)) };
  }
  if (/что.*прода|товар|услуг|каталог|ассортимент/.test(lower)) {
    if (!market.offerings.length) return { answer: 'Конкретные карточки товаров и услуг не распознаны. Добавьте каталог или прайс — тогда можно будет ответить по позициям, а не по общему описанию сайта.', citations: [] };
    return { answer: `В исследовании подтверждены: ${market.offerings.slice(0, 8).map(item => `${offeringDisplayName(item)}${item.price ? ` — ${item.price}` : ''}`).join('; ')}.`, citations: market.offerings.slice(0, 8).map(item => itemLink(item, research)) };
  }
  const stop = new Set(['что', 'как', 'почему', 'какой', 'какие', 'есть', 'это', 'для', 'про', 'мне', 'нам', 'его', 'ее', 'или', 'при', 'над', 'под', 'без', 'the', 'and']);
  const tokens = lower.replace(/[^\p{L}\p{N}%]+/gu, ' ').split(/\s+/).filter(token => token.length >= 4 && !stop.has(token));
  const candidates = [];
  for (const source of research.sources || []) {
    for (const sentence of String(source.text || '').match(/[^.!?…]+[.!?…]?/g) || []) {
      const text = sentence.trim();
      if (text.length < 30 || text.length > 700) continue;
      const normalized = text.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (normalized.includes(token) ? 1 : 0), 0);
      if (score) candidates.push({ score, text, source });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  const best = candidates.slice(0, 3);
  if (!best.length) return { answer: 'В исследовании и добавленных документах нет достаточных оснований для уверенного ответа. Уточните вопрос или добавьте относящиеся к нему материалы — я не буду додумывать недостающие факты.', citations: [] };
  return { answer: 'По загруженным материалам нашёл следующие релевантные фрагменты. Это ответ строго в границах исследования; управленческий вывод требует отдельной проверки.', citations: best.map(item => ({ sourceId: item.source.id, url: item.source.url, sourceTitle: item.source.title, quote: item.text })) };
}
