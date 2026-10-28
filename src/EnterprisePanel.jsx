import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  Gauge,
  Mail,
  Network,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import EnterpriseLeadForm from './EnterpriseLeadForm.jsx';
import { enterpriseRecommendations } from '../shared/enterprise.js';
import { formatRubles } from '../shared/solutions.js';
import './enterprise.css';

const ECOSYSTEM_URL = 'https://balanov.pro/all';
const AUDIT_EMAIL = 'office@balanov.pro';
const PRICE_LEVELS = [
  { key: 'junior', label: 'Junior' },
  { key: 'middle', label: 'Middle' },
  { key: 'senior', label: 'Senior' },
];
const ARCHITECTURE_ITEMS = [
  { key: 'data', title: 'Данные', icon: Database },
  { key: 'integrations', title: 'Интеграции', icon: Network },
  { key: 'security', title: 'Безопасность', icon: ShieldCheck },
  { key: 'quality', title: 'Качество', icon: Gauge },
  { key: 'operations', title: 'Эксплуатация', icon: Settings },
];

function hasPrice(value) {
  return value !== null && value !== undefined;
}

function unitLabel(unit) {
  return unit == null ? 'Период не указан в прайсе' : `Единица измерения: ${unit}`;
}

function buildAuditMailto({ email, company, website, process, hypothesis }) {
  const subject = `Бесплатный аудит Balanov.PRO — ${company}`;
  const body = [
    'Здравствуйте!',
    '',
    'Прошу согласовать бесплатный аудит процессов и инфраструктуры, а также условия NDA.',
    '',
    `Компания: ${company}`,
    `Сайт: ${website || 'Не указан'}`,
    `Процесс: ${process}`,
    `Гипотеза: ${hypothesis}`,
    '',
    'Пожалуйста, предложите следующий шаг.',
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function SectionHeading({ number, icon: Icon, title, description }) {
  return <div className="enterprise-panel__section-heading">
    <span className="enterprise-panel__section-icon"><Icon size={18} /></span>
    <div>
      <span className="enterprise-panel__section-number">{number}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  </div>;
}

export function EnterprisePanel({
  research = {},
  profile = {},
  opportunity = {},
  solution = null,
  companyName = '',
  website = '',
  onOpen,
}) {
  const [leadOpen, setLeadOpen] = useState(false);
  const closeLead = useCallback(() => setLeadOpen(false), []);
  const recommendations = useMemo(() => enterpriseRecommendations({
    research,
    profile,
    opportunity,
    solution,
    limit: 3,
  }), [research, profile, opportunity, solution]);

  const company = companyName || research?.companyName || profile?.companyName || 'Компания не указана';
  const site = website || research?.requestedUrl || '';
  const process = opportunity?.processName || opportunity?.title || solution?.fullName || solution?.name || 'Процесс пока не выбран';
  const hypothesis = opportunity?.processAction || opportunity?.action || solution?.outcome
    || 'Сначала нужно уточнить владельца процесса, данные и критерий результата на бесплатном аудите.';
  const nextStep = recommendations.nextStep;
  const roadmap = recommendations.roadmapPriceRange;
  const auditMailto = buildAuditMailto({
    email: nextStep?.email || recommendations.contact?.email || AUDIT_EMAIL,
    company,
    website: site,
    process,
    hypothesis,
  });

  function openEcosystem(event) {
    if (typeof onOpen !== 'function') return;
    event.preventDefault();
    onOpen(ECOSYSTEM_URL);
  }

  return <section className="enterprise-panel" aria-label="Balanov.PRO · ИИ-советник для бизнеса">
    <header className="enterprise-panel__hero">
      <div className="enterprise-panel__hero-copy">
        <span className="enterprise-panel__brand"><Sparkles size={15} /> Balanov.PRO · ИИ-советник для бизнеса</span>
        <h2>Enterprise-трек: от процесса к проверяемому пилоту</h2>
        <p>Для компании, отдела или министерства. Сначала аудит и измеримая гипотеза, затем решение о составе работ.</p>
      </div>
      <div className="enterprise-panel__company">
        <Building2 size={19} />
        <span><small>Контекст рекомендации</small><strong>{company}</strong></span>
      </div>
    </header>

    <p className="enterprise-panel__summary"><ShieldCheck size={16} /> <span>{recommendations.summary}</span></p>

    <section className="enterprise-panel__section enterprise-panel__process">
      <SectionHeading
        number="01 · Выбранный процесс"
        icon={ClipboardCheck}
        title="Конкретная гипотеза, а не обещание эффекта"
        description="Применимость решения и результат проверяются на данных заказчика."
      />
      <div className="enterprise-panel__process-card">
        <div className="enterprise-panel__process-main">
          <span className="enterprise-panel__label">Выбранный процесс</span>
          <h4>{process}</h4>
          <p>{hypothesis}</p>
        </div>
        <span className="enterprise-panel__hypothesis-badge">Гипотеза · требует аудита</span>
        {(solution?.fullName || solution?.name) && <div className="enterprise-panel__process-detail">
          <span>Решение для проверки</span>
          <strong>{solution.fullName || solution.name}</strong>
        </div>}
        {(opportunity?.businessMetric || opportunity?.metric) && <div className="enterprise-panel__process-detail">
          <span>Как измерять результат</span>
          <strong>{opportunity.businessMetric || opportunity.metric}</strong>
        </div>}
        {opportunity?.why && <div className="enterprise-panel__process-detail enterprise-panel__process-detail--wide">
          <span>Почему процесс выбран</span>
          <strong>{opportunity.why}</strong>
        </div>}
      </div>
    </section>

    <section className="enterprise-panel__section">
      <SectionHeading
        number="02 · Опыт вендора"
        icon={FileSearch}
        title="Релевантные кейсы с результатом и ограничениями"
        description="Результаты описаны вендором для других клиентов. Их повторение в этой компании не обещается."
      />
      {recommendations.cases.length ? <div className="enterprise-panel__cases">
        {recommendations.cases.map(item => <article
          className={`enterprise-panel__case${item.isUnsuccessful ? ' enterprise-panel__case--risk' : ''}`}
          key={item.id}
        >
          <div className="enterprise-panel__case-topline">
            <span>{item.cluster}</span>
            {item.isUnsuccessful
              ? <strong className="enterprise-panel__risk-badge"><AlertTriangle size={14} /> Риск · неуспешный или остановленный кейс</strong>
              : <strong className="enterprise-panel__reported-badge"><CheckCircle2 size={14} /> Результат описан вендором</strong>}
          </div>
          <h4>{item.task}</h4>
          <p className="enterprise-panel__case-client">{item.client}</p>
          <div className="enterprise-panel__case-facts">
            <div><span>{item.isUnsuccessful ? 'Итог и риск' : 'Заявленный результат'}</span><strong>{item.outcome}</strong></div>
            <div><span>Подробности</span><p>{item.result}</p></div>
            {item.comment && <div><span>Срок / ограничение</span><p>{item.comment}</p></div>}
          </div>
          <p className="enterprise-panel__case-note"><ShieldCheck size={14} /> {item.applicability}</p>
        </article>)}
      </div> : <div className="enterprise-panel__empty">
        <FileSearch size={21} />
        <p>Релевантные кейсы не найдены. Мы не подставляем другой опыт и не выдумываем результат для этой задачи.</p>
      </div>}
      {recommendations.risks.length > 0 && <div className="enterprise-panel__risk-list">
        <h3><AlertTriangle size={18} /> Риски из остановленных и неуспешных проектов</h3>
        <p>Эти кейсы не рекомендуются как успешный опыт. Они помогают заранее проверить условия, при которых проект может не дать результата.</p>
        {recommendations.risks.map(item => <article className="enterprise-panel__case enterprise-panel__case--risk" key={item.caseId}>
          <div className="enterprise-panel__case-topline"><span>{item.cluster}</span><strong className="enterprise-panel__risk-badge"><AlertTriangle size={14} /> Риск · неуспешный или остановленный кейс</strong></div>
          <h4>{item.task}</h4>
          <p className="enterprise-panel__case-client">{item.client}</p>
          <div className="enterprise-panel__case-facts">
            <div><span>Итог и риск</span><strong>{item.outcome}</strong></div>
            <div><span>Подробности</span><p>{item.result}</p></div>
            {item.comment && <div><span>Ограничение</span><p>{item.comment}</p></div>}
          </div>
          <p className="enterprise-panel__case-note"><ShieldCheck size={14} /> {item.applicability}</p>
        </article>)}
      </div>}
    </section>

    <section className="enterprise-panel__section">
      <SectionHeading
        number="03 · Команда и прайс"
        icon={Users}
        title="Подходящие специалисты и услуги"
        description="Показаны только позиции и значения из прайса Balanov.PRO. Состав и объём работ определяются после аудита."
      />
      {recommendations.services.length ? <div className="enterprise-panel__services">
        {recommendations.services.map(service => {
          const levels = PRICE_LEVELS.filter(level => hasPrice(service.prices?.[level.key]));
          return <article className="enterprise-panel__service" key={service.id}>
            <span className="enterprise-panel__service-cluster">{service.cluster}</span>
            <h4>{service.name}</h4>
            {service.tasks && <p className="enterprise-panel__service-tasks">{service.tasks}</p>}
            <div className="enterprise-panel__price-list">
              {levels.map(level => <div key={level.key}>
                <span>{level.label}</span>
                <strong>{formatRubles(service.prices[level.key])}</strong>
              </div>)}
              {!levels.length && !service.offer && <p>Ставки Junior / Middle / Senior в прайсе не указаны.</p>}
            </div>
            {service.offer && <div className="enterprise-panel__service-offer">{service.offer}</div>}
            {hasPrice(service.prices?.integrationOneTime) && <div className="enterprise-panel__integration-price">
              <span><small>Отдельно</small>Интеграция · разовая работа</span>
              <strong>{formatRubles(service.prices.integrationOneTime)}</strong>
            </div>}
            <small className="enterprise-panel__unit-note">{unitLabel(service.unit)}</small>
          </article>;
        })}
      </div> : <div className="enterprise-panel__empty">
        <Users size={21} />
        <p>Подходящие позиции прайса не найдены. Специалистов, состав команды и стоимость автоматически не назначаем.</p>
      </div>}
    </section>

    <section className="enterprise-panel__section">
      <SectionHeading
        number="04 · Архитектура"
        icon={Network}
        title="Пять контуров для проектирования и проверки"
        description="Это требования к будущему решению, а не заявление о готовых интеграциях, сертификациях или уже реализованных мерах."
      />
      <div className="enterprise-panel__architecture">
        {ARCHITECTURE_ITEMS.map(({ key, title, icon: Icon }) => recommendations.architecture?.[key] && <article key={key}>
          <div><Icon size={17} /><h4>{title}</h4></div>
          <p>{recommendations.architecture[key]}</p>
        </article>)}
      </div>
    </section>

    <section className="enterprise-panel__section enterprise-panel__next-step">
      <SectionHeading
        number="05 · Следующий шаг"
        icon={Mail}
        title={nextStep.title}
        description={nextStep.action}
      />
      <div className="enterprise-panel__next-grid">
        <div className="enterprise-panel__audit-offer">
          <span>Первый шаг</span>
          <strong>{nextStep.price === 0 ? '0 ₽' : nextStep.offer}</strong>
          <p>{nextStep.offer}</p>
        </div>
        {roadmap && <div className="enterprise-panel__roadmap">
          <span>Если понадобится отдельная дорожная карта</span>
          <h4>{roadmap.service}</h4>
          <strong>{formatRubles(roadmap.min)} — {formatRubles(roadmap.max)}</strong>
          <p>{roadmap.note}</p>
          <small>{unitLabel(roadmap.unit)}</small>
        </div>}
      </div>
      <div className="enterprise-panel__actions">
        <button type="button" className="enterprise-panel__primary-action" onClick={() => setLeadOpen(true)}>
          <Mail size={18} /> Получить бесплатный аудит <ArrowUpRight size={17} />
        </button>
        <a className="enterprise-panel__secondary-action" href={auditMailto}>
          Написать office@balanov.pro <ArrowUpRight size={16} />
        </a>
        <a className="enterprise-panel__secondary-action" href={ECOSYSTEM_URL} target="_blank" rel="noreferrer" onClick={openEcosystem}>
          Экосистема Balanov.PRO <ArrowUpRight size={16} />
        </a>
      </div>
      <p className="enterprise-panel__mail-note"><ShieldCheck size={14} /> Откроется форма заявки или подготовленное письмо — вы всё проверите перед отправкой</p>
    </section>
    {leadOpen && <EnterpriseLeadForm company={company} website={site} process={process} hypothesis={hypothesis} mailto={auditMailto} onClose={closeLead} />}
  </section>;
}

export default EnterprisePanel;
