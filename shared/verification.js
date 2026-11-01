import { getSolution, recommendSolution } from './solutions.js';
import { buildPilotBlueprint } from './pilot.js';
import { buildLocalizedPilotPlan } from './localized-pilot.js';
import { ANALYSIS_COPY } from './analysis-copy.js';
import { normalizeLanguage } from './locale.js';
import {
  classifyEvidence,
  directProcessEvidence,
  processEvidenceAssessment,
  summarizeEvidenceQuality,
} from './evidence-quality.js';

const LOCAL_QUALITY = {
  en: { direct: 'The source describes a relevant process; current shortcomings and impact still require internal verification.', discovery: 'Discovery hypothesis: public context does not prove the internal process or its problem.', published: 'The company source describes a relevant process; its current metrics and shortcomings still require internal verification.', internal: 'The internal document is relevant to this process; confirm the complete procedure, owner and metrics with the responsible person.', customer: 'Reviews confirm customer experience, not the existence of an internal review process.', industry: 'No first-party description of this exact process was found. The evidence supports the industry context only; the process is a hypothesis, not an established company problem.' },
  es: { direct: 'La fuente describe un proceso relevante; las carencias y el efecto actual requieren verificación interna.', discovery: 'Hipótesis de descubrimiento: el contexto público no demuestra el proceso interno ni su problema.', published: 'La fuente de la empresa describe un proceso relevante; sus métricas y carencias actuales requieren verificación interna.', internal: 'El documento interno es relevante para este proceso; confirme el procedimiento completo, el responsable y las métricas.', customer: 'Las reseñas confirman la experiencia del cliente, no la existencia de un proceso interno de gestión.', industry: 'No se encontró una descripción propia de este proceso concreto. La evidencia solo respalda el contexto sectorial; el proceso es una hipótesis, no un problema confirmado.' },
  zh: { direct: '来源描述了相关流程，但当前缺陷和效果仍需内部核实。', discovery: '探索性假设：公开背景不能证明企业内部流程或其问题。', published: '企业来源描述了相关流程，当前指标和缺陷仍需内部核实。', internal: '内部文件与该流程相关；请向负责人确认完整规程、负责人和指标。', customer: '评价证明客户体验，不能证明企业内部已有评价处理流程。', industry: '未找到企业对该具体流程的自有描述。证据仅支持行业背景；流程是假设，不是已确认的企业问题。' },
  hi: { direct: 'स्रोत संबंधित प्रक्रिया बताता है; वर्तमान कमियों और प्रभाव की आंतरिक जाँच आवश्यक है।', discovery: 'खोज परिकल्पना: सार्वजनिक संदर्भ आंतरिक प्रक्रिया या उसकी समस्या सिद्ध नहीं करता।', published: 'कंपनी स्रोत संबंधित प्रक्रिया बताता है; वर्तमान मीट्रिक और कमियों की आंतरिक जाँच आवश्यक है।', internal: 'आंतरिक दस्तावेज़ इस प्रक्रिया से संबंधित है; पूर्ण प्रक्रिया, स्वामी और मीट्रिक जिम्मेदार व्यक्ति से पुष्ट करें।', customer: 'समीक्षाएँ ग्राहक अनुभव पुष्ट करती हैं, आंतरिक समीक्षा प्रक्रिया का अस्तित्व नहीं।', industry: 'इस सटीक प्रक्रिया का स्वयं का विवरण नहीं मिला। प्रमाण केवल उद्योग संदर्भ देता है; प्रक्रिया परिकल्पना है, कंपनी की पुष्ट समस्या नहीं।' },
  ar: { direct: 'يصف المصدر عملية ذات صلة؛ ما زالت أوجه القصور والأثر الحاليان بحاجة إلى تحقق داخلي.', discovery: 'فرضية استكشافية: السياق العام لا يثبت العملية الداخلية أو مشكلتها.', published: 'يصف مصدر الشركة عملية ذات صلة؛ ما زالت مقاييسها وأوجه قصورها الحالية بحاجة إلى تحقق داخلي.', internal: 'المستند الداخلي مرتبط بهذه العملية؛ أكد الإجراء الكامل والمالك والمقاييس مع الشخص المسؤول.', customer: 'تؤكد المراجعات تجربة العملاء، لا وجود عملية داخلية لمعالجة المراجعات.', industry: 'لم يوجد وصف من الشركة لهذه العملية تحديداً. يدعم الدليل السياق القطاعي فقط؛ العملية فرضية لا مشكلة مؤكدة لدى الشركة.' },
};

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
  const language = normalizeLanguage(raw?.language || inputSources.find(source => source.language)?.language, 'ru');
  const copy = ANALYSIS_COPY[language];
  const sourceMap = new Map(inputSources.map(source => [source.id, source]));
  const sourceCompanyName = inputSources.find(source => source.companyName)?.companyName;
  function verifiedEvidence(items, claim) {
    return (Array.isArray(items) ? items : []).flatMap(proof => {
      const source = sourceMap.get(proof?.sourceId);
      const quote = String(proof?.quote || '').replace(/\s+/g, ' ').trim();
      if (!source || quote.length < 12) return [];
      if (!normalizeEvidenceText(source.text).includes(normalizeEvidenceText(quote))) return [];
      const assessed = classifyEvidence(claim, source, quote);
      // Russian lexical topic matching cannot assess translated hypotheses.
      // Their source URL, source id and verbatim quote are still checked above.
      const quality = copy ? { ...assessed, relevance: 'relevant', relevanceBasis: 'verified-source-excerpt' } : assessed;
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
    if (copy) quality.label = quality.directProcessEvidenceCount ? LOCAL_QUALITY[language].direct : LOCAL_QUALITY[language].discovery;
    const unknowns = Array.isArray(item.unknowns) ? item.unknowns.map(value => String(value).slice(0, 240)) : [];
    if (quality.requiresInternalEvidence) unknowns.push(copy ? copy.unknowns.join('; ') : 'Нужны внутренний регламент, владелец процесса и реальные случаи: публичный контекст не подтверждает внутренний процесс.');
    const processEvidence = finalObject ? processEvidenceAssessment(item, evidence) : item.processEvidence;
    if (copy && processEvidence) processEvidence.note = LOCAL_QUALITY[language][processEvidence.status] || LOCAL_QUALITY[language].industry;
    const evidencePrefix = 'Публичные материалы не подтверждают внутреннюю проблему.';
    let why = String(item.why || (copy ? copy.opportunities[1][1] : 'Предложение возникло из материалов ниже. Перед запуском нужно подтвердить процесс и измерить пользу на реальных данных компании.')).slice(0, finalObject ? 1600 : 900);
    if (quality.requiresInternalEvidence && !why.startsWith(evidencePrefix) && !copy) {
      why = `${evidencePrefix} Проверяемая гипотеза: ${why}`;
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
      decision: String(item.decision || copy?.decision || 'Продолжать только после сравнения измеренного результата с исходной метрикой.').slice(0, 500),
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
  const localized = buildLocalizedPilotPlan(analysis, opportunity, sources);
  if (localized) return localized;
  const solution = getSolution(opportunity.solutionId) || recommendSolution(opportunity);
  const pilot = buildPilotBlueprint(opportunity, solution);
  const sourceLines = (opportunity.evidence || []).map(item => `- ${item.sourceTitle}: ${item.url}\n  «${item.quote}»`).join('\n') || (opportunity.origin === 'user' ? '- Гипотеза сформулирована пользователем; внешние доказательства ещё не собраны.' : '- Подтверждающие источники не найдены.');
  const steps = (opportunity.steps?.length ? opportunity.steps : ['Подтвердить владельца, текущий процесс и исходную метрику.', 'Собрать обезличенный эталонный набор и правила остановки.', 'Запустить ограниченный пилот с подтверждением человеком.', 'Сверить результат с эталоном и записать ошибки.']).map((item, index) => `${index + 1}. ${item}`).join('\n');
  const list = items => (items || []).map(item => `- ${item}`).join('\n');
  const audit = opportunity.processName ? `\n## Процесс: вход → действия → результат → эскалация\n**${opportunity.processName}**\n\n${(opportunity.workSteps || []).map(step => `### ${step.name}\n${step.description}`).join('\n\n')}\n\n### Владелец\n${opportunity.owner}\n\n### Необходимые данные\n${list(opportunity.requiredData)}\n\n### Возможные подключения после проверки доступа\n${list(opportunity.integrations)}\n\n### Более простая альтернатива ИИ\n${opportunity.simpleAlternative}\n\n### Риски и ограничения\n${list(opportunity.riskControls)}\n` : '';
  const acceptance = opportunity.acceptance ? `\n## Приёмочные сценарии\n${opportunity.acceptance.cases.map(test => `### ${test.name}\n- **Тип:** ${test.type}\n- **Вход:** ${test.input}\n- **Ожидаемый результат:** ${test.expected}\n${list(test.assertions)}`).join('\n\n')}\n\n## Метрики приёмки\n${opportunity.acceptance.metrics.map(metric => `- **${metric.name}:** ${metric.measure}`).join('\n')}\n\n${opportunity.acceptance.targetPolicy}\n\n## Эксплуатационный контроль\n### Подтверждение человеком\n${list(opportunity.acceptance.controls.humanConfirmation)}\n\n### Trace\n${list(opportunity.acceptance.controls.trace)}\n\n### Stop и rollback\n${list(opportunity.acceptance.controls.rollbackStop)}\n\n### Регрессия\n${list(opportunity.acceptance.controls.regression)}\n` : '';
  return `# BAIagent — ИИ-советник для бизнеса\n\n## Компания\n${analysis.companyName || 'Не указано'}\n\n## Гипотеза\n${opportunity.title}\n\n${opportunity.why}\n\n**Статус:** проверяемая гипотеза, не гарантированный результат.\n\n## Действие\n${opportunity.action}\n${audit}\n## План реализации\n${steps}\n\n## Рамка пилота\n- **Исходная метрика:** ${pilot.baseline}\n- **Цель:** ${pilot.target}\n- **Период:** ${pilot.period}\n- **Владелец:** ${pilot.owner}\n\n## Данные и подключения\n- **Данные:** ${pilot.data}\n- **Системы:** ${pilot.integrations}\n- **Контроль человеком:** ${pilot.humanControl}\n\n## Экономический эффект\n${pilot.effectFormula}\n\n## Критерии решения\n- **Остановить:** ${pilot.stopRule}\n- **Масштабировать:** ${pilot.scaleRule}\n${acceptance}\n## Что пока неизвестно\n${opportunity.unknowns.length ? opportunity.unknowns.map(item => `- ${item}`).join('\n') : '- Требуется интервью с владельцем процесса'}\n\n## Доказательства\n${sourceLines}\n\nСоздано ИИ-советником BAIagent ${new Date().toISOString()}. Источников в исследовании: ${sources.length}.\n`;
}
