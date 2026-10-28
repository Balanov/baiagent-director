import { describe, expect, it } from 'vitest';
import { researchErrorMessage } from '../shared/research-error.js';
import { ADVISOR_SYSTEM_PROMPT, advisorPrompt } from '../electron/advisor-context.mjs';

 describe('research connection diagnostics', () => {
  it.each([
    'Failed to fetch',
    'fetch failed: ENOTFOUND',
    'Could not resolve host: example.ru',
    'ERR_CONNECTION_RESET',
  ])('does not equate a specific connection failure with no internet: %s', message => {
    const friendly = researchErrorMessage(new Error(message));
    expect(friendly).toContain('При работающем интернете');
    expect(friendly).toContain('DNS');
    expect(friendly).not.toContain('Failed to fetch');
  });
  it('separates a research service failure from a company-site failure', () => {
    expect(researchErrorMessage(new Error('Сервер исследования: HTTP 502'))).toContain('Служба исследования');
    expect(researchErrorMessage(new Error('HTTP 403'))).toContain('Сайт отклонил');
  });
  it('explains timeouts and preserves useful validation messages', () => {
    expect(researchErrorMessage(new Error('AbortError: timeout'))).toContain('не ответили вовремя');
    expect(researchErrorMessage(new Error('Укажите сайт компании'))).toBe('Укажите сайт компании');
  });
});

describe('local document context', () => {
  it('marks only device files as user documents, not web research', () => {
    const prompt = advisorPrompt({
      question: 'Какой документ я добавил?',
      research: {
        companyName: 'Пример',
        sources: [
          { id: 'site-1', kind: 'company-site', title: 'Сайт компании', text: 'Сведения с сайта компании.' },
          { id: 'web-1', kind: 'review-snippet', title: 'Внешний отзыв', text: 'Материал внешнего рынка.' },
          { id: 'local-1', kind: 'local-document', title: 'Регламент продаж.docx', url: 'local://sales.docx', text: 'Внутренний регламент обработки обращений.' },
        ],
      },
    });
    expect(ADVISOR_SYSTEM_PROMPT).toContain('Вопрос о добавленных документах отвечай только по источникам kind=local-document');
    expect(prompt).toContain('Регламент продаж.docx');
    expect(prompt).toContain('"id":"local-1","kind":"local-document"');
    expect(prompt).not.toContain('"id":"site-1","kind":"local-document"');
    expect(prompt).not.toContain('"id":"web-1","kind":"local-document"');
  });
});
