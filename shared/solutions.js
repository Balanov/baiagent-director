export const AGENT_SOLUTIONS = [
  { id: 'chatbot', name: 'ИИ-Чатбот / Голосовой бот', outcome: 'Отвечает клиентам, уточняет параметры, принимает заказ или запись и передаёт сложные случаи оператору с историей диалога.', monthly: 19900, setup: 189900, launchDays: 7 },
  { id: 'reputation', name: 'ИИ-анализ отзывов', fullName: 'ИИ-анализ отзывов и управление репутацией', outcome: 'Собирает отзывы, выделяет кризисные и повторяющиеся темы, уведомляет ответственного и готовит черновик ответа.', monthly: 14900, setup: 119900, launchDays: 5 },
  { id: 'lead-scoring', name: 'ИИ-скоринг заявок', outcome: 'Проверяет документы и параметры кредитных, тендерных и лизинговых заявок по согласованным правилам.', monthly: 29900, setup: 279900, launchDays: 10 },
  { id: 'content', name: 'Генерация контента', outcome: 'Готовит тексты, описания товаров и изображения по утверждённому стилю и исходным материалам.', monthly: 24900, setup: 329900, launchDays: 7 },
  { id: 'driver-logistics', name: 'ИИ-помощник водителя и логиста', outcome: 'Строит маршруты с учётом ограничений, помогает с путевыми листами и контролем режима работы водителя.', monthly: 19900, setup: 209900, launchDays: 10 },
  { id: 'ocr-idp', name: 'OCR + IDP', outcome: 'Извлекает данные из счетов, накладных и других документов, сверяет реквизиты и передаёт их в учётную систему.', monthly: 29900, setup: 359900, launchDays: 14 },
  { id: 'rpa', name: 'RPA + ИИ', outcome: 'Переносит данные между учётными системами, реагирует на события и выполняет согласованные операции без ручного копирования.', monthly: 19900, setup: 209900, launchDays: 7 },
  { id: 'rag', name: 'Интеллектуальный поиск и RAG', outcome: 'Находит ответы во внутренних документах по смыслу и показывает источник каждого ответа.', monthly: 19900, setup: 159900, launchDays: 10 },
  { id: 'accounting', name: 'ИИ-ассистент для бухгалтерии', outcome: 'Разбирает выписки, предлагает проводки, находит дубликаты и готовит данные для отчётности.', monthly: 24900, setup: 219900, launchDays: 10 },
  { id: 'translation', name: 'ИИ-переводчик и локализация', outcome: 'Переводит материалы с сохранением терминологии и стиля и адаптирует их для разных языков.', monthly: 14900, setup: 149900, launchDays: 5 },
  { id: 'forecasting', name: 'Прогнозная аналитика', outcome: 'Прогнозирует спрос и продажи по позициям, выявляет сезонность и помогает планировать закупки.', monthly: 24900, setup: 209900, launchDays: 10 },
  { id: 'bi-reporting', name: 'AI-генерация отчётности', fullName: 'AI-генерация отчётности (BI + NLP)', outcome: 'Собирает управленческие отчёты, объясняет показатели текстом и отвечает на вопросы руководителя по данным.', monthly: 19900, setup: 209900, launchDays: 7 },
  { id: 'ai-security', name: 'ИИ-Безопасность', outcome: 'Анализирует события и действия в контуре, выявляет нехарактерные операции и уведомляет об инцидентах.', monthly: 29900, setup: 299900, launchDays: 14 },
  { id: 'financial-monitoring', name: 'Финансовый мониторинг', outcome: 'Проверяет контрагентов и транзакции, выявляет мошеннические операции и передаёт подозрительные случаи ответственному.', monthly: 39900, setup: 549900, launchDays: 14 },
  { id: 'compliance', name: 'ИИ-контроль регламентов', outcome: 'Проверяет переписки, звонки и документы на нарушения регламентов и готовит материалы для аудита.', monthly: 24900, setup: 209900, launchDays: 10 },
  { id: 'moderation', name: 'ИИ-модерация контента', outcome: 'Выявляет спам, токсичность и запрещённый контент и направляет спорные случаи на ручную проверку.', monthly: 19900, setup: 209900, launchDays: 7 },
  { id: 'visual-quality', name: 'Визуальный контроль качества', outcome: 'Выявляет дефекты продукции по изображению и ведёт статистику брака по типам и причинам.', monthly: 34900, setup: 309900, launchDays: 20 },
  { id: 'warehouse-logistics', name: 'Управление складом и логистикой', outcome: 'Оптимизирует размещение товаров, комплектацию, запасы и маршруты по данным учётной системы.', monthly: 24900, setup: 269900, launchDays: 10 },
  { id: 'predictive-maintenance', name: 'Предиктивное обслуживание', outcome: 'Прогнозирует отказы оборудования по показаниям датчиков и помогает планировать обслуживание до остановки.', monthly: 34900, setup: 429900, launchDays: 20 },
  { id: 'construction-bim', name: 'ИИ-контроль строительства и BIM', outcome: 'Сопоставляет фото и видео со стройплощадки с проектом и выявляет отклонения.', monthly: 39900, setup: 429900, launchDays: 20 },
  { id: 'recruiting', name: 'ИИ-Рекрутинг', outcome: 'Ранжирует резюме по согласованным критериям и помогает с интервью и онбордингом.', monthly: 19900, setup: 159900, launchDays: 10 },
  { id: 'tutoring', name: 'Персональное обучение', outcome: 'Создаёт задания по уровню ученика, проверяет ответы и адаптирует траекторию обучения.', monthly: 19900, setup: 159900, launchDays: 7 },
  { id: 'clinic', name: 'ИИ-помощник для клиник', outcome: 'Записывает пациентов, помогает с медицинскими картами и протоколами и напоминает о приёме.', monthly: 24900, setup: 179900, launchDays: 10 },
  { id: 'legal', name: 'Юридический ИИ-ассистент', outcome: 'Анализирует договоры и риски, находит практику и готовит черновики юридических документов.', monthly: 29900, setup: 249900, launchDays: 7 },
].map(solution => ({ ...solution, fullName: solution.fullName || solution.name, annualSetupCondition: 'При контракте от 1 года установка бесплатно' }));

