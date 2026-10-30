import { verifyAnalysis, verifyFinalAnalysis } from './verification.js';
import { createMarketIntelligence, offeringDisplayName } from './advisor.js';
import { createBusinessProfile, executiveSummary } from './business.js';
import { enrichAuditOpportunities, PROCESS_PLAYBOOKS, auditIndustryFor } from './audit.js';
import { classifyEvidence } from './evidence-quality.js';
import { marketSubject } from './market-plan.js';

function quoteFor(source, pattern, minimumLength = 20) {
  const sentences = source.text.match(/[^.!?…]+[.!?…]?/g) || [source.text];
  const matching = sentences.filter(sentence => pattern.test(sentence) && sentence.trim().length >= minimumLength).sort((a, b) => {
    const score = sentence => (/возможн|позвол|предостав|получа|можно|регламент|правил|этап|сервис/i.test(sentence) ? 3 : 0)
      + (/клиент|партн[её]р|пользовател|документ|пациент|заказчик/i.test(sentence) ? 1 : 0)
      - (/подробнее|читать все|читать далее|перейти|главная/i.test(sentence) ? 2 : 0);
    return score(b) - score(a) || a.length - b.length;
  });
  const selected = (matching[0] || sentences.find(sentence => sentence.trim().length >= minimumLength) || source.text).trim();
  if (selected.length <= 320) return selected;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const candidates = [...selected.matchAll(new RegExp(pattern.source, flags))].map(match => {
    const beforeStart = Math.max(0, match.index - 180);
    const before = selected.slice(beforeStart, match.index);
    const boundary = Math.max(...['.', '!', '?', '…'].map(mark => before.lastIndexOf(mark)));
    const sentenceStart = boundary >= 0 ? beforeStart + boundary + 1 : -1;
    let start = sentenceStart >= 0 && match.index - sentenceStart <= 200 ? sentenceStart : Math.max(0, match.index - 120);
    if (start > 0 && start !== sentenceStart) start = selected.indexOf(' ', start) + 1 || start;
    const remainder = selected.slice(match.index + match[0].length);
    const punctuation = remainder.search(/[.!?…]/);
    let end = punctuation >= 0 && punctuation <= 280 ? match.index + match[0].length + punctuation + 1 : Math.min(selected.length, start + 320);
    if (end < selected.length && punctuation < 0) end = selected.lastIndexOf(' ', end) || end;
    const quote = selected.slice(start, end).trim();
    const context = selected.slice(Math.max(0, match.index - 100), match.index + 180);
    const explanatory = /возможн|позвол|предостав|получа|можно|правил|регламент|клиент|партн[её]р|пользовател|документ|сервис|этап/i.test(context);
    return { quote, score: match[0].length * 3 + (explanatory ? 35 : 0) + (start === sentenceStart ? 20 : 0) };
  }).filter(item => item.quote.length >= minimumLength).sort((a, b) => b.score - a.score);
  return candidates[0]?.quote || selected.slice(0, 320);
}

function evidenceFor(item, sources) {
  if (!item?.sourceId || !item?.quote) return null;
  const source = sources.find(candidate => candidate.id === item.sourceId);
  return source ? { sourceId: source.id, quote: item.quote, url: item.url || source.url, sourceTitle: item.sourceTitle || source.title } : null;
}

