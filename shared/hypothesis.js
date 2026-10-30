const CATEGORIES = new Set(['revenue', 'cost', 'offering']);
const clean = (value, limit) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);

export const HYPOTHESIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'category', 'why', 'action', 'metric', 'unknowns', 'steps'],
  properties: {
    title: { type: 'string' }, category: { type: 'string', enum: ['revenue', 'cost', 'offering'] },
    why: { type: 'string' }, action: { type: 'string' }, metric: { type: 'string' },
    unknowns: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    steps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
  },
};

export function normalizeUserHypothesis(raw = {}, input = {}, id = `custom-${Date.now().toString(36)}`) {
  const brief = clean(input.brief, 1600);
  const constraints = clean(input.constraints, 2000);
  const title = clean(raw.title, 140) || clean(brief, 140) || 'Новая проверяемая гипотеза';
  const rationale = clean(raw.why, 650);
  const action = clean(raw.action, 900) || `Проверить идею «${brief || title}» на ограниченном наборе реальных случаев до принятия решения о внедрении.`;
  const defaults = [
    'Зафиксировать желаемый результат, владельца и исходную метрику.',
    'Собрать разрешённые данные и эталонные случаи для проверки.',
    'Провести ограниченный пилот с подтверждением человеком.',
    'Сравнить результат с исходным и решить: развивать, изменить или остановить.',
  ];
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map(item => clean(item, 320)).filter(Boolean).slice(0, 5);
  return {
    id, title, category: CATEGORIES.has(raw.category) ? raw.category : 'revenue',
    why: `Ваша идея: «${brief || title}». Это гипотеза для проверки, а не установленный факт о компании.${rationale ? ` ${rationale}` : ''}`,
    action,
    metric: clean(raw.metric, 300) || 'Доля эталонных случаев с подтверждённым полезным результатом и влияние на выбранную бизнес-метрику.',
    confidence: 'low', status: 'hypothesis', origin: 'user', userBrief: brief, constraints,
    unknowns: [...new Set([
      ...(Array.isArray(raw.unknowns) ? raw.unknowns.map(item => clean(item, 240)).filter(Boolean) : []),
      'Нужны владелец процесса, исходная метрика и реальные случаи для проверки.',
      ...(constraints ? [] : ['Бюджет, сроки и технические ограничения пока не заданы.']),
    ])].slice(0, 5),
    decision: 'Продолжать только после проверки на реальных данных и сравнения результата с исходной метрикой.',
    steps: steps.length >= 3 ? steps : defaults,
    evidence: [],
  };
}

export function hypothesisPrompt({ input, research = {}, analysis = {}, history = [] }) {
  const brief = clean(input.brief, 1600);
  const context = {
    company: research.companyName,
    market: research.marketContext || null,
    offerings: (research.offerings || []).slice(0, 8).map(item => item.displayName || item.name),
    existingHypotheses: (analysis.opportunities || []).map(item => item.title),
    summary: analysis.summary,
  };
  return `Сформируй одну проверяемую бизнес-гипотезу строго в JSON по схеме.\nИдея или поручение пользователя: ${brief}\nРамки пользователя: ${clean(input.constraints, 2000) || 'Не заданы'}\nКонтекст исследования: ${JSON.stringify(context)}\nПоследний диалог: ${history.slice(-4).map(item => `${item.role}: ${clean(item.text, 500)}`).join('\n') || 'Нет'}\nНе повторяй существующие направления. Не выдавай желаемое за действительное, не придумывай проблемы компании, числа, бюджет или сроки. Не предполагай, что новая идея уже продаётся или используется. Не подменяй целевую аудиторию сотрудниками компании, если пользователь их не указал. Сохрани пользовательские ограничения как допущения. В why опиши проверяемый механизм условно: «если…, то…», без утверждений о спросе или текущей практике. В action — конкретный эксперимент, в metric — измерение без выдуманной цели.`;
}
