import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Onboarding from '../src/Onboarding.jsx';
import { advisorIntent } from '../shared/advisor-dialogue.js';
import { answerAdvisor } from '../shared/advisor.js';
import { buildSelfServicePlan, selfServiceAnswer } from '../shared/self-service.js';
import { normalizeUserHypothesis } from '../shared/hypothesis.js';
import { buildPilotPlan } from '../shared/verification.js';
import { advisorRequiresEvidence, modelAnswerHasUnsupportedSpecifics, parseAdvisorResponse } from '../electron/advisor-context.mjs';
import { selectOllamaModel } from '../electron/qwen.mjs';

const research = {
  companyName: 'Теремок', createdAt: '2026-10-31T00:00:00Z', sources: [{ id: 'site-1', kind: 'company-site', title: 'Теремок', url: 'https://teremok.ru/', text: 'Меню и стоимость блюд\nопубликованы на сайте.' }],
  offerings: [{ name: 'Блин Алёша Попович', sourceId: 'site-1', quote: 'Меню и стоимость блюд опубликованы на сайте.' }],
};
const opportunity = {
  id: 'opportunity-1', title: 'Упростить выбор блюда', category: 'offering', action: 'Проверить выбор на реальных вопросах.', metric: 'Доля вопросов с готовым ответом',
  steps: ['Собрать вопросы.', 'Составить эталон.', 'Провести пилот.', 'Сравнить результат.'], unknowns: [], evidence: [{ sourceId: 'site-1', quote: 'Меню и стоимость блюд опубликованы на сайте.', sourceTitle: 'Теремок', url: 'https://teremok.ru/' }],
};

describe('свободный и управленческий диалог', () => {
  it.each([
    ['эй', 'smalltalk'], ['и что с этим делать?', 'recommendation'],
    ['Составь план внедрения самостоятельно: этапы, сроки, стоимость и риски.', 'implementation'],
    ['Что продаёт компания?', 'factual'], ['Создай новую гипотезу: наборы для завтрака', 'hypothesis'],
  ])('классифицирует «%s» как %s', (question, intent) => {
    expect(advisorIntent(question)).toBe(intent);
    expect(advisorRequiresEvidence(question)).toBe(intent === 'factual');
  });

  it('отвечает на приветствие без ошибки сверки цитат', () => {
    const result = answerAdvisor('эй', research, {}, opportunity);
    expect(result.answer).toContain('Здравствуйте');
    expect(result.answer).toContain('Теремок');
    expect(result.answer).not.toContain('не прошёл');
    expect(result.citations).toEqual([]);
  });

  it('отвечает на вопрос о действиях конкретным планом', () => {
    const result = answerAdvisor('и что с этим делать?', research, {}, opportunity);
    expect(result.answer).toContain('Собрать вопросы');
    expect(result.answer).toContain('Метрика');
    expect(result.answer).not.toContain('недостаточных оснований');
  });

  it('не показывает обрезанный JSON как осмысленный ответ', () => {
    expect(parseAdvisorResponse('{"answer":"обрезано', research, opportunity, 'Что продаёт компания?').answer).toBe('');
  });

  it('сохраняет проверяемую цитату при разных переносах строк', () => {
    const parsed = parseAdvisorResponse(JSON.stringify({ answer: 'Меню опубликовано.', citations: [{ sourceId: 'site-1', quote: 'Меню и стоимость блюд опубликованы на сайте.' }] }), research, null, 'Что продаёт компания?');
    expect(parsed.citations).toHaveLength(1);
  });

  it('отклоняет уверенную выдуманную цену, но пропускает обозначенную оценку', () => {
    expect(modelAnswerHasUnsupportedSpecifics({ answer: 'Внедрение стоит 200 000 рублей.', citations: [] })).toBe(true);
    expect(modelAnswerHasUnsupportedSpecifics({ answer: 'Например, 3 часа работы по ставке 1000 ₽ — это 3000 ₽.', citations: [] })).toBe(true);
    expect(modelAnswerHasUnsupportedSpecifics({ answer: 'Оценка для планирования зависит от трудозатрат: 2–4 дня.', citations: [] })).toBe(false);
    expect(modelAnswerHasUnsupportedSpecifics({ answer: 'Программа — 0 ₽. Внутренний бюджет = часы участников × стоимость часа.', citations: [] })).toBe(false);
  });
});

describe('пользовательские гипотезы', () => {
  it('сохраняет идею и рамки как гипотезу, а не как факт', () => {
    const created = normalizeUserHypothesis({ title: 'Наборы для офиса', action: 'Проверить спрос.', metric: 'Подтверждённые заказы.', steps: ['Шаг один.', 'Шаг два.', 'Шаг три.'] }, { brief: 'Проверить наборы для завтрака в офис', constraints: 'Без новых наймов' }, 'custom-test');
    expect(created.id).toBe('custom-test');
    expect(created.origin).toBe('user');
    expect(created.constraints).toBe('Без новых наймов');
    expect(created.why).toContain('не установленный факт');
    expect(created.evidence).toEqual([]);
    const plan = buildPilotPlan({ companyName: 'Теремок' }, created, research.sources);
    expect(plan).toContain('Наборы для офиса');
    expect(plan).toContain('Гипотеза сформулирована пользователем');
  });
});

describe('самостоятельное внедрение', () => {
  it('даёт этапы, ориентиры, владельцев и формулу бюджета', () => {
    const plan = buildSelfServicePlan(opportunity);
    expect(plan.phases).toHaveLength(4);
    expect(plan.phases[0].duration).toContain('часа');
    expect(plan.phases[0].owner).toMatch(/владелец/i);
    expect(plan.budget).toContain('часы участников');
    expect(selfServiceAnswer(opportunity)).toContain('Остановка');
  });

  it('не содержит самоссылку и открывает обсуждение внутри советника', () => {
    const html = renderToStaticMarkup(createElement(Onboarding, { companyName: 'Теремок', website: 'https://teremok.ru/', opportunity, solution: null, onOpen: () => {}, onDiscussSelfService: () => {} }));
    expect(html).toContain('Обсудить план с советником');
    expect(html).toContain('Как считать бюджет');
    expect(html).not.toContain('https://baiagent.ru/free/');
    expect(html).not.toContain('Открыть бесплатного советника');
  });
});

describe('явный выбор локальной модели', () => {
  const models = ['qwen3-vl:8b-instruct-q4_K_M', 'bge-m3:latest', 'gemma3-12b:latest', 'qwen3:8b', 'qwen3:14b'];
  it('не выбирает модель по длине имени или vision/embedding', () => {
    expect(selectOllamaModel(models)).toBe('qwen3:14b');
    expect(selectOllamaModel(models, 'qwen3:8b')).toBe('qwen3:8b');
    expect(selectOllamaModel(models, 'missing:1b')).toBe('qwen3:14b');
  });
});
