import { ArrowUpRight, Check, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';
import { applicationUrl } from './Ecosystem.jsx';
import { formatRubles } from '../shared/solutions.js';

export default function Onboarding({ companyName, website, opportunity, solution, onOpen }) {
  const implementationUrl = applicationUrl(solution?.fullName || 'Индивидуальное внедрение', companyName, opportunity.processName || opportunity.title, website);
  return <section className="native-onboarding">
    <div className="onboarding-hero">
      <span className="section-kicker"><Sparkles size={13} /> {solution ? 'Автономный агент · внедрение под ключ' : 'Индивидуальная проработка процесса'}</span>
      <h3>{solution?.fullName || 'Сначала определим рабочий сценарий'}</h3>
      <p>{solution?.outcome || 'По текущей гипотезе нельзя честно назначить готового агента. Уточним данные, границы процесса и ожидаемый результат.'}</p>
      <div className="onboarding-price">{solution ? <><strong>{formatRubles(solution.monthly)}/мес</strong><span>Установка {formatRubles(solution.setup)}<br />Запуск {solution.launchDays} дн.</span></> : <><strong>По задаче</strong><span>Цена и срок<br />после обследования</span></>}</div>
      {solution && <small className="application-note">{solution.annualSetupCondition}.</small>}
    </div>

    <div className="onboarding-path">
      <article className="is-done"><span><Check size={16} /></span><div><small>Уже готово в ИИ-советнике</small><strong>Гипотеза связана с доказательствами</strong><p>Задача: «{opportunity.processName || opportunity.title}». Результат проверяем на ваших данных, а не обещаем эффект заранее.</p></div></article>
      <article><span>2</span><div><small>Следующий шаг · заявка и первичный аудит 0 ₽</small><strong>Подключить решение с проверкой процесса</strong><p>Бесплатно оставите заявку и согласуете первичный аудит. Последующее внедрение и абонентская плата — по прайсу и согласованному объёму работ.</p><button className="onboarding-primary" onClick={() => onOpen(implementationUrl)}>{solution ? 'Подключить 0 руб.' : 'Запросить аудит за 0 ₽'}<ArrowUpRight size={16} /></button></div></article>
    </div>

    <div className="onboarding-safety"><ShieldCheck size={16} /><span>0 ₽ — заявка и первичный аудит, не последующее внедрение. Откроется заполненная заявка — ничего не отправится автоматически.</span></div>
    <details className="onboarding-support"><summary><span>Хотите сначала всё сделать сами?</span><small>Советник · 0 ₽</small><ChevronRight size={16} /></summary><div><p>Бесплатный советник остаётся отдельным продуктом: исследование, локальный диалог и ваши документы. На странице Free также доступна необязательная поддержка установки и использования от 3 990 ₽/мес.</p><button onClick={() => onOpen('https://baiagent.ru/free/')}>Открыть бесплатного советника<ArrowUpRight size={16} /></button></div></details>
  </section>;
}
