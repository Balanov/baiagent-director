import { ArrowUpRight, Bot, Check, ChevronRight, FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react';
import { AGENT_CATALOG, AGENT_SOLUTIONS, formatRubles, recommendSolution, recommendedAgents } from '../shared/solutions.js';

export { AGENT_CATALOG, recommendedAgents };

export function applicationUrl(agent, companyName, task, website) {
  const url = new URL('https://baiagent.ru/');
  url.searchParams.set('director', '1');
  url.searchParams.set('agent', agent);
  url.searchParams.set('company', companyName || '');
  url.searchParams.set('task', task || '');
  if (website) url.searchParams.set('website', website);
  return url.toString();
}

export function RecommendedAgent({ opportunity, companyName, website, onOpen }) {
  const solution = recommendSolution(opportunity);
  if (!solution) return <section className="recommended-agent">
    <div className="recommended-agent-top"><span><ShieldCheck size={15} /> Сначала уточним процесс</span><small>Без навязанного сценария</small></div>
    <h3>Нужна индивидуальная проработка</h3>
    <p>По текущей гипотезе нельзя честно выбрать готового агента. Сначала определим данные, границы задачи и измеримый результат.</p>
    <button onClick={() => onOpen(applicationUrl('Индивидуальное внедрение', companyName, opportunity.title, website))}>Обсудить задачу<ArrowUpRight size={18} /></button>
  </section>;
  return <section className="recommended-agent">
    <div className="recommended-agent-top"><span><Sparkles size={15} /> Автономное решение этой задачи</span><small>Внедрение под ключ</small></div>
    <h3>{solution.fullName}</h3>
    <p>{solution.outcome}</p>
    <div className="agent-commercial"><span><strong>{formatRubles(solution.monthly)}/мес</strong><small>абонентская плата</small></span><span><strong>{formatRubles(solution.setup)}</strong><small>установка</small></span><span><strong>{solution.launchDays} дн.</strong><small>срок запуска</small></span></div>
    <small className="application-note">{solution.annualSetupCondition}.</small>
    <button onClick={() => onOpen(applicationUrl(solution.fullName, companyName, opportunity.title, website))}>Обсудить внедрение<ArrowUpRight size={18} /></button>
    <small className="application-note"><Check size={13} /> Откроется заполненная заявка. Вы всё проверите перед отправкой.</small>
  </section>;
}

export function AgentShowcase({ opportunity, companyName, website, onOpen }) {
  const primary = recommendSolution(opportunity);
  const ordered = primary ? [primary, ...AGENT_SOLUTIONS.filter(solution => solution.id !== primary.id)] : AGENT_SOLUTIONS;
  return <section className="agent-showcase">
    <div className="agent-showcase-heading"><div><span className="section-kicker">24 готовых решения</span><h2>От найденной задачи — к конкретному агенту</h2></div><p>Синим отмечено только решение, которое действительно соответствует сценарию. Цены и сроки — из действующего прайса.</p></div>
    <div className="agent-carousel">{ordered.map((solution, index) => {
      const matches = solution.id === primary?.id;
      return <article className={`agent-solution ${matches ? 'is-recommended' : ''}`} key={solution.id}>
        <div className="agent-solution-icon">{matches ? <Sparkles size={20} /> : <Bot size={20} />}</div>
        <span>{String(AGENT_SOLUTIONS.indexOf(solution) + 1).padStart(2, '0')}</span><h3>{solution.name}</h3>
        <small>{matches ? 'Подходит к текущей задаче' : `${formatRubles(solution.monthly)}/мес · запуск ${solution.launchDays} дн.`}</small>
        <button onClick={() => onOpen(applicationUrl(solution.fullName, companyName, opportunity.title, website))}>Обсудить<ChevronRight size={14} /></button>
      </article>;
    })}</div>
    <a className="ecosystem-price" href="https://baiagent.ru/xray/downloads/BAIagent-B2B-price.xlsx" target="_blank" rel="noreferrer"><FileSpreadsheet size={19} /> Полный прайс на решения под ключ<ArrowUpRight size={16} /></a>
  </section>;
}

export function FreeStart({ onOpen }) {
  return <section className="free-start">
    <div className="free-start-heading"><span className="section-kicker">Самостоятельный запуск</span><h2>Можно начать за 0 ₽</h2><p>Для тех, кто хочет попробовать самостоятельно. Без скрытого перехода на платный тариф.</p></div>
    <div className="free-options">
      <article><div><strong>0 ₽</strong><span>Самостоятельный Director</span></div><p>Исследование, локальный диалог и выбранные документы. Поддержка не требуется.</p></article>
      <article><div><strong>от 3 990 ₽/мес</strong><span>Поддержка Director</span></div><p>Только по желанию: помощь с установкой, настройкой и использованием.</p></article>
    </div>
    <button onClick={() => onOpen('https://baiagent.ru/free/')}><ShieldCheck size={18} /> Попробовать за 0 ₽<ArrowUpRight size={18} /></button>
  </section>;
}
