import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Onboarding from '../src/Onboarding.jsx';
import { getSolution } from '../shared/solutions.js';

const opportunity = { title: 'Ответы на вопросы клиентов', processName: 'Консультация клиентов' };
const render = solution => renderToStaticMarkup(createElement(Onboarding, { companyName: 'Теремок', website: 'https://teremok.ru/', opportunity, solution, onOpen: () => {} }));

describe('Единый переход к подключению', () => {
  it('не меняет CTA, если готовый агент ещё не подобран', () => {
    const html = render(null);
    expect(html).toContain('Подключить 0 руб.');
    expect(html).toContain('0 ₽ — заявка и первичный аудит, не последующее внедрение');
    expect(html).toContain('Цена и срок');
    expect(html).not.toContain('Запросить аудит за 0 ₽');
  });

  it('показывает условия готового решения рядом с бесплатным подключением', () => {
    const html = render(getSolution('chatbot'));
    expect(html).toContain('Подключить 0 руб.');
    expect(html).toContain('При контракте от 1 года установка бесплатно');
    expect(html).toContain(`19${String.fromCharCode(160)}900 ₽/мес`);
  });
});
