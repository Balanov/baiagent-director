import { describe, expect, it } from 'vitest';
import { PROCESS_PLAYBOOKS, buildAcceptanceSuite, enrichAuditOpportunities } from '../shared/audit.js';
import { getSolution } from '../shared/solutions.js';

const CATEGORIES = ['revenue', 'cost', 'offering'];
const MODES = ['standard-agent', 'custom', 'simple-automation', 'data-preparation'];
const INDUSTRIES = [
  'manufacturing', 'retail', 'logistics', 'distribution', 'construction', 'healthcare',
  'education', 'professional', 'finance', 'food', 'cybersecurity', 'government',
];

const EVIDENCE = Object.freeze([{ sourceId: 'site', quote: 'Компания описывает подтверждённое предложение и порядок работы.' }]);

function opportunity(category, extra = {}) {
  return {
    id: `verified-${category}`,
    category,
    title: `Проверяемая возможность ${category}`,
    why: 'Гипотеза требует внутренней проверки.',
    action: 'Проверить процесс на реальных обезличенных случаях.',
    metric: 'Качество и время процесса до и после пилота.',
    evidence: EVIDENCE,
    customField: 'сохранить',
    ...extra,
  };
}

function enrich(industry, opportunities = CATEGORIES.map(category => opportunity(category)), extra = {}) {
  return enrichAuditOpportunities({
    opportunities,
    profile: { industry: { id: industry, label: industry }, ...extra.profile },
    research: extra.research || {},
    market: extra.market || {},
  });
}

function categoryResult(industry, category, extra = {}, opportunityExtra = {}) {
  return enrich(industry, [opportunity(category, opportunityExtra)], extra)[0];
}

describe('industry-specific audit playbooks', () => {
  it.each(INDUSTRIES)('builds three concrete and implementable processes for %s', industry => {
    const result = enrich(industry);
    expect(result).toHaveLength(3);
    expect(new Set(result.map(item => item.category))).toEqual(new Set(CATEGORIES));
    expect(new Set(result.map(item => item.processName)).size).toBe(3);
    for (const item of result) {
      expect(item.input).toBeTruthy();
      expect(item.output).toBeTruthy();
      expect(item.owner).toBeTruthy();
      expect(item.requiredData.length).toBeGreaterThanOrEqual(2);
      expect(item.integrations.length).toBeGreaterThan(0);
      expect(item.baselineMetrics.length).toBeGreaterThanOrEqual(2);
      expect(item.baselineMetrics.length).toBeLessThanOrEqual(3);
      expect(item.qualityMetrics.length).toBeGreaterThanOrEqual(2);
      expect(item.qualityMetrics.length).toBeLessThanOrEqual(3);
      expect(item.riskControls.length).toBeGreaterThanOrEqual(2);
      expect(item.workSteps.map(step => step.stage)).toEqual(['input', 'action', 'output', 'escalation']);
      expect(MODES).toContain(item.implementationMode);
      if (item.solutionId) expect(getSolution(item.solutionId)).not.toBeNull();
      expect(item.acceptance.processName).toBe(item.processName);
    }
  });

  it('does not force visual quality control onto an ordinary manufacturing process', () => {
    const ordinary = categoryResult('manufacturing', 'cost');
    expect(ordinary.solutionId).toBe('rpa');
    expect(ordinary.processName).toContain('Передача требований');
    const visual = categoryResult('manufacturing', 'cost', {}, {
      title: 'Визуальный контроль дефектов на участке',
      action: 'Проверить изображения брака с контролёром качества.',
    });
    expect(visual.solutionId).toBe('visual-quality');
    expect(visual.riskControls.join(' ')).toContain('Не браковать');
  });

  it('keeps medical protocols with a doctor and prohibits autonomous diagnosis', () => {
    const result = categoryResult('healthcare', 'cost');
    expect(result.solutionId).toBe('clinic');
    expect(result.escalation).toContain('Врач');
    expect(result.riskControls.join(' ')).toMatch(/врач|диагноз/i);
    expect(result.acceptance.cases.find(item => item.id === 'adversarial-unsupported-critical').expected).toContain('Врач');
    expect(categoryResult('healthcare', 'offering').implementationMode).toBe('simple-automation');
  });

  it('uses legal review for contract comparison, not an autonomous legal opinion', () => {
    const result = categoryResult('professional', 'cost', {}, {
      title: 'Черновое сравнение договоров',
      action: 'Сопоставить версии договора и показать риски юристу.',
    });
    expect(result.solutionId).toBe('legal');
    expect(result.processName).toContain('договора');
    expect(result.escalation).toContain('Юрист');
    expect(result.riskControls.join(' ')).toContain('юридическое заключение');
  });

  it('controls document versions in construction without autonomous closure or unnecessary BIM', () => {
    const result = categoryResult('construction', 'cost');
    expect(result.implementationMode).toBe('simple-automation');
    expect(result.solutionId).toBeNull();
    expect(result.riskControls.join(' ')).toContain('Не закрывать замечания');
    expect(result.processName).toContain('версий');
  });

  it('requires RBAC and a responsible official in government processes', () => {
    for (const result of enrich('government')) {
      expect(result.riskControls.join(' ')).toMatch(/RBAC|ответственн/i);
      expect(result.escalation).toMatch(/сотрудник|Ответственный/i);
      expect(result.solutionId).not.toBe('chatbot');
    }
    expect(categoryResult('government', 'cost').implementationMode).toBe('simple-automation');
  });

  it('keeps financial scoring and accounting decisions with authorized people', () => {
    const scoring = categoryResult('finance', 'revenue');
    expect(scoring.solutionId).toBe('lead-scoring');
    expect(scoring.escalation).toContain('Финальное решение');
    expect(scoring.riskControls.join(' ')).toContain('Человек');
    const accounting = categoryResult('finance', 'cost');
    expect(accounting.solutionId).toBe('accounting');
    expect(accounting.riskControls.join(' ')).toContain('платеж');
  });

  it('does not allow autonomous educational grades', () => {
    for (const result of enrich('education')) {
      expect(`${result.escalation} ${result.riskControls.join(' ')}`).toMatch(/методист|преподавател/i);
    }
    expect(categoryResult('education', 'offering').riskControls.join(' ')).toContain('Не выставлять автономные итоговые оценки');
  });

  it('handles logistics exceptions and food allergen data as domain-specific risks', () => {
    const logistics = categoryResult('logistics', 'cost');
    expect(logistics.solutionId).toBe('ocr-idp');
    expect(logistics.processName).toContain('исключений');
    expect(logistics.riskControls.join(' ')).toContain('претензию');
    const food = categoryResult('food', 'offering');
    expect(food.implementationMode).toBe('data-preparation');
    expect(food.riskControls.join(' ')).toContain('аллерген');
  });

  it('uses a cautious process based on the real offering for an unknown industry', () => {
    const [result] = enrichAuditOpportunities({
      opportunities: [opportunity('revenue')],
      profile: { industry: { id: 'unknown', label: 'Неизвестное направление' } },
      market: { offerings: [{ name: 'Реальная услуга', sourceId: 'site', quote: 'Подтверждённое описание реальной услуги.' }] },
    });
    expect(result.processName).toContain('Реальная услуга');
    expect(result.input).toContain('Реальная услуга');
    expect(result.readiness.missing.join(' ')).toContain('Исходный замер');
    expect(result.priority.reason).toContain('не доказывает внутреннюю проблему');
  });
});

