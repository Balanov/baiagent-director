import { describe, expect, it } from 'vitest';
import { AGENT_CATALOG, AGENT_SOLUTIONS, getSolution, recommendSolution } from '../shared/solutions.js';
import { verifyAnalysis } from '../shared/verification.js';

const evidenceSource = [{ id: 'site-1', kind: 'company-site', url: 'https://example.com', title: 'Example', text: 'Компания отвечает на обращения и работает с отзывами клиентов.' }];

describe('paid agent solution matching', () => {
  it('keeps the complete 24-solution catalog with commercial terms', () => {
    expect(AGENT_CATALOG).toHaveLength(24);
    expect(new Set(AGENT_SOLUTIONS.map(solution => solution.id)).size).toBe(24);
    for (const solution of AGENT_SOLUTIONS) {
      expect(solution.monthly).toBeGreaterThan(0);
      expect(solution.setup).toBeGreaterThan(0);
      expect(solution.launchDays).toBeGreaterThan(0);
      expect(solution.annualSetupCondition).toContain('от 1 года');
    }
    expect(getSolution('reputation')).toMatchObject({ monthly: 14900, setup: 119900, launchDays: 5 });
    expect(getSolution('ocr-idp')).toMatchObject({ monthly: 29900, setup: 359900, launchDays: 14 });
    expect(getSolution('legal')).toMatchObject({ monthly: 29900, setup: 249900, launchDays: 7 });
  });

  it('maps review operations to reputation management, not a generic chatbot', () => {
    const solution = recommendSolution({ category: 'cost', title: 'Превратить темы отзывов в управляемый цикл улучшений', action: 'Классифицировать отзывы и назначить владельца реакции.' });
    expect(solution.id).toBe('reputation');
  });

  it('distinguishes customer delivery requests from warehouse optimization', () => {
    expect(recommendSolution({ category: 'revenue', title: 'Сократить путь от запроса на доставку к оформленному отправлению', action: 'Уточнить параметры отправления и подготовить расчёт.' }).id).toBe('chatbot');
    expect(recommendSolution({ category: 'cost', title: 'Оптимизировать склад и комплектацию товаров', action: 'Управлять запасами и размещением на складе.' }).id).toBe('warehouse-logistics');
  });

  it('maps internal sourced answers to RAG', () => {
    expect(recommendSolution({ category: 'cost', title: 'Сократить поиск подтверждённых ответов', action: 'Создать базу знаний, где каждый ответ содержит источник.' }).id).toBe('rag');
  });

  it('does not force an agent onto an unrelated or ambiguous task', () => {
    expect(recommendSolution({ category: 'offering', title: 'Обсудить стратегию на год', action: 'Провести управленческую сессию.' })).toBeNull();
  });

  it('persists the computed solution id during evidence verification', () => {
    const raw = { opportunities: [{ category: 'cost', title: 'Превратить темы отзывов в управляемый цикл улучшений', action: 'Классифицировать отзывы.', metric: 'Время реакции', confidence: 'low', unknowns: [], evidence: [{ sourceId: 'site-1', quote: 'работает с отзывами клиентов.' }] }] };
    const [result] = verifyAnalysis(raw, evidenceSource).opportunities;
    expect(result.solutionId).toBe('reputation');
    expect(getSolution(result.solutionId).name).toBe('ИИ-анализ отзывов');
  });
});
