const SUBJECTS = [
  [/мыл[аоуе]/i, 'мыло'],
  [/металлопрокат|металлопродукц|стальн|листов[а-яё]* сталь/i, 'металлопродукция'],
  [/мебел/i, 'мебель'],
  [/косметик/i, 'косметика'],
  [/электроник|бытов[а-яё]* техник/i, 'электроника'],
  [/стройматериал/i, 'стройматериалы'],
  [/стоматолог|зубн[а-яё]* (?:имплант|протез|лечени)/i, 'стоматологические услуги'],
  [/медицинск[а-яё]* (?:клиник|центр|услуг)|клиник/i, 'медицинские услуги'],
  [/юридическ[а-яё]* (?:услуг|компан|консульт)|адвокат|юрист/i, 'юридические услуги'],
  [/бухгалтерск[а-яё]* (?:услуг|обслужив|сопровожд)|аудит/i, 'бухгалтерские и аудиторские услуги'],
  [/недвижимост|квартир|застройщ|ипотек/i, 'недвижимость'],
  [/ремонт[а-яё]* (?:квартир|помещени|домов)|отделочн[а-яё]* работ/i, 'ремонт и отделка помещений'],
  [/онлайн[- ]?(?:курс|школ|обучени)|образовательн[а-яё]* (?:программ|услуг)/i, 'образовательные программы'],
  [/корпоративн[а-яё]* обучени|тренинг/i, 'корпоративное обучение'],
  [/спич|розжиг|древесн[а-яё]* (?:ролл|брикет)|сух[а-яё]* горюч|щеп[а-яё]* для копчен/i, 'товары для розжига'],
  [/упаковк|тар[аыуе]\b/i, 'упаковка'],
  [/полиграф|печат[а-яё]* (?:продукц|услуг)|типограф/i, 'полиграфические услуги'],
  [/грузов[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|бортов[а-яё]* автомобил|шасси/i, 'грузовые автомобили'],
  [/автозапчаст|автосервис|ремонт[а-яё]* автомобил/i, 'автотовары и автосервис'],
  [/химическ[а-яё]* (?:продукц|сырь)|промышленн[а-яё]* хим/i, 'промышленная химия'],
  [/пластик|полимер/i, 'полимерная продукция'],
  [/производств[а-яё]* мебел|мебел/i, 'мебель'],
  [/туристическ[а-яё]* (?:услуг|поездк)|туроператор|турагент/i, 'туристические услуги'],
  [/гостиниц|отел[ьеяю]/i, 'гостиничные услуги'],
  [/фитнес|спортивн[а-яё]* клуб/i, 'фитнес-услуги'],
  [/салон[а-яё]* красот|косметолог/i, 'услуги красоты'],
  [/складск[а-яё]* (?:техник|оборудован)|погрузчик/i, 'складская техника'],
  [/промышленн[а-яё]* оборудован|станк[а-яё]*|компрессор/i, 'промышленное оборудование'],
  [/одежд|обув[ьи]/i, 'одежда и обувь'],
  [/продукт[а-яё]* питания|бакале|кондитерск/i, 'продукты питания'],
  [/saas|программн[а-яё]* обеспечени|it[- ]?платформ|цифров[а-яё]* платформ/i, 'программные продукты'],
];

const MARKET_PRESETS = {
  government: {
    subject: 'цифровые государственные сервисы',
    queries: ['"цифровизация государственных услуг" платформа', '"портал государственных услуг" регион'],
    relevance: /госуслуг|государственн[а-яё]* (?:услуг|сервис|портал)|муниципальн[а-яё]* (?:услуг|сервис|портал)|цифровизац[а-яё]* (?:государственн|муниципальн)/i,
    news: 'цифровизация государственных услуг Россия',
  },
  logistics: {
    subject: 'доставка для бизнеса',
    queries: ['"логистика для бизнеса" доставка компания', '"доставка для интернет-магазинов" компания тарифы'],
    relevance: /логистик|доставк|грузоперевоз|фулфилмент|отправлени/i,
    news: 'логистика доставка бизнес Россия рынок',
  },
  cybersecurity: {
    subject: 'кибербезопасность',
    queries: ['"кибербезопасность" решения для бизнеса компания', '"защита информации" продукты для бизнеса'],
    relevance: /кибербезопас|информационн[а-яё]* безопас|антивирус|защит[а-яё]* (?:данных|информации)/i,
    news: 'кибербезопасность бизнес Россия рынок',
  },
  distribution: {
    subject: 'оборудование',
    queries: ['"дистрибуция оборудования" поставки компания', '"оптовые поставки" оборудование каталог'],
    relevance: /дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* оборудования/i,
    news: 'дистрибуция оборудования рынок Россия',
  },
  manufacturing: {
    subject: 'продукция',
    queries: ['"производитель" "оптом" продукция купить', '"производство" продукция каталог компания'],
    relevance: /производств|изготавлива|фабрик|оптов/i,
    news: 'производство промышленность рынок Россия',
  },
  retail: {
    subject: 'товары',
    queries: ['"интернет-магазин" каталог товары цены', '"купить" "интернет-магазин" электроника'],
    relevance: /интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател/i,
    news: 'розничная торговля интернет-магазины рынок Россия',
  },
  food: { subject: 'продукты питания', queries: ['"продукты питания" производитель оптом', '"ресторанный сервис" компания'], relevance: /ресторан|продукт[а-яё]* питания|кейтеринг|кофейн/i, news: 'пищевая промышленность ресторанный рынок Россия' },
  finance: { subject: 'финансовые услуги', queries: ['"финансовые услуги" для бизнеса компания', '"банк для бизнеса" сервисы'], relevance: /банк|страхован|лизинг|кредит|плат[её]ж/i, news: 'финансовый рынок банки бизнес Россия' },
  construction: { subject: 'строительство', queries: ['"строительство" "инженерные решения" компания', '"стройматериалы" производитель поставщик'], relevance: /строительств|стройматериал|инженерн[а-яё]* систем/i, news: 'строительный рынок Россия динамика' },
  healthcare: { subject: 'медицинские услуги', queries: ['"медицинские услуги" клиника', '"медицина для бизнеса" компания'], relevance: /медицин|клиник|стоматолог|фармацевт/i, news: 'медицинский рынок клиники Россия' },
  education: { subject: 'обучение', queries: ['"корпоративное обучение" компания курсы', '"образование для бизнеса" программы'], relevance: /обучени|образован|курсы|тренинг/i, news: 'корпоративное обучение рынок Россия' },
  professional: { subject: 'профессиональные услуги', queries: ['"консалтинг для бизнеса" компания услуги', '"аудит" "юридические услуги" компания'], relevance: /консалтинг|аудит|юридическ|бухгалтер|внедрен/i, news: 'консалтинг профессиональные услуги рынок Россия' },
};

function clean(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(?:amp|quot|apos|lt|gt);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' })[entity])
    .replace(/\s+/g, ' ').trim();
}
function host(value = '') { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }

const SERVICE_SUBJECT_SCOPES = {
  healthcare: ['стоматологические услуги', 'медицинские услуги', 'услуги красоты'],
  education: ['образовательные программы', 'корпоративное обучение'],
  professional: ['юридические услуги', 'бухгалтерские и аудиторские услуги', 'туристические услуги', 'гостиничные услуги', 'фитнес-услуги', 'услуги красоты', 'программные продукты'],
};
const PRODUCT_INDUSTRIES = ['manufacturing', 'retail', 'distribution', 'construction', 'food'];
const SERVICE_SUBJECTS = new Set(Object.values(SERVICE_SUBJECT_SCOPES).flat());

export function marketSubject(research = {}, profile = {}) {
  const industry = profile.industry?.id || 'professional';
  const preset = MARKET_PRESETS[industry] || MARKET_PRESETS.professional;
  const own = (research.sources || []).filter(source => source.kind === 'company-site' && clean(source.text).length >= 40);
  const independent = (research.sources || []).filter(source => ['search-snippet', 'review-snippet'].includes(source.kind) && clean(source.text).length >= 40);
  const basis = own.length ? own : independent;
  const primaryText = basis[0] ? `${basis[0].title || ''} ${basis[0].text || ''}` : '';
  const secondaryText = basis.slice(1).map(source => `${source.title || ''} ${source.text || ''}`).join(' ');
  const offeringText = [...(research.offerings || []), ...own.flatMap(source => source.offerings || [])]
    .map(item => `${item.name || ''} ${item.displayName || ''}`).join(' ');
  const scopedSubjects = SERVICE_SUBJECT_SCOPES[industry]
    ? SUBJECTS.filter(([, name]) => SERVICE_SUBJECT_SCOPES[industry].includes(name))
    : PRODUCT_INDUSTRIES.includes(industry) ? SUBJECTS.filter(([, name]) => !SERVICE_SUBJECTS.has(name)) : [];
  const subjects = scopedSubjects.map(([pattern, name]) => {
    const count = text => Math.min(20, (text.match(new RegExp(pattern.source, 'gi')) || []).length);
    return { name, score: count(offeringText) * 12 + count(primaryText) * 4 + count(secondaryText) };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  return { industry, subject: subjects[0]?.name || preset.subject };
}

export function createMarketSearchPlan(research = {}, profile = {}) {
  const { industry, subject } = marketSubject(research, profile);
  const preset = MARKET_PRESETS[industry] || MARKET_PRESETS.professional;
  const productMarket = ['manufacturing', 'retail', 'distribution', 'construction', 'food'].includes(industry);
  const searchSubject = subject === 'товары для розжига' ? `спички ${subject}` : subject;
  const queries = subject !== preset.subject
    ? productMarket
      ? [`${searchSubject} производитель поставщик цены`, `${searchSubject} оптом каталог компания`]
      : [`${searchSubject} компания услуги цены`, `${searchSubject} организации сервис стоимость`]
    : preset.queries.map(query => query.replaceAll('"', ''));
  const year = new Date().getFullYear();
  const evidenceQueries = [
    { kind: 'industry-snippet', query: `${searchSubject} рынок динамика спрос ${year}`, message: `Проверяю отраслевую динамику и спрос: ${subject}` },
    { kind: 'customer-snippet', query: `${searchSubject} как выбрать отзывы жалобы клиенты`, message: `Ищу критерии выбора и повторяющиеся жалобы: ${subject}` },
    { kind: 'market-price-snippet', query: `${searchSubject} цены тарифы стоимость сравнение`, message: `Собираю рыночный ценовой контекст: ${subject}` },
  ];
  const newsQuery = subject === 'товары для розжига' ? 'спички производство' : `"${searchSubject}" (рынок OR производство OR спрос OR цены)`;
  const homeSource = (research.sources || []).find(source => source.kind === 'company-site') || research.sources?.[0];
  const titleParts = clean(homeSource?.title).split(/\s*(?:\||—|–|\s+-\s+)\s*/).filter(Boolean);
  const ownAlias = titleParts.length > 1 ? clean(titleParts.at(-1)) : '';
  const ownAliases = ownAlias.length >= 3 && ownAlias.length <= 100 ? [ownAlias] : [];
  return { industry, subject, companyName: clean(research.companyName || homeSource?.companyName), ownAliases, competitorQueries: queries, evidenceQueries, relevance: preset.relevance, newsQuery };
}

const NON_COMPANY_HOSTS = /(?:^|\.)(?:yandex\.ru|ya\.ru|2gis\.ru|zoon\.ru|yell\.ru|wikipedia\.org|wikimedia\.org|duckduckgo\.com|bing\.com|google\.com|rbc\.ru|kommersant\.ru|vedomosti\.ru|vc\.ru|cnews\.ru|tadviser\.ru|interfax\.ru|ria\.ru|iz\.ru|forbes\.ru|frc\.ru|tradedir\.ru|optomtovar\.ru|fabricators\.ru|o-zavodah\.ru|productcenter\.ru|supl\.biz|tiu\.ru|pulscen\.ru|optsbyt\.ru|optlist\.ru|mediam\.ru|ozon\.ru|wildberries\.ru|avito\.ru|sima-land\.ru|vseinstrumenti\.ru|onlinetrade\.ru|auchan\.ru|lemanapro\.ru|mktools\.ru|atann\.ru|farpost\.ru|joom\.ru)$/i;
const GENERIC_SUBJECTS = new Set(['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'цифровые государственные сервисы']);
const BRAND_ALIASES = { cdek: ['сдэк'], kaspersky: ['касперск'], dns: ['днс'] };
function subjectPattern(subject) {
  const roots = {
    'мыло': 'мыл', 'металлопродукция': 'металло', 'мебель': 'мебел', 'косметика': 'косметик', 'электроника': 'электрон',
    'стройматериалы': 'стройматериал', 'стоматологические услуги': 'стоматолог', 'медицинские услуги': 'медицин|клиник',
    'юридические услуги': 'юридическ|юрист|адвокат', 'бухгалтерские и аудиторские услуги': 'бухгалтер|аудит',
    'недвижимость': 'недвижимост|квартир|ипотек', 'ремонт и отделка помещений': 'ремонт|отделочн',
    'образовательные программы': 'образован|обучени|курс', 'корпоративное обучение': 'корпоративн[а-яё]* обучени|тренинг',
    'товары для розжига': 'спич|розжиг|древесн[а-яё]* (?:ролл|брикет)|сух[а-яё]* горюч|щеп[а-яё]* для копчен',
    'упаковка': 'упаковк|тар[аыуе]\\b', 'полиграфические услуги': 'полиграф|типограф|печат',
    'грузовые автомобили': 'грузов[а-яё]* автомобил|самосвал|тягач|бортов[а-яё]* автомобил|шасси',
    'автотовары и автосервис': 'автозапчаст|автосервис|автомобил', 'промышленная химия': 'химическ|химия',
    'полимерная продукция': 'полимер|пластик', 'туристические услуги': 'турист|туроператор|турагент',
    'гостиничные услуги': 'гостиниц|отел', 'фитнес-услуги': 'фитнес', 'услуги красоты': 'красот|косметолог',
    'складская техника': 'складск[а-яё]* техник|погрузчик', 'промышленное оборудование': 'промышленн[а-яё]* оборудован|станк|компрессор',
    'одежда и обувь': 'одежд|обув', 'продукты питания': 'продукт[а-яё]* питания|бакале|кондитерск',
    'программные продукты': 'saas|программн[а-яё]* обеспечени|платформ', 'доставка для бизнеса': 'доставк',
    'кибербезопасность': 'кибербезопас|информационн[а-яё]* безопас',
    'цифровые государственные сервисы': 'госуслуг|государственн[а-яё]* (?:услуг|сервис|портал)|муниципальн[а-яё]* (?:услуг|сервис|портал)',
  };
  return new RegExp(roots[subject] || subject, 'i');
}

export function isCompetitorContent(text, plan) {
  const value = clean(text); const generic = GENERIC_SUBJECTS.has(plan.subject);
  if (!generic && !subjectPattern(plan.subject).test(value)) return false;
  if (generic && !plan.relevance.test(value)) return false;
  return /производств|производител|изготавлива|фабрик|завод|оптов|оптом|цен[аыуе]|стоимост|каталог|купить|поставля|продаж/i.test(value);
}

export function isCompetitorCandidate(item, plan, siteUrl) {
  const candidateHost = host(item?.url);
  const ownHost = host(siteUrl);
  if (!candidateHost || candidateHost === ownHost || candidateHost.endsWith(`.${ownHost}`) || NON_COMPANY_HOSTS.test(candidateHost)) return false;
  const text = clean(`${item?.title || ''} ${item?.text || ''}`);
  const negative = clean(item?.title).match(/без\s+[^.!?]{0,40}/i)?.[0];
  if (negative && !GENERIC_SUBJECTS.has(plan.subject) && subjectPattern(plan.subject).test(negative)) return false;
  const ownBrand = ownHost.split('.')[0];
  const ownNames = [plan.companyName, ownBrand, ...(plan.ownAliases || []), ...(BRAND_ALIASES[ownBrand] || [])].map(value => clean(value).toLowerCase()).filter(value => value.length >= 3);
  if (ownNames.some(name => candidateHost.includes(name) || text.toLowerCase().includes(name))) return false;
  if (plan.industry === 'healthcare') {
    if (/(?:^|\.)(?:docdoc|prodoctorov|napopravku|sberhealth|zoon|yandex|2gis)\.[a-z.]+$/i.test(candidateHost)) return false;
    if (/мис\s+для|медицинск[а-яё]*\s+информационн[а-яё]*\s+систем|автоматизац[а-яё]*\s+клиник|it[- ]?решени[а-яё]*\s+для\s+клиник|сервис\s+онлайн-записи|агрегатор/i.test(text)) return false;
    if (!/клиник|лаборатор|медицинск[а-яё]*\s+центр|диагностик|стационар|пациент/i.test(text)) return false;
  }
  if (plan.subject === 'грузовые автомобили') {
    if (/(?:^|\.)(?:made-in-china\.com|alibaba\.com|aliexpress\.com)$/i.test(candidateHost)) return false;
    if (/запчаст|аксессуар|сувенир|кондиционер|сервисн[а-яё]*\s+обслуживан|автосервис|ремонт|грузоперевозк|аренд[аыуе]?\s+(?:грузов|авто|транспорт)/i.test(text)) return false;
    const vehicle = '(?:грузов[а-яё]*\\s+автомобил[ья]|грузовик[а-яё]*|самосвал[а-яё]*|седельн[а-яё]*\\s+тягач[а-яё]*|бортов[а-яё]*\\s+автомобил[ья])';
    const commerce = '(?:производ[а-яё]*|изготавлива[а-яё]*|прода[а-яё]*|купить|каталог|дилер[а-яё]*|автосалон[а-яё]*|цен[аыуе])';
    if (!new RegExp(`${commerce}[^.!?…]{0,120}${vehicle}|${vehicle}[^.!?…]{0,120}${commerce}`, 'i').test(text)) return false;
  }
  if (text.length < 18 || !isCompetitorContent(text, plan)) return false;
  if (/отзывы о|рейтинг компаний|топ-\d|лучшие компании|новости|статья|блог|руководство|как защитить|что такое|википедия|производители .*в России|\d+\s+поставщик|найдено\s+\d+\s+(?:компан|изготовител)/i.test(text)) return false;
  if (/\/(?:suppliers|producers)(?:\/|$)/i.test(candidateHost + new URL(item.url).pathname)) return false;
  return true;
}

export function isRelevantMarketNews(item, plan) {
  const text = clean(`${item?.title || ''} ${item?.text || ''}`);
  const published = Date.parse(item?.publishedAt || '');
  const fresh = Number.isFinite(published) && published <= Date.now() + 172800000 && Date.now() - published < 548 * 86400000;
  if (text.length < 20 || !fresh || /как спичк|спички пироманьяку|рассада|рассаду/i.test(text)) return false;
  if (!/рынок|рынк[аеу]|динамик|спрос|производств|завод|фабрик|экспорт|импорт|подорожа|подеше|цен[аыуе]|запуск/i.test(text)) return false;
  return GENERIC_SUBJECTS.has(plan.subject) ? plan.relevance.test(text) : subjectPattern(plan.subject).test(text);
}

export function isRelevantIndustryEvidence(item, plan, kind) {
  const text = clean(`${item?.title || ''} ${item?.text || ''}`);
  if (text.length < 60) return false;
  const relevantSubject = GENERIC_SUBJECTS.has(plan.subject) ? plan.relevance.test(text) : subjectPattern(plan.subject).test(text);
  if (!relevantSubject) return false;
  if (kind === 'customer-snippet') return /выбир|выбор|отзыв|жалоб|клиент|покупател|качеств|сервис/i.test(text);
  if (kind === 'market-price-snippet') return /цен[аыуе]|стоимост|тариф|прайс|бюджет/i.test(text);
  return /рынок|рынк[аеу]|динамик|спрос|рост[аеу]?|снижен|объ[её]м|тренд|прогноз|исследован|статистик/i.test(text);
}

export function competitorNameFrom(source = {}) {
  const legalForm = /^(?:ООО|АО|ПАО|ЗАО|ИП)\s+/i;
  const genericTitle = /^(?:логистика|кибербезопасность|доставка|производство|профессиональные услуги|спички|средства для розжига|розжиг)(?:\s+для\s+|$)/i;
  const structured = clean(source.organizationName || source.siteName).split(/[|—–·:]|\s+-\s+/)[0].trim().replace(legalForm, '');
  if (structured.length >= 3 && structured.length <= 100 && !genericTitle.test(structured) && !/^(?:www|главная|официальный сайт)$/i.test(structured)) return structured;
  const title = clean(source.title).split(/[|—–·:]|\s+-\s+/)[0].trim().replace(legalForm, '');
  if (title.length >= 3 && title.length <= 70 && !genericTitle.test(title) && !/купить|каталог|цены|оптом|доставка|производство|решения для|официальный сайт|^www$/i.test(title)) return title;
  const acronym = title.match(/(?:^|\s)([А-ЯЁA-Z][А-ЯЁA-Z-]{2,})(?:$|\s)/)?.[1];
  if (acronym && !/^(?:ООО|АО|ПАО|ЗАО|ИП|WWW)$/i.test(acronym)) return acronym;
  const hostname = host(source.url);
  const parts = hostname.split('.').filter(Boolean);
  const brand = (parts.length > 2 ? parts.at(-2) : parts[0]) || 'Компания';
  return brand.length <= 7 && !brand.startsWith('xn--') ? brand.toUpperCase() : brand;
}

export function relevantMarketQuote(source = {}, plan) {
  const sentences = String(source.text || '').match(/[^.!?…]+[.!?…]?/g) || [];
  const pattern = GENERIC_SUBJECTS.has(plan.subject) ? plan.relevance : subjectPattern(plan.subject);
  const matching = sentences.map(clean).filter(sentence => sentence.length >= 18 && pattern.test(sentence)).map(sentence => ({
    sentence,
    score: Math.min(sentence.length, 240) / 40 + (/производств|изготавлива|поставля|продаж|купить|каталог|цен[аыуе]|стоимост|услуг|сервис|оптом/i.test(sentence) ? 4 : 0),
  })).sort((a, b) => b.score - a.score);
  const selected = matching[0]?.sentence || '';
  return selected.length > 420 ? `${selected.slice(0, 417).trim()}…` : selected;
}
