import { getSolution, recommendSolution } from './solutions.js';
import { buildPilotBlueprint } from './pilot.js';
import {
  classifyEvidence,
  directProcessEvidence,
  processEvidenceAssessment,
  summarizeEvidenceQuality,
} from './evidence-quality.js';

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

function unsupportedNumbersInText(text, validQuotes) {
  const outputNumbers = String(text || '').match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?![\p{L}\p{N}])/gu) || [];
  const quoted = normalizeEvidenceText(validQuotes.map(item => item.quote).join(' '));
  return outputNumbers.filter(number => !quoted.includes(normalizeEvidenceText(number)));
}

function hasUnsupportedNumbers(opportunity, validQuotes, finalObject = false) {
  const explanations = finalObject ? [
    opportunity.processName, opportunity.processAction, opportunity.decision,
    opportunity.processEvidence?.note, opportunity.priority?.reason,
    ...(Array.isArray(opportunity.readiness?.known) ? opportunity.readiness.known : []),
    ...(Array.isArray(opportunity.readiness?.missing) ? opportunity.readiness.missing : []),
  ] : [];
  const claims = [
    opportunity.title, opportunity.why, opportunity.action, opportunity.metric,
    ...(Array.isArray(opportunity.unknowns) ? opportunity.unknowns : []),
    ...explanations,
  ].join(' ');
  return unsupportedNumbersInText(claims, validQuotes).length > 0;
}

function opportunityCategory(item) {
  if (['revenue', 'cost', 'offering'].includes(item?.category)) return item.category;
  const text = `${item?.title || ''} ${item?.action || ''}`;
  if (/товар|линейк|продукт|предложени|ассортимент|упаков/i.test(text)) return 'offering';
  if (/затрат|расход|эконом|автоматиз|документ|обработ|время/i.test(text)) return 'cost';
  return 'revenue';
}

function confidenceFor(requested, evidence) {
  const direct = directProcessEvidence(evidence);
  if (!direct.length) return 'low';
  if (requested === 'high' && new Set(direct.map(item => item.sourceId)).size > 1) return 'high';
  return requested === 'medium' || requested === 'high' ? 'medium' : 'low';
}

function sanitizeSummary(value, evidence) {
  const sentences = String(value || '').match(/[^.!?…]+[.!?…]?/g) || [String(value || '')];
  const kept = sentences.filter(sentence => !unsupportedNumbersInText(sentence, evidence).length);
  return {
    text: kept.join(' ').replace(/\s+/g, ' ').trim().slice(0, 1000),
    removedUnsupportedNumericClaims: sentences.length - kept.length,
  };
}