function uniqueEvidence(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item) return false;
    const key = `${item.sourceId}|${item.quote}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 3);
}

function genericOpportunities(usable) {
  const definitions = [
    { pattern: /цен[аыуеой]|стоимост|прайс|price|pricing|тариф/i, title: 'Ускорить ответы на вопросы о стоимости', category: 'revenue', why: 'На сайте есть информация о ценах или условиях. Гипотеза: типовой ответ можно собирать из утверждённых данных, оставляя менеджеру нестандартные случаи.', action: 'Собрать правила ответов, взять реальные обезличенные обращения и сравнить черновые ответы с ответами менеджера.', metric: 'Время первого ответа и доля ответов, принятых без исправлений.' },
    { pattern: /услуг|сервис|продукт|решени|продукц|service|product|solution/i, title: 'Подготовить первичную консультацию по продуктам', category: 'offering', why: 'Описания предложений опубликованы. Гипотеза: из них можно собрать консультацию, которая не выдумывает условия и показывает источник ответа.', action: 'Сформировать базу ответов только из подтверждённых материалов и проверить её на эталонных вопросах клиентов.', metric: 'Полнота и корректность ответов на эталонном наборе вопросов.' },
    { pattern: /контакт|почт|телефон|связаться|contact|email|phone|@/i, title: 'Упростить маршрутизацию входящих обращений', category: 'cost', why: 'Контактный канал опубликован. Можно отдельно проверить классификацию обращений и подготовку карточки для ответственного без автономных решений.', action: 'Настроить черновую классификацию с журналом, причиной маршрутизации и обязательной проверкой человеком.', metric: 'Доля корректно классифицированных обращений и число потерянных обращений.' },
  ];
  return definitions.map(definition => {
    const source = usable.find(item => definition.pattern.test(item.text));
    if (!source) return null;
    return { ...definition, pattern: undefined, confidence: 'low', unknowns: ['Нужны реальные обращения, владелец процесса и исходная метрика'], decision: 'Продолжать только если эталонная проверка подтверждает качество и владелец процесса видит измеримую пользу.', steps: ['Зафиксировать текущий процесс и исходную метрику.', 'Собрать обезличенный эталонный набор и правила остановки.', 'Провести ограниченный пилот с подтверждением человеком.', 'Сравнить результат с исходным и решить: масштабировать, изменить или остановить.'], evidence: [{ sourceId: source.id, quote: quoteFor(source, definition.pattern) }] };
  }).filter(Boolean);
}

const INDUSTRY_PLAYBOOKS = {
  logistics: [
    { title: 'Сократить путь от запроса на доставку к оформленному отправлению', category: 'revenue', action: 'В BAIagent собрать черновой сценарий: адреса, вес и габариты, срок, объявленная ценность, наложенный платёж и ограничения. Агент запрашивает недостающие параметры и подготавливает расчёт только по утверждённым тарифам; нестандартный маршрут и заказ подтверждает оператор.', metric: 'Доля полных запросов, время до расчёта и конверсия расчёта в отправление.', evidencePattern: /заявк[а-яё]*\s+на\s+(?:доставк|перевозк|отправлен)|оформить\s+(?:доставк|отправлен)|рассчитать\s+(?:стоимость|тариф|доставк)|вес\s+и\s+габарит|параметр[а-яё]*\s+отправлен/i, firstStep: 'Разобрать реальные обращения и выделить параметры, без которых оператор не может рассчитать отправление.' },
    { title: 'Обработка перевозочных документов и исключений', category: 'cost', action: 'Настроить извлечение согласованных полей из накладных и актов, связь документа с отправлением и карточку расхождения. BAIagent не закрывает претензию, не меняет количество и не проводит документ с нераспознанными критическими полями; решение остаётся за логистом.', metric: 'Время обработки комплекта, точность полей и время регистрации исключения.', evidencePattern: /накладн|транспортн[а-яё]*\s+документ|сопроводительн[а-яё]*\s+документ|акт[а-яё]*\s+(?:при[её]ма|при[её]мки|расхожден)|сч[её]т[- ]фактур|реестр[а-яё]*\s+(?:отправлен|документ)/i, firstStep: 'Собрать эталонные накладные и акты, статусы отправлений и правила исключений.' },
    { title: 'Клиентские статусы доставки и правила исключений', category: 'offering', action: 'Сформировать в BAIagent единую базу подтверждённых событий перевозки и сценариев задержки, повреждения, возврата и изменения условий. По правилам события подготавливать разрешённый статус и следующий шаг; новые причины и сроки не выдумывать, спорный случай передавать оператору.', metric: 'Полнота решения при первом обращении, соответствие статуса событию и доля корректных эскалаций.', evidencePattern: /отслеживан|статус[а-яё]*\s+(?:отправлен|заказ|доставк)|события\s+перевозки|уведомлен/i, firstStep: 'Выбрать один статусный сценарий и согласовать его эталонный регламент с владельцем сервиса.' },
  ],
  cybersecurity: [
    { title: 'Превратить запрос на защиту в квалифицированный план внедрения', category: 'revenue', action: 'В BAIagent собрать пресейл-сценарий: защищаемые активы, бизнес-процесс, текущий контур, угроза, нормативные ограничения и критерии успеха. Агент сопоставляет потребность только с подтверждёнными продуктами и готовит вопросы инженеру, не обещая неподтверждённый уровень защиты.', metric: 'Полнота квалификации, время подготовки предложения и конверсия в техническую встречу.', firstStep: 'Разобрать реальные входящие запросы с пресейл-инженером и отметить недостающие исходные данные.' },
    { title: 'Сократить поиск подтверждённых ответов для пресейла и поддержки', category: 'cost', action: 'Объединить документацию, ограничения, совместимость и эталонные архитектуры в локальной базе BAIagent. Каждый черновой ответ содержит источник; вопросы лицензирования, исключений и нестандартной интеграции остаются за специалистом.', metric: 'Время поиска ответа, доля ответов с корректным источником и число исправлений специалиста.', firstStep: 'Выбрать один продуктовый контур и собрать эталонные вопросы клиентов с проверенными ответами.' },
    { title: 'Перевести портфель защитных решений на язык бизнес-рисков', category: 'offering', action: 'Для каждого подтверждённого решения описать цепочку: риск → затронутый процесс → необходимые исходные данные → состав решения → ограничения → пилот. BAIagent использует эту карту для консультации и не подменяет техническое обследование.', metric: 'Полнота сценариев выбора и доля обращений с корректно выбранным следующим шагом.', firstStep: 'Выбрать один приоритетный риск и проверить карту решения с техническим специалистом и владельцем продаж.' },
  ],
  distribution: [
    { title: 'Ускорить подбор оборудования по задаче и ограничениям клиента', category: 'revenue', action: 'В BAIagent собрать сценарий подбора: задача, совместимость, бюджет, срок, наличие, аналоги и условия поставки. Агент формирует сравнение с источниками, а менеджер подтверждает остаток, цену и коммерческие условия.', metric: 'Время подбора, полнота запроса и конверсия подбора в заказ.', firstStep: 'Разобрать реальные запросы и выделить параметры, из-за которых менеджер чаще всего уточняет заявку повторно.' },
    { title: 'Сократить рутинную работу менеджеров с аналогами и документами', category: 'cost', action: 'Связать в BAIagent карточки, правила замен, сертификаты и условия поставки. Агент готовит черновой подбор и комплект документов с указанием источника, но не назначает скидку и не подтверждает отсутствующий остаток.', metric: 'Время ответа, доля корректных аналогов и число доработок менеджером.', firstStep: 'Выбрать одну товарную группу и собрать эталонные пары исходного товара и допустимого аналога.' },
    { title: 'Превратить каталог поставщика в сценарии закупки для сегментов', category: 'offering', action: 'Сгруппировать подтверждённые товары по задачам клиентов и показать комплект, совместимость, срок и следующий шаг. BAIagent ведёт покупателя от потребности к запросу менеджеру без выдуманных характеристик.', metric: 'Полнота подбора и переход от консультации к подтверждённой заявке.', firstStep: 'Выбрать один клиентский сегмент и проверить с менеджером наиболее частый сценарий комплектной закупки.' },
  ],
  manufacturing: [
    { title: 'Связать потребность заказчика с производимой продукцией и условиями заказа', category: 'revenue', action: 'В BAIagent собрать подбор по применению, характеристикам, варианту, объёму и сроку. Агент готовит карточку потребности и подтверждённые варианты, а технолог и менеджер проверяют реализуемость и условия.', metric: 'Полнота технического запроса, время ответа и конверсия в заказ.', firstStep: 'Разобрать реальные запросы и определить, каких данных производству не хватает для первого ответа.' },
    { title: 'Снизить потери при передаче запроса между продажами и производством', category: 'cost', action: 'Настроить единую карточку BAIagent с требованиями, версиями материалов, ответственным и статусом подтверждения. Агент ищет несоответствия и готовит вопросы, но не меняет спецификацию самостоятельно.', metric: 'Число уточняющих итераций и ошибок в переданных требованиях.', firstStep: 'Зафиксировать текущий маршрут одного типового заказа и точки потери информации.' },
    { title: 'Упаковать продукцию в доказуемые сценарии применения', category: 'offering', action: 'Для подтверждённой продукции описать применение, свойства, варианты, ограничения, документы и следующий шаг. BAIagent использует карту для консультации и показывает источник каждого утверждения.', metric: 'Полнота карточек и доля вопросов, закрытых без повторного запроса производству.', firstStep: 'Выбрать одну продуктовую группу и сверить сценарии применения с техническим специалистом.' },
  ],
  retail: [
    { title: 'Ускорить выбор товара и подтверждение покупки', category: 'revenue', action: 'В BAIagent собрать сценарий выбора по потребности, характеристикам, бюджету, наличию, доставке и возврату. Агент сравнивает только подтверждённые варианты и передаёт нестандартный запрос продавцу.', metric: 'Полнота выбора, время ответа и конверсия консультации в заказ.', firstStep: 'Разобрать реальные вопросы покупателей по одной категории и отметить препятствия к выбору.' },
    { title: 'Сократить повторяющиеся вопросы продавцам о товарах и заказах', category: 'cost', action: 'Объединить карточки, правила продаж и эталонные ответы в BAIagent. Ответ всегда содержит источник; наличие, индивидуальная скидка и спорный возврат подтверждаются сотрудником.', metric: 'Время поиска ответа и доля ответов, принятых без исправлений.', firstStep: 'Собрать эталонную выборку частых вопросов и правильных ответов продавцов.' },
    { title: 'Превратить витрину в понятный сценарий выбора для разных покупателей', category: 'offering', action: 'Для одной категории связать потребность, отличия вариантов, цену, условия получения и возврата. BAIagent использует эту структуру для консультации и выявляет пробелы без домысливания.', metric: 'Полнота карточек, число повторных вопросов и переход к целевому действию.', firstStep: 'Проверить одну категорию на реальных вопросах покупателей и зафиксировать недостающие сведения.' },
  ],
  professional: [
    { title: 'Превратить экспертизу в квалифицированный запрос на консультацию', category: 'revenue', action: 'В BAIagent собрать сценарий первичной квалификации: задача клиента, желаемый результат, сроки, участники, ограничения, исходные документы и критерии выбора специалиста. Агент готовит структурированную карточку и вопросы для эксперта, но не выдаёт юридическое заключение, не обещает результат и не назначает стоимость.', metric: 'Полнота исходных данных, время подготовки к первой встрече и конверсия обращения в квалифицированную консультацию.', firstStep: 'Разобрать реальные обращения с ведущими специалистами и отметить сведения, без которых нельзя предметно начать работу.' },
    { title: 'Сократить поиск прецедентов и подготовку первичных материалов', category: 'cost', action: 'Объединить в локальной базе BAIagent утверждённые описания практик, типовые вопросы, шаблоны и проверенные ответы. Агент готовит черновик со ссылками на исходники; выводы, позицию по делу и итоговый документ подтверждает профильный специалист.', metric: 'Время поиска материалов, доля черновиков с корректными источниками и число исправлений специалиста.', firstStep: 'Выбрать одну практику и собрать эталонные запросы, документы и ответы ответственного эксперта.' },
    { title: 'Перевести список практик в сценарии клиентских задач', category: 'offering', action: 'Для каждой выбранной услуги описать ситуацию клиента, признаки потребности, необходимые документы, этапы, ограничения и следующий шаг. BAIagent ведёт от задачи к подходящей практике и эксперту, не смешивая смежные услуги и не заменяя профессиональную консультацию.', metric: 'Доля обращений с корректно выбранной практикой, полнота сценариев и переход к предметной консультации.', firstStep: 'Выбрать одну приоритетную практику и сопоставить её опубликованное описание с реальными вопросами клиентов.' },
  ],
};

function evidenceForPlan(plan, baseEvidence, sources, catalogOfferings = []) {
  const claim = { ...plan, why: 'Отраслевая гипотеза требует проверки на реальных данных компании.' };
  const direct = plan.evidencePattern ? sources.flatMap(source => {
    const sentences = source.text.match(/[^.!?…]+[.!?…]?/g) || [source.text];
    if (!sentences.some(sentence => plan.evidencePattern.test(sentence) && sentence.trim().length >= 35)) return [];
    const item = { sourceId: source.id, quote: quoteFor(source, plan.evidencePattern, 35) };
    const evidence = evidenceFor(item, [source]);
    const priority = ['company-site', 'local-document'].includes(source.kind) ? 0 : source.kind === 'search-snippet' ? 1 : ['industry-snippet', 'customer-snippet'].includes(source.kind) ? 2 : 3;
    return evidence && classifyEvidence(claim, source, evidence.quote).relevance === 'relevant' ? [{ evidence, priority }] : [];
  }).sort((left, right) => left.priority - right.priority).map(item => item.evidence) : [];
  return uniqueEvidence([...direct, ...baseEvidence.map(item => {
    const source = sources.find(candidate => candidate.id === item?.sourceId);
    const ownCatalogEvidence = plan.category === 'offering' && source?.kind === 'company-site'
      && [...(source.offerings || []), ...catalogOfferings].some(offering => offering.sourceId === item.sourceId && offering.quote === item.quote);
    return source && (ownCatalogEvidence || classifyEvidence(claim, source, item.quote).relevance === 'relevant') ? evidenceFor(item, sources) : null;
  })]);
}

function profileOpportunities(profile, sources = []) {
  if (!profile.industry?.evidence) return [];
  const plans = INDUSTRY_PLAYBOOKS[profile.industry.id] || ['revenue', 'cost', 'offering'].flatMap(category => {
    const process = PROCESS_PLAYBOOKS[auditIndustryFor(profile)]?.[category];
    return process ? [{
      title: process.processName, processName: process.processName, category,
      action: `В BAIagent настроить проверяемый процесс: ${process.work} ${process.escalation}`,
      metric: process.businessMetric, evidencePattern: process.evidencePattern,
      firstStep: `Зафиксировать исходный замер и собрать разрешённые данные: ${process.requiredData.join('; ')}.`,
    }] : [];
  });
  const baseEvidence = uniqueEvidence([profile.industry.evidence, ...profile.segments.map(item => item.evidence)]);
  const common = {
    confidence: 'low',
    unknowns: ['Нужны реальные обращения, внутренние регламенты и исходные значения метрик', 'Гипотезу и экономический эффект должен подтвердить владелец процесса'],
    decision: 'Масштабировать только после эталонной проверки качества и измеримого улучшения выбранной метрики.',
  };
  const result = plans.slice(0, 2).map(plan => ({
    ...common, ...plan,
    why: `Открытые материалы подтверждают направление «${profile.industry.label}». Это не утверждение о текущей проблеме, а отраслевая гипотеза: проверить конкретный процесс на данных компании до внедрения.`,
    evidence: evidenceForPlan(plan, baseEvidence, sources),
    steps: [plan.firstStep, 'Собрать правила и эталонные ответы только из подтверждённых материалов.', 'Запустить ограниченный пилот BAIagent с обязательной проверкой человеком.', 'Сравнить результат с исходным периодом и решить: развивать, изменить или остановить.'],
  }));
  if (profile.risks[0] && profile.businessModel !== 'service-marketplace' && !plans[2]) {
    result.push({
      ...common,
      title: 'Подготовить контур непрерывности и клиентских коммуникаций на случай сбоя', category: 'offering',
      why: 'Во внешнем источнике есть отраслевой или компанейский сигнал риска. Его актуальность и влияние нужно проверить; практический ответ — заранее согласовать действия и коммуникации, а не делать вывод о текущем инциденте.',
      action: 'В BAIagent собрать регламент: подтверждённый статус, затронутый процесс, ответственный, разрешённое сообщение клиенту, следующий шаг и критерий эскалации. Агент готовит черновики только из утверждённых обновлений и не сообщает неподтверждённые причины или сроки.',
      metric: 'Время подготовки согласованного ответа, полнота карточки инцидента и доля корректных эскалаций.',
      evidence: uniqueEvidence([profile.risks[0], ...baseEvidence]),
      steps: ['Проверить источник и актуальность риска с владельцем непрерывности бизнеса.', 'Выбрать один сценарий сбоя и утвердить регламент действий и сообщений.', 'Провести учебный разбор в BAIagent без отправки сообщений клиентам.', 'Исправить пробелы и только затем подключать ограниченный рабочий контур.'],
    });
  } else if (plans[2]) {
    const plan = plans[2];
    result.push({ ...common, ...plan, why: `Предложение опирается на подтверждённую отрасль и требует проверки на реальном клиентском сценарии. Это план пилота, а не утверждение о существующем недостатке.`, evidence: evidenceForPlan(plan, baseEvidence, sources), steps: [plan.firstStep, 'Согласовать эталонный сценарий и ограничения с владельцем процесса.', 'Проверить черновые действия BAIagent на реальных обезличенных случаях.', 'Измерить пользу и принять решение о масштабировании.'] });
  }
  return result;
}

function canonicalSoftwareOffering(item, sources, industry) {
  if (industry !== 'software' || item?.price) return null;
  const source = sources.find(candidate => candidate.id === item?.sourceId);
  if (!source) return null;
  let hint;
  try { hint = decodeURIComponent(new URL(item.url || source.url).pathname).split('/').filter(Boolean).at(-1)?.replace(/[-_+]+/g, ' '); } catch { return null; }
  if (!hint || hint.length < 2 || /^(?:software|products?|services?|solutions?|platform|ecosystem|enterprise|menu|catalog|shop|store)$/i.test(hint)) return null;
  const expression = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ -]+')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const lead = String(source.text || '').slice(0, 1200);
  const name = lead.match(expression)?.[1];
  if (!name || name.toLowerCase() === offeringDisplayName(item).toLowerCase()) return null;
  return { ...item, name, displayName: name, quote: quoteFor(source, expression) };
}

function selectPrimaryOffering(market, profile, research, sources) {
  if (profile.businessModel === 'service-marketplace') return null;
  const subject = marketSubject(research, profile).subject;
  const industry = profile.industry?.id;
  const brandTokens = String(research.companyName || profile.companyName || '').toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length >= 4 && !/^(?:официальный|сайт|компания|законодательство|выбирайте|россии|россия)$/i.test(token));
  const homepageLead = String(sources.find(source => source.kind === 'company-site' && /^https?:\/\/[^/]+\/?$/i.test(source.url))?.text || sources.find(source => source.kind === 'company-site')?.text || '').slice(0, 1600).toLowerCase();
  const candidates = market.offerings.map((item, index) => {
    const canonical = canonicalSoftwareOffering(item, sources, industry);
    const selected = canonical || item;
    const name = offeringDisplayName(selected);
    const normalized = name.toLowerCase();
    const evidence = evidenceFor(selected, sources);
    if (!evidence || /^(?:телевизоры(?:\s|$)|товары$|продукты$|услуги$|сервисы$|прайс-лист\b|цены\b|каталог\b)/i.test(name)) return null;
    const brand = brandTokens.some(token => normalized.includes(token));
    const audience = /юрист|бухгалтер|кадров|закупк|медицинск/i.test(subject) && new RegExp(subject.match(/юрист|бухгалтер|кадров|закупк|медицинск/i)[0], 'i').test(name);
    const softwareProduct = industry === 'software' && /\bsoftware\b|\bsaas\b|программн|информационн[а-яё]*\s+систем/i.test(name);
    const conciseProduct = name.length <= 70 && name.split(/\s+/).length <= 4
      && !/^(?:start|meet|build|help|deliver|turn|unite|align|driving|ship|products|services)\b|high-quality|high-velocity|powered\s+by|from\s+scratch/i.test(name);
    const topIndex = profile.topOfferings.indexOf(name);
    const escapedName = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const homepageMention = industry === 'software' && conciseProduct && name.length >= 3 && new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapedName}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(homepageLead);
    const score = (homepageMention ? 70 : 0) + (canonical ? 28 : 0) + (brand && conciseProduct ? 32 : 0) + (audience ? 48 : 0) + (softwareProduct && conciseProduct ? 20 : 0)
      + (conciseProduct ? 5 : 0) + (topIndex >= 0 ? 3 - Math.min(topIndex, 2) : 0) + (selected.price ? 2 : 0);
    return { item: selected, index, score, brand };
  }).filter(Boolean);
  // A single side-page service is not automatically the core offer of a broad marketplace.
  const relevant = industry === 'professional' && subject === 'профессиональные услуги'
    ? candidates.filter(candidate => candidate.brand)
    : candidates;
  return relevant.sort((left, right) => right.score - left.score || left.index - right.index)[0]?.item || null;
}

export function createEvidenceBasedFallback(sources, requestedUrl = '', research = {}) {
  const usable = sources.filter(source => source.text?.length >= 20);
  if (!usable.length) throw new Error('Не удалось получить текст открытых источников');
  const data = { ...research, sources, requestedUrl };
  const market = createMarketIntelligence(data);
  const profile = createBusinessProfile(data);
  const own = selectPrimaryOffering(market, profile, data, usable);
  const ownEvidence = evidenceFor(own, usable);
  const alternativeEvidence = market.alternatives.map(item => evidenceFor(item, usable)).filter(Boolean);
  const competitorEvidence = market.competitors.map(item => evidenceFor(item, usable)).filter(Boolean);
  const newsEvidence = market.news.map(item => evidenceFor(item, usable)).filter(Boolean);
  const reviewEvidence = market.reviews.map(item => evidenceFor(item, usable)).filter(Boolean);
  const industryEvidence = market.industryEvidence.map(item => evidenceFor(item, usable)).filter(Boolean);
  const customerEvidence = market.customerEvidence.map(item => evidenceFor(item, usable)).filter(Boolean);
  const marketPriceEvidence = market.marketPriceEvidence.map(item => evidenceFor(item, usable)).filter(Boolean);
  const opportunities = [];

  if (own && ownEvidence) {
    const name = offeringDisplayName(own);
    const industry = profile.industry?.id;
    const revenueTitle = {
      cybersecurity: 'Превратить запрос на защиту в понятный план внедрения',
      logistics: 'Сократить путь от параметров отправления к расчёту и заказу',
      distribution: 'Превратить широкий каталог в быстрый подбор по задаче клиента',
      manufacturing: 'Связать продукцию с конкретной потребностью покупателя',
      retail: 'Ускорить выбор и подтверждение покупки',
      professional: 'Превратить экспертизу в квалифицированный запрос на консультацию',
      software: 'Упростить путь от задачи к выбору программного продукта',
      food: 'Упростить выбор блюда и оформление заказа',
    }[industry] || `Проверить рыночную позицию «${name}»`;
    const revenueAction = {
      cybersecurity: `Для предложения «${name}» собрать сценарий: риск клиента → необходимый уровень защиты → состав решения → доказательства → следующий шаг. Проверить его на реальных обращениях и не обещать уровень защиты, которого нет в материалах.`,
      logistics: `Для предложения «${name}» связать параметры отправления, тариф, сроки, ограничения и статус заказа в одном ответе. Нестандартный маршрут и окончательную стоимость подтверждает оператор.`,
      distribution: `Для предложения «${name}» создать подбор по задаче, совместимости, наличию, сроку поставки и аналогам. Менеджер получает карточку с источниками и подтверждает коммерческие условия.`,
      manufacturing: `Для предложения «${name}» связать свойства продукции, варианты, цену и сценарии использования. Проверить, какие доказательства помогают покупателю выбрать и не требуют повторного звонка.`,
      retail: `Для предложения «${name}» собрать сравнение вариантов, наличие, цену, доставку и возврат в одном сценарии выбора. Проверить, на каком шаге покупателю всё ещё нужен менеджер.`,
      professional: `Для практики «${name}» собрать сценарий квалификации: ситуация клиента, желаемый результат, сроки, документы, ограничения и следующий шаг. Агент готовит карточку для эксперта, но не выдаёт профессиональное заключение и не обещает результат.`,
      software: `Для программного продукта «${name}» собрать сценарий: задача и пользователи → подтверждённые возможности → ограничения и тариф → следующий шаг. Не обещать отсутствующие функции и не выдавать ответ по продукту за профессиональное заключение.`,
      food: `Для предложения «${name}» связать выбор блюда, подтверждённый состав, доступность и оформление заказа. Вопросы аллергенов, замен и нестандартных условий передавать сотруднику.`,
    }[industry] || `Собрать сравнительную матрицу по «${name}»: цена за сопоставимый объём, состав, формат, условия заказа, доказательства спроса. Затем проверить одну корректировку оффера на ограниченном канале без изменения всего каталога.`;
    const externalRevenueEvidence = competitorEvidence.length + alternativeEvidence.length + customerEvidence.length + marketPriceEvidence.length;
    opportunities.push({
      title: revenueTitle, category: 'revenue',
      why: externalRevenueEvidence
        ? `Собственная карточка подтверждает «${name}», а внешние материалы добавляют конкурентов, критерии выбора или ценовой контекст. Проверяем, где предложение выигрывает или проигрывает по сопоставимым условиям; найденные публикации сами по себе не доказывают рост спроса или неправильную цену.`
        : `Предложение «${name}» подтверждено собственной страницей, но сопоставимых внешних альтернатив в этом запуске нет. Поэтому проверяем путь от потребности до решения и отдельно собираем конкурентный эталон, а не объявляем цену правильной или неправильной.`,
      action: customerEvidence.length || marketPriceEvidence.length
        ? `${revenueAction} В сравнение включить критерии выбора и ценовые наблюдения из независимых источников, сверив объём, состав и условия; несопоставимые цены не усреднять.`
        : revenueAction,
      metric: 'Конверсия в заказ, маржинальность, полнота подбора и причины отказа до и после изменения сценария.',
      unknowns: ['Нужны маржа, объём продаж и причины отказов', 'Нужны реальные обращения и сопоставимый набор конкурентов'],
      decision: 'Масштабировать только вариант, который улучшает выбранную метрику без неприемлемой потери маржи или качества ответа.',
      steps: ['Выбрать одну приоритетную карточку и зафиксировать текущие продажи, маржу и вопросы клиентов.', 'Сопоставить предложение с внешними альтернативами по задаче клиента, составу, цене и условиям.', 'Проверить новый сценарий выбора на реальных обезличенных обращениях и исправить пробелы.', 'Запустить ограниченный тест и сравнить результат с исходным периодом.'],
      evidence: uniqueEvidence([ownEvidence, ...competitorEvidence, ...alternativeEvidence, ...customerEvidence, ...marketPriceEvidence]), confidence: externalRevenueEvidence > 1 ? 'medium' : 'low',
    });
    const playbook = INDUSTRY_PLAYBOOKS[industry] || [];
    const processPlan = category => {
      const process = PROCESS_PLAYBOOKS[auditIndustryFor(profile)]?.[category];
      return process ? {
        title: process.processName, processName: process.processName,
        action: `В BAIagent настроить проверяемый процесс: ${process.work} ${process.escalation}`,
        metric: process.businessMetric, evidencePattern: process.evidencePattern,
        firstStep: `Зафиксировать исходный замер и собрать разрешённые данные: ${process.requiredData.join('; ')}.`,
      } : null;
    };
    const offeringPlan = playbook.find(plan => plan.category === 'offering') || processPlan('offering');
    const costPlan = playbook.find(plan => plan.category === 'cost') || processPlan('cost');
    opportunities.push({
      title: offeringPlan?.title || `Усилить цифровую витрину «${name}»`, category: 'offering',
      why: customerEvidence.length
        ? `Независимые материалы показывают, что клиенты сравнивают предложения по конкретным критериям. Проверяем, насколько «${name}» отвечает на эти вопросы подтверждёнными данными, а не приписываем компании недостатки по чужому опыту.`
        : offeringPlan ? `Предложение «${name}» подтверждено собственной страницей. На этой основе проверяем отраслевой сценарий с реальными вопросами клиентов, не приписывая компании неподтверждённый недостаток.` : `Карточка «${name}» существует и содержит проверяемые данные. Практическая гипотеза — превратить набор сведений в полноценный сценарий выбора.`,
      action: offeringPlan
        ? `${offeringPlan.action} Первый объект проверки — «${name}».${customerEvidence.length ? ' Сопоставить сценарий с независимыми критериями выбора и закрывать пробелы только подтверждёнными материалами.' : ''}`
        : customerEvidence.length
          ? `Сопоставить «${name}» с найденными критериями выбора: задача, состав, качество, цена, условия и следующий шаг. Пробелы закрывать только подтверждёнными материалами; спорные ответы передавать ответственному специалисту.`
          : `Разобрать карточку «${name}» по вопросам покупателя, восполнить только подтверждаемые пробелы, добавить сравнение вариантов и понятный запрос в отдел продаж.`,
      metric: offeringPlan?.metric || 'Полнота карточки, доля вопросов с готовым ответом и переход от просмотра к обращению.',
      unknowns: ['Нужны реальные вопросы покупателей и владелец проверки ответов', 'Нужно подтвердить, какие характеристики и условия влияют на выбор'],
      decision: 'Оставить новый сценарий, только если эталонная проверка и ограниченный пилот подтверждают качество и пользу.',
      steps: offeringPlan ? [offeringPlan.firstStep, `Проверить сценарий на предложении «${name}», внешних критериях выбора и эталонных обращениях.`, 'Запустить ограниченный пилот BAIagent с подтверждением человеком.', 'Сравнить выбранные метрики и решить: развивать, изменить или остановить.'] : ['Собрать вопросы из звонков, писем, внешних материалов и поисковых подсказок.', 'Отметить, на какие вопросы карточка уже отвечает подтверждёнными данными.', 'Дополнить структуру карточки и связать её с ответственным менеджером.', 'Сравнить обращения и целевые действия до и после.'],
      evidence: offeringPlan ? evidenceForPlan(offeringPlan, uniqueEvidence([ownEvidence, ...customerEvidence, ...marketPriceEvidence, ...reviewEvidence, profile.industry?.evidence]), usable, market.offerings) : uniqueEvidence([ownEvidence, ...customerEvidence, ...marketPriceEvidence]), confidence: customerEvidence.length ? 'medium' : 'low',
    });
    opportunities.push(reviewEvidence.length ? {
      title: 'Превратить темы отзывов в управляемый цикл улучшений', category: 'cost',
      why: 'В открытых источниках найден клиентский опыт. Это не оценка всей репутации, а основание проверить, как компания выявляет повторяющиеся темы, реагирует на критические случаи и доводит улучшения до результата.',
      action: 'Объединить открытые отзывы и внутренние обращения, классифицировать повторяющиеся темы и подготавливать карточку: проблема, доказательство, владелец, срок реакции и следующий шаг. Публичный ответ и решение по спорному случаю подтверждает человек.',
      metric: 'Время реакции на критический отзыв, доля обращений с назначенным владельцем и число повторных обращений по одной теме.',
      unknowns: ['Нужны внутренние обращения, текущее время реакции и владелец процесса', 'Нужно проверить представительность открытых отзывов и правила ответа'],
      decision: 'Развивать сценарий только если классификация подтверждена на эталонной выборке, а время реакции и повторные обращения улучшаются без потери контроля.',
      steps: ['Собрать открытые отзывы и обезличенные внутренние обращения за сопоставимый период.', 'Вручную разметить эталонные темы, критичность, владельца и правильное следующее действие.', 'Проверить классификацию и карточки реакции на эталоне; зафиксировать ошибки и критерии остановки.', 'Запустить ограниченный пилот с подтверждением человеком и сравнить выбранные метрики.'],
      evidence: uniqueEvidence([...reviewEvidence, ownEvidence]), confidence: reviewEvidence.length > 1 ? 'medium' : 'low',
    } : {
      title: costPlan?.title || 'Собрать продажи и знания в единый рабочий контур', category: 'cost',
      why: costPlan ? `Собственные материалы подтверждают предложение и отрасль. Следующая гипотеза — сократить ручной поиск и передачу информации в конкретном процессе, сохранив решения за ответственным сотрудником.` : 'Каталог и условия уже опубликованы, но для ответа менеджера нужны актуальные остатки, маржа, правила и история обращений. Гипотеза — сократить поиск и ошибки без автономного изменения условий.',
      action: costPlan ? `${costPlan.action} Начать с материалов и обращений, связанных с «${name}».` : 'Создать в BAIagent базу ответов из карточек, прайса и регламентов. Каждый ответ содержит источник; цену, скидку и нестандартные условия подтверждает человек.',
      metric: costPlan?.metric || 'Время поиска ответа, доля ответов с верным источником и число исправлений менеджера.',
      unknowns: ['Нужны актуальные регламенты и обезличенная выборка обращений', 'Нужно назначить владельца процесса и исходную метрику'],
      decision: 'Подключать следующие процессы только после устойчивого качества ответов на эталонной выборке.',
      steps: costPlan ? [costPlan.firstStep, 'Зафиксировать исходную метрику, правила и критерии остановки.', 'Проверить черновые действия BAIagent на эталонной выборке с человеком.', 'Сравнить результат с исходным и принять решение о масштабировании.'] : ['Выбрать один тип обращений и назначить владельца.', 'Загрузить каталог, прайс и правила в локальный контур.', 'Проверить ответы на эталонной выборке и зафиксировать ошибки.', 'Запустить черновые ответы с подтверждением человеком и измерить эффект.'],
      evidence: costPlan ? evidenceForPlan(costPlan, uniqueEvidence([ownEvidence, profile.industry?.evidence]), usable) : uniqueEvidence([ownEvidence]), confidence: 'low',
    });
  }

  if (!opportunities.length) opportunities.push(...profileOpportunities(profile, usable));
  if (!opportunities.length) opportunities.push(...genericOpportunities(usable));
  if (!opportunities.length) {
    const source = usable[0];
    opportunities.push({ title: 'Подготовить базу ответов по материалам компании', category: 'offering', why: 'Для конкретной рыночной гипотезы данных недостаточно. Безопасный первый шаг — проверить качество знаний и полноту исходных материалов.', action: 'Собрать утверждённые материалы и проверить черновые ответы на эталонном наборе вопросов.', metric: 'Полнота и корректность ответов, подтверждённых источниками.', confidence: 'low', unknowns: ['Нужны реальные вопросы и владелец проверки ответов'], decision: 'Не расширять сценарий без подтверждённого качества.', steps: ['Собрать материалы.', 'Составить эталон вопросов и ответов.', 'Проверить систему.', 'Принять решение по измеренным ошибкам.'], evidence: [{ sourceId: source.id, quote: quoteFor(source, /./) }] });
  }

  const swot = [];
  if (ownEvidence) swot.push({ category: 'strength', title: `Предложение «${own ? offeringDisplayName(own) : profile.industry?.label}» подтверждено собственной страницей: это исходный объект проверки клиентского сценария, а не оценка всего портфеля или доказательство преимущества.`, evidence: [ownEvidence] });
  else if (profile.industry?.evidence) swot.push({ category: 'strength', title: `Специализация «${profile.industry.label}» подтверждена материалами и позволяет строить отраслевой, а не универсальный сценарий.`, evidence: [profile.industry.evidence] });
  if (competitorEvidence.length) swot.push({ category: 'threat', title: `В одном поисковом поле с компанией присутствуют ${market.competitors.slice(0, 3).map(item => item.name).join(', ')}: покупателю есть с чем сравнить предложение.`, evidence: competitorEvidence.slice(0, 2) });
  else if (alternativeEvidence.length) swot.push({ category: 'threat', title: 'Покупатель может сравнить предложение с найденными внешними альтернативами; сравнение требует сопоставимых условий.', evidence: alternativeEvidence.slice(0, 2) });
  else if (profile.risks[0]) swot.push({ category: 'threat', title: 'Во внешнем источнике есть сигнал, который требует проверки актуальности и влияния на непрерывность бизнеса.', evidence: [profile.risks[0]] });
  if (reviewEvidence.length) swot.push({ category: 'opportunity', title: 'Открытые отклики показывают темы качества, цены и сервиса, которые можно превратить в конкретные улучшения и доказательства для продаж.', evidence: reviewEvidence.slice(0, 2) });
  else if (industryEvidence.length) swot.push({ category: 'opportunity', title: 'Независимые отраслевые материалы дают контекст для проверки спроса и ассортимента, но без числового ряда не доказывают рост или падение рынка.', evidence: industryEvidence.slice(0, 2) });
  else if (newsEvidence.length) swot.push({ category: 'opportunity', title: 'Отраслевой информационный фон можно отслеживать регулярно и связывать с изменениями ассортимента, закупок и клиентских сценариев.', evidence: newsEvidence.slice(0, 2) });
  const negativeReview = market.reviews.find(item => /не рекоменд|не получил|сложно оценить|претенз|плохо|ужас|не порядоч/i.test(item.quote));
  const negativeEvidence = evidenceFor(negativeReview, usable);
  if (negativeEvidence) swot.push({ category: 'weakness', title: 'В открытых откликах есть критический клиентский опыт: нужно разобрать конкретные случаи и устранить причину, а не усреднять репутацию.', evidence: [negativeEvidence] });
  else if (!reviewEvidence.length && (ownEvidence || profile.industry?.evidence)) swot.push({ category: 'weakness', title: 'Клиентский опыт не подтверждён найденными открытыми отзывами: это пробел доказательной базы, требующий внутренних обращений, а не вывод о плохой репутации.', evidence: [ownEvidence || profile.industry.evidence] });

  const hostname = (() => { try { return new URL(requestedUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const verified = verifyAnalysis({
    companyName: sources[0]?.companyName || research.companyName || hostname || 'Компания',
    summary: executiveSummary(data, profile),
    opportunities, swot,
  }, usable);
  return enrichAnalysisWithAudit({ ...verified, mode: 'evidence-rules', market, profile }, data);
}

export function enrichAnalysisWithAudit(analysis, research = {}) {
  const market = analysis.market || createMarketIntelligence(research);
  const profile = analysis.profile || createBusinessProfile(research);
  const enriched = enrichAuditOpportunities({ opportunities: analysis.opportunities, research, market, profile });
  const candidate = { ...analysis, opportunities: enriched.length ? enriched : analysis.opportunities, market, profile };
  return Array.isArray(research.sources) && research.sources.length
    ? verifyFinalAnalysis(candidate, research.sources)
    : candidate;
}
