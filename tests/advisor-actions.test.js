import { describe, expect, it } from 'vitest';
import {
  createAdvisorActionOutcome,
  routeAdvisorCommand,
  validateAdvisorAction,
} from '../shared/advisor-actions.js';

const context = {
  desktop: true,
  steps: ['audit', 'direction', 'plan', 'pilot', 'documents'],
  opportunities: [{ id: 'opportunity-1' }, { id: 'opportunity-2' }, { id: 'opportunity-3' }],
  selectedOpportunityId: 'opportunity-1',
  hasDocuments: true,
};

describe('advisor action schema', () => {
  it.each([
    [{ type: 'navigate_step', step: 'plan' }],
    [{ type: 'select_opportunity', opportunityId: 'opportunity-2' }],
    [{ type: 'add_documents' }],
    [{ type: 'exclude_documents' }],
    [{ type: 'export_pilot' }],
    [{ type: 'reset_session' }],
  ])('allows an exact valid action: $type', action => {
    expect(validateAdvisorAction(action, context)).toEqual({ ok: true, action });
  });

  it('rejects an unknown action type', () => {
    expect(validateAdvisorAction({ type: 'run_shell' }, context).error.code).toBe('unknown_type');
  });

  it.each([
    [{ type: 'add_documents', command: 'rm -rf /' }],
    [{ type: 'add_documents', path: 'C:\\Windows\\System32' }],
    [{ type: 'navigate_step', step: 'audit', url: 'https://example.com' }],
    [{ type: 'select_opportunity', opportunityId: 'opportunity-1', extra: true }],
  ])('rejects shell, path and extra fields', action => {
    expect(validateAdvisorAction(action, context).error.code).toBe('invalid_fields');
  });

  it('rejects a step outside the current context', () => {
    expect(validateAdvisorAction({ type: 'navigate_step', step: 'missing' }, context).error.code).toBe('unknown_step');
    expect(validateAdvisorAction({ type: 'navigate_step', step: 'plan' }, { ...context, steps: ['audit'] }).error.code).toBe('unknown_step');
  });

  it('rejects an opportunity outside the current result', () => {
    expect(validateAdvisorAction({ type: 'select_opportunity', opportunityId: 'missing' }, context).error.code).toBe('unknown_opportunity');
  });
});

describe('explicit advisor command router', () => {
  it('routes an ordinal selection to an existing opportunity', () => {
    expect(routeAdvisorCommand('выбери второе направление', context)).toEqual({
      ok: true,
      action: { type: 'select_opportunity', opportunityId: 'opportunity-2' },
    });
  });

  it.each([
    ['добавь документы', { type: 'add_documents' }],
    ['исключи документы', { type: 'exclude_documents' }],
    ['сохрани пилот', { type: 'export_pilot' }],
    ['новый аудит', { type: 'reset_session' }],
    ['перейди к плану', { type: 'navigate_step', step: 'plan' }],
    ['открой документы', { type: 'navigate_step', step: 'documents' }],
  ])('routes only the explicit command %s', (command, action) => {
    expect(routeAdvisorCommand(command, context)).toEqual({ ok: true, action });
  });

  it.each([
    'Какие документы добавлены?',
    'Добавь документы?',
    'Как добавить документы',
    'Можно добавить документы?',
    'Что ты знаешь о документах',
    'Зачем исключать документы из анализа',
    'Как сохранить пилот',
    'Что будет при новом аудите?',
    'Какое направление второе?',
  ])('does not turn an ordinary question into an action: %s', question => {
    expect(routeAdvisorCommand(question, context)).toBeNull();
  });

  it('reports an unavailable explicit command without executing it', () => {
    const routed = routeAdvisorCommand('исключи документы', { ...context, hasDocuments: false });
    expect(routed.ok).toBe(false);
    expect(routed.error.code).toBe('unsupported');
  });
});

describe('advisor action outcomes', () => {
  it('never reports picker cancellation as success', () => {
    const outcome = createAdvisorActionOutcome('canceled', 'Выбор файла отменён.');
    expect(outcome.status).toBe('canceled');
    expect(outcome.success).toBe(false);
  });
});
