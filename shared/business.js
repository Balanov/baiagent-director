const INDUSTRIES = [
  { id: 'government', label: 'Государственные и муниципальные сервисы', pattern: /министерств|ведомств|муниципальн|государственн[а-яё]* (?:услуг|сервис|орган|портал)|орган[а-яё]* (?:власти|исполнительной)|госуслуг|администраци[яи] (?:города|региона|области|края|республики)/i },
  { id: 'cybersecurity', label: 'Разработка решений для кибербезопасности', pattern: /кибербезопас|антивирус|информационн[а-яё]* безопас|защит[а-яё]* (?:данных|информации|endpoint)/i },
  { id: 'software', label: 'Программные, SaaS и цифровые продукты', pattern: /\b(?:saas|software|software as a service|cloud platform|digital products?)\b|программн[а-яё]* обеспечени|программн[а-яё]* продукт|справочн[а-яё]* [а-яё-]* ?систем|информационн[а-яё]* (?:систем|продукт|ресурс)|цифров[а-яё]* (?:платформ|продукт|сервис)|облачн[а-яё]* (?:платформ|сервис)|разработчик[а-яё]* (?:программ|систем|платформ|приложен)/i },
  { id: 'logistics', label: 'Логистика и доставка', pattern: /логистик|курьерск|оператор доставки|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|отправлени|грузоперевоз|фулфилмент/i },
  { id: 'distribution', label: 'Дистрибуция товаров и оборудования', pattern: /дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* (?:оборудования|техники)/i },
  { id: 'manufacturing', label: 'Производство и продажа продукции', pattern: /производим|производител|производств|собственн[а-яё]* (?:производств|фабрик)|изготавлива|фабрик|завод-изготовител|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси/i },
  { id: 'retail', label: 'Продажа товаров и подбор решений для покупателей', pattern: /интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател|электроник|бытов[а-яё]* техник/i },
  { id: 'food', label: 'Продукты питания и ресторанный сервис', pattern: /ресторан|пицц|продукт[а-яё]* питания|кейтеринг|кофейн/i },
  { id: 'finance', label: 'Финансовые услуги', pattern: /банк(?!рот)|страхован|лизинг|кредит|плат[её]ж/i },
  { id: 'construction', label: 'Строительство и инженерные решения', pattern: /строительств|стройматериал|инженерн[а-яё]* систем|проектировани/i },
  { id: 'healthcare', label: 'Медицинские услуги и товары', pattern: /медицин|клиник|стоматолог|фармацевт/i },
  { id: 'education', label: 'Образование и профессиональное развитие', pattern: /обучени|образован|курсы|тренинг/i },
  { id: 'professional', label: 'Профессиональные услуги для клиентов', pattern: /консалтинг|аудит|юридическ[а-яё]* (?:услуг|компан|консульт|поддержк|сопровожд)|правов[а-яё]* (?:услуг|поддержк|сопровожд)|адвокат|бухгалтерск[а-яё]* (?:услуг|обслужив|сопровожд)/i },
];

const SEGMENTS = [
  { id: 'business', label: 'Компании и организации', pattern: /для бизнеса|юридическ[а-яё]* лиц|корпоративн|предприят|B2B/i },
  { id: 'consumers', label: 'Частные клиенты', pattern: /для дома|частн[а-яё]* (?:клиент|лиц|потребител)|физическ[а-яё]* лиц/i },
  { id: 'commerce', label: 'Интернет-магазины и продавцы', pattern: /для интернет-магазин|интернет-магазин(?:ов|ам|ами)|онлайн-продав|продавц[а-яё]* маркетплей|для маркетплейс/i },
  { id: 'partners', label: 'Партнёры, дилеры и франчайзи', pattern: /партн[её]р|дилер|франшиз|франчайз/i },
];

import { researchLanguage } from './locale.js';