function verify(raw, sources, { finalObject = false } = {}) {
  const inputSources = Array.isArray(sources) ? sources : [];
  const sourceMap = new Map(inputSources.map(source => [source.id, source]));
  const sourceCompanyName = inputSources.find(source => source.companyName)?.companyName;
  function verifiedEvidence(items, claim) {
    return (Array.isArray(items) ? items : []).flatMap(proof => {
      const source = sourceMap.get(proof?.sourceId);
      const quote = String(proof?.quote || '').replace(/\s+/g, ' ').trim();
      if (!source || quote.length < 12) return [];
      if (!normalizeEvidenceText(source.text).includes(normalizeEvidenceText(quote))) return [];
      const quality = classifyEvidence(claim, source, quote);
      if (quality.relevance === 'irrelevant') return [];
      let url = source.url;
      try {
        const candidate = new URL(proof.url || source.url, source.url);
        if (candidate.hostname === new URL(source.url).hostname && ['http:', 'https:'].includes(candidate.protocol)) url = proof.url ? candidate.href : source.url;
      } catch { /* Keep the source page when a deeper link is invalid. */ }
      return [{ sourceId: source.id, url, sourceTitle: source.title, quote, kind: source.kind, ...quality }];
    });
  }
  const rawOpportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : [];
  const opportunities = rawOpportunities.map(item => {
    const evidence = verifiedEvidence(item?.evidence, item);
    if (!evidence.length || hasUnsupportedNumbers(item, evidence, finalObject)) return null;
    const quality = summarizeEvidenceQuality(evidence);
    const unknowns = Array.isArray(item.unknowns) ? item.unknowns.map(value => String(value).slice(0, 240)) : [];
    if (quality.requiresInternalEvidence) unknowns.push('Нужны внутренний регламент, владелец процесса и реальные случаи: публичный контекст не подтверждает внутренний процесс.');
    const processEvidence = finalObject ? processEvidenceAssessment(item, evidence) : item.processEvidence;
    let why = String(item.why || 'Предложение возникло из материалов ниже. Перед запуском нужно подтвердить процесс и измерить пользу на реальных данных компании.').slice(0, finalObject ? 1600 : 900);
    if (quality.requiresInternalEvidence && !why.startsWith('Публичные материалы не подтверждают внутреннюю проблему.')) {
      why = `Публичные материалы не подтверждают внутреннюю проблему. Проверяемая гипотеза: ${why}`;
    }
    if (finalObject && processEvidence?.note && !why.includes(processEvidence.note)) why = `${why} ${processEvidence.note}`.trim();
    return {
      ...(finalObject ? item : {}),
      title: String(item.title || '').slice(0, 140),
      category: opportunityCategory(item),
      why,
      action: String(item.action || '').slice(0, 700),
      solutionId: finalObject && item.solutionId !== undefined ? item.solutionId : recommendSolution(item)?.id || null,
      metric: String(item.metric || '').slice(0, 240),
      confidence: confidenceFor(item.confidence, evidence),
      unknowns: [...new Set(unknowns)].slice(0, finalObject ? 5 : 4),
      decision: String(item.decision || 'Продолжать только после сравнения измеренного результата с исходной метрикой.').slice(0, 500),
      steps: Array.isArray(item.steps) ? item.steps.slice(0, 6).map(value => String(value).slice(0, 320)) : [],
      evidence,
      evidenceQuality: quality,
      ...(finalObject ? { processEvidence } : {}),
      status: 'hypothesis',
    };
  }).filter(Boolean).filter((item, index, items) => items.findIndex(other => other.category === item.category) === index).slice(0, 3).map((item, index) => ({ ...item, id: finalObject && item.id ? item.id : `opportunity-${index + 1}` }));
  const categories = new Set(['strength', 'weakness', 'opportunity', 'threat']);
  const swot = (Array.isArray(raw?.swot) ? raw.swot : []).map(item => {
    const evidence = verifiedEvidence(item?.evidence, item);
    if (!categories.has(item?.category) || !evidence.length || hasUnsupportedNumbers(item, evidence)) return null;
    return {
      ...(finalObject ? item : {}),
      category: item.category,
      title: String(item.title || '').slice(0, 240),
      evidence,
      status: 'hypothesis',
      confidence: 'low',
    };
  }).filter(Boolean).filter((item, index, items) => items.findIndex(other => other.category === item.category) === index).slice(0, 4);
  const summary = sanitizeSummary(raw?.summary, [...opportunities, ...swot].flatMap(item => item.evidence));
  return {
    ...(finalObject ? raw : {}),
    companyName: String(sourceCompanyName || raw?.companyName || '').slice(0, 160),
    summary: summary.text,
    opportunities,
    swot,
    evidenceValidation: {
      policy: 'deterministic-quote-relevance-v1',
      finalObjectChecked: finalObject,
      rejectedOpportunityCount: rawOpportunities.length - opportunities.length,
      removedUnsupportedSummaryClaims: summary.removedUnsupportedNumericClaims,
    },
    verifiedAt: finalObject && raw?.verifiedAt ? raw.verifiedAt : new Date().toISOString(),
  };
}

export function verifyAnalysis(raw, sources) {
  return verify(raw, sources);
}

export function verifyFinalAnalysis(raw, sources) {
  return verify(raw, sources, { finalObject: true });
}

