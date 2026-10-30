import { buildPilotBlueprint } from './pilot.js';
import { formatRubles } from './solutions.js';

const DURATIONS = ['2–4 часа', '0,5–1 рабочего дня', '3–5 рабочих дней', '1–2 рабочих дня'];

export function buildSelfServicePlan(opportunity = {}, solution = null) {
  const pilot = buildPilotBlueprint(opportunity, solution);
  const actions = opportunity.steps?.length ? opportunity.steps : [
    opportunity.action || 'Описать выбранный процесс и назначить ответственного.',
    'Собрать разрешённые данные и эталонные случаи.',
    'Проверить решение на ограниченном наборе случаев с человеком.',
    'Сравнить результат с исходной метрикой и принять решение.',
  ];
  return {
    title: opportunity.processName || opportunity.title || 'Самостоятельная проверка гипотезы',
    estimateNotice: 'Ориентиры для одного ограниченного процесса, а не обещание срока или цены. Точность зависит от готовности данных, доступов и участия владельца процесса.',
    phases: actions.slice(0, 4).map((action, index) => ({
      title: ['Рамка и исходный замер', 'Данные и эталон', 'Ограниченная проверка', 'Решение по результату'][index] || `Этап ${index + 1}`,
      action, duration: DURATIONS[index] || 'Уточняется после обследования',
      owner: index === 0 ? pilot.owner : index === 3 ? 'Владелец процесса и руководитель пилота' : 'Назначенный сотрудник совместно с владельцем процесса',
      cost: '0 ₽ за советника; отдельно учтите время своей команды',
    })),
    budget: 'Программа — 0 ₽. Внутренний бюджет = часы участников × ваша стоимость часа + расходы на доступные инструменты. До спецификации внешняя разработка в смету не включена.',
    data: pilot.data, integrations: pilot.integrations, humanControl: pilot.humanControl,
    metric: opportunity.metric || 'Выбранная бизнес-метрика и доля корректно обработанных эталонных случаев.',
    stopRule: pilot.stopRule,
    paidOption: solution ? `${solution.fullName}: ${formatRubles(solution.monthly)}/мес, установка ${formatRubles(solution.setup)}. ${solution.annualSetupCondition || 'Условия фиксируются до начала работ'}.` : null,
  };
}

export function selfServiceAnswer(opportunity, solution = null) {
  const plan = buildSelfServicePlan(opportunity, solution);
  const stages = plan.phases.map((phase, index) => `${index + 1}. ${phase.title}: ${phase.action} Ориентир: ${phase.duration}.`).join('\n');
  return `Можно начать своими силами — вот рабочий план для «${plan.title}»:\n${stages}\n\nБюджет: ${plan.budget}\nМетрика: ${plan.metric}\nОстановка: ${plan.stopRule}\n\n${plan.estimateNotice}`;
}