const INTERNATIONAL_INDUSTRY_PATTERNS = {
  government: /government (?:services?|agency|portal)|public services|servicios públicos|数字政务|सरकारी सेवा|خدمات حكومية/i,
  cybersecurity: /cybersecurity|information security|ciberseguridad|网络安全|साइबर सुरक्षा|أمن سيبراني/i,
  software: /\b(?:software|cloud computing|developer tools|enterprise platform|mobile applications?)\b|software empresarial|plataforma en la nube|软件|云平台|सॉफ्टवेयर|क्लाउड|برمجيات|منصة سحابية/i,
  logistics: /\b(?:logistics|freight|parcel delivery|shipping services?|courier services?)\b|logística|transporte de mercancías|env[ií]os?|paquetes?|cartas?|物流|配送|लॉजिस्टिक्स|डिलीवरी|خدمات لوجستية|شحن/i,
  distribution: /\b(?:equipment distributor|wholesale supplier|industrial supplies)\b|distribuidor de equipos|设备经销|उपकरण वितरक|موزع معدات/i,
  manufacturing: /\b(?:manufacturer|manufacturing|manufacture|factory|industrial (?:technology|products|clients)|home appliances?|smart home)\b|fabricante|productos industriales|制造商|工业产品|家电|智能制造|निर्माता|उत्पादन|شركة تصنيع|منتجات صناعية/i,
  retail: /\b(?:online store|online retail|e-?commerce|retail store)\b|tienda online|comercio electrónico|在线商店|零售|ऑनलाइन स्टोर|खुदरा|متجر إلكتروني|تجزئة/i,
  food: /\b(?:restaurant|restaurants|fast food|food delivery|menu|cafe|catering|chicken|burgers?|pizza)\b|restaurante|comida rápida|entrega de comida|menú|餐厅|食品|菜单|रेस्तरां|फास्ट फूड|खाद्य|مطعم|وجبات سريعة|توصيل طعام/i,
  finance: /\b(?:banking|financial services|insurance|payments|business loans?)\b|servicios financieros|banca|seguros|金融|银行|वित्तीय सेवा|बैंकिंग|خدمات مالية|مصرفية/i,
  construction: /\b(?:construction|engineering services|building materials|contractor)\b|construcción|ingeniería|materiales de construcción|建筑|工程服务|निर्माण|इंजीनियरिंग|خدمات بناء|مواد بناء/i,
  healthcare: /\b(?:healthcare|medical clinic|dental|hospital|patient services)\b|clínica|servicios médicos|sanitarios|医疗|诊所|स्वास्थ्य सेवा|क्लिनिक|رعاية صحية|عيادة/i,
  education: /\b(?:education|training courses|online learning|professional training)\b|formación|cursos|educación|教育|课程|शिक्षा|पाठ्यक्रम|تعليم|دورات/i,
  professional: /\b(?:consulting|legal services|accounting services|professional services)\b|consultoría|servicios profesionales|咨询|专业服务|परामर्श|व्यावसायिक सेवा|خدمات استشارية|خدمات مهنية/i,
};

const INTERNATIONAL_SEGMENT_PATTERNS = {
  business: /\b(?:for business|businesses|enterprises|organisations|organizations|b2b|corporate)\b|para empresas|empresas|企业|公司|व्यापार|कंपनियों|للشركات|الأعمال/i,
  consumers: /\b(?:for consumers|individual customers|for you|for families|personal)\b|particulares|clientes individuales|个人|家庭|व्यक्तिगत|उपभोक्ता|للأفراد|شخصي/i,
  commerce: /\b(?:online sellers|e-?commerce sellers|retailers|merchants|marketplace sellers)\b|vendedores en línea|comercios|在线商家|电商|ऑनलाइन विक्रेता|खुदरा विक्रेता|البائعون عبر الإنترنت|التجار/i,
  partners: /\b(?:partners|dealers|franchisees|resellers)\b|socios|distribuidores|franquiciados|合作伙伴|加盟商|भागीदार|फ्रैंचाइज़ी|شركاء|أصحاب الامتياز/i,
};

function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }

