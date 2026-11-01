import { createInternationalMarketSearchPlan, isInternationalCompetitorContent, isInternationalCompetitorPage, isInternationalIndustryEvidence, isRelevantInternationalReview } from './international-market.js';
import { researchLanguage } from './locale.js';

const SOFTWARE_PRODUCT_PATTERN = /\b(?:saas|software|software as a service|cloud platform|digital products?|mobile apps?|web platform)\b|программн[а-яё]* обеспечени|программн[а-яё]* продукт|справочн[а-яё]* [а-яё-]* ?систем|информационн[а-яё]* (?:систем|продукт|ресурс)|цифров[а-яё]* (?:платформ|продукт|сервис)|облачн[а-яё]* (?:платформ|сервис)|разработчик[а-яё]* (?:программ|систем|платформ|приложен)|онлайн[- ](?:сервис|платформ)|веб[- ](?:сервис|платформ)|мобильн[а-яё]* приложен/i;
const PROFESSIONAL_SERVICE_MARKETPLACE = /юридическ[а-яё]* услуг[а-яё]*\s+(?:оказывают|предоставляют)[^.!?…]{0,100}(?:исполнител|юрист|адвокат)|независим[а-яё]* исполнител[а-яё]*\s*[-—,:]?\s*(?:юрист|адвокат)|юридическ[а-яё]* компан[а-яё]*\s+на\s+платформе/i;
const SERVICE_MARKETPLACE_PATTERN = /(?:сервис|платформа|маркетплейс)\s+(?:поиска\s+|подбора\s+)?специалист|поиск\s+специалист|специалисты\s+напишут\s+сами|исполнител[а-яё]*\s+(?:пришлют|предложат)|заказчик[а-яё]*\s+и\s+исполнител/i;
const COLLABORATION_SOFTWARE_PATTERN = /team collaboration software|teamwork platform|collaboration platform|платформ[а-яё]*\s+(?:для\s+)?совместной\s+работы|\bJira\b|\bConfluence\b|\bBitbucket\b|project management/i;
const COLLABORATION_COMPETITOR_PATTERN = /team collaboration|teamwork|work management|project management|task management|knowledge management|corporate (?:wiki|messenger|workspace)|\bwiki\b|мессенджер|видеозвон|доски|совместная работа|совместной работы|управлени[а-яё]* проект|управлени[а-яё]* задач|баз[аы] знаний|корпоративн[а-яё]* портал/i;
const SOFTWARE_FAMILIES = [
  { id: 'ecommerce', identify: /ecommerce|e-commerce|commerce platform|online store|интернет-магазин/i, relevant: /ecommerce|e-commerce|commerce|online store|checkout|интернет-магазин/i },
  { id: 'engineering', identify: /\b(?:CAD|CAM|CAE|PLM)\b|product lifecycle|industrial software|digital twin|engineering software|инженерн[а-яё]* (?:программ|продукт|систем)/i, relevant: /\b(?:CAD|CAM|CAE|PLM)\b|product lifecycle|digital twin|engineering|manufacturing|computer-aided|инженерн[а-яё]* (?:программ|продукт|систем)|промышленн[а-яё]* (?:программ|продукт|систем)/i },
];
const RESTAURANT_MODEL_PATTERN = /сет[ьи][^.!?…]{0,24}ресторан|ресторан[а-яё]*\s+(?:русской\s+)?кухн|ресторанн[а-яё]*\s+сервис|формат[а-яё]*\s+фаст[- ]?к[эе]жуал/i;
const RESTAURANT_CONTEXT_PATTERN = /меню|блюд|блин|завтрак|десерт|суп[аыу]?|пельмен/i;
const RESTAURANT_COMPETITOR_PATTERN = /сет[ьи][^.!?…]{0,24}ресторан|ресторан[а-яё]*\s+(?:русской\s+)?кухн|блинн[а-яё]*|забронировать|заказать\s+столик/i;
const RESTAURANT_SUPPLIER_PATTERN = /обучени[а-яё]*\s+(?:официант|персонал)|курсы\s+(?:для\s+)?официант|поставщик[а-яё]*\s+(?:оборудования|мебели)|оборудовани[а-яё]*\s+для\s+ресторан|управлени[а-яё]*\s+ресторан|автоматизац[а-яё]*\s+ресторан|система\s+.*(?:меню|стандартов)/i;
const LOGISTICS_PROVIDER_PATTERN = /логистическ[а-яё]* (?:компан|оператор|услуг)|транспортн[а-яё]*[- ]?(?:логистическ[а-яё]* )?компан|курьерск[а-яё]* (?:служб|доставк|компан)|служб[а-яё]* доставки|оператор доставки|грузоперевоз|фулфилмент|экспедировани|\b3pl\b/i;
const LOGISTICS_CALCULATOR_PATTERN = /калькулятор|рассчита(?:ть|йте)|расч[её]т\s+(?:стоимости|тарифа|доставки)|calculator|calculate/i;
const SOFTWARE_SPECIALIST_AUDIENCES = [
  { name: 'юристов', pattern: /для\s+юрист|юристу|юристов|правов[а-яё]*\s+систем|for\s+legal(?:\s+teams?)?/i, emphasis: /справочн[а-яё]*\s+правов[а-яё]*\s+систем/i },
  { name: 'бухгалтеров', pattern: /для\s+бухгалтер|бухгалтеру|бухгалтеров|for\s+account/i },
  { name: 'кадровых специалистов', pattern: /кадров[а-яё]*\s+специалист|для\s+кадровик|кадровику|кадровиков|for\s+(?:hr|human resources)/i },
  { name: 'специалистов по закупкам', pattern: /специалист[а-яё]*\s+по\s+закупк|для\s+закуп|for\s+procurement/i },
  { name: 'медицинских специалистов', pattern: /медицинск[а-яё]*\s+организац|для\s+врач|for\s+(?:clinicians|medical professionals)/i },
  { name: 'специалистов строительной отрасли', pattern: /строительн[а-яё]*\s+организац|для\s+проектировщик|for\s+(?:architects|construction (?:companies|professionals)|civil engineers)/i },
];

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
  software: {
    subject: 'программные продукты',
    queries: ['"программные продукты" разработчик платформа', '"SaaS" платформа для бизнеса тарифы'],
    relevance: SOFTWARE_PRODUCT_PATTERN,
    news: 'программное обеспечение SaaS рынок цифровые продукты',
  },
  professional: { subject: 'профессиональные услуги', queries: ['"консалтинг для бизнеса" компания услуги', '"аудит" "юридические услуги" компания'], relevance: new RegExp(`${SERVICE_MARKETPLACE_PATTERN.source}|консалтинг|аудит|юридическ|бухгалтер|внедрен`, 'i'), news: 'консалтинг профессиональные услуги рынок Россия' },
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
  software: ['программные продукты'],
  professional: ['юридические услуги', 'бухгалтерские и аудиторские услуги', 'туристические услуги', 'гостиничные услуги', 'фитнес-услуги', 'услуги красоты'],
};
const PRODUCT_INDUSTRIES = ['manufacturing', 'retail', 'distribution', 'construction', 'food'];
const SERVICE_SUBJECTS = new Set(Object.values(SERVICE_SUBJECT_SCOPES).flat());
const SPECIALIST_SOFTWARE_PREFIX = 'программные и информационные продукты для';

