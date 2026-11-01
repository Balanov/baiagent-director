const SEARCHES = {
  en: { reviews: 'reviews rating', maps: 'customer reviews Google Maps', mentions: '', business: 'customers partners news', fallback: 'customer reviews Trustpilot Google', productReviews: 'reviews price', alternatives: 'buy price alternative' },
  es: { reviews: 'opiniones valoración', maps: 'opiniones clientes Google Maps', mentions: '', business: 'clientes socios noticias', fallback: 'opiniones clientes Trustpilot Google', productReviews: 'opiniones precio', alternatives: 'comprar precio alternativa' },
  zh: { reviews: '客户 评价 评分', maps: '客户 评价 地图', mentions: '', business: '客户 合作伙伴 新闻', fallback: '客户 评价 大众点评', productReviews: '评价 价格', alternatives: '购买 价格 替代' },
  hi: { reviews: 'ग्राहक समीक्षा रेटिंग', maps: 'ग्राहक समीक्षा Google Maps', mentions: '', business: 'ग्राहक भागीदार समाचार', fallback: 'ग्राहक समीक्षा Google', productReviews: 'समीक्षा कीमत', alternatives: 'खरीद कीमत विकल्प' },
  ar: { reviews: 'آراء العملاء تقييم', maps: 'آراء العملاء خرائط Google', mentions: '', business: 'عملاء شركاء أخبار', fallback: 'آراء العملاء Google', productReviews: 'آراء سعر', alternatives: 'شراء سعر بديل' },
};

export function companyResearchQueries(companyName, language) {
  const copy = SEARCHES[language];
  if (!copy) return [
    { query: `"${companyName}" отзывы рейтинг`, message: 'Ищу реальные отзывы и оценки' },
    { query: `"${companyName}" отзывы Яндекс Карты`, message: 'Проверяю оценки компании на картах' },
    { query: `"${companyName}"`, message: 'Ищу независимые упоминания о компании' },
    { query: `"${companyName}" клиенты партнеры новости`, message: 'Проверяю клиентов, партнёрства и деловой след' },
  ];
  return [
    { query: `"${companyName}" ${copy.reviews}`, message: `${companyName} · ${copy.reviews}` },
    { query: `"${companyName}" ${copy.maps}`, message: `${companyName} · ${copy.maps}` },
    { query: `"${companyName}"`, message: companyName },
    { query: `"${companyName}" ${copy.business}`, message: `${companyName} · ${copy.business}` },
  ];
}

export function productResearchQuery(name, mode, language) {
  const copy = SEARCHES[language];
  return `"${name}" ${mode === 'reviews' ? copy?.productReviews || 'отзывы цена' : copy?.alternatives || 'купить цена аналог'}`;
}

const PROGRESS = {
  en: { start: 'Opening the company website and looking for its catalogue', openPage: 'Opening: {page}', deepenPage: 'Checking offering pages: {page}', externalSources: '{count} sources collected', reference: 'Checking reference sources', independent: 'Checking an independent company profile', competitors: '{subject} · competitors', marketNews: '{subject} · market news', productReviews: '{name} · reviews', productAlternatives: '{name} · alternatives', readExternal: 'Reading the external source: {title}' },
  es: { start: 'Abriendo el sitio de la empresa y buscando su catálogo', openPage: 'Abriendo: {page}', deepenPage: 'Revisando fichas: {page}', externalSources: '{count} fuentes recopiladas', reference: 'Consultando fuentes de referencia', independent: 'Consultando un perfil independiente de la empresa', competitors: '{subject} · competidores', marketNews: '{subject} · noticias del mercado', productReviews: '{name} · opiniones', productAlternatives: '{name} · alternativas', readExternal: 'Leyendo la fuente externa: {title}' },
  zh: { start: '正在打开公司网站并查找产品目录', openPage: '正在打开：{page}', deepenPage: '正在核对产品页面：{page}', externalSources: '已收集 {count} 个来源', reference: '正在检查参考资料', independent: '正在检查公司的独立资料', competitors: '{subject} · 竞争对手', marketNews: '{subject} · 市场新闻', productReviews: '{name} · 评价', productAlternatives: '{name} · 替代方案', readExternal: '正在阅读外部来源：{title}' },
  hi: { start: 'कंपनी की साइट और कैटलॉग खोला जा रहा है', openPage: 'खोला जा रहा है: {page}', deepenPage: 'प्रस्ताव पृष्ठ जाँचे जा रहे हैं: {page}', externalSources: '{count} स्रोत मिले', reference: 'संदर्भ स्रोत जाँचे जा रहे हैं', independent: 'कंपनी की स्वतंत्र प्रोफ़ाइल जाँची जा रही है', competitors: '{subject} · प्रतियोगी', marketNews: '{subject} · बाजार समाचार', productReviews: '{name} · समीक्षाएँ', productAlternatives: '{name} · विकल्प', readExternal: 'बाहरी स्रोत पढ़ा जा रहा है: {title}' },
  ar: { start: 'أفتح موقع الشركة وأبحث عن كتالوجها', openPage: 'أفتح: {page}', deepenPage: 'أراجع صفحات العروض: {page}', externalSources: 'تم جمع {count} مصادر', reference: 'أراجع المصادر المرجعية', independent: 'أراجع ملفاً مستقلاً عن الشركة', competitors: '{subject} · المنافسون', marketNews: '{subject} · أخبار السوق', productReviews: '{name} · المراجعات', productAlternatives: '{name} · البدائل', readExternal: 'أقرأ المصدر الخارجي: {title}' },
};