export const AGENT_CATALOG = AGENT_SOLUTIONS.map(solution => solution.name);

export function getSolution(id) {
  return AGENT_SOLUTIONS.find(solution => solution.id === id) || null;
}

function match(text, pattern) {
  return pattern.test(text);
}

export function recommendSolution(opportunity = {}) {
  const title = String(opportunity.title || '').toLowerCase();
  const text = `${title} ${String(opportunity.action || '')}`.toLowerCase();
  const category = opportunity.category;
  const rules = [
    { id: 'reputation', pattern: /отзыв|репутац/ },
    { id: 'construction-bim', pattern: /bim|стройплощад|контрол[ья].*строительств/ },
    { id: 'predictive-maintenance', pattern: /предиктивн|прогноз.*полом|данным датчик|внепланов.*просто/ },
    { id: 'visual-quality', pattern: /визуальн.*контрол|компьютерн.*зрен|выявлен.*брак/ },
    { id: 'driver-logistics', pattern: /водител|путев.*лист|холост.*пробег|уч[её]т гсм/ },
    { id: 'warehouse-logistics', pattern: /склад|комплектац.*товар|управлен.*запас/ },
    { id: 'clinic', pattern: /пациент|медицинск.*карт|помощник для клиник/ },
    { id: 'legal', pattern: /юридическ|анализ.*договор|договор.*риск/ },
    { id: 'translation', pattern: /перевод|локализац/ },
    { id: 'recruiting', pattern: /рекрут|резюме|оценк.*персонал/ },
    { id: 'tutoring', pattern: /тьютор|ученик|персонализированн.*обучени|траектори.*обучени/ },
    { id: 'moderation', pattern: /модерац|токсичн|спам/ },
    { id: 'compliance', pattern: /комплаенс|контрол.*регламент|нарушени.*регламент/ },
    { id: 'financial-monitoring', pattern: /финансов.*мониторинг|обналич|мошенническ.*транзакц/ },
    { id: 'lead-scoring', pattern: /скоринг|кредит.*заяв|тендер.*заяв|лизинг.*заяв/ },
    { id: 'accounting', pattern: /бухгалтер|проводк|банковск.*выписк/ },
    { id: 'ocr-idp', pattern: /ocr|накладн|распозна.*документ|извлеч.*реквизит|сч[её]т.*1[сc]/ },
    { id: 'content', pattern: /генерац.*контент|описани[я].*товар.*(?:пост|изображен)|баннер/ },
    { id: 'forecasting', pattern: /прогнозн.*аналитик|прогноз.*спрос|сезонн.*спрос|планирован.*закуп/ },
    { id: 'chatbot', pattern: /статусн.*обращени|маршрутизац.*обращени|путь от запроса|параметр.*отправлен|подбор.*по задаче|выбор.*покупк|первичн.*консультац|ответ.*стоимост/ },
    { id: 'chatbot', pattern: /запрос.*защит|потребност.*заказчик|продукц.*потребност|запрос.*менеджер/ },
    { id: 'rag', pattern: /баз[аы].*(?:ответ|знан)|поиск.*ответ|поиск.*документ|источник.*ответ|консультац.*источник|сценари[и].*применени|цифров.*витрин|карточк.*покупател|карточки.*правила|карточки.*сертификат|карточки.*эталонные ответы/ },
    { id: 'rpa', pattern: /передач.*запрос.*производств|перенос.*данных|между 1[сc].*crm/ },
    { id: 'bi-reporting', pattern: /генерац.*отч[её]т|управленческ.*отч[её]т|сравнительн.*матриц|рыночн.*позиц/ },
  ];
  const found = rules.find(rule => match(text, rule.pattern));
  if (found) return getSolution(found.id);
  if (category === 'revenue' && /консультац|подбор|выбор|заказ|обращени/.test(title)) return getSolution('chatbot');
  if (category === 'offering' && /знания|консультац|сценарий|витрин/.test(text)) return getSolution('rag');
  return null;
}

export function recommendedAgents(title = '') {
  const solution = recommendSolution({ title });
  return solution ? [solution.name] : [];
}

export function formatRubles(value) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}
