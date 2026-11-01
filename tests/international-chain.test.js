import { describe, expect, it } from 'vitest';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { buildPilotPlan, verifyFinalAnalysis } from '../shared/verification.js';
import { buildPilotBlueprint } from '../shared/pilot.js';
import { detectContentLanguage, preferredLanguage } from '../shared/locale.js';
import { isInternationalReviewMaterial } from '../shared/international-market.js';
import { researchErrorMessage } from '../shared/research-error.js';
import { parsePage, resolvedResearchWarnings } from '../electron/research.mjs';
import { answerInternationalAdvisor } from '../shared/advisor-prompts.js';

const CASES = {
  ru: {
    company: 'Вкусный пример', own: 'Сеть ресторанов «Вкусный пример» готовит свежие блюда для гостей и семей. В меню есть завтраки, обеды и доставка готовых блюд.',
    offering: 'Большой завтрак с сезонными фруктами', price: '390 ₽', competitor: 'Сеть ресторанов предлагает меню из свежих блюд, заказать столик и доставку для гостей.',
    review: 'Рекомендую ресторан: качество блюд и доставка были отличными.', news: 'Рынок ресторанов: спрос и производство блюд меняются в этом году.', mention: 'Исследование рынка ресторанов отмечает «Вкусный пример» — ресторан с меню и доставкой готовых блюд для гостей.',
  },
  en: {
    company: 'Fresh Example', own: 'Our restaurant prepares fresh food for our customers and families. The menu includes breakfast, lunch and food delivery for your office.',
    offering: 'Large breakfast with seasonal fruit', price: '$12', competitor: 'Our restaurant offers a fresh food menu, table ordering and reliable delivery services for customers.',
    review: 'I recommend this restaurant because our delivery and the service quality were excellent.', news: 'The restaurant market reports changing demand, production and food prices this year.', mention: 'Fresh Example is a restaurant with a food menu and delivery for customers.',
  },
  es: {
    company: 'Ejemplo Fresco', own: 'Nuestro restaurante prepara comida fresca para los clientes y las familias. El menú incluye desayunos, almuerzos y entrega de comida para la empresa.',
    offering: 'Desayuno grande con fruta de temporada', price: '12 €', competitor: 'Nuestro restaurante ofrece un menú de comida fresca, pedidos y servicios de entrega para clientes.',
    review: 'Recomiendo este restaurante porque la entrega, la calidad y el servicio fueron excelentes.', news: 'El mercado de restaurantes registra cambios en la demanda, la producción y los precios este año.', mention: 'Ejemplo Fresco es un restaurante con menú de comida y entrega para clientes.',
  },
  zh: {
    company: '鲜味示例餐厅', own: '我们的餐厅为顾客和家庭制作新鲜食品。菜单包括早餐、午餐和企业餐饮配送服务。',
    offering: '时令水果丰盛早餐', price: '¥58', competitor: '我们的餐厅提供新鲜食品菜单、点餐服务和可靠的顾客配送服务。',
    review: '我推荐这家餐厅，配送很快，食品质量和服务都很好。', news: '今年餐饮市场的需求、生产和食品价格出现新的变化。', mention: '鲜味示例餐厅提供食品菜单和顾客配送服务。',
  },
  hi: {
    company: 'फ्रेश उदाहरण', own: 'हमारा रेस्तरां ग्राहकों और परिवारों के लिए ताज़ा खाद्य तैयार करता है। मेनू में नाश्ता, दोपहर का भोजन और खाद्य डिलीवरी सेवा है।',
    offering: 'मौसमी फलों वाला बड़ा नाश्ता', price: '₹499', competitor: 'हमारा रेस्तरां ताज़ा खाद्य मेनू, ऑर्डर और ग्राहकों के लिए भरोसेमंद डिलीवरी सेवा देता है।',
    review: 'मैं इस रेस्तरां की सिफारिश करता हूँ क्योंकि डिलीवरी, गुणवत्ता और सेवा बहुत अच्छी थी।', news: 'इस वर्ष रेस्तरां बाजार में मांग, उत्पादन और खाद्य कीमत में बदलाव दिख रहा है।', mention: 'फ्रेश उदाहरण खाद्य मेनू और ग्राहक डिलीवरी वाला रेस्तरां है।',
  },
  ar: {
    company: 'مثال طازج', own: 'يعد مطعمنا طعاماً طازجاً للعملاء والعائلات. تضم القائمة وجبات الإفطار والغداء وخدمة توصيل الطعام للشركات.',
    offering: 'فطور كبير مع فواكه الموسم', price: '45 ر.س', competitor: 'يقدم مطعمنا قائمة طعام طازج وخدمات الطلب والتوصيل الموثوقة للعملاء.',
    review: 'أنصح بهذا المطعم لأن التوصيل والجودة والخدمة كانت ممتازة.', news: 'يسجل سوق المطاعم تغيرات في الطلب والإنتاج وأسعار الطعام هذا العام.', mention: 'مثال طازج مطعم يوفر قائمة طعام وخدمة توصيل للعملاء.',
  },
};

