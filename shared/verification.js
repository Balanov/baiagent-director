import { getSolution, recommendSolution } from './solutions.js';
import { buildPilotBlueprint } from './pilot.js';

export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['companyName', 'summary', 'opportunities'],
  properties: {
    companyName: { type: 'string' },
    summary: { type: 'string' },
    opportunities: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'category', 'why', 'action', 'metric', 'confidence', 'unknowns', 'evidence'],
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: ['revenue', 'cost', 'offering'] },
          solutionId: { type: ['string', 'null'] },
          why: { type: 'string' }, action: { type: 'string' },
          metric: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          unknowns: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          evidence: {
            type: 'array', minItems: 1, maxItems: 3,
            items: {
              type: 'object', additionalProperties: false, required: ['sourceId', 'quote'],
              properties: { sourceId: { type: 'string' }, quote: { type: 'string' } },
            },
          },
        },
      },
    },
    swot: {
      type: 'array', maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        required: ['category', 'title', 'evidence'],
        properties: {
          category: { type: 'string', enum: ['strength', 'weakness', 'opportunity', 'threat'] },
          title: { type: 'string' },
          evidence: {
            type: 'array', minItems: 1, maxItems: 2,
            items: {
              type: 'object', additionalProperties: false, required: ['sourceId', 'quote'],
              properties: { sourceId: { type: 'string' }, quote: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};

export function normalizeEvidenceText(value = '') {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function parseModelJson(text = '') {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Qwen did not return a JSON object');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function hasUnsupportedNumbers(opportunity, validQuotes) {
  const claims = [opportunity.title, opportunity.why, opportunity.action, opportunity.metric, ...(Array.isArray(opportunity.unknowns) ? opportunity.unknowns : [])].join(' ');
  const outputNumbers = claims.match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?![\p{L}\p{N}])/gu) || [];
  const quoted = normalizeEvidenceText(validQuotes.map(item => item.quote).join(' '));
  return outputNumbers.some(number => !quoted.includes(normalizeEvidenceText(number)));
}

function opportunityCategory(item) {
  if (['revenue', 'cost', 'offering'].includes(item?.category)) return item.category;
  const text = `${item?.title || ''} ${item?.action || ''}`;
  if (/товар|линейк|продукт|предложени|ассортимент|упаков/i.test(text)) return 'offering';
  if (/затрат|расход|эконом|автоматиз|документ|обработ|время/i.test(text)) return 'cost';
  return 'revenue';
}

export function verifyAnalysis(raw, sources) {
  const sourceMap = new Map(sources.map(source => [source.id, source]));
  const sourceCompanyName = sources.find(source => source.companyName)?.companyName;
  function verifiedEvidence(items) {
    return (Array.isArray(items) ? items : []).flatMap(proof => {
      const source = sourceMap.get(proof?.sourceId);
      const quote = String(proof?.quote || '').replace(/\s+/g, ' ').trim();
      if (!source || quote.length < 12) return [];
      if (!normalizeEvidenceText(source.text).includes(normalizeEvidenceText(quote))) return [];
      let url = source.url;
      try {
        const candidate = new URL(proof.url || source.url, source.url);
        if (candidate.hostname === new URL(source.url).hostname && ['http:', 'https:'].includes(candidate.protocol)) url = proof.url ? candidate.href : source.url;
      } catch { /* Keep the source page when a deeper link is invalid. */ }
      return [{ sourceId: source.id, url, sourceTitle: source.title, quote, kind: source.kind }];
    });
  }
  const opportunities = (Array.isArray(raw?.opportunities) ? raw.opportunities : []).map(item => {
    const evidence = verifiedEvidence(item?.evidence);
    if (!evidence.length || hasUnsupportedNumbers(item, evidence)) return null;
    return {
      title: String(item.title || '').slice(0, 140),
      category: opportunityCategory(item),
      why: String(item.why || 'Предложение возникло из материалов ниже. Перед запуском нужно подтвердить процесс и измерить пользу на реальных данных компании.').slice(0, 900),
      action: String(item.action || '').slice(0, 700),
      solutionId: recommendSolution(item)?.id || null,
      metric: String(item.metric || '').slice(0, 240),
      confidence: item.confidence === 'medium' && evidence.length > 1 ? 'medium' : 'low',
      unknowns: Array.isArray(item.unknowns) ? item.unknowns.slice(0, 4).map(value => String(value).slice(0, 240)) : [],
      decision: String(item.decision || 'Продолжать только после сравнения измеренного результата с исходной метрикой.').slice(0, 500),
      steps: Array.isArray(item.steps) ? item.steps.slice(0, 6).map(value => String(value).slice(0, 320)) : [],
      evidence,
      status: 'hypothesis',
    };
  }).filter(Boolean).filter((item, index, items) => items.findIndex(other => other.category === item.category) === index).slice(0, 3).map((item, index) => ({ ...item, id: `opportunity-${index + 1}` }));
  const categories = new Set(['strength', 'weakness', 'opportunity', 'threat']);
  const swot = (Array.isArray(raw?.swot) ? raw.swot : []).map(item => {
    const evidence = verifiedEvidence(item?.evidence);
    if (!categories.has(item?.category) || !evidence.length || hasUnsupportedNumbers(item, evidence)) return null;
    return {
      category: item.category,
      title: String(item.title || '').slice(0, 240),
      evidence,
      status: 'hypothesis',
      confidence: 'low',
    };
  }).filter(Boolean).filter((item, index, items) => items.findIndex(other => other.category === item.category) === index).slice(0, 4);
  return {
    companyName: String(sourceCompanyName || raw?.companyName || '').slice(0, 160),
    summary: String(raw?.summary || '').slice(0, 1000),
    opportunities,
    swot,
    verifiedAt: new Date().toISOString(),
  };
}

export function buildPilotPlan(analysis, opportunity, sources) {
  if (!opportunity) throw new Error('No verified opportunity selected');
  const solution = getSolution(opportunity.solutionId) || recommendSolution(opportunity);
  const pilot = buildPilotBlueprint(opportunity, solution);
  const sourceLines = opportunity.evidence.map(item => `- ${item.sourceTitle}: ${item.url}\n  «${item.quote}»`).join('\n');
  const steps = (opportunity.steps?.length ? opportunity.steps : ['Подтвердить владельца, текущий процесс и исходную метрику.', 'Собрать обезличенный эталонный набор и правила остановки.', 'Запустить ограниченный пилот с подтверждением человеком.', 'Сверить результат с эталоном и записать ошибки.']).map((item, index) => `${index + 1}. ${item}`).join('\n');
  const list = items => (items || []).map(item => `- ${item}`).join('\n');
  const audit = opportunity.processName ? `\n## Процесс: вход → действия → результат → эскалация\n**${opportunity.processName}**\n\n${(opportunity.workSteps || []).map(step => `### ${step.name}\n${step.description}`).join('\n\n')}\n\n### Владелец\n${opportunity.owner}\n\n### Необходимые данные\n${list(opportunity.requiredData)}\n\n### Возможные подключения после проверки доступа\n${list(opportunity.integrations)}\n\n### Более простая альтернатива ИИ\n${opportunity.simpleAlternative}\n\n### Риски и ограничения\n${list(opportunity.riskControls)}\n` : '';
  const acceptance = opportunity.acceptance ? `\n## Приёмочные сценарии\n${opportunity.acceptance.cases.map(test => `### ${test.name}\n- **Тип:** ${test.type}\n- **Вход:** ${test.input}\n- **Ожидаемый результат:** ${test.expected}\n${list(test.assertions)}`).join('\n\n')}\n\n## Метрики приёмки\n${opportunity.acceptance.metrics.map(metric => `- **${metric.name}:** ${metric.measure}`).join('\n')}\n\n${opportunity.acceptance.targetPolicy}\n\n## Эксплуатационный контроль\n### Подтверждение человеком\n${list(opportunity.acceptance.controls.humanConfirmation)}\n\n### Trace\n${list(opportunity.acceptance.controls.trace)}\n\n### Stop и rollback\n${list(opportunity.acceptance.controls.rollbackStop)}\n\n### Регрессия\n${list(opportunity.acceptance.controls.regression)}\n` : '';
  return `# BAIagent — ИИ-советник для бизнеса\n\n## Компания\n${analysis.companyName || 'Не указано'}\n\n## Гипотеза\n${opportunity.title}\n\n${opportunity.why}\n\n**Статус:** проверяемая гипотеза, не гарантированный результат.\n\n## Действие\n${opportunity.action}\n${audit}\n## План реализации\n${steps}\n\n## Рамка пилота\n- **Исходная метрика:** ${pilot.baseline}\n- **Цель:** ${pilot.target}\n- **Период:** ${pilot.period}\n- **Владелец:** ${pilot.owner}\n\n## Данные и подключения\n- **Данные:** ${pilot.data}\n- **Системы:** ${pilot.integrations}\n- **Контроль человеком:** ${pilot.humanControl}\n\n## Экономический эффект\n${pilot.effectFormula}\n\n## Критерии решения\n- **Остановить:** ${pilot.stopRule}\n- **Масштабировать:** ${pilot.scaleRule}\n${acceptance}\n## Что пока неизвестно\n${opportunity.unknowns.length ? opportunity.unknowns.map(item => `- ${item}`).join('\n') : '- Требуется интервью с владельцем процесса'}\n\n## Доказательства\n${sourceLines}\n\nСоздано ИИ-советником BAIagent ${new Date().toISOString()}. Источников в исследовании: ${sources.length}.\n`;
}
