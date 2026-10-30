import { describe, expect, it } from 'vitest';
import { modelAnswerHasUnsupportedSpecifics, parseAdvisorResponse } from '../electron/advisor-context.mjs';
import { answerAdvisor } from '../shared/advisor.js';

const research = {
  companyName: 'Теремок',
  marketContext: { subject: 'продукты питания' },
  sources: [{ id: 'site-1', kind: 'company-site', url: 'https://teremok.ru/', title: 'Теремок', text: 'Завтрак Богатырский. Блин Алёша Попович.' }],
  offerings: [
    { name: 'Завтрак Богатырский', sourceId: 'site-1', quote: 'Завтрак Богатырский.' },
    { name: 'Блин Алёша Попович', sourceId: 'site-1', quote: 'Блин Алёша Попович.' },
  ],
};

describe('advisor factual grounding', () => {
  it('rejects unsupported services and locations attached to a real product quote', () => {
    const parsed = parseAdvisorResponse(JSON.stringify({
      answer: 'В меню есть блины. Доступны доставка, предзаказ и рестораны в Краснодаре.',
      citations: [{ sourceId: 'site-1', quote: 'Блин Алёша Попович.' }],
    }), research, null, 'Что вы поняли о бизнесе?');
    expect(parsed.citations).toHaveLength(1);
    expect(modelAnswerHasUnsupportedSpecifics(parsed)).toBe(true);
  });
  it('accepts a specific service only when the citation confirms it', () => {
    const supported = { answer: 'Доступна доставка.', citations: [{ quote: 'Доставка готовых блюд.' }] };
    expect(modelAnswerHasUnsupportedSpecifics(supported)).toBe(false);
  });
  it('rejects comparisons and review judgments that a product quote cannot prove', () => {
    expect(modelAnswerHasUnsupportedSpecifics({
      answer: 'Ассортимент шире, чем у конкурентов, а средний чек ниже. Отзывы подтверждают высокое качество сервиса.',
      citations: [{ quote: 'Блин Алёша Попович.' }],
    })).toBe(true);
  });
  it('checks each claimed service independently', () => {
    expect(modelAnswerHasUnsupportedSpecifics({
      answer: 'Доступны доставка и бронирование.',
      citations: [{ quote: 'Доставка готовых блюд.' }],
    })).toBe(true);
    expect(modelAnswerHasUnsupportedSpecifics({
      answer: 'В отзывах клиенты отмечают качество сервиса.',
      citations: [{ quote: 'В отзывах клиенты отмечают качество сервиса.' }],
    })).toBe(false);
  });
  it('gives a concise evidence-only company summary instead of generic advice', () => {
    const result = answerAdvisor('Что вы поняли о моём бизнесе?', research);
    expect(result.answer).toContain('Теремок');
    expect(result.answer).toContain('Завтрак Богатырский');
    expect(result.answer).not.toContain('доставку');
    expect(result.citations).toHaveLength(2);
  });
});