function fixture(language) {
  const item = CASES[language];
  const ownUrl = `https://${language}.example/`;
  const own = {
    id: 'site-1', kind: 'company-site', url: ownUrl, title: item.company, companyName: item.company, language,
    text: `${item.own} ${item.offering} ${item.price}.`,
    offerings: [{ name: item.offering, displayName: item.offering, kind: 'product', price: item.price, quote: `${item.offering} ${item.price}`, sourceId: 'site-1', sourceTitle: item.company, url: ownUrl }],
  };
  const external = (id, kind, text, url, extra = {}) => ({ id, kind, url, title: text.slice(0, 90), text, language, ...extra });
  const competitor = external('web-1', 'competitor-candidate', item.competitor, 'https://competitor.example/', { competitorName: 'Market Example' });
  const reviewSource = external('web-2', 'review-snippet', `${item.company} · ${item.review}`, 'https://reviews.example/company');
  const newsSource = external('web-3', 'news-snippet', item.news, 'https://news.example/market', { publishedAt: new Date(Date.now() - 86400000).toUTCString() });
  const mentionSource = external('web-4', 'search-snippet', item.mention, 'https://directory.example/company');
  const sources = [own, competitor, reviewSource, newsSource, mentionSource];
  const quote = source => ({ sourceId: source.id, sourceTitle: source.title, url: source.url, quote: source.text });
  return {
    requestedUrl: ownUrl, language, companyName: item.company, sources, offerings: own.offerings,
    competitors: [{ name: 'Market Example', ...quote(competitor) }],
    reviews: [quote(reviewSource)], news: [{ ...quote(newsSource), title: newsSource.title, publishedAt: newsSource.publishedAt }],
  };
}

function generatedFields(analysis) {
  return JSON.stringify({
    summary: analysis.summary,
    opportunities: analysis.opportunities.map(item => ({ ...item, evidence: undefined })),
    swot: analysis.swot.map(item => ({ ...item, evidence: undefined })),
    observations: analysis.market?.observations,
    gaps: analysis.market?.gaps,
    reviewThemes: analysis.market?.reviews?.map(item => item.themes),
    industry: analysis.profile?.industry?.label,
    segments: analysis.profile?.segments?.map(item => item.label),
    risks: analysis.profile?.risks,
  });
}

