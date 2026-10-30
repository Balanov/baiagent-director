const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

const CLAIM_FIELDS = ['title', 'why', 'action', 'processName', 'processAction'];
const CUSTOMER_EXPERIENCE = /отзыв|репутац|клиентск[а-яё]*\s+опыт/i;
const DIRECT_PROCESS = /регламент|порядок|этап|ответственн|согласу|проверя|обрабатыва|обработк|принима|переда(?:ёт|ет|ют|ч)|назнача|фиксиру|владел|маршрут|контрол|отвеча|онлайн[- ]запис|напомина|оформля|подтвержда|классифициру|хранени[ея]\s+верси|работа[ею]т\s+с\s+отзыв|технологическ[а-яё]*\s+(?:карт|процесс)|производственн[а-яё]*\s+задани|инструкци[а-яё]*\s+(?:для|к)|подготовк[а-яё]*\s+(?:к|перед)/i;
const GENERIC_OFFERING_LABEL = /^(?:подарочн[а-яё]*\s+сертификат[а-яё]*|(?:заказать\s+)?прайс(?:-лист)?|каталог|цены|товары|услуги|продукты)[.!?…]?$/i;

const TOPICS = [
  ['reviews', /отзыв|репутац|клиентск[а-яё]*\s+опыт/i],
  ['food-service', /ресторан|кафе|блюд|меню|аллерген|рецептур|повар|продукт[а-яё]*\s+питания|кейтеринг/i],
  ['software-product', /\b(?:software|saas)\b|программн[а-яё]*\s+(?:продукт|обеспечени)|цифров[а-яё]*\s+(?:продукт|платформ)/i],
  ['appointment', /запис[а-яё]*\s+(?:на\s+)?(?:при[её]м|анализ|услуг)|онлайн[- ]запис|расписан|напоминан[а-яё]*\s+о\s+(?:при[её]ме|визите)/i],
  ['documents', /документ|договор|спецификац|согласован|верси[а-яё]*\s+(?:чертеж|документ|материал)|чертеж|первичн[а-яё]*\s+документ|сч[её]т[- ]фактур/i],
  ['pricing', /цен[аыуеой]|стоимост|прайс|тариф|скидк|маржин/i],
  ['catalog', /товар|продукт|продукц|каталог|ассортимент|услуг|предложени|модел|практик/i],
  ['sales', /продаж|заказ|заявк|покупател|квалификац|подбор[а-яё]*\s+(?:товар|продукт|оборудован|решени)/i],
  ['support', /поддерж|обращени|вопрос|ответ|оператор|менеджер|продав|консультац/i],
  ['handoff', /передач|маршрут\s+согласован|между\s+продаж|производственн[а-яё]*\s+задани|технолог/i],
  ['knowledge', /знан|источник|поиск|материал|инструкц|база\s+ответ/i],
  ['logistics', /достав|отправлен|груз|посыл|трек[- ]|склад|запас|комплектац/i],
  ['healthcare', /протокол|врач|пациент|медицин|клиник|анализ[а-яё]*\s+(?:крови|пациент)/i],
  ['manufacturing', /производ|изготавлива|завод|фабрик|чертеж|спецификац/i],
  ['offering', /витрин|карточк[а-яё]*\s+(?:товар|продукт|предлож)|оффер|позицион|сценари[а-яё]*\s+(?:выбора|применения)/i],
];

const TOKEN_STOP = new Set([
  'этот', 'эти', 'этого', 'этой', 'после', 'перед', 'через', 'между', 'только', 'нужно', 'нужны', 'который', 'которая', 'которые',
  'компания', 'компании', 'клиент', 'клиенты', 'клиента', 'клиентов', 'процесс', 'процесса', 'пилот', 'проверить', 'проверка', 'проверки',
  'гипотеза', 'реальный', 'реальные', 'реальных', 'данные', 'данных', 'материалы', 'материалов', 'действие', 'результат', 'метрика', 'метрики',
  'собрать', 'сформировать', 'подготовить', 'ускорить', 'сократить', 'снизить', 'улучшить', 'повысить', 'превратить', 'связать', 'объединить',
  'baiagent', 'агент', 'агента', 'черновой', 'черновые', 'утверждённые', 'утвержденные', 'подтверждённый', 'подтвержденный', 'источник', 'источники',
  'вопрос', 'вопросы', 'ответ', 'ответы', 'владелец', 'владельца', 'процессе', 'работы', 'работа', 'одной', 'один', 'одна', 'без', 'для', 'или',
]);

function textForClaim(claim = {}) {
  if (typeof claim === 'string') return clean(claim);
  return CLAIM_FIELDS.map(field => claim?.[field]).map(clean).filter(Boolean).join(' ');
}