export function researchProgress(key, language, values = {}) {
  const template = PROGRESS[language]?.[key];
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

const NOTICE_COPY = {
  en: { favicon: 'The logo was inferred only from the favicon; brand matching is not visually confirmed.', noLogo: 'No reliable company logo was found; unrelated images are not used.', challenge: 'The website returned a JavaScript challenge, so its page content could not be read automatically.', empty: 'The page contains no readable text; the website content was not retrieved.', coverage: 'The main page content is unavailable. The company profile relies on external sources rather than a successful website audit.', external: 'Some external sources could not be retrieved. Only available evidence is included.' },
  es: { favicon: 'El logotipo se dedujo solo del favicon; la correspondencia visual con la marca no está confirmada.', noLogo: 'No se encontró un logotipo fiable; no se utilizan imágenes no relacionadas.', challenge: 'El sitio devolvió una comprobación de JavaScript y no se pudo leer automáticamente.', empty: 'La página no contiene texto legible; no se obtuvo el contenido del sitio.', coverage: 'El contenido de la página principal no está disponible. El perfil se basa en fuentes externas, no en una auditoría correcta del sitio.', external: 'No se pudieron obtener algunas fuentes externas. Solo se incluyen las evidencias disponibles.' },
  zh: { favicon: '标志仅根据网站图标推断，尚未确认其视觉品牌一致性。', noLogo: '未找到可靠的公司标志，不会使用无关图片。', challenge: '网站返回了 JavaScript 验证，无法自动读取页面内容。', empty: '页面没有可读取的文本，未获取网站内容。', coverage: '主页内容不可用。公司资料依据外部来源，而非成功的网站审计。', external: '部分外部来源无法获取，仅保留现有证据。' },
  hi: { favicon: 'लोगो केवल फ़ेविकॉन से अनुमानित है; दृश्य ब्रांड मिलान पुष्ट नहीं है।', noLogo: 'विश्वसनीय कंपनी लोगो नहीं मिला; असंबंधित चित्र इस्तेमाल नहीं किए गए।', challenge: 'साइट ने JavaScript जाँच भेजी, इसलिए पृष्ठ स्वचालित रूप से नहीं पढ़ा जा सका।', empty: 'पृष्ठ में पढ़ने योग्य पाठ नहीं है; साइट की सामग्री प्राप्त नहीं हुई।', coverage: 'मुख्य पृष्ठ की सामग्री उपलब्ध नहीं है। प्रोफ़ाइल सफल साइट ऑडिट के बजाय बाहरी स्रोतों पर आधारित है।', external: 'कुछ बाहरी स्रोत प्राप्त नहीं हो सके। केवल उपलब्ध प्रमाण शामिल हैं।' },
  ar: { favicon: 'تم استنتاج الشعار من أيقونة الموقع فقط؛ التطابق المرئي مع العلامة غير مؤكد.', noLogo: 'لم يتم العثور على شعار موثوق للشركة؛ لا تُستخدم صور غير مرتبطة.', challenge: 'أعاد الموقع تحقق JavaScript، لذا تعذرت قراءة محتواه تلقائياً.', empty: 'لا تحتوي الصفحة على نص مقروء؛ لم يتم الحصول على محتوى الموقع.', coverage: 'محتوى الصفحة الرئيسية غير متاح. يعتمد ملف الشركة على مصادر خارجية لا على تدقيق ناجح للموقع.', external: 'تعذر الحصول على بعض المصادر الخارجية. تم تضمين الأدلة المتاحة فقط.' },
};

export function researchNotice(message, language = 'ru') {
  const original = String(message || '');
  if (language === 'ru' || !NOTICE_COPY[language]) return original;
  const copy = NOTICE_COPY[language];
  if (/favicon/i.test(original)) return copy.favicon;
  if (/Логотип не определён/.test(original)) return copy.noLogo;
  if (/JavaScript-challenge/i.test(original)) return copy.challenge;
  if (/Страница не содержит доступного текста/.test(original)) return copy.empty;
  if (/Содержимое главной страницы недоступно/.test(original)) return copy.coverage;
  return copy.external;
}
