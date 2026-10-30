export const ADVISOR_ACTION_TYPES = Object.freeze([
  'navigate_step',
  'select_opportunity',
  'add_documents',
  'exclude_documents',
  'export_pilot',
  'reset_session',
]);

export const ADVISOR_STEPS = Object.freeze(['audit', 'direction', 'plan', 'pilot', 'documents']);

const ACTION_FIELDS = {
  navigate_step: ['type', 'step'],
  select_opportunity: ['type', 'opportunityId'],
  add_documents: ['type'],
  exclude_documents: ['type'],
  export_pilot: ['type'],
  reset_session: ['type'],
};

const EXACT_COMMANDS = {
  'добавь документ': { type: 'add_documents' },
  'добавь документы': { type: 'add_documents' },
  'добавь документы в анализ': { type: 'add_documents' },
  'исключи документы': { type: 'exclude_documents' },
  'исключи документы из анализа': { type: 'exclude_documents' },
  'сохрани пилот': { type: 'export_pilot' },
  'сохрани план пилота': { type: 'export_pilot' },
  'новый аудит': { type: 'reset_session' },
  'начни новый аудит': { type: 'reset_session' },
  'сбрось сессию': { type: 'reset_session' },
  'открой аудит': { type: 'navigate_step', step: 'audit' },
  'перейди к аудиту': { type: 'navigate_step', step: 'audit' },
  'вернись к аудиту': { type: 'navigate_step', step: 'audit' },
  'перейди к выбору': { type: 'navigate_step', step: 'direction' },
  'открой выбор направления': { type: 'navigate_step', step: 'direction' },
  'покажи направления': { type: 'navigate_step', step: 'direction' },
  'перейди к плану': { type: 'navigate_step', step: 'plan' },
  'открой план': { type: 'navigate_step', step: 'plan' },
  'перейди к пилоту': { type: 'navigate_step', step: 'pilot' },
  'открой пилот': { type: 'navigate_step', step: 'pilot' },
  'открой документы': { type: 'navigate_step', step: 'documents' },
  'перейди к документам': { type: 'navigate_step', step: 'documents' },
};

const ORDINALS = { первое: 0, второе: 1, третье: 2, 1: 0, 2: 1, 3: 2 };

function rejection(code, message) {
  return { ok: false, error: { code, message } };
}

function opportunityIds(context) {
  if (Array.isArray(context.opportunities)) return context.opportunities.map(item => item?.id).filter(Boolean);
  return Array.isArray(context.opportunityIds) ? context.opportunityIds : [];
}

export function validateAdvisorAction(candidate, context = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return rejection('invalid_action', 'Действие должно быть объектом строгого формата.');
  }
  if (!ADVISOR_ACTION_TYPES.includes(candidate.type)) {
    return rejection('unknown_type', 'Такое действие не поддерживается.');
  }
  const expected = ACTION_FIELDS[candidate.type];
  const actual = Reflect.ownKeys(candidate).filter(key => typeof key !== 'string' || key.length > 0).map(String).sort();
  if (actual.length !== expected.length || expected.some(key => !actual.includes(key))) {
    return rejection('invalid_fields', 'Действие содержит неподдерживаемые или неполные поля.');
  }

  if (candidate.type === 'navigate_step') {
    const availableSteps = Array.isArray(context.steps) ? context.steps : ADVISOR_STEPS;
    if (typeof candidate.step !== 'string' || !ADVISOR_STEPS.includes(candidate.step) || !availableSteps.includes(candidate.step)) {
      return rejection('unknown_step', 'Такого раздела нет в текущем исследовании.');
    }
    return { ok: true, action: { type: candidate.type, step: candidate.step } };
  }

  if (candidate.type === 'select_opportunity') {
    if (typeof candidate.opportunityId !== 'string' || !opportunityIds(context).includes(candidate.opportunityId)) {
      return rejection('unknown_opportunity', 'Такого направления нет в текущем исследовании.');
    }
    return { ok: true, action: { type: candidate.type, opportunityId: candidate.opportunityId } };
  }

  if (candidate.type === 'add_documents' && context.desktop !== true) {
    return rejection('unsupported', 'Локальные документы доступны только в Windows-версии.');
  }
  if (candidate.type === 'exclude_documents' && (context.desktop !== true || context.hasDocuments !== true)) {
    return rejection('unsupported', 'В текущем исследовании нет локальных документов для исключения.');
  }
  if (candidate.type === 'export_pilot' && (context.desktop !== true || !opportunityIds(context).includes(context.selectedOpportunityId))) {
    return rejection('unsupported', 'Сначала выберите направление для плана пилота.');
  }
  if (candidate.type === 'reset_session' && context.desktop !== true) {
    return rejection('unsupported', 'Сброс локальной сессии доступен только в Windows-версии.');
  }
  return { ok: true, action: { type: candidate.type } };
}

function normalizeCommand(input) {
  return String(input || '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[.!]+$/u, '');
}

export function routeAdvisorCommand(input, context = {}) {
  const command = normalizeCommand(input);
  if (!command || command.includes('?')) return null;

  let candidate = Object.prototype.hasOwnProperty.call(EXACT_COMMANDS, command) ? EXACT_COMMANDS[command] : null;
  if (!candidate) {
    const match = command.match(/^выбери (?:(первое|второе|третье|[1-3])(?: направление)?|направление (первое|второе|третье|[1-3]))$/u);
    if (match) {
      const index = ORDINALS[match[1] || match[2]];
      const opportunityId = opportunityIds(context)[index];
      candidate = { type: 'select_opportunity', opportunityId };
    }
  }
  return candidate ? validateAdvisorAction(candidate, context) : null;
}

export function createAdvisorActionOutcome(status, message) {
  if (!['completed', 'canceled', 'error'].includes(status)) throw new Error('Unknown advisor action outcome');
  return { status, success: status === 'completed', message: String(message || '') };
}