function topics(text) {
  return TOPICS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

function tokens(text) {
  const result = new Set();
  for (const raw of clean(text).toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || []) {
    const token = raw.replace(/^-+|-+$/g, '');
    if (token.length < 4 || TOKEN_STOP.has(token) || /^\d+$/.test(token)) continue;
    result.add(token);
  }
  return result;
}

function intersection(left, right) {
  return [...left].filter(value => right.has(value));
}

export function isCustomerExperienceClaim(claim) {
  return CUSTOMER_EXPERIENCE.test(textForClaim(claim));
}

export function assessEvidenceRelevance(claim, quote) {
  const claimText = textForClaim(claim);
  const evidenceText = clean(quote);
  const sharedTopics = intersection(new Set(topics(claimText)), new Set(topics(evidenceText)));
  const claimTokens = tokens(claimText);
  const sharedTerms = intersection(claimTokens, tokens(evidenceText)).filter(token => !/^(?:прайс|заказать|сертификат|сертификаты)$/.test(token));
  const genericLabel = GENERIC_OFFERING_LABEL.test(evidenceText);
  if (!sharedTopics.length && !sharedTerms.length) {
    return { status: 'irrelevant', basis: 'no-shared-topic-or-specific-term', topics: [], sharedTerms: [] };
  }
  if (genericLabel && !DIRECT_PROCESS.test(evidenceText)) {
    return { status: 'weak', basis: 'generic-offering-label', topics: sharedTopics, sharedTerms };
  }
  return {
    status: 'relevant',
    basis: sharedTopics.length ? 'shared-deterministic-topics' : 'shared-specific-term',
    topics: sharedTopics,
    sharedTerms: sharedTerms.slice(0, 5),
  };
}

export function classifyEvidence(claim, source, quote) {
  const relevance = assessEvidenceRelevance(claim, quote);
  const kind = source?.kind || 'unknown';
  const customerClaim = isCustomerExperienceClaim(claim);
  const directPublishedProcess = kind === 'company-site' && relevance.status === 'relevant' && DIRECT_PROCESS.test(clean(quote));
  const directInternalDocument = kind === 'local-document' && relevance.status === 'relevant' && DIRECT_PROCESS.test(clean(quote));
  let role = 'industry-context';
  if (kind === 'local-document') role = 'internal-document';
  else if (kind === 'company-site') role = directPublishedProcess ? 'published-process' : 'company-offering';
  else if (kind === 'review-snippet') role = 'customer-experience';
  else if (kind === 'customer-snippet') role = 'customer-context';
  else if (kind === 'search-snippet') role = 'company-mention';
  const directCustomerExperience = role === 'customer-experience' && customerClaim && relevance.status === 'relevant';
  const directness = directPublishedProcess || directInternalDocument || directCustomerExperience ? 'direct' : 'contextual';
  return { evidenceRole: role, directness, relevance: relevance.status, relevanceBasis: relevance.basis, relevanceTopics: relevance.topics };
}

export function directProcessEvidence(evidence = []) {
  return evidence.filter(item => item.directness === 'direct' && ['published-process', 'internal-document'].includes(item.evidenceRole) && item.relevance === 'relevant');
}

export function summarizeEvidenceQuality(evidence = []) {
  const direct = directProcessEvidence(evidence);
  const contextual = evidence.filter(item => !direct.includes(item));
  return {
    policy: 'deterministic-quote-relevance-v1',
    directProcessEvidenceCount: direct.length,
    directSourceCount: new Set(direct.map(item => item.sourceId)).size,
    contextualEvidenceCount: contextual.length,
    hypothesisKind: direct.length ? 'process-evidence' : 'discovery-industry-hypothesis',
    label: direct.length
      ? 'Есть прямое описание процесса; текущие недостатки и эффект всё равно требуют внутренней проверки.'
      : 'Discovery / отраслевая гипотеза: публичный контекст не доказывает внутренний процесс или его проблему.',
    requiresInternalEvidence: !direct.length,
  };
}

export const PROCESS_EVIDENCE_NOTES = {
  'published-process': 'Собственный источник описывает соответствующий процесс; текущие показатели и недостатки всё равно требуют внутренней проверки.',
  'internal-document': 'Внутренний документ связан с этим процессом по явным тематическим признакам; полноту регламента, владельца и показатели нужно подтвердить у ответственного.',
  'customer-experience': 'Отзывы подтверждают клиентский опыт, а не наличие внутреннего процесса разбора.',
  'industry-hypothesis': 'Собственное описание именно этого процесса не найдено. Доказательство подтверждает только отрасль, а процесс предложен как отраслевая гипотеза — не как существующий порядок или проблема компании.',
};

export function processEvidenceAssessment(claim, evidence = []) {
  const direct = directProcessEvidence(evidence);
  const internal = direct.find(item => item.evidenceRole === 'internal-document');
  const published = direct.find(item => item.evidenceRole === 'published-process');
  // Keep the established UI status for direct first-party evidence; the role and note distinguish internal documents.
  const status = internal || published ? 'published-process'
    : evidence.some(item => item.evidenceRole === 'customer-experience' && item.directness === 'direct') ? 'customer-experience'
      : 'industry-hypothesis';
  const note = internal ? PROCESS_EVIDENCE_NOTES['internal-document'] : PROCESS_EVIDENCE_NOTES[status];
  return { status, note };
}