describe('enrichment preservation and deterministic priority', () => {
  it('preserves verified fields and evidence while adding the audit contract', () => {
    const original = opportunity('revenue');
    const snapshot = structuredClone(original);
    const [result] = enrich('retail', [original]);
    expect(result.title).toBe(original.title);
    expect(result.why).toBe(original.why);
    expect(result.action).toBe(original.action);
    expect(result.metric).toBe(original.metric);
    expect(result.id).toBe(original.id);
    expect(result.customField).toBe('сохранить');
    expect(result.evidence).toBe(original.evidence);
    expect(original).toEqual(snapshot);
  });

  it('returns at most one opportunity per category and consecutive ranks', () => {
    const result = enrich('distribution', [
      opportunity('revenue'),
      opportunity('revenue', { id: 'second-revenue' }),
      opportunity('cost'),
    ]);
    expect(result).toHaveLength(2);
    expect(new Set(result.map(item => item.category)).size).toBe(2);
    expect(result.map(item => item.priority.rank)).toEqual([1, 2]);
  });

  it('rewards independent evidence, catalog completeness and solution fit deterministically', () => {
    const market = {
      competitors: [{ sourceId: 'competitor', quote: 'Независимое описание конкурента.' }],
      reviews: [{ sourceId: 'review', quote: 'Независимый клиентский опыт.' }],
      customerEvidence: [{ sourceId: 'customer', quote: 'Независимые критерии выбора.' }],
      industryEvidence: [{ sourceId: 'industry', quote: 'Независимый отраслевой материал.' }],
      marketPriceEvidence: [{ sourceId: 'price', quote: 'Независимое ценовое наблюдение.' }],
      offerings: [{ name: 'Подтверждённый продукт', sourceId: 'site', quote: 'Полное описание подтверждённого продукта.' }],
    };
    const weak = categoryResult('retail', 'revenue');
    const strong = categoryResult('retail', 'revenue', { market });
    expect(strong.priority.score).toBeGreaterThan(weak.priority.score);
    expect(strong.priority.reason).toContain('независимый контекст');
    expect(strong.priority.reason).toContain('не доказывает внутреннюю проблему');
    expect(enrich('retail', CATEGORIES.map(category => opportunity(category)), { market })).toEqual(
      enrich('retail', CATEGORIES.map(category => opportunity(category)), { market }),
    );
  });

  it('does not turn unrelated external signals into proof of an internal cost problem', () => {
    const market = {
      competitors: [{ sourceId: 'competitor', quote: 'Конкурент опубликовал новый каталог.' }],
      industryEvidence: [{ sourceId: 'industry', quote: 'Отраслевая публикация описывает общий рынок.' }],
      marketPriceEvidence: [{ sourceId: 'price', quote: 'Внешнее ценовое наблюдение.' }],
    };
    const withoutMarket = categoryResult('manufacturing', 'cost');
    const withMarket = categoryResult('manufacturing', 'cost', { market });
    expect(withMarket.priority.score).toBe(withoutMarket.priority.score);
    expect(withMarket.priority.reason).toContain('Внешний сигнал не доказывает внутреннюю проблему');
    expect(withMarket.readiness.missing.join(' ')).toContain('Исходный замер');
  });

  it('selects simple automation where deterministic rules are sufficient', () => {
    const cases = [
      ['retail', 'cost'], ['logistics', 'offering'], ['construction', 'cost'],
      ['healthcare', 'offering'], ['government', 'cost'],
    ];
    for (const [industry, category] of cases) {
      const result = categoryResult(industry, category);
      expect(result.implementationMode).toBe('simple-automation');
      expect(result.solutionId).toBeNull();
      expect(result.simpleAlternative).toBeTruthy();
    }
  });

  it('does not fabricate numerical business targets or monetary effects', () => {
    for (const result of enrich('manufacturing')) {
      const claims = [
        result.businessMetric, result.simpleAlternative, result.priority.reason,
        ...result.baselineMetrics, ...result.qualityMetrics, ...result.riskControls,
      ].join(' ');
      expect(claims).not.toMatch(/\d+(?:[.,]\d+)?\s*(?:%|₽|руб)/i);
      expect(Number.isInteger(result.priority.score)).toBe(true);
      expect(result.acceptance.metrics.every(metric => metric.target === null)).toBe(true);
    }
  });
});