function quoteFrom(source, pattern) {
  const sentences = String(source?.text || '').match(/[^.!?…]+[.!?…]?/g) || [];
  const sentence = sentences.map(clean).find(item => item.length >= 18 && pattern.test(item)) || sentences.map(clean).find(item => item.length >= 18);
  if (!sentence) return null;
  const match = sentence.match(pattern);
  const center = match?.index || 0;
  const matchEnd = match ? center + match[0].length : 0;
  if (sentence.length <= 360) return sentence.slice(0, match && /\d/.test(sentence[matchEnd] || '') ? matchEnd : sentence.length).trim();
  let start = Math.max(0, center - 100);
  let end = Math.min(sentence.length, Math.max(start + 360, matchEnd));
  if (start > 0) {
    const boundary = sentence.indexOf(' ', start);
    start = boundary >= 0 && boundary < center ? boundary + 1 : center;
  }
  if (/\d/.test(sentence[matchEnd] || '')) end = matchEnd;
  else if (end < sentence.length) {
    const boundary = sentence.lastIndexOf(' ', end);
    end = boundary >= matchEnd ? boundary : matchEnd;
  }
  return sentence.slice(start, end).trim();
}

function evidenceFrom(sources, pattern) {
  const sourcePriority = source => source.kind === 'company-site' ? 3 : source.kind === 'search-snippet' ? 2 : source.kind === 'customer-snippet' ? 1 : 0;
  return sources.map((source, index) => ({ source, index })).sort((left, right) => sourcePriority(right.source) - sourcePriority(left.source) || left.index - right.index).map(({ source }) => {
    const sentences = String(source.text || '').match(/[^.!?…]+[.!?…]?/g) || [];
    const candidates = sentences.map(clean).filter(sentence => sentence.length >= 30 && pattern.test(sentence));
    if (!candidates.length) return null;
    const scored = candidates.map(sentence => {
      const matches = sentence.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) || [];
      const meaningfulLength = Math.min(sentence.length, 360);
      // A company description is stronger industry evidence than a staff story that
      // happens to repeat the industry word more often.
      const employeeStory = /работа[ею]?\s+(?:у|в)\s+нас|наши\s+сотрудники|карьерн|ваканси|территориальн|блиноп[её]к|стаж[её]р/i.test(sentence);
      return { sentence, score: matches.length * 100 + meaningfulLength - (employeeStory ? 600 : 0) };
    }).sort((a, b) => b.score - a.score);
    const sourceWithBestSentence = { ...source, text: scored[0].sentence };
    const quote = quoteFrom(sourceWithBestSentence, pattern);
    return quote ? { sourceId: source.id, url: source.url, sourceTitle: source.title, quote } : null;
  }).filter(Boolean)[0] || null;
}

function countMatches(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return Math.min(8, (text.match(new RegExp(pattern.source, flags)) || []).length);
}

const INDUSTRY_STRENGTH = {
  software: /\b(?:saas|software|software as a service|team collaboration software|cloud platform)\b|программн[а-яё]* обеспечени|разработчик[а-яё]* (?:справочн|программ|систем|платформ|приложен)|справочн[а-яё]* правов[а-яё]* систем|правообладател[а-яё]* программ|цифров[а-яё]* (?:платформ|продукт)/i,
  logistics: /курьерск[а-яё]*(?:\s+(?:услуг|доставк)[а-яё]*)?|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|логистическ[а-яё]* (?:компан|оператор|услуг)/i,
  manufacturing: /производственн[а-яё]* (?:система|площадк|мощност|процесс)|завод|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси/i,
  finance: /банковск[а-яё]* (?:услуг|продукт|сервис)|банк\s+(?:для|предлагает)|открыть\s+(?:сч[её]т|вклад)|ипотек|дебетов[а-яё]* карт|кредитн[а-яё]* карт/i,
};

const PRIMARY_INDUSTRY_MODEL = {
  professional: /(?:сервис|платформа|маркетплейс)\s+(?:поиска\s+|подбора\s+)?специалист|поиск\s+специалист|специалисты\s+напишут\s+сами/i,
  logistics: /транспортн[а-яё]*\s+компан|логистическ[а-яё]*\s+(?:компан|оператор)|курьерск[а-яё]*\s+служб|оператор\s+доставки/i,
  software: /\b(?:saas|software as a service|team collaboration software)\b|разработчик[а-яё]*\s+(?:справочн|программ|систем|платформ|приложен)|справочн[а-яё]*\s+правов[а-яё]*\s+систем/i,
};

