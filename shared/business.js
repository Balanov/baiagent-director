const INDUSTRIES = [
  { id: 'government', label: 'Государственные и муниципальные сервисы', pattern: /министерств|ведомств|муниципальн|государственн[а-яё]* (?:услуг|сервис|орган|портал)|орган[а-яё]* (?:власти|исполнительной)|госуслуг|администраци[яи] (?:города|региона|области|края|республики)/i },
  { id: 'cybersecurity', label: 'Разработка решений для кибербезопасности', pattern: /кибербезопас|антивирус|информационн[а-яё]* безопас|защит[а-яё]* (?:данных|информации|endpoint)/i },
  { id: 'logistics', label: 'Логистика и доставка', pattern: /логистик|курьерск|оператор доставки|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|отправлени|грузоперевоз|фулфилмент/i },
  { id: 'distribution', label: 'Дистрибуция товаров и оборудования', pattern: /дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* (?:оборудования|техники)/i },
  { id: 'manufacturing', label: 'Производство и продажа продукции', pattern: /производим|производител|производств|собственн[а-яё]* (?:производств|фабрик)|изготавлива|фабрик|завод-изготовител|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси/i },
  { id: 'retail', label: 'Продажа товаров и подбор решений для покупателей', pattern: /интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател|электроник|бытов[а-яё]* техник/i },
  { id: 'food', label: 'Продукты питания и ресторанный сервис', pattern: /ресторан|пицц|продукт[а-яё]* питания|кейтеринг|кофейн/i },
  { id: 'finance', label: 'Финансовые услуги', pattern: /банк(?!рот)|страхован|лизинг|кредит|плат[её]ж/i },
  { id: 'construction', label: 'Строительство и инженерные решения', pattern: /строительств|стройматериал|инженерн[а-яё]* систем|проектировани/i },
  { id: 'healthcare', label: 'Медицинские услуги и товары', pattern: /медицин|клиник|стоматолог|фармацевт/i },
  { id: 'education', label: 'Образование и профессиональное развитие', pattern: /обучени|образован|курсы|тренинг/i },
  { id: 'professional', label: 'Профессиональные услуги для клиентов', pattern: /консалтинг|аудит|юридическ|правов|адвокат|бухгалтер|внедрен/i },
];

const SEGMENTS = [
  { id: 'business', label: 'Компании и организации', pattern: /для бизнеса|юридическ[а-яё]* лиц|корпоративн|предприят|B2B/i },
  { id: 'consumers', label: 'Частные клиенты', pattern: /для дома|частн[а-яё]* (?:клиент|лиц|потребител)|физическ[а-яё]* лиц/i },
  { id: 'commerce', label: 'Интернет-магазины и продавцы', pattern: /для интернет-магазин|интернет-магазин(?:ов|ам|ами)|онлайн-продав|продавц[а-яё]* маркетплей|для маркетплейс/i },
  { id: 'partners', label: 'Партнёры, дилеры и франчайзи', pattern: /партн[её]р|дилер|франшиз|франчайз/i },
];

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
  return sources.map(source => {
    const sentences = String(source.text || '').match(/[^.!?…]+[.!?…]?/g) || [];
    const candidates = sentences.map(clean).filter(sentence => sentence.length >= 30 && pattern.test(sentence));
    if (!candidates.length) return null;
    const scored = candidates.map(sentence => {
      const matches = sentence.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) || [];
      const meaningfulLength = Math.min(sentence.length, 360);
      return { sentence, score: matches.length * 100 + meaningfulLength };
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
  logistics: /курьерск[а-яё]*(?:\s+(?:услуг|доставк)[а-яё]*)?|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|логистическ[а-яё]* (?:компан|оператор|услуг)/i,
  manufacturing: /производственн[а-яё]* (?:система|площадк|мощност|процесс)|завод|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси/i,
  finance: /банковск[а-яё]* (?:услуг|продукт|сервис)|банк\s+(?:для|предлагает)|открыть\s+(?:сч[её]т|вклад)|ипотек|дебетов[а-яё]* карт|кредитн[а-яё]* карт/i,
};

export function createBusinessProfile(research = {}) {
  const sources = research.sources || [];
  const own = sources.filter(source => source.kind === 'company-site' && clean(source.text).length >= 40);
  const external = sources.filter(source => !['company-site', 'local-document'].includes(source.kind) && clean(source.text).length >= 40);
  const independent = external.filter(source => ['search-snippet', 'review-snippet'].includes(source.kind));
  const basis = own.length ? own : independent;
  const combined = basis.map(source => `${source.title || ''} ${source.text || ''}`).join(' ');
  const primaryText = basis[0] ? `${basis[0].title || ''} ${basis[0].text || ''}` : '';
  const secondaryText = basis.slice(1).map(source => `${source.title || ''} ${source.text || ''}`).join(' ');
  const industries = INDUSTRIES.map(industry => {
    const strong = INDUSTRY_STRENGTH[industry.id];
    const score = countMatches(primaryText, industry.pattern) * 4 + countMatches(secondaryText, industry.pattern)
      + (strong ? countMatches(primaryText, strong) * 6 + countMatches(secondaryText, strong) * 2 : 0);
    return { ...industry, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const industry = industries[0] ? { ...industries[0], evidence: evidenceFrom(basis, new RegExp(`${INDUSTRY_STRENGTH[industries[0].id]?.source || ''}${INDUSTRY_STRENGTH[industries[0].id] ? '|' : ''}${industries[0].pattern.source}`, 'i')) } : null;
  const segments = SEGMENTS.map(segment => ({ ...segment, score: countMatches(combined, segment.pattern) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
    .map(item => ({ id: item.id, label: item.label, evidence: evidenceFrom(basis, item.pattern) }));
  const riskPattern = /утечк|взлом|хакерск|санкци|штраф|банкрот|задержан[а-яё]*|судебн[а-яё]* (?:иск|разбирательств)|массов[а-яё]* сбо[йи]|приостановил[а-яё]* (?:работу|при[её]м|выдачу)/i;
  const helpingPattern = /оказал[а-яё]* поддерж|помогл|борьб[а-яё]* с|опубликовал[а-яё]* исследован|исследовани[а-яё]* атак|обнаружил|выявил|предупреждает|защитил/i;
  const risks = external.flatMap(source => {
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
    industry, segments, risks, basis: own.length ? 'company' : external.length ? 'external' : 'none',
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
