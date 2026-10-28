import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Database, GitBranch, Gauge, ShieldCheck, UserCheck } from 'lucide-react';

function List({ items = [] }) {
  return <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;
}

export default function AuditContract({ opportunity }) {
  if (!opportunity?.processName || !opportunity?.acceptance) return null;
  const acceptance = opportunity.acceptance;
  return <section className="audit-contract" aria-label="Контракт проверяемого процесса">
    <div className="audit-contract-heading"><ClipboardCheck size={18} /><div><span>Рабочий процесс, а не общий совет</span><h3>{opportunity.processName}</h3></div></div>
    {opportunity.priority?.reason && <p className="audit-priority-reason"><strong>Почему этот приоритет.</strong> {opportunity.priority.reason}</p>}

    <div className="audit-workflow">{opportunity.workSteps.map((step, index) => <article key={step.stage}>
      <span>{String(index + 1).padStart(2, '0')} · {step.name}</span><p>{step.description}</p>{index < opportunity.workSteps.length - 1 && <ArrowRight size={15} />}
    </article>)}</div>

    <div className="audit-two-columns">
      <article><Database size={16} /><h4>Что потребуется</h4><strong>Данные</strong><List items={opportunity.requiredData} /><strong>Подключения — после проверки доступа</strong><List items={opportunity.integrations} /></article>
      <article><UserCheck size={16} /><h4>Кто отвечает</h4><p>{opportunity.owner}</p><strong>Граница автономности</strong><p>{opportunity.escalation}</p></article>
    </div>

    <article className="audit-metrics"><Gauge size={16} /><h4>Как доказать пользу</h4><div className="audit-metric-grid"><div><strong>Исходный замер</strong><List items={opportunity.baselineMetrics} /></div><div><strong>Качество работы</strong><List items={opportunity.qualityMetrics} /></div></div><p><strong>Бизнес-метрика:</strong> {opportunity.businessMetric}</p><small>{acceptance.targetPolicy}</small></article>

    <article className="audit-alternative"><GitBranch size={16} /><div><h4>Сначала более простое решение, если его достаточно</h4><p>{opportunity.simpleAlternative}</p></div></article>
    <article className="audit-risks"><AlertTriangle size={16} /><div><h4>Риски и обязательные ограничения</h4><List items={opportunity.riskControls} /></div></article>

    <details className="audit-acceptance"><summary><span><CheckCircle2 size={16} /> Приёмка: {acceptance.cases.length} обязательных сценариев и контроль эксплуатации</span></summary><div>
      <div className="audit-acceptance-cases">{acceptance.cases.map(test => <article key={test.id}><span>{test.type === 'normal' ? 'Штатный' : test.type === 'boundary' ? 'Граничный' : 'Противодействие'}</span><h4>{test.name}</h4><p><strong>Вход:</strong> {test.input}</p><p><strong>Ожидаемо:</strong> {test.expected}</p><List items={test.assertions} /></article>)}</div>
      <h4>Метрики приёмки без выдуманных целевых значений</h4>{acceptance.metrics.map(metric => <p className="audit-acceptance-metric" key={metric.id}><strong>{metric.name}.</strong> {metric.measure}</p>)}
      <div className="audit-controls"><article><h4>Подтверждение человеком</h4><List items={acceptance.controls.humanConfirmation} /></article><article><h4>Trace и наблюдаемость</h4><List items={acceptance.controls.trace} /></article><article><h4>Stop и rollback</h4><List items={acceptance.controls.rollbackStop} /></article><article><h4>Регрессионная проверка</h4><List items={acceptance.controls.regression} /></article></div>
    </div></details>

    <div className="audit-readiness"><ShieldCheck size={16} /><div><strong>Что уже известно</strong><List items={opportunity.readiness?.known} /><strong>Что обязательно проверить до запуска</strong><List items={opportunity.readiness?.missing} /></div></div>
  </section>;
}