export function createBusinessProfile(research = {}) {
  const sources = research.sources || [];
  const own = sources.filter(source => source.kind === 'company-site' && clean(source.text).length >= 40);
  const external = sources.filter(source => !['company-site', 'local-document'].includes(source.kind) && clean(source.text).length >= 40);
  const independent = external.filter(source => ['search-snippet', 'review-snippet'].includes(source.kind));
  const basis = own.length ? own : independent;
  const combined = basis.map(source => `${source.title || ''} ${source.text || ''}`).join(' ');
  const industryText = value => value.replace(/производственн[а-яё]*\s+календар[ьеяю]|исполнительн[а-яё]*\s+производств[а-яё]*|судебн[а-яё]*\s+производств[а-яё]*|производств[а-яё]*\s+по\s+(?:делу|делам)/gi, ' ');
  const primaryText = industryText(basis[0] ? `${basis[0].title || ''} ${basis[0].text || ''}` : '');
  const secondaryText = industryText(basis.slice(1).map(source => `${source.title || ''} ${source.text || ''}`).join(' '));
  const international = researchLanguage(research) !== 'ru';
  const primaryModelText = primaryText.slice(0, 8000);
  const industries = INDUSTRIES.map(industry => {
    const pattern = international ? new RegExp(`${industry.pattern.source}|${INTERNATIONAL_INDUSTRY_PATTERNS[industry.id].source}`, 'i') : industry.pattern;
    const strong = INDUSTRY_STRENGTH[industry.id];
    const primaryModel = PRIMARY_INDUSTRY_MODEL[industry.id];
    const score = countMatches(primaryText, pattern) * 4 + countMatches(secondaryText, pattern)
      + (strong ? countMatches(primaryText, strong) * 6 + countMatches(secondaryText, strong) * 2 : 0)
      + (primaryModel?.test(primaryModelText) ? 48 : 0)
      + (international && industry.id === 'logistics' && /\b(?:logistics (?:compan|services?|provider)|freight (?:compan|services?|provider)|parcel delivery|postal services?|courier services?)\b|sigue tu envío|env[ií]a paquetes|paquetes? y cartas|servicios? de paqueter[ií]a|物流(?:公司|服务|配送)|配送(?:公司|服务)|خدمات لوجستية|शिपिंग सेवा/i.test(primaryModelText) ? 72 : 0)
      + (international && /restaurant|fast food|restaurante|comida rápida|餐厅|रेस्तरां|مطعم/i.test(primaryModelText) && industry.id === 'food' ? 48 : 0)
      + (international && /\b(?:smart home|industrial technology|home appliances?)\b|家电|智能制造/i.test(primaryModelText) && industry.id === 'manufacturing' ? 48 : 0)
      + (international && /\b(?:software|cloud platform|developer tools)\b/i.test(primaryModelText) && industry.id === 'software' ? 28 : 0);
    return { ...industry, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const industryPattern = id => international
    ? new RegExp(`${INDUSTRIES.find(item => item.id === id)?.pattern.source || ''}|${INTERNATIONAL_INDUSTRY_PATTERNS[id].source}`, 'i')
    : INDUSTRIES.find(item => item.id === id)?.pattern;
  const industry = industries[0] ? { ...industries[0], evidence: evidenceFrom(basis, new RegExp(`${PRIMARY_INDUSTRY_MODEL[industries[0].id]?.source || ''}${PRIMARY_INDUSTRY_MODEL[industries[0].id] ? '|' : ''}${INDUSTRY_STRENGTH[industries[0].id]?.source || ''}${INDUSTRY_STRENGTH[industries[0].id] ? '|' : ''}${industryPattern(industries[0].id).source}`, 'i')) } : null;
  const businessModel = !international && industry?.id === 'professional' && PRIMARY_INDUSTRY_MODEL.professional.test(primaryText) ? 'service-marketplace' : null;
  if (businessModel) industry.label = 'Платформа поиска специалистов и услуг';
  const segments = SEGMENTS.map(segment => {
    const pattern = international ? new RegExp(`${segment.pattern.source}|${INTERNATIONAL_SEGMENT_PATTERNS[segment.id].source}`, 'i') : segment.pattern;
    return { ...segment, pattern, score: countMatches(combined, pattern) };
  })
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
    .map(item => ({ id: item.id, label: item.label, evidence: evidenceFrom(basis, item.pattern) }));
  const riskPattern = /утечк|взлом|хакерск|санкци|штраф|банкрот|задержан[а-яё]*|судебн[а-яё]* (?:иск|разбирательств)|массов[а-яё]* сбо[йи]|приостановил[а-яё]* (?:работу|при[её]м|выдачу)/i;
  const helpingPattern = /оказал[а-яё]* поддерж|помогл|борьб[а-яё]* с|опубликовал[а-яё]* исследован|исследовани[а-яё]* атак|обнаружил|выявил|предупреждает|защитил/i;
  const risks = international ? [] : external.flatMap(source => {
    const sentences = String(source.text || '').match(/[^.!?…]+[.!?…]?/g) || [];
    const sourceBrand = clean(source.title).split(/\s+[—–|]\s+/)[0].replace(/[«»"]/g, '');
    const names = [research.companyName, sourceBrand].map(name => clean(name).toLowerCase()).filter(name => name.length >= 4);
    const mentionsCompany = sentence => names.some(name => sentence.toLowerCase().includes(name));
    return sentences.map(clean).filter(sentence => sentence.length >= 30 && riskPattern.test(sentence) && !helpingPattern.test(sentence) && mentionsCompany(sentence)).slice(0, 2).map(sentence => ({
      title: 'Сигнал во внешнем источнике — проверить актуальность и влияние',
      quote: sentence,
      sourceId: source.id, url: source.url, sourceTitle: source.title,
    }));
  }).filter((item, index, items) => items.findIndex(other => other.quote === item.quote) === index).slice(0, 4);
  const offerings = research.offerings || own.flatMap(source => source.offerings || []);
  const presentationOfferings = offerings.filter(item => {
    const name = clean(item.displayName || item.name);
    return name && name.length <= 100 && !/^(?:продукция|товары|продукты|услуги)$/i.test(name) && !/прайс-лист|не беспокойтесь|продолжаем поддерживать/i.test(name);
  });
  const prices = offerings.filter(item => item.price).length;
  return {
    companyName: research.companyName || own[0]?.companyName || '',
    industry, businessModel, segments, risks, basis: own.length ? 'company' : external.length ? 'external' : 'none',
    ownPagesReadable: own.length,
    offerings, priceCoverage: { priced: prices, total: offerings.length },
    topOfferings: presentationOfferings.slice(0, 3).map(item => item.displayName || item.name).filter(Boolean),
  };
}

export function executiveSummary(research = {}, profile = createBusinessProfile(research)) {
  const company = profile.companyName || 'Компания';
  const activity = profile.industry?.label || 'вид деятельности требует уточнения по дополнительным материалам';
  const offerings = profile.topOfferings.length ? ` Ключевые подтверждённые предложения: ${profile.topOfferings.join('; ')}.` : '';
  const audience = profile.segments.length ? ` Основной опубликованный контур клиентов: ${profile.segments.map(item => item.label.toLowerCase()).join(', ')}.` : '';
  if (profile.basis === 'external') return `${company}: ${activity.toLowerCase()}. Собственный сайт не отдал читаемое содержимое, поэтому профиль собран по независимым материалам и требует сверки с компанией.${audience}`;
  if (profile.basis === 'none') return `${company}: сайт открыт, но читаемого содержимого недостаточно для управленческих выводов. Нужны каталог, описание услуг или документы компании — без них я не строю выдуманный анализ.`;
  return `${company}: ${activity.toLowerCase()}.${offerings}${audience} Ниже — не общие советы, а проверяемые действия на основании этих материалов; экономический эффект рассчитывается только после добавления внутренних данных.`;
}
