import { ANALYSIS_COPY } from './analysis-copy.js';
import { normalizeLanguage } from './locale.js';

const CATEGORIES = new Set(['revenue', 'cost', 'offering']);
const clean = (value, limit) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
const USER_COPY = {
  en: { title: 'New testable hypothesis', lead: 'Your idea', note: 'This is a hypothesis to test, not an established company fact.', action: brief => `Test “${brief}” on a bounded set of real cases before making an implementation decision.`, metric: 'Share of reference cases with a confirmed useful outcome and the measured effect on the selected business metric.', unknown: 'Confirm the process owner, baseline and representative cases.', constraints: 'Budget, timing and technical constraints are not yet specified.' },
  es: { title: 'Nueva hipótesis comprobable', lead: 'Su idea', note: 'Es una hipótesis por comprobar, no un hecho establecido sobre la empresa.', action: brief => `Comprobar «${brief}» en un conjunto limitado de casos reales antes de decidir la implantación.`, metric: 'Proporción de casos de referencia con un resultado útil confirmado y efecto medido en la métrica de negocio.', unknown: 'Confirme el responsable, la base y los casos representativos.', constraints: 'Aún no se especificaron presupuesto, plazos ni limitaciones técnicas.' },
  zh: { title: '新的可验证假设', lead: '您的想法', note: '这是待验证假设，不是已证实的公司事实。', action: brief => `在实施决策前，先在一组边界明确的真实案例中验证“${brief}”。`, metric: '基准案例中经确认有用结果的比例，以及对所选业务指标的实测影响。', unknown: '需要确认流程负责人、基线和代表性案例。', constraints: '尚未说明预算、时间和技术限制。' },
  hi: { title: 'नई जाँचने योग्य परिकल्पना', lead: 'आपका विचार', note: 'यह जाँचने योग्य परिकल्पना है, कंपनी का पुष्ट तथ्य नहीं।', action: brief => `कार्यान्वयन का निर्णय लेने से पहले सीमित वास्तविक मामलों में “${brief}” जाँचें।`, metric: 'संदर्भ मामलों में पुष्ट उपयोगी परिणाम की दर और चुने व्यापार मीट्रिक पर मापा प्रभाव।', unknown: 'प्रक्रिया स्वामी, आधार और प्रतिनिधि मामले तय करें।', constraints: 'बजट, समय और तकनीकी सीमाएँ अभी तय नहीं हैं।' },
  ar: { title: 'فرضية جديدة قابلة للاختبار', lead: 'فكرتك', note: 'هذه فرضية للاختبار وليست حقيقة مؤكدة عن الشركة.', action: brief => `اختبر «${brief}» على مجموعة محدودة من الحالات الحقيقية قبل قرار التنفيذ.`, metric: 'نسبة الحالات المرجعية ذات النتيجة المفيدة المؤكدة والأثر المقاس على مقياس العمل المختار.', unknown: 'يجب تأكيد مالك العملية والأساس والحالات التمثيلية.', constraints: 'لم تحدد الميزانية والوقت والقيود التقنية بعد.' },
};

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

export function normalizeUserHypothesis(raw = {}, input = {}, id = `custom-${Date.now().toString(36)}`, requestedLanguage = 'ru') {
  const brief = clean(input.brief, 1600);
  const constraints = clean(input.constraints, 2000);
  const language = normalizeLanguage(requestedLanguage, 'ru');
  const local = USER_COPY[language];
  const copy = ANALYSIS_COPY[language];
  const title = clean(raw.title, 140) || clean(brief, 140) || local?.title || 'Новая проверяемая гипотеза';
  const rationale = clean(raw.why, 650);
  const action = clean(raw.action, 900) || (local ? local.action(brief || title) : `Проверить идею «${brief || title}» на ограниченном наборе реальных случаев до принятия решения о внедрении.`);
  const defaults = copy?.steps || [
    'Зафиксировать желаемый результат, владельца и исходную метрику.',
    'Собрать разрешённые данные и эталонные случаи для проверки.',
    'Провести ограниченный пилот с подтверждением человеком.',
    'Сравнить результат с исходным и решить: развивать, изменить или остановить.',
  ];
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map(item => clean(item, 320)).filter(Boolean).slice(0, 5);
  const why = local ? `${local.lead}: “${brief || title}”. ${local.note}${rationale ? ` ${rationale}` : ''}` : `Ваша идея: «${brief || title}». Это гипотеза для проверки, а не установленный факт о компании.${rationale ? ` ${rationale}` : ''}`;
  const opportunity = {
    id, title, category: CATEGORIES.has(raw.category) ? raw.category : 'revenue', language,
    why, action, processName: title, processAction: action,
    metric: clean(raw.metric, 300) || local?.metric || 'Доля эталонных случаев с подтверждённым полезным результатом и влияние на выбранную бизнес-метрику.',
    confidence: 'low', status: 'hypothesis', origin: 'user', userBrief: brief, constraints,
    unknowns: [...new Set([
      ...(Array.isArray(raw.unknowns) ? raw.unknowns.map(item => clean(item, 240)).filter(Boolean) : []),
      local?.unknown || 'Нужны владелец процесса, исходная метрика и реальные случаи для проверки.',
      ...(constraints ? [] : [local?.constraints || 'Бюджет, сроки и технические ограничения пока не заданы.']),
    ])].slice(0, 5),
    decision: copy?.decision || 'Продолжать только после проверки на реальных данных и сравнения результата с исходной метрикой.',
    steps: steps.length >= 3 ? steps : defaults,
    evidence: [],
  };
  if (copy) Object.assign(opportunity, {
    input: copy.data[0], output: copy.work[3][1], owner: copy.owner, requiredData: copy.data,
    integrations: copy.systems, escalation: copy.escalation, baselineMetrics: copy.baseline,
    qualityMetrics: copy.quality, businessMetric: opportunity.metric, simpleAlternative: copy.simple,
    riskControls: copy.risks, workSteps: copy.work.map(([name, description], step) => ({ stage: `stage-${step + 1}`, name, description })),
    acceptance: { cases: copy.cases.map(([type, name, input, expected, assertion], index) => ({ id: `case-${index + 1}`, type, name, input, expected, assertions: [assertion] })), targetPolicy: copy.target },
  });
  return opportunity;
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