describe('acceptance suite', () => {
  it('covers normal, boundary and adversarial behavior with measurable non-invented targets', () => {
    const suite = buildAcceptanceSuite(opportunity('cost'), getSolution('ocr-idp'), { industry: { id: 'logistics' } });
    expect(new Set(suite.cases.map(item => item.type))).toEqual(new Set(['normal', 'boundary', 'adversarial']));
    expect(suite.cases.find(item => item.id === 'adversarial-injection').expected).toContain('инструкции не выполняются');
    expect(suite.metrics.map(item => item.id)).toEqual(expect.arrayContaining([
      'task-success', 'groundedness', 'escalation-quality', 'p95-latency', 'cost-per-accepted-case',
    ]));
    for (const metric of suite.metrics) {
      expect(metric.measure).toBeTruthy();
      expect(metric.target).toBeNull();
      expect(metric.targetRule).toContain('после исходного замера');
    }
  });

  it('requires human confirmation, trace, rollback/stop and full regression triggers', () => {
    const enriched = categoryResult('government', 'offering');
    const suite = buildAcceptanceSuite(enriched, null, { industry: { id: 'government' } });
    expect(suite.controls.humanConfirmation.join(' ')).toContain('подтверждения уполномоченного человека');
    expect(suite.controls.trace.join(' ')).toMatch(/модель, prompt/);
    expect(suite.controls.rollbackStop.join(' ')).toMatch(/rollback|отключение записи/i);
    expect(suite.controls.rollbackStop.join(' ')).toMatch(/stop|остановить/i);
    expect(suite.controls.regression.join(' ')).toMatch(/модели, prompt, базы знаний/);
    expect(suite.controls.regression.join(' ')).toContain('Повторять весь набор кейсов');
  });

  it('works with a minimal raw opportunity and a real solution', () => {
    const suite = buildAcceptanceSuite({}, getSolution('clinic'));
    expect(suite.context.solutionId).toBe('clinic');
    expect(suite.cases.length).toBeGreaterThanOrEqual(6);
    expect(suite.metrics.every(metric => metric.target === null)).toBe(true);
  });

  it('exposes every required industry playbook without replacing process definitions with generic titles', () => {
    for (const industry of INDUSTRIES) {
      expect(Object.keys(PROCESS_PLAYBOOKS[industry])).toEqual(expect.arrayContaining(CATEGORIES));
    }
    for (const category of CATEGORIES) {
      const names = INDUSTRIES.map(industry => PROCESS_PLAYBOOKS[industry][category].processName);
      expect(new Set(names).size).toBe(INDUSTRIES.length);
    }
  });
});