export function marketSubject(research = {}, profile = {}) {
  const industry = profile.industry?.id || 'professional';
  const preset = MARKET_PRESETS[industry] || MARKET_PRESETS.professional;
  const own = (research.sources || []).filter(source => source.kind === 'company-site' && clean(source.text).length >= 40);
  const independent = (research.sources || []).filter(source => ['search-snippet', 'review-snippet'].includes(source.kind) && clean(source.text).length >= 40);
  const basis = own.length ? own : independent;
  const primaryText = basis[0] ? `${basis[0].title || ''} ${basis[0].text || ''}` : '';
  const secondaryText = basis.slice(1).map(source => `${source.title || ''} ${source.text || ''}`).join(' ');
  const offeringItems = [...(research.offerings || []), ...own.flatMap(source => source.offerings || [])]
    .map(item => clean(`${item.name || ''} ${item.displayName || ''}`)).filter(Boolean);
  const offeringText = offeringItems.join(' ');
  if (industry === 'professional' && SERVICE_MARKETPLACE_PATTERN.test(primaryText)) return { industry, subject: preset.subject };
  if (industry === 'food' && RESTAURANT_MODEL_PATTERN.test(primaryText) && RESTAURANT_CONTEXT_PATTERN.test(`${primaryText} ${secondaryText}`)) {
    return { industry, subject: 'ресторанный сервис' };
  }
  const count = (text, pattern) => Math.min(20, (text.match(new RegExp(pattern.source, 'gi')) || []).length);
  const scopedSubjects = SERVICE_SUBJECT_SCOPES[industry]
    ? SUBJECTS.filter(([, name]) => SERVICE_SUBJECT_SCOPES[industry].includes(name))
    : PRODUCT_INDUSTRIES.includes(industry) ? SUBJECTS.filter(([, name]) => !SERVICE_SUBJECTS.has(name)) : [];
  const subjects = scopedSubjects.map(([pattern, name]) => ({
    name, score: count(offeringText, pattern) * 12 + count(primaryText, pattern) * 4 + count(secondaryText, pattern),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (industry === 'software' && SOFTWARE_PRODUCT_PATTERN.test(`${primaryText} ${secondaryText} ${offeringText}`)) {
    const diversePortfolio = new Set(offeringItems).size >= 4 || basis.length >= 6;
    const specialistSubjects = SOFTWARE_SPECIALIST_AUDIENCES.map(audience => {
      const offeringSupport = offeringItems.filter(text => audience.pattern.test(text)).length;
      const pageSupport = basis.filter(source => audience.pattern.test(`${source.title || ''} ${source.text || ''}`)).length;
      const emphasized = audience.emphasis && (audience.emphasis.test(primaryText) || audience.emphasis.test(secondaryText));
      const focusedSmallPortfolio = !diversePortfolio && audience.pattern.test(primaryText);
      const corroboratedPortfolio = offeringSupport >= 2 && pageSupport >= 2;
      return {
        name: `${SPECIALIST_SOFTWARE_PREFIX} ${audience.name}`,
        supported: Boolean(emphasized || focusedSmallPortfolio || corroboratedPortfolio),
        score: count(offeringText, audience.pattern) * 12 + count(primaryText, audience.pattern) * 4 + count(secondaryText, audience.pattern)
          + (audience.emphasis ? count(primaryText, audience.emphasis) * 12 + count(secondaryText, audience.emphasis) * 6 : 0),
      };
    }).filter(item => item.score > 0 && item.supported).sort((a, b) => b.score - a.score);
    if (specialistSubjects.length) return { industry, subject: specialistSubjects[0].name };
  }
  return { industry, subject: subjects[0]?.name || preset.subject };
}

export function createMarketSearchPlan(research = {}, profile = {}) {
  const international = createInternationalMarketSearchPlan(research, profile);
  if (international) return international;
  const { industry, subject } = marketSubject(research, profile);
  const preset = MARKET_PRESETS[industry] || MARKET_PRESETS.professional;
  const productMarket = ['manufacturing', 'retail', 'distribution', 'construction', 'food'].includes(industry) && subject !== 'ресторанный сервис';
  const searchSubject = subject === 'товары для розжига' ? `спички ${subject}` : subject;
  const queries = subject !== preset.subject
    ? productMarket
      ? [`${searchSubject} производитель поставщик цены`, `${searchSubject} оптом каталог компания`]
      : industry === 'software'
        ? [`${searchSubject} разработчик продукты платформа`, `${searchSubject} тарифы подписка внедрение`]
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
  const homeText = clean(`${homeSource?.title || ''} ${homeSource?.text || ''}`);
  const titleParts = clean(homeSource?.title).split(/\s*(?:\||—|–|\s+-\s+)\s*/).filter(Boolean);
  const ownAlias = titleParts.length > 1 ? clean(titleParts.at(-1)) : '';
  const ownAliases = ownAlias.length >= 3 && ownAlias.length <= 100 ? [ownAlias] : [];
  const serviceMarketplace = industry === 'professional' && SERVICE_MARKETPLACE_PATTERN.test(homeText);
  const softwareText = `${homeText} ${(research.offerings || []).map(item => `${item.name || ''} ${item.displayName || ''}`).join(' ')}`;
  const specialist = subject.startsWith(`${SPECIALIST_SOFTWARE_PREFIX} `) ? SOFTWARE_SPECIALIST_AUDIENCES.find(audience => subject.endsWith(` ${audience.name}`)) : null;
  const softwareFamily = industry !== 'software' ? '' : specialist ? 'specialist'
    : COLLABORATION_SOFTWARE_PATTERN.test(softwareText) ? 'collaboration'
      : SOFTWARE_FAMILIES.find(family => family.identify.test(softwareText))?.id || '';
  const competitorQueries = serviceMarketplace
    ? ['"сервис поиска специалистов" заказчики исполнители', '"платформа для специалистов" заказы услуги']
    : softwareFamily === 'ecommerce' ? ['ecommerce platform enterprise pricing', 'online store platform for business']
      : softwareFamily === 'engineering' ? ['CAD CAM engineering software products', 'PLM product lifecycle management software']
        : softwareFamily === 'collaboration' ? ['team collaboration software platform', 'project management software for teams']
          : subject === 'ресторанный сервис' ? ['сеть ресторанов русской кухни меню', 'ресторан блины меню заказать столик']
            : queries;
  return { industry, subject, companyName: clean(research.companyName || homeSource?.companyName), ownAliases, serviceMarketplace, softwareFamily, softwareAudience: specialist?.pattern || null, competitorQueries, evidenceQueries, relevance: preset.relevance, newsQuery };
}

const NON_COMPANY_HOSTS = /(?:^|\.)(?:yandex\.ru|ya\.ru|2gis\.ru|zoon\.ru|yell\.ru|wikipedia\.org|wikimedia\.org|duckduckgo\.com|bing\.com|google\.com|rbc\.ru|kommersant\.ru|vedomosti\.ru|vc\.ru|cnews\.ru|tadviser\.ru|interfax\.ru|ria\.ru|iz\.ru|forbes\.ru|frc\.ru|tradedir\.ru|optomtovar\.ru|fabricators\.ru|o-zavodah\.ru|productcenter\.ru|supl\.biz|tiu\.ru|pulscen\.ru|optsbyt\.ru|optlist\.ru|mediam\.ru|ozon\.ru|wildberries\.ru|avito\.ru|sima-land\.ru|vseinstrumenti\.ru|onlinetrade\.ru|auchan\.ru|lemanapro\.ru|mktools\.ru|atann\.ru|farpost\.ru|joom\.ru|checko\.ru|behance\.net|pinterest\.[a-z.]+|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|twitter\.com|x\.com|reddit\.com|quora\.com|medium\.com|seclists\.org|arxiv\.org)$/i;
const GENERIC_SUBJECTS = new Set(['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'программные продукты', 'цифровые государственные сервисы']);
const BRAND_ALIASES = { cdek: ['сдэк'], kaspersky: ['касперск'], dns: ['днс'] };
function subjectPattern(subject) {
  if (subject.startsWith(`${SPECIALIST_SOFTWARE_PREFIX} `)) return SOFTWARE_PRODUCT_PATTERN;
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
    'ресторанный сервис': 'ресторан|кафе|фаст[- ]?к[эе]жуал|меню|блин|блюд',
    'программные продукты': 'saas|программн[а-яё]* обеспечени|платформ', 'доставка для бизнеса': 'доставк',
    'кибербезопасность': 'кибербезопас|информационн[а-яё]* безопас',
    'цифровые государственные сервисы': 'госуслуг|государственн[а-яё]* (?:услуг|сервис|портал)|муниципальн[а-яё]* (?:услуг|сервис|портал)',
  };
  return new RegExp(roots[subject] || subject, 'i');
}

function isEditorialCompetitorPage(item = {}) {
  const title = clean(item.title);
  const path = reviewPagePath(item);
  const declaredType = clean([item.pageType, item.ogType, item.structuredType, ...(Array.isArray(item.schemaTypes) ? item.schemaTypes : [])].filter(Boolean).join(' '));
  return /(?:^|\b)(?:article|newsarticle|blogposting)(?:\b|$)/i.test(declaredType)
    || /\/(?:article|articles|wiki|news|press|events?|conferences?|cases?|portfolio|projects?|resources?|blog|gallery|compilations)(?:\/|$)/i.test(path)
    || /\bобзор\b|рувики|энциклопед|википедия|представили|пресс-центр|конференц[а-яё]*|симпозиум[а-яё]*|\bconference\b|\bcongress\b|\bwhat is\b|\bhow to\b|mailing list/i.test(title);
}

export function isCompetitorContent(text, plan) {
  if (plan?.language && plan.language !== 'ru') return isInternationalCompetitorContent(text, plan);
  const value = clean(text); const generic = GENERIC_SUBJECTS.has(plan.subject);
  if (!generic && !subjectPattern(plan.subject).test(value)) return false;
  if (generic && !plan.relevance.test(value)) return false;
  if (plan.industry === 'software') {
    if (PROFESSIONAL_SERVICE_MARKETPLACE.test(value)) return false;
    if (plan.softwareFamily === 'collaboration' && !COLLABORATION_COMPETITOR_PATTERN.test(value)) return false;
    const family = SOFTWARE_FAMILIES.find(candidate => candidate.id === plan.softwareFamily);
    if (family && !family.relevant.test(value)) return false;
    if (plan.softwareFamily === 'specialist' && plan.softwareAudience && !plan.softwareAudience.test(value)) return false;
    return SOFTWARE_PRODUCT_PATTERN.test(value);
  }
  if (plan.subject === 'ресторанный сервис') return !RESTAURANT_SUPPLIER_PATTERN.test(value) && RESTAURANT_COMPETITOR_PATTERN.test(value);
  if (['professional', 'logistics', 'healthcare', 'education', 'finance'].includes(plan.industry)) {
    return /цен[аыуе]|стоимост|тариф|прайс|услуг|сервис|консультац|подключ|заказать|записаться|оставить заявку|подписк|внедрен|pricing|subscription|trial|demo|contact sales|get started/i.test(value);
  }
  return /производств|производител|изготавлива|фабрик|завод|оптов|оптом|цен[аыуе]|стоимост|каталог|купить|поставля|продаж/i.test(value);
}

export function isCompetitorCandidate(item, plan, siteUrl) {
  const candidateHost = host(item?.url);
  const ownHost = host(siteUrl);
  if (!candidateHost || candidateHost === ownHost || candidateHost.endsWith(`.${ownHost}`) || NON_COMPANY_HOSTS.test(candidateHost)) return false;
  const text = clean(`${item?.title || ''} ${item?.text || ''}`);
  if (isEditorialCompetitorPage(item)) return false;
  if (plan.serviceMarketplace && !SERVICE_MARKETPLACE_PATTERN.test(text)) return false;
  if (plan.industry === 'retail') {
    const wholesale = /оптом|оптов[а-яё]*|дистрибью|дистрибу|\bB2B\b/i.test(text);
    const retailFormat = /розничн[а-яё]*\s+(?:магазин|продаж)|оптом\s+и\s+в\s+розницу|в\s+розницу/i.test(text);
    if (wholesale && !retailFormat) return false;
  }
  const negative = clean(item?.title).match(/без\s+[^.!?]{0,40}/i)?.[0];
  if (negative && !GENERIC_SUBJECTS.has(plan.subject) && subjectPattern(plan.subject).test(negative)) return false;
  const ownBrand = ownHost.split('.')[0];
  const ownNames = [plan.companyName, ownBrand, ...(plan.ownAliases || []), ...(BRAND_ALIASES[ownBrand] || [])].map(value => clean(value).toLowerCase()).filter(value => value.length >= 3);
  if (ownNames.some(name => candidateHost.includes(name) || text.toLowerCase().includes(name))) return false;
  if (plan.language && plan.language !== 'ru') {
    const title = clean(item?.title).toLowerCase();
    const hostLabels = candidateHost.split('.');
    const ownOfferings = (plan.ownOfferingNames || []).map(value => clean(value).toLowerCase())
      .filter(name => name.length >= 4 && name.length <= 100 && !/^(?:products?|services?|software|platform|solutions?|home|smart home)$/i.test(name));
    if (ownOfferings.some(name => title.includes(name) || hostLabels.includes(name.replace(/[^\p{L}\p{N}]+/gu, '')))) return false;
    if (text.length < 18 || !isInternationalCompetitorContent(text, plan)) return false;
    return isInternationalCompetitorPage(item);
  }
  if (plan.industry === 'logistics') {
    const merchantDelivery = /интернет-магазин|мебел|корзина|доставка заказов|оплата и доставка/i.test(text)
      && /отправк[а-яё]*\s+через|доставк[а-яё]*\s+(?:через|транспортн)|транспортными компаниями|другие\s+ТК/i.test(text);
    if (merchantDelivery) return false;
    if (LOGISTICS_CALCULATOR_PATTERN.test(text)) {
      const titleBrand = competitorNameFrom(item);
      if (!titleBrand || !clean(item?.title).toLowerCase().includes(titleBrand.toLowerCase())) return false;
    } else if (!LOGISTICS_PROVIDER_PATTERN.test(text)) return false;
  }
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
  if (plan.language && plan.language !== 'ru') return plan.newsSignal.test(text) && plan.relevance.test(text);
  if (plan.serviceMarketplace && !SERVICE_MARKETPLACE_PATTERN.test(text)) return false;
  if (!/рынок|рынк[аеу]|динамик|спрос|производств|завод|фабрик|экспорт|импорт|подорожа|подеше|цен[аыуе]|запуск/i.test(text)) return false;
  return GENERIC_SUBJECTS.has(plan.subject) ? plan.relevance.test(text) : subjectPattern(plan.subject).test(text);
}

export function isRelevantIndustryEvidence(item, plan, kind) {
  if (plan?.language && plan.language !== 'ru') return isInternationalIndustryEvidence(item, plan, kind);
  const text = clean(`${item?.title || ''} ${item?.text || ''}`);
  if (text.length < 60) return false;
  if (plan.serviceMarketplace && !SERVICE_MARKETPLACE_PATTERN.test(text)) return false;
  const relevantSubject = GENERIC_SUBJECTS.has(plan.subject) ? plan.relevance.test(text) : subjectPattern(plan.subject).test(text);
  if (!relevantSubject) return false;
  if (kind === 'customer-snippet') return /выбир|выбор|отзыв|жалоб|клиент|покупател|качеств|сервис/i.test(text);
  if (kind === 'market-price-snippet') return /цен[аыуе]|стоимост|тариф|прайс|бюджет/i.test(text);
  return /рынок|рынк[аеу]|динамик|спрос|рост[аеу]?|снижен|объ[её]м|тренд|прогноз|исследован|статистик/i.test(text);
}

const REVIEW_SIGNAL_PATTERN = /отзыв|рейтинг|оценк|review|rating/i;
const REVIEW_DETAIL_PATTERN = /\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд(?:ую|уем|уете|уешь|уют|овал[аи]?)(?:\s|$|[,.!?])|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен|качество|персонал|доставк|возврат/i;
const REVIEW_STRONG_DETAIL_PATTERN = /\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд(?:ую|уем|уете|уешь|уют|овал[аи]?)(?:\s|$|[,.!?])|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен/i;
const REVIEW_EXPERIENCE_PATTERN = /(?:^|[\s.!?])(?:я|мы|мне|нам|мной|наш[а-яё]*)(?:\s|$|[,.!?])|\b(?:i|we|my|our)\b|купил|покупал|заказывал|пользу(?:юсь|емся)|используем|сотрудничаем|рекомендую\b|не\s+рекомендую\b|понравил|доволен|недоволен|достоинства\s*:|недостатки\s*:|установил|ездил|съездили|разжигаются|работает\b|сломал/i;

function normalizedReviewText(value = '') {
  return clean(value).toLowerCase().replace(/[«»"“”'’®™]/g, '').replace(/\s+/g, ' ').trim();
}

function reviewCompanyAliases(context, sources) {
  const research = context.research || context;
  const home = sources.find(source => source.kind === 'company-site') || sources[0];
  const siteUrl = context.siteUrl || research.siteUrl || research.requestedUrl || home?.url;
  const rawNames = [context.companyName || research.companyName, home?.companyName, home?.organizationName, home?.siteName, ...(context.ownAliases || research.ownAliases || [])];
  const aliases = new Set();
  for (const rawName of rawNames) {
    const value = clean(rawName).replace(/^(?:ООО|АО|ПАО|ЗАО|ИП)\s+/i, '');
    const parts = [value, ...value.split(/\s+(?:-|—|–|\|)\s+|\s*[\\:]\s*/)];
    for (const quoted of value.matchAll(/[«"“]([^»"”]{3,70})[»"”]/g)) parts.push(quoted[1]);
    for (const part of parts) {
      const alias = normalizedReviewText(part);
      if (alias.length >= 3 && alias.length <= 70 && !/^(?:главная|официальный сайт|компания)$/i.test(alias)) {
        aliases.add(alias);
        const spacedAlias = alias.replace(/\s*[-–—]+\s*/g, ' ').trim();
        if (spacedAlias !== alias && spacedAlias.split(/\s+/).every(token => token.length >= 3)) aliases.add(spacedAlias);
      }
    }
  }
  const ownBrand = host(siteUrl).split('.')[0];
  if (ownBrand.length >= 3) {
    aliases.add(normalizedReviewText(ownBrand));
    for (const alias of BRAND_ALIASES[ownBrand] || []) aliases.add(normalizedReviewText(alias));
  }
  return [...aliases];
}

function reviewOfferingAliases(context, sources) {
  const research = context.research || context;
  const offerings = [
    ...(context.offerings || research.offerings || []),
    ...sources.filter(source => source.kind === 'company-site').flatMap(source => source.offerings || []),
  ];
  return [...new Set(offerings.flatMap(item => [item?.name, item?.displayName])
    .map(normalizedReviewText)
    .filter(name => name.length >= 4 && name.length <= 100
      && !/^(?:продукция|продукты|товары|услуги|сервисы|доставка|products?|services?|software|platform)$/i.test(name)
      && !/заказать|прайс-лист|узнать цену|получить предложение/i.test(name)))];
}

function hasPurposefulMention(text, aliases) {
  for (const alias of aliases) {
    let offset = 0;
    while (offset < text.length) {
      const index = text.indexOf(alias, offset);
      if (index < 0) break;
      const before = text.slice(Math.max(0, index - 56), index);
      const incidental = /(?:доставк[а-яё]*|комплектац[а-яё]*|shipping|delivery|carrier|для|на|под|совместим[а-яё]*(?:\s+с)?|compatible\s+(?:with|for)|for)(?:\s+[\w-]+){0,3}\s*$/i.test(before);
      if (!incidental) return true;
      offset = index + alias.length;
    }
  }
  return false;
}

function hasFuzzyOfferingMention(text, aliases, companyAliases = []) {
  const genericTokens = /^(?:продукц|продукт|товар|услуг|сервис|доставк|product|service|software|platform|digital|solution)/i;
  const companyTokens = new Set(companyAliases.flatMap(alias => alias.split(/[^\p{L}\p{N}]+/u)).filter(Boolean));
  return aliases.some(alias => {
    if (alias.length > 60 || alias.split(/\s+/).length > 3) return false;
    return alias.split(/[^\p{L}\p{N}]+/u).some(token => token.length >= 5 && !companyTokens.has(token) && !genericTokens.test(token)
      && text.includes(token.slice(0, 6)));
  });
}

function reviewPagePath(item) {
  try { return new URL(item?.url || '').pathname; } catch { return ''; }
}

function isProductReviewPage(item, text) {
  return /\/(?:product|products|goods|item|catalog|katalog)(?:\/|$)/i.test(reviewPagePath(item))
    || /(?:^|\s)товар\s*[—:]|отзыв[а-яё]*\s+о\s+товаре|отзывы\s+покупателей\s+и\s+пользователей/i.test(text);
}

/**
 * Determines both review form and relevance to the researched company.
 * context may be the full research object or { companyName, siteUrl, sources, offerings, ownAliases }.
 */
export function isRelevantCompanyReview(item = {}, context = {}) {
  const research = context.research || context;
  const sources = context.sources || research.sources || [];
  if (researchLanguage({ ...research, language: context.language || research.language }) !== 'ru') return isRelevantInternationalReview(item, context, sources);
  const title = normalizedReviewText(item.title);
  const text = normalizedReviewText(`${item.title || ''} ${item.text || ''}`);
  const path = reviewPagePath(item);
  const ownBusinessText = normalizedReviewText(sources.filter(source => source.kind === 'company-site').map(source => `${source.title || ''} ${source.text || ''} ${(source.offerings || []).map(offering => offering.name || '').join(' ')}`).join(' '));
  const accommodation = /мини[-\s]*отел|гостиниц|хостел|база\s+отдыха|апартамент|\bhotel\b|\bhostel\b/i;
  // A coinciding brand name is not proof of identity when the reviewed business type is absent from the company itself.
  if (accommodation.test(title) && !accommodation.test(ownBusinessText)) return false;
  if (!text || /отзыв[а-яё]* сотрудник|отзыв[а-яё]* о работодател|работа в |зарплат/i.test(title)
    || /условия труда|карьерных возможност/i.test(text)) return false;
  if (/аналитик[аи]|продажи бренда|объ[её]м продаж/i.test(text)) return false;
  const hasExperience = REVIEW_EXPERIENCE_PATTERN.test(text);
  const body = normalizedReviewText(item.text);
  const emptyReviewPage = /рейтинг\s*0\s*\(?0\)?|0\s+отзыв|отзывов\s*0|пока нет отзывов|нет отзывов|оставьте первый отзыв|написать первый отзыв/i.test(body);
  const requiredDetailPattern = item.contentOrigin === 'full-page' ? REVIEW_DETAIL_PATTERN : REVIEW_STRONG_DETAIL_PATTERN;
  if ((emptyReviewPage && !hasExperience) || (!hasExperience && !requiredDetailPattern.test(body))) return false;
  if (/\/menu(?:\/|$)/i.test(path) && !hasExperience && !/\d+\s*(?:отзыв|reviews?)/i.test(text)) return false;
  const reviewPath = /\/(?:review|reviews|otzyv|otzyvy|otzyvy_vladelcev)[\w.-]*/i.test(path);
  const declaredType = normalizedReviewText([item.pageType, item.ogType, item.structuredType, ...(Array.isArray(item.schemaTypes) ? item.schemaTypes : [])].filter(Boolean).join(' '));
  const declaredArticle = /(?:^|\s)(?:article|newsarticle|blogposting)(?:\s|$)/i.test(declaredType);
  const substantiveReviewArticle = /обзор|review/i.test(title) && hasExperience && REVIEW_DETAIL_PATTERN.test(text);
  if (/\/search(?:\/|$)/i.test(path) || /результаты\s+поиска|поиск\s+товаров/i.test(title)) return false;
  if (declaredArticle && !reviewPath && !/отзыв|review/i.test(title) && !substantiveReviewArticle) return false;
  if (/^как\s+(?!я\b|мы\b|мо[йяи]\b)/i.test(title) && !reviewPath) return false;
  if (/инструкци|руководство/i.test(title) && !reviewPath) return false;
  if (/дистрибьютор|дистрибутор/i.test(title) && !reviewPath) return false;
  if (!REVIEW_SIGNAL_PATTERN.test(text) || (!REVIEW_DETAIL_PATTERN.test(text) && !hasExperience)) return false;
  const companyAliases = reviewCompanyAliases(context, sources);
  const offeringAliases = reviewOfferingAliases(context, sources);
  const fuzzyOfferingMatch = hasFuzzyOfferingMention(text, offeringAliases, companyAliases);
  const matchingTitle = title.replace(/\s*[-–—]+\s*/g, ' ');
  const directCompanyTitle = companyAliases.some(alias => matchingTitle.includes(alias));
  const companyInTitle = hasPurposefulMention(matchingTitle, companyAliases) || (directCompanyTitle && fuzzyOfferingMatch);
  const searchSnippet = item.contentOrigin === 'search-snippet';
  const companyInMaterial = hasPurposefulMention(searchSnippet ? body : text, companyAliases);
  const exactBodyOffering = offeringAliases.some(name => body.includes(name));
  const snippetOfferingMatch = !searchSnippet || exactBodyOffering || hasFuzzyOfferingMention(body, offeringAliases, companyAliases);
  const exactOfferingMatch = offeringAliases.some(name => text.includes(name));
  const offeringMatch = exactOfferingMatch || (companyInTitle && fuzzyOfferingMatch);
  const supplierBeforeCompany = companyAliases.some(alias => {
    const companyAt = title.indexOf(alias); const supplierAt = title.search(/поставщик|дилер|дистрибьютор|дистрибутор|автосалон/i);
    return supplierAt >= 0 && companyAt > supplierAt;
  });
  if (supplierBeforeCompany && !exactOfferingMatch) return false;
  const productPage = isProductReviewPage(item, text);
  if (productPage && (!hasExperience || (offeringAliases.length ? !offeringMatch : !companyInTitle))) return false;
  if (/\/shop(?:\/|$)/i.test(path) && offeringAliases.length && !offeringMatch) {
    const ownText = normalizedReviewText(sources.filter(source => source.kind === 'company-site').map(source => `${source.title || ''} ${source.text || ''}`).join(' '));
    if (ownText && !/интернет-магазин|розничн[а-яё]*\s+(?:магазин|продаж)/i.test(ownText)) return false;
  }
  const market = context.marketContext || research.marketContext || {};
  if (market.industry === 'logistics' && /(?:^|[\s.])shopping\b|шопп?инг/i.test(title)) return false;
  const trustedCompanyMap = /(?:^|\.)yandex\.[a-z.]+$/i.test(host(item.url)) && /\/maps\/org\//i.test(path)
    || /(?:^|\.)2gis\.[a-z.]+$/i.test(host(item.url)) && /\/firm\//i.test(path);
  const directCompanyReview = trustedCompanyMap && companyInTitle && companyInMaterial;
  const subject = market.subject;
  if (subject && !offeringMatch && !directCompanyReview) {
    const sameMarket = GENERIC_SUBJECTS.has(subject) ? context.marketContext?.relevance?.test(text) : subjectPattern(subject).test(text);
    if (!sameMarket) return false;
  }
  return companyInMaterial || offeringMatch && snippetOfferingMatch;
}

function decodePunycodeLabel(label) {
  if (!label.startsWith('xn--')) return label;
  try {
    const encoded = label.slice(4).toLowerCase();
    const output = [];
    let n = 128; let i = 0; let bias = 72;
    const delimiter = encoded.lastIndexOf('-');
    let index = 0;
    if (delimiter >= 0) {
      const basic = encoded.slice(0, delimiter);
      if (!/^[\x00-\x7f]*$/.test(basic)) return label;
      for (const character of basic) output.push(character.codePointAt(0));
      index = delimiter + 1;
    }
    const adapt = (delta, points, first) => {
      let value = first ? Math.floor(delta / 700) : Math.floor(delta / 2);
      value += Math.floor(value / points);
      let k = 0;
      while (value > 455) { value = Math.floor(value / 35); k += 36; }
      return k + Math.floor((36 * value) / (value + 38));
    };
    while (index < encoded.length) {
      const previous = i;
      let weight = 1;
      for (let k = 36; ; k += 36) {
        if (index >= encoded.length) return label;
        const code = encoded.charCodeAt(index++);
        const digit = code >= 48 && code <= 57 ? code - 22 : code >= 97 && code <= 122 ? code - 97 : NaN;
        if (!Number.isFinite(digit)) return label;
        i += digit * weight;
        const threshold = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
        if (digit < threshold) break;
        weight *= 36 - threshold;
        if (!Number.isSafeInteger(i) || !Number.isSafeInteger(weight)) return label;
      }
      bias = adapt(i - previous, output.length + 1, previous === 0);
      n += Math.floor(i / (output.length + 1));
      i %= output.length + 1;
      if (n > 0x10ffff) return label;
      output.splice(i, 0, n);
      i += 1;
    }
    return String.fromCodePoint(...output);
  } catch { return label; }
}

export function competitorNameFrom(source = {}) {
  const legalForm = /^(?:ООО|АО|ПАО|ЗАО|ИП)\s+/i;
  const genericTitle = /^(?:(?:логистика|кибербезопасность|доставка|производство|профессиональные услуги|спички|средства для розжига|розжиг)(?:\s+для\s+|$)|(?:аутсорсинг|производитель оптом|производители|услуги|каталог|главная|информационные ресурсы|document|www|españa|spain|united states|india|china|россия|ai innovation workspace|task and project management software|project & work management software|transporte y entrega de mercancías)|(?:collaboration|project management|team collaboration)(?:\s+(?:software|platform|tool))*)$/i;
  const normalize = value => {
    const cleaned = clean(value).replace(legalForm, '').replace(/^(?:интернет-магазин|официальный сайт|компания)\s+/i, '').trim();
    const domainLabel = cleaned.match(/^(?:www\.)?([\p{L}\p{N}-]+)\.[a-z]{2,}$/iu)?.[1];
    return domainLabel || cleaned;
  };
  const usable = (value, limit = 70) => value.length >= 3 && value.length <= limit && !genericTitle.test(value)
    && !/(?:\.{3}|…)|купить|каталог|цен[аыуе]|стоимост|оптом|доставка|производств|решения для|официальный сайт|рассчита|калькулятор|^www$|^(?:online\s+)?project management\b/i.test(value);
  const labels = host(source.url).split('.').filter(Boolean);
  const publicSuffix = /^(?:com|net|org|ru|su|io|ai|co|uk|de|fr|es|it|eu|cn|in|au|br|mx|jp|nl|se|no|fi|pl|cz|sk|ua|kz|by|biz|info|app|dev|cloud|xyz|online|site|shop|store|tech|me|tv|cc|us|ca|ch|at|be|dk|ie|pt|gr|tr|sa|ae|qa|za|gov|edu|mil|xn--[a-z0-9-]+)$/i;
  const lastLabel = labels.at(-1) || '';
  const rawDomainBrand = labels.length > 1 && !publicSuffix.test(lastLabel) ? lastLabel : labels.at(-2) || labels[0] || '';
  const decodedDomainBrand = decodePunycodeLabel(rawDomainBrand);
  const formatDomainBrand = value => {
    const brand = decodePunycodeLabel(value) || 'Компания';
    return brand.length <= 7 ? brand.toUpperCase() : brand;
  };
  const domainEscaped = decodedDomainBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const domainConfirmed = decodedDomainBrand.length >= 3 && new RegExp(`(?<![\\p{L}\\p{N}])${domainEscaped}(?![\\p{L}\\p{N}])`, 'iu').test(clean(`${source.organizationName || ''} ${source.siteName || ''} ${source.title || ''} ${source.text || ''}`));
  const descriptiveTitle = /^(?:(?:log[ií]stic[ao]s?|transporte|env[ií]os?|paqueter[ií]a|delivery|shipping|logistics|software|services?|soluciones|solutions?|confiable|reliable|segura|secure|global|internacional|international|express|rápida|fast|calidad|quality|empresarial|business|mercancías|freight|transport|entrega|españa|spain|china|bahrain|bahrein|europe|europa|desde|hasta|de|a|y|from|to|and|логистика|над[её]жн[а-яё]*|доставка|транспорт|услуги|качество|para|empresas|for)\s*)+$/iu;
  const structured = normalize(clean(source.organizationName || source.siteName).split(/[|—–·:\\]|\s+-\s+/)[0]);
  if (usable(structured, 100)) return structured;
  const rawTitle = clean(source.title);
  const leadingAcronym = rawTitle.match(/^(?:(?:ООО|АО|ПАО|ЗАО|ИП)\s+)?([А-ЯЁA-Z][А-ЯЁA-Z0-9-]{2,})(?:$|\s)/)?.[1];
  if (leadingAcronym && !/^(?:ООО|АО|ПАО|ЗАО|ИП|WWW)$/i.test(leadingAcronym)) return leadingAcronym;
  const titleParts = rawTitle.split(/[|—–·:\\]|\s+-\s+/).map(part => normalize(part)
    .replace(/^(?:тарифы|цены|прайс|стоимость)\s+/i, '')
    .replace(/\s+для\s+(?:бизнеса|компаний|организаций|юристов|бухгалтеров).*$/i, '').trim()).filter(Boolean);
  const titleBrand = titleParts.find(part => usable(part));
  if (titleBrand && !(descriptiveTitle.test(titleBrand) && !titleBrand.toLocaleLowerCase().includes(decodedDomainBrand.toLocaleLowerCase()))) return titleBrand;
  const acronym = rawTitle.match(/(?:^|\s)([А-ЯЁA-Z][А-ЯЁA-Z0-9-]{2,})(?:$|\s)/)?.[1];
  if (acronym && !/^(?:ООО|АО|ПАО|ЗАО|ИП|WWW)$/i.test(acronym)) return acronym;
  const rawBrand = !publicSuffix.test(lastLabel) && !domainConfirmed ? labels.at(-2) || rawDomainBrand : rawDomainBrand;
  return formatDomainBrand(rawBrand);
}

export function relevantMarketQuote(source = {}, plan) {
  const sentences = [source.title, ...(String(source.text || '').match(/[^.!?…]+[.!?…]?/g) || [])].filter(Boolean);
  const matching = sentences.map(clean).filter(sentence => sentence.length >= 18 && isCompetitorContent(sentence, plan)).map(sentence => ({
    sentence,
    score: Math.min(sentence.length, 240) / 40 + (/производств|изготавлива|поставля|продаж|купить|каталог|цен[аыуе]|стоимост|услуг|сервис|оптом/i.test(sentence) ? 4 : 0),
  })).sort((a, b) => b.score - a.score);
  const selected = matching[0]?.sentence || '';
  return selected.length > 420 ? `${selected.slice(0, 417).trim()}…` : selected;
}