describe('complete language chain with real source excerpts', () => {
  it.each(Object.keys(CASES))('keeps %s through research, analysis, verification, pilot and advisor', language => {
    const research = fixture(language);
    const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
    expect(analysis.language).toBe(language);
    expect(analysis.companyName).toBe(research.companyName);
    expect(analysis.opportunities.length).toBeGreaterThan(0);
    expect(analysis.opportunities.every(item => item.evidence.length > 0)).toBe(true);
    expect(analysis.market.offerings.length).toBeGreaterThan(0);
    expect(analysis.market.competitors.length).toBeGreaterThan(0);
    expect(analysis.market.reviews.length).toBeGreaterThan(0);
    expect(analysis.market.news.length).toBeGreaterThan(0);
    expect(analysis.market.mentions.length).toBeGreaterThan(0);
    expect(analysis.profile.risks).toEqual([]);
    expect(analysis.market.observations).toHaveLength(5);
    const final = verifyFinalAnalysis(analysis, research.sources);
    expect(final.language).toBe(language);
    expect(final.opportunities.length).toBeGreaterThan(0);
    expect(final.opportunities.every(item => item.processEvidence?.note)).toBe(true);
    const pilot = buildPilotBlueprint(final.opportunities[0], language);
    expect(pilot.stopRule).toBeTruthy();
    const document = buildPilotPlan(final, final.opportunities[0], research.sources);
    expect(document).toContain(final.opportunities[0].title);
    if (language !== 'ru') {
      expect(generatedFields(final)).not.toMatch(/[а-яё]/i);
      expect(document).not.toMatch(/[а-яё]/i);
      expect(analysis.market.reviews.every(item => item.themes.length === 0)).toBe(true);
      const advisor = answerInternationalAdvisor({ question: { en: 'What competitors did you find?', es: '¿Qué competidores encontraste?', zh: '你找到了哪些竞争对手？', hi: 'आपको कौन से प्रतियोगी मिले?', ar: 'ما المنافسون الذين وجدتهم؟' }[language], research, analysis, opportunity: final.opportunities[0] });
      expect(advisor.language).toBe(language);
      expect(advisor.answer).not.toMatch(/[а-яё]/i);
      expect(advisor.citations.length).toBeGreaterThan(0);
    }
  });
});

describe('language detection and public diagnostics', () => {
  it('uses substantial page text instead of a contradictory html lang', () => {
    const page = parsePage('<html lang="ru"><head><title>Fresh Example</title></head><body><main><h1>Fresh food for our customers</h1><p>Our restaurant and the team prepare fresh food with seasonal ingredients for your family and business.</p></main></body></html>', 'https://en.example/', 'site-1');
    expect(page.declaredLanguage).toBe('ru');
    expect(page.language).toBe('en');
    expect(detectContentLanguage('en', 'Обычное описание нашего ресторана с блюдами для гостей и доставкой по городу.')).toBe('ru');
  });
  it('does not let a few Russian menu links redefine an English page', () => {
    const english = 'Our company provides products and services for customers with clear prices and reliable business support. '.repeat(12);
    expect(detectContentLanguage('en', `${english} Меню Отзывы Контакты`)).toBe('en');
  });
  it('accepts a real English customer review without a numeric rating', () => {
    expect(isInternationalReviewMaterial({ title: 'Fresh Example reviews', url: 'https://reviews.example/fresh', text: 'I recommend this restaurant because the service quality and our delivery were excellent.' })).toBe(true);
    expect(isInternationalReviewMaterial({ pageType: 'article', title: 'Fresh Example reviews', text: 'I recommend this restaurant for service quality.' })).toBe(false);
  });
  it.each(['en', 'es', 'zh', 'hi', 'ar'])('translates connection errors and warnings into %s', language => {
    const error = researchErrorMessage(new Error('fetch failed: ENOTFOUND'), language);
    expect(error).toBeTruthy();
    expect(error).not.toMatch(/[а-яё]/i);
    const warnings = resolvedResearchWarnings(['Логотип не определён: изображения без явных признаков бренда не используются.'], null, language);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toMatch(/[а-яё]/i);
  });
  it('falls back to English for an unsupported browser language', () => {
    expect(preferredLanguage({ browser: 'fr-FR,fr;q=0.9' })).toBe('en');
    expect(preferredLanguage({ browser: 'es-MX,es;q=0.9' })).toBe('es');
    expect(preferredLanguage({ explicit: 'ar-EG' })).toBe('ar');
  });
});