export function buildPilotPlan(analysis, opportunity, sources) {
  if (!opportunity) throw new Error('No verified opportunity selected');
  const solution = getSolution(opportunity.solutionId) || recommendSolution(opportunity);
  const pilot = buildPilotBlueprint(opportunity, solution);
  const sourceLines = (opportunity.evidence || []).map(item => `- ${item.sourceTitle}: ${item.url}\n  «${item.quote}»`).join('\n') || (opportunity.origin === 'user' ? '- Гипотеза сформулирована пользователем; внешние доказательства ещё не собраны.' : '- Подтверждающие источники не найдены.');
  const steps = (opportunity.steps?.length ? opportunity.steps : ['Подтвердить владельца, текущий процесс и исходную метрику.', 'Собрать обезличенный эталонный набор и правила остановки.', 'Запустить ограниченный пилот с подтверждением человеком.', 'Сверить результат с эталоном и записать ошибки.']).map((item, index) => `${index + 1}. ${item}`).join('\n');
  const list = items => (items || []).map(item => `- ${item}`).join('\n');
  const audit = opportunity.processName ? `\n## Процесс: вход → действия → результат → эскалация\n**${opportunity.processName}**\n\n${(opportunity.workSteps || []).map(step => `### ${step.name}\n${step.description}`).join('\n\n')}\n\n### Владелец\n${opportunity.owner}\n\n### Необходимые данные\n${list(opportunity.requiredData)}\n\n### Возможные подключения после проверки доступа\n${list(opportunity.integrations)}\n\n### Более простая альтернатива ИИ\n${opportunity.simpleAlternative}\n\n### Риски и ограничения\n${list(opportunity.riskControls)}\n` : '';
  const acceptance = opportunity.acceptance ? `\n## Приёмочные сценарии\n${opportunity.acceptance.cases.map(test => `### ${test.name}\n- **Тип:** ${test.type}\n- **Вход:** ${test.input}\n- **Ожидаемый результат:** ${test.expected}\n${list(test.assertions)}`).join('\n\n')}\n\n## Метрики приёмки\n${opportunity.acceptance.metrics.map(metric => `- **${metric.name}:** ${metric.measure}`).join('\n')}\n\n${opportunity.acceptance.targetPolicy}\n\n## Эксплуатационный контроль\n### Подтверждение человеком\n${list(opportunity.acceptance.controls.humanConfirmation)}\n\n### Trace\n${list(opportunity.acceptance.controls.trace)}\n\n### Stop и rollback\n${list(opportunity.acceptance.controls.rollbackStop)}\n\n### Регрессия\n${list(opportunity.acceptance.controls.regression)}\n` : '';
  return `# BAIagent — ИИ-советник для бизнеса\n\n## Компания\n${analysis.companyName || 'Не указано'}\n\n## Гипотеза\n${opportunity.title}\n\n${opportunity.why}\n\n**Статус:** проверяемая гипотеза, не гарантированный результат.\n\n## Действие\n${opportunity.action}\n${audit}\n## План реализации\n${steps}\n\n## Рамка пилота\n- **Исходная метрика:** ${pilot.baseline}\n- **Цель:** ${pilot.target}\n- **Период:** ${pilot.period}\n- **Владелец:** ${pilot.owner}\n\n## Данные и подключения\n- **Данные:** ${pilot.data}\n- **Системы:** ${pilot.integrations}\n- **Контроль человеком:** ${pilot.humanControl}\n\n## Экономический эффект\n${pilot.effectFormula}\n\n## Критерии решения\n- **Остановить:** ${pilot.stopRule}\n- **Масштабировать:** ${pilot.scaleRule}\n${acceptance}\n## Что пока неизвестно\n${opportunity.unknowns.length ? opportunity.unknowns.map(item => `- ${item}`).join('\n') : '- Требуется интервью с владельцем процесса'}\n\n## Доказательства\n${sourceLines}\n\nСоздано ИИ-советником BAIagent ${new Date().toISOString()}. Источников в исследовании: ${sources.length}.\n`;
}
