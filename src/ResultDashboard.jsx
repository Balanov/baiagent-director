import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check,
  CheckCircle2, ChevronRight, ClipboardList, Download, ExternalLink, FilePlus2,
  FileSearch, FileText, FolderOpen, Gauge, Globe2, Home, Image, Layers3, Lightbulb,
  MessageSquareText, Monitor, Newspaper, Plus, Rocket, ShieldCheck, Sparkles, Trash2,
  TrendingUp, X,
} from 'lucide-react';
import { verifyMarketItems } from '../shared/market.js';
import { createMarketIntelligence, money, offeringDisplayName } from '../shared/advisor.js';
import { createBusinessProfile } from '../shared/business.js';
import { AgentShowcase } from './Ecosystem.jsx';
import { formatRubles, getSolution, recommendSolution } from '../shared/solutions.js';
import { buildPilotBlueprint } from '../shared/pilot.js';
import AdvisorChat from './AdvisorChat.jsx';
import Onboarding from './Onboarding.jsx';
import EnterprisePanel from './EnterprisePanel.jsx';
import AuditContract from './AuditContract.jsx';
import { DIRECTOR_WINDOWS_DOWNLOAD, ENTERPRISE_WINDOWS_DOWNLOAD } from '../shared/release.js';

const ENTERPRISE = import.meta.env.MODE === 'enterprise';
const CATEGORY_LABELS = { revenue: 'Больше зарабатывать', cost: 'Меньше тратить', offering: 'Усилить предложение' };
const SWOT_LABELS = { strength: 'Сильные стороны', weakness: 'Точки внимания', opportunity: 'Возможности', threat: 'Риски' };
const WINDOWS_DOWNLOAD = ENTERPRISE ? ENTERPRISE_WINDOWS_DOWNLOAD : DIRECTOR_WINDOWS_DOWNLOAD;
const WORKSPACE_STEPS = [
  { id: 'audit', label: 'Аудит', icon: Home },
  { id: 'direction', label: 'Выбор', icon: Lightbulb },
  { id: 'plan', label: 'План', icon: ClipboardList },
  { id: 'pilot', label: 'Пилот', icon: Rocket },
  { id: 'documents', label: 'Документы', icon: FolderOpen },
];
const DEFAULT_PLAN = [
  'Зафиксировать исходную метрику.',
  'Собрать эталонный набор и правила остановки.',
  'Провести ограниченный пилот.',
  'Сравнить результат и принять решение.',
];

function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Дата не указана' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date); }
function accent(value) { const hash = [...String(value)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 0); return `hsl(${hash} 68% 42%)`; }
function EmptyState({ children }) { return <div className="drawer-empty"><ShieldCheck size={22} /><p>{children}</p></div>; }
function SourceButton({ item, onOpen, children }) { return <button className="source-button" onClick={() => onOpen(item)}>{children || item.sourceTitle || host(item.url)}<ExternalLink size={14} /></button>; }

function WorkspaceRail({ current, onChange, desktop }) {
  return <nav className="workspace-rail" aria-label="Разделы рабочего пространства">
    <button className="rail-brand" onClick={() => onChange('audit')} aria-label="Перейти к аудиту">Ai</button>
    <div className="rail-navigation">
      {WORKSPACE_STEPS.map(({ id, label, icon: Icon }) => <button
        key={id}
        className={current === id ? 'is-active' : ''}
        aria-current={current === id ? 'page' : undefined}
        onClick={() => onChange(id)}
      ><Icon size={20} strokeWidth={1.8} /><span>{label}</span></button>)}
    </div>
    <div className={`rail-trust ${desktop ? 'is-local' : 'is-web'}`}>
      {desktop ? <><ShieldCheck size={20} strokeWidth={1.8} /><strong>Локальная обработка</strong><span>Диалог и документы · на вашем ПК</span></> : <><Globe2 size={20} strokeWidth={1.8} /><strong>Веб-аудит</strong><span>Без локальной обработки</span></>}
    </div>
  </nav>;
}

function BackButton({ onClick, children }) {
  return <button className="workspace-back" onClick={onClick}><ArrowLeft size={17} strokeWidth={2} />{children}</button>;
}

function StepHeading({ kicker, title, subtitle, back }) {
  return <header className="workspace-heading enter-group">
    <div><span className="workspace-kicker">{kicker}</span><h1>{title}</h1><p>{subtitle}</p></div>
    {back}
  </header>;
}

function NewAuditDialog({ onClose, onSubmit, desktop, hasLocalDocuments }) {
  const [site, setSite] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const pendingRef = useRef(false);
  closeRef.current = onClose;
  pendingRef.current = pending;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape' && !pendingRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!site.trim() || pending) return;
    setPending(true); setError('');
    try { await onSubmit(site.trim()); }
    catch (reason) { setError(reason.message || 'Не удалось завершить текущий аудит. Данные не удалены.'); setPending(false); }
  }

  return <div className="new-audit-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <section ref={dialogRef} className="new-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="new-audit-title" aria-describedby="new-audit-warning new-audit-behavior">
      <div className="new-audit-heading"><div><span className="workspace-kicker">Новое исследование</span><h2 id="new-audit-title">Новый аудит компании</h2><p>Введите сайт — советник соберёт новую проверяемую базу.</p></div><button onClick={onClose} disabled={pending} aria-label="Закрыть диалог"><X size={21} /></button></div>
      <form onSubmit={submit}>
        <label htmlFor="new-audit-url">Сайт компании</label>
        <div className="new-audit-input"><Globe2 size={19} /><input ref={inputRef} id="new-audit-url" type="text" inputMode="url" autoComplete="url" placeholder="https://company.ru" value={site} onChange={event => setSite(event.target.value)} disabled={pending} required /></div>
        <div className="new-audit-warning" id="new-audit-warning" role="alert"><AlertTriangle size={21} /><strong>Текущие результаты, гипотезы и реестр документов в сессии удаляются безвозвратно; исходные файлы на диске остаются.</strong></div>
        <p className="new-audit-behavior" id="new-audit-behavior"><strong>Фактическое поведение:</strong> {desktop
          ? 'перед новым исследованием приложение очистит текущую локальную сессию. Удаление исходных файлов не выполняется.'
          : 'текущие результаты, гипотезы и реестр документов будут очищены в этой вкладке. Веб-версия не использует локальные файлы и ничего не удаляет с вашего устройства.'}</p>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="new-audit-actions"><button type="button" className="new-audit-cancel" onClick={onClose} disabled={pending}>Отмена</button><button type="submit" className="primary-action" disabled={!site.trim() || pending}>{pending ? 'Завершаю текущий аудит…' : 'Завершить текущий аудит'}<ArrowRight size={17} /></button></div>
      </form>
    </section>
  </div>;
}

export default function ResultDashboard({
  result, selected, onSelect, onOpen, onSave, saved, desktop, onStartNewAudit,
  onAddDocuments, onAddFolder, onForgetFolder, onAction, onCreateHypothesis, adding, folderBusy, error,
}) {
  const [drawer, setDrawer] = useState(null);
  const [hypothesisOpen, setHypothesisOpen] = useState(false);
  const [hypothesisBrief, setHypothesisBrief] = useState('');
  const [hypothesisConstraints, setHypothesisConstraints] = useState('');
  const [hypothesisBusy, setHypothesisBusy] = useState(false);
  const [hypothesisNotice, setHypothesisNotice] = useState('');
  const [advisorRequest, setAdvisorRequest] = useState(null);
  const [sourceScope, setSourceScope] = useState('own');
  const [workspaceStep, setWorkspaceStep] = useState('audit');
  const [documentsReturnStep, setDocumentsReturnStep] = useState('audit');
  const [activeOffering, setActiveOffering] = useState(null);
  const [showNewAudit, setShowNewAudit] = useState(false);
  const research = result.research;
  const sources = useMemo(() => research.sources.filter(source => source.text), [research]);
  const visibleSources = useMemo(() => sources.filter(source => (sourceScope === 'own') === ['company-site', 'local-document'].includes(source.kind)), [sources, sourceScope]);
  const offerings = useMemo(() => research.offerings?.length ? research.offerings : verifyMarketItems(sources.flatMap(source => source.offerings || []), sources), [research, sources]);
  const normalizedResearch = useMemo(() => ({ ...research, offerings }), [research, offerings]);
  const market = useMemo(() => createMarketIntelligence(normalizedResearch), [normalizedResearch]);
  const profile = useMemo(() => createBusinessProfile({ ...normalizedResearch, companyName: result.analysis.companyName || normalizedResearch.companyName }), [normalizedResearch, result.analysis.companyName]);
  const swot = result.analysis.swot || [];
  const companyName = result.analysis.companyName || research.companyName;
  const domain = host(research.requestedUrl);
  const primarySolution = getSolution(selected.solutionId) || recommendSolution(selected);
  const pilot = useMemo(() => buildPilotBlueprint(selected, primarySolution), [selected, primarySolution]);
  const primaryAgent = primarySolution?.fullName || 'Индивидуальная проработка';
  const opportunities = result.analysis.opportunities;
  const companyLogo = research.companyLogo || sources.find(source => source.logo)?.logo;
  const localDocuments = useMemo(() => sources.filter(source => source.kind === 'local-document'), [sources]);
  const latestNews = market.news[0];
  const ratedReview = market.reviews.find(item => item.rating || item.count);
  const threat = swot.find(item => item.category === 'threat');
  const planSteps = selected.steps?.length ? selected.steps : selected.workSteps?.length ? selected.workSteps.map(step => step.description) : DEFAULT_PLAN;

  useEffect(() => {
    if (!drawer) return undefined;
    const close = event => { if (event.key === 'Escape') setDrawer(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);

  function goToStep(step) {
    if (step === 'documents' && workspaceStep !== 'documents') setDocumentsReturnStep(workspaceStep);
    setDrawer(null);
    setWorkspaceStep(step);
  }

  async function handleAdvisorAction(action) {
    if (action.type !== 'navigate_step') {
      const outcome = await onAction(action);
      if (action.type === 'create_hypothesis' && outcome?.status === 'completed') goToStep('direction');
      return outcome;
    }
    goToStep(action.step);
    const label = WORKSPACE_STEPS.find(item => item.id === action.step)?.label || 'Исследование';
    return { status: 'completed', success: true, message: `Открыт раздел «${label}».` };
  }

  function openOffering(item) { setActiveOffering(item); setDrawer('offering'); }
  function openOfferings() { setActiveOffering(null); setDrawer('offerings'); }

  async function addHypothesis(generated = false) {
    const brief = generated
      ? 'Предложи новую проверяемую гипотезу на основе исследования и рамки ниже. Не повторяй уже существующие направления.'
      : hypothesisBrief.trim();
    if (!brief || hypothesisBusy) return;
    setHypothesisBusy(true); setHypothesisNotice('');
    try {
      const response = await onCreateHypothesis({ brief, constraints: hypothesisConstraints.trim() });
      setHypothesisBrief(''); setHypothesisOpen(false);
      setHypothesisNotice(`Гипотеза сохранена и выбрана: «${response.result?.analysis.opportunities.find(item => item.id === response.opportunityId)?.title || 'новое направление'}». Можно переходить к плану.`);
      setAdvisorRequest({ id: Date.now(), text: 'Объясни, как проверить новую выбранную гипотезу и какие данные нужны первыми.' });
    } catch (reason) { setHypothesisNotice(reason.message || 'Не удалось сохранить гипотезу.'); }
    finally { setHypothesisBusy(false); }
  }

  function discussSelfService() {
    setDrawer(null); goToStep('plan');
    setAdvisorRequest({ id: Date.now(), text: `Разбери самостоятельный план внедрения для «${selected.processName || selected.title}»: этапы, ориентировочные сроки, бюджет, владельцы и риски.` });
  }

  const drawerTitles = {
    company: 'Профиль компании и управленческое резюме',
    offering: activeOffering ? offeringDisplayName(activeOffering) : 'Карточка предложения',
    offerings: 'Товары и услуги с точными источниками', reviews: 'Отзывы, оценки и темы клиентского опыта',
    alternatives: 'Сопоставимые товары и услуги', competitors: 'Прямой конкурентный контур', news: 'Отраслевые сигналы и динамика', mentions: 'Независимые упоминания о компании',
    market: 'Рыночная картина и границы выводов', swot: 'SWOT по подтверждённым материалам', sources: 'Все материалы исследования',
    agents: 'Готовые ИИ-агенты BAIagent', plan: 'Процесс, приёмка и критерии результата', documents: 'Больше инсайтов из ваших данных',
    enterprise: 'Balanov.PRO · решение для enterprise и госсектора',
    connect: primarySolution ? 'Автономный агент для выбранного процесса' : 'Индивидуальное внедрение',
  };

  const advisorContext = workspaceStep === 'audit' ? <>
    <div className="advisor-context-card"><span className="workspace-kicker">Сводка исследования</span><p>Собраны сведения о компании «{companyName}». Проверьте предложения и откройте первоисточники — выводы основаны только на полученных материалах.</p></div>
    <div className="advisor-source-list" aria-label="Данные исследования">
      <button onClick={openOfferings}><Layers3 size={18} /><span>Сайт · {offerings.length} {offerings.length === 1 ? 'карточка' : 'карточек'}</span><ChevronRight size={16} /></button>
      <button onClick={() => setDrawer('reviews')}><MessageSquareText size={18} /><span>Отзывы · {market.reviews.length} {market.reviews.length === 1 ? 'источник' : 'источников'}</span><ChevronRight size={16} /></button>
      <button onClick={() => setDrawer('market')}><Globe2 size={18} /><span>Рынок · {market.competitors.length} конкурентов · {market.mentions.length} упоминаний</span><ChevronRight size={16} /></button>
    </div>
  </> : workspaceStep === 'direction' ? <div className="advisor-context-card"><span className="workspace-kicker">Выбранное направление</span><h3>{selected.processName || selected.title}</h3><p>{selected.processAction || selected.action}</p></div>
    : workspaceStep === 'plan' ? <div className="advisor-context-card"><span className="workspace-kicker">На выходе</span><h3>{selected.output || 'Проверяемый результат процесса'}</h3><p>{selected.processName || selected.title}. Автоматический запуск и публикация на этом экране не выполняются.</p></div>
      : workspaceStep === 'pilot' ? <div className="advisor-context-card"><span className="workspace-kicker">Решение о пилоте</span><h3>{pilot.target}</h3><p><strong>Стоп:</strong> {pilot.stopRule}</p></div>
        : <div className="advisor-context-card"><span className="workspace-kicker">Материалы исследования</span><h3>{localDocuments.length ? `${localDocuments.length} локальных документов` : 'Локальные документы не добавлены'}</h3><p>{desktop ? 'Доступ предоставляется только к выбранным материалам. Исходные документы не изменяются.' : 'В браузере доступен только экспресс-аудит открытых данных. Работа с локальными документами — в Windows.'}</p></div>;

  const advisorActions = workspaceStep === 'audit' ? <><button className="advisor-next" onClick={() => goToStep('direction')}>Перейти к гипотезам<ArrowRight size={18} /></button><p>Сначала выберите одно направление — ничего не запускается автоматически.</p></>
    : workspaceStep === 'direction' ? <><button className="advisor-next" onClick={() => goToStep('plan')}>Перейти к плану<ArrowRight size={18} /></button><button className="advisor-text-action" onClick={() => goToStep('audit')}>Вернуться к аудиту компании</button></>
      : workspaceStep === 'plan' ? <><button className="advisor-next" onClick={() => goToStep('pilot')}>Перейти к пилоту<ArrowRight size={18} /></button><button className="advisor-text-action" onClick={onSave}>{saved ? <Check size={16} /> : <Download size={16} />}{saved ? 'План сохранён' : 'Скачать план · Markdown'}</button></>
        : workspaceStep === 'pilot' ? <><button className="advisor-next" onClick={() => setDrawer(ENTERPRISE ? 'enterprise' : 'connect')}>Подключить 0 руб.<ArrowUpRight size={18} /></button><button className="advisor-text-action" onClick={() => onOpen('https://2aos.ru/')}>Маркетплейс ИИ-агентов 2AOS<ArrowUpRight size={15} /></button></>
          : <><button className="advisor-next" onClick={() => goToStep(documentsReturnStep)}>Вернуться к гипотезам<ArrowRight size={18} /></button><button className="advisor-text-action" onClick={() => goToStep('audit')}>Открыть аудит компании</button></>;

  return <div className={`workspace-shell ${workspaceStep === 'audit' ? 'is-audit' : 'has-rail'}`}>
    {workspaceStep !== 'audit' && <WorkspaceRail current={workspaceStep} onChange={goToStep} desktop={desktop} />}
    <div className="workspace-stage">
      <main className="workspace-window workspace-main result-view result-dashboard" data-analysis-mode={result.analysis.mode || 'evidence-rules'} style={{ '--company-accent': accent(companyName) }}>
        <div className="workspace-screen" key={workspaceStep}>
          {workspaceStep === 'audit' && <>
            <header className="audit-company-header enter-group">
              <div className="audit-company-identity">
                <div className="audit-company-logo">{companyLogo ? <img src={companyLogo} alt={`Логотип ${companyName}`} onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Building2 size={26} strokeWidth={1.7} />}</div>
                <div><div className="audit-company-name"><h1>{companyName}</h1><button className="new-audit-trigger" onClick={() => setShowNewAudit(true)} aria-label="Начать новый аудит компании" title="Новый аудит"><Plus size={18} strokeWidth={1.8} /></button></div><button className="domain-link" onClick={() => onOpen(research.requestedUrl)}>{domain}<ExternalLink size={14} /></button></div>
              </div>
              <button className="soft-action" onClick={() => setDrawer('company')}>Ещё о компании</button>
            </header>
            <p className="audit-company-description enter-item">{profile.industry?.label || 'Профиль компании уточняется'}{profile.segments.length ? ` · ${profile.segments.map(item => item.label).join(' · ')}` : ''}</p>
            {(research.warnings?.length || result.analysis.warning) && <div className="research-warning enter-item" role="status"><ShieldCheck size={18} /><div><strong>Покрытие источников ограничено</strong><span>{[...new Set([...(research.warnings || []), result.analysis.warning].filter(Boolean))].slice(0, 2).join(' ')} Результат основан только на полученных материалах.</span></div></div>}
            <div className="workspace-section-heading enter-item"><div><h2>Ваши товары и услуги</h2><p>{offerings.length ? `Показано ${Math.min(8, offerings.length)} из ${offerings.length} · данные карточек сайта` : 'Карточки в изученных материалах'}</p></div><button className="soft-action" onClick={openOfferings}>Все предложения<ChevronRight size={16} /></button></div>
            {offerings.length ? <div className="offerings-grid audit-offerings enter-cards">{offerings.slice(0, 8).map((item, index) => <button className="offering-card" key={`${item.name}-${item.price || 'no-price'}-${index}`} onClick={() => openOffering(item)}>
              <div className="offering-image">{item.image ? <img src={item.image} alt={offeringDisplayName(item)} loading="eager" onError={event => { event.currentTarget.parentElement.classList.add('is-empty'); event.currentTarget.remove(); }} /> : <Image size={22} strokeWidth={1.6} />}</div>
              <div className="offering-card-copy"><span className="offering-kind">{item.kind === 'service' ? 'Услуга' : 'Товар'}<ExternalLink size={13} /></span><strong>{offeringDisplayName(item)}</strong><span className={item.price ? 'offering-price' : 'offering-price is-unknown'}>{item.price || 'Условия по запросу'}</span></div>
            </button>)}</div> : <div className="offerings-empty enter-item"><Layers3 size={30} /><strong>Карточки предложений не распознаны</strong><p>Добавьте каталог в полной версии — советник разберёт его локально.</p><button onClick={() => goToStep('documents')}>Добавить материалы<ArrowRight size={16} /></button></div>}
            <div className="audit-footer-links enter-item"><button onClick={() => setDrawer('sources')}><FileSearch size={16} />{sources.length} источников</button><button onClick={() => setDrawer('competitors')}>Конкуренты · {market.competitors.length}</button><button onClick={() => setDrawer('reviews')}>Отзывы · {market.reviews.length} источников</button><button onClick={() => goToStep('documents')}><FolderOpen size={16} />{desktop ? 'Добавить документы' : 'Документы в Windows'}</button></div>
          </>}

          {workspaceStep === 'direction' && <>
            <StepHeading kicker="ШАГ 1 ИЗ 3 · ВЫБОР" title="Что хотите улучшить?" subtitle="Выберите одно направление. Каждая карточка связана с собранными доказательствами и собственным планом." back={<BackButton onClick={() => goToStep('audit')}>К аудиту</BackButton>} />
            <div className="direction-list enter-cards">{opportunities.map((item, index) => <button key={item.id} className={`direction-card ${item.id === selected.id ? 'is-selected' : ''}`} onClick={() => onSelect(item.id)} aria-pressed={item.id === selected.id}>
              <span className="direction-number">{String(item.priority?.rank || index + 1).padStart(2, '0')}</span>
              <span className="direction-copy"><span className="workspace-kicker">{CATEGORY_LABELS[item.category] || 'Возможность'}{item.priority?.label ? ` · ${item.priority.label}` : ''}</span><strong>{item.processName || item.title}</strong><span>{item.processAction || item.action}</span><small><Gauge size={15} />{item.businessMetric || item.metric}</small></span>
              <span className="direction-check">{item.id === selected.id ? <CheckCircle2 size={22} /> : <ChevronRight size={20} />}</span>
            </button>)}</div>
            <div className="hypothesis-actions enter-item"><button className="soft-action" onClick={() => { setHypothesisOpen(value => !value); setHypothesisNotice(''); }} disabled={hypothesisBusy}><Plus size={16} />Своя гипотеза</button><button className="soft-action" onClick={() => addHypothesis(true)} disabled={hypothesisBusy}><Sparkles size={16} />{hypothesisBusy ? 'Формирую…' : 'Предложить ещё'}</button></div>
            {hypothesisOpen && <form className="hypothesis-composer enter-item" onSubmit={event => { event.preventDefault(); addHypothesis(false); }}>
              <label htmlFor="own-hypothesis">Что хотите проверить?</label>
              <textarea id="own-hypothesis" value={hypothesisBrief} onChange={event => setHypothesisBrief(event.target.value)} maxLength={1600} placeholder="Например: предложить готовые наборы для корпоративных заказов" disabled={hypothesisBusy} required />
              <label htmlFor="hypothesis-constraints">Ваши рамки <span>необязательно</span></label>
              <textarea id="hypothesis-constraints" value={hypothesisConstraints} onChange={event => setHypothesisConstraints(event.target.value)} maxLength={2000} placeholder="Бюджет, сроки, ресурсы, юридические или технические ограничения" disabled={hypothesisBusy} />
              <p>Советник оформит это как проверяемую идею, а не как подтверждённый факт. Новое направление сохранится в текущем исследовании.</p>
              <button className="primary-action" type="submit" disabled={!hypothesisBrief.trim() || hypothesisBusy}>{hypothesisBusy ? 'Оформляю гипотезу…' : 'Добавить в направления'}<ArrowRight size={16} /></button>
            </form>}
            {hypothesisNotice && <p className="hypothesis-notice" role="status">{hypothesisNotice}</p>}
            <div className="workspace-summary enter-item"><TrendingUp size={20} /><div><span className="workspace-kicker">{selected.origin === 'user' ? 'Ваша гипотеза · требует проверки' : 'Выбрано для плана'}</span><strong>{selected.processName || selected.title}</strong><p>{selected.why}</p></div></div>
          </>}

          {workspaceStep === 'plan' && <>
            <StepHeading kicker="ШАГ 2 ИЗ 3 · ПЛАН" title="Что именно проверим" subtitle={selected.processName || selected.title} back={<BackButton onClick={() => goToStep('direction')}>Назад</BackButton>} />
            <ol className="plan-step-list enter-cards">{planSteps.map((step, index) => <li key={`${index}-${step}`}><span className="direction-number">{String(index + 1).padStart(2, '0')}</span><div><span className="workspace-kicker">Шаг {index + 1} · {index === 0 ? 'Подготовка' : index === planSteps.length - 1 ? 'Решение' : 'Проверка'}</span><strong>{step}</strong>{selected.workSteps?.[index]?.name && <p>{selected.workSteps[index].name}</p>}</div></li>)}</ol>
            <div className="workspace-summary enter-item"><ClipboardList size={20} /><div><span className="workspace-kicker">На выходе</span><strong>{selected.output || 'Проверяемый результат процесса'}</strong><p>{selected.processAction || selected.action}</p></div></div>
            <div className="workspace-inline-actions enter-item"><button className="soft-action" onClick={() => setDrawer('plan')}>План и доказательства<ArrowRight size={16} /></button><button className="soft-action" onClick={onSave}>{saved ? <Check size={16} /> : <Download size={16} />}{saved ? 'План сохранён' : 'Скачать план · Markdown'}</button></div>
          </>}

          {workspaceStep === 'pilot' && <>
            <StepHeading kicker="ШАГ 3 ИЗ 3 · ПИЛОТ" title="Проверим пользу на практике" subtitle="Сначала измерим текущий процесс, затем сравним с ограниченным пилотом." back={<BackButton onClick={() => goToStep('plan')}>Назад</BackButton>} />
            <div className="pilot-card-list enter-cards">
              <article><Gauge size={21} /><div><span className="workspace-kicker">Метрика успеха</span><h2>{selected.businessMetric || selected.metric}</h2><p><strong>Исходный замер:</strong> {pilot.baseline}</p><p><strong>Цель:</strong> {pilot.target}</p></div></article>
              <article><ClipboardList size={21} /><div><span className="workspace-kicker">Сроки и владелец</span><h2>{pilot.period}</h2><p>{pilot.owner}</p><p>{pilot.humanControl}</p></div></article>
              <article className="is-selected"><Sparkles size={21} /><div><span className="workspace-kicker">{ENTERPRISE ? 'Enterprise-решение Balanov.PRO' : 'Решение BAIagent'}</span><h2>{ENTERPRISE ? 'Аудит → архитектура → команда → измеримый пилот' : primaryAgent}</h2>{ENTERPRISE ? <p>Заявка и первичный аудит — 0 ₽. Дальнейшие работы — по согласованному объёму.</p> : primarySolution ? <p>{formatRubles(primarySolution.monthly)}/мес · установка {formatRubles(primarySolution.setup)} · запуск {primarySolution.launchDays} дн.</p> : <p>Сначала уточним границы задачи, стоимость и сроки.</p>}</div></article>
            </div>
            <div className="workspace-summary enter-item"><ShieldCheck size={20} /><div><span className="workspace-kicker">Можно остановить пилот</span><strong>{pilot.stopRule}</strong><p><strong>Масштабировать:</strong> {pilot.scaleRule}</p></div></div>
            <div className="workspace-inline-actions enter-item"><button className="soft-action" onClick={() => setDrawer('plan')}>Приёмка{selected.acceptance?.cases?.length ? ` · ${selected.acceptance.cases.length} сценариев` : ''}<ArrowRight size={16} /></button><button className="soft-action" onClick={() => setDrawer('agents')}>Решения экосистемы<ArrowRight size={16} /></button>{!ENTERPRISE && <button className="soft-action" onClick={() => setDrawer('enterprise')}>Внедрение Balanov.PRO<ArrowRight size={16} /></button>}</div>
          </>}

          {workspaceStep === 'documents' && <>
            <StepHeading kicker="ДОКУМЕНТЫ · ТОЛЬКО С ВАШЕГО РАЗРЕШЕНИЯ" title="Материалы компании" subtitle="Файлы и папки дополняют исследование. Источник каждого добавленного документа остаётся видимым." back={<BackButton onClick={() => goToStep(documentsReturnStep)}>Назад</BackButton>} />
            <div className="document-actions enter-cards">
              {desktop ? <><button onClick={onAddFolder} disabled={folderBusy || adding}><FolderOpen size={22} /><span><strong>{folderBusy ? 'Проверяю папку…' : 'Выбрать рабочую папку'}</strong><small>Только чтение выбранной папки</small></span><ChevronRight size={18} /></button><button onClick={onAddDocuments} disabled={adding || folderBusy}><FilePlus2 size={22} /><span><strong>{adding ? 'Изучаю документы…' : 'Выбрать отдельные документы'}</strong><small>TXT, MD, CSV, JSON, PDF и DOCX</small></span><ChevronRight size={18} /></button></> : <a href={WINDOWS_DOWNLOAD} download><Monitor size={22} /><span><strong>Скачать полную версию для Windows</strong><small>Локальные документы и свободный диалог</small></span><Download size={18} /></a>}
            </div>
            <div className="workspace-inline-actions enter-item"><button className="soft-action" onClick={() => setDrawer('documents')}>О данных и доступе<ArrowRight size={16} /></button></div>
            <section className="document-registry enter-item"><div className="workspace-section-heading"><div><h2>Добавленные документы</h2><p>{localDocuments.length ? `${localDocuments.length} в текущем исследовании` : 'Пока не добавлены'}</p></div>{localDocuments.length > 0 && desktop && <button className="soft-action danger-soft" onClick={onForgetFolder} disabled={folderBusy || adding}><Trash2 size={16} />Исключить из анализа</button>}</div>
              {localDocuments.length ? <div className="document-list">{localDocuments.map(source => <article key={source.id}><FileText size={20} /><div><strong>{source.title || source.url.replace('local://', '')}</strong><p>Локальный документ · добавлен в текущий анализ{source.retrievedAt ? ` · ${dateLabel(source.retrievedAt)}` : ''}</p></div><ShieldCheck size={18} /></article>)}</div> : <div className="document-empty"><FileText size={26} /><p>Добавьте каталог, прайс, регламенты или обращения. Здесь появятся только фактически прочитанные документы — без выдуманных версий и истории изменений.</p></div>}
            </section>
            <div className={`documents-privacy enter-item ${desktop ? 'is-local' : 'is-web'}`}><ShieldCheck size={19} /><p>{desktop ? 'Документы обрабатываются локально и не отправляются в облачную модель. Для свежего внешнего рынка нужен интернет.' : 'Веб-версия не обрабатывает ваши локальные документы. Для локальной работы скачайте Windows-версию.'}</p></div>
          </>}
          {error && <div className="inline-error workspace-error" role="alert">{error}</div>}
        </div>
      </main>

      <AdvisorChat
        research={normalizedResearch}
        analysis={result.analysis}
        opportunity={selected}
        onOpen={onOpen}
        desktop={desktop}
        step={workspaceStep}
        context={advisorContext}
        actions={advisorActions}
        onAction={handleAdvisorAction}
        requestedQuestion={advisorRequest}
      />
    </div>

    <footer className="workspace-signature">BAIagent · Баланов Антон Николаевич</footer>

    {drawer && <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDrawer(null); }}>
      <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-label={drawerTitles[drawer]}>
        <div className="drawer-header"><div><span className="section-kicker">{ENTERPRISE ? 'Balanov.PRO · ИИ-советник' : 'BAIagent · ИИ-советник для бизнеса'}</span><h2>{drawerTitles[drawer]}</h2></div><button autoFocus onClick={() => setDrawer(null)} aria-label="Закрыть"><X size={21} /></button></div>
        <div className="drawer-body">
          {drawer === 'company' && <section className="drawer-plan"><span className="drawer-tag">Данные из источников</span><h3>{companyName}</h3><p>{result.analysis.summary}</p><div className="company-drawer-facts"><article><span>Чем занимается</span><strong>{profile.industry?.label || 'Нужны дополнительные материалы'}</strong></article><article><span>Для кого</span><strong>{profile.segments.length ? profile.segments.map(item => item.label).join(' · ') : 'Сегменты пока не подтверждены'}</strong></article><article><span>Что собрано</span><strong>{offerings.length} предложений · {market.reviews.length} источников отзывов · {market.competitors.length} конкурентов · {market.mentions.length} упоминаний</strong></article></div><SourceButton item={{ url: research.requestedUrl, sourceTitle: domain }} onOpen={onOpen}>Открыть сайт компании</SourceButton></section>}

          {drawer === 'offering' && activeOffering && <section className="drawer-plan"><span className="drawer-tag">{activeOffering.kind === 'service' ? 'Услуга' : 'Товар'} · карточка из источника</span>{activeOffering.image && <img className="drawer-product-image offering-detail-image" src={activeOffering.image} alt={offeringDisplayName(activeOffering)} />}<h3>{offeringDisplayName(activeOffering)}</h3><p className="offering-detail-price">{activeOffering.price || 'Условия по запросу'}</p>{activeOffering.quote && <blockquote>«{activeOffering.quote}»</blockquote>}<SourceButton item={activeOffering} onOpen={onOpen}>Открыть оригинальную карточку</SourceButton></section>}

          {drawer === 'offerings' && (offerings.length ? <div className="drawer-offerings">{offerings.map((item, index) => <article key={`${item.name}-${index}`}><div><span>{item.kind === 'service' ? 'Услуга' : 'Товар'}</span><strong>{item.price || 'Условия по запросу'}</strong></div><h3>{offeringDisplayName(item)}</h3>{item.image && <img className="drawer-product-image" src={item.image} alt={offeringDisplayName(item)} loading="lazy" />}<blockquote>«{item.quote}»</blockquote><SourceButton item={item} onOpen={onOpen} /></article>)}</div> : <EmptyState>В изученных страницах не найдено конкретных карточек. Добавьте каталог или прайс компании.</EmptyState>)}

          {drawer === 'competitors' && (market.competitors.length ? <><div className="drawer-context-note"><ShieldCheck size={16} /> Прямые внешние сайты из того же продуктового поискового поля. Это конкурентный контур, а не утверждение о равной доле рынка.</div><div className="drawer-sources">{market.competitors.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">Конкурентный кандидат · {host(item.url)}</span><h3>{item.name}</h3><p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>Открыть сайт конкурента</SourceButton></article>)}</div></> : <EmptyState>Прямые сайты конкурентов не подтверждены в этом запуске. Это ограничение поиска, а не отсутствие конкуренции.</EmptyState>)}

          {drawer === 'news' && (market.news.length ? <><div className="drawer-context-note"><Newspaper size={16} /> Публикации за последние 18 месяцев. Они показывают информационный фон, а не количественный индекс рынка.</div><div className="drawer-sources">{market.news.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">{dateLabel(item.publishedAt)}</span><h3>{item.title}</h3><p>{item.quote}</p><SourceButton item={item} onOpen={onOpen}>Открыть публикацию</SourceButton></article>)}</div></> : <EmptyState>Свежих релевантных отраслевых публикаций не найдено. Мы не подставляем старые или unrelated новости ради заполнения блока.</EmptyState>)}

          {drawer === 'reviews' && (market.reviews.length ? <div className="drawer-sources">{market.reviews.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">{item.rating ? `Оценка ${item.rating}` : 'Клиентский опыт'}{item.count ? ` · ${item.count} отзывов` : ''}</span><h3>{item.sourceTitle}</h3>{!!item.themes.length && <div className="review-themes">{item.themes.map(theme => <span key={theme}>{theme}</span>)}</div>}<p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>{host(item.url)}</SourceButton></article>)}</div> : <EmptyState>Подтверждённых отзывов в этом запуске нет. Это ограничение исследования, а не вывод о репутации.</EmptyState>)}

          {drawer === 'mentions' && (market.mentions.length ? <><div className="drawer-context-note"><ShieldCheck size={16} /> Независимые материалы именно о компании: профиль, клиенты, партнёрства и другие упоминания. Полноту текста и дату обращения видно у каждого источника.</div><div className="drawer-sources">{market.mentions.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">{item.contentOrigin === 'full-page' ? 'Прочитана полная страница' : 'Поисковый фрагмент'} · {host(item.url)}</span><h3>{item.sourceTitle}</h3><p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>Открыть упоминание</SourceButton></article>)}</div></> : <EmptyState>Независимых упоминаний именно о компании в этом запуске не найдено. Это ограничение поискового корпуса, а не доказательство отсутствия цифрового следа.</EmptyState>)}

          {drawer === 'market' && <section className="market-analysis"><div className="market-observations">{market.observations.map(item => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div><div className="market-quick-links"><button onClick={() => setDrawer('competitors')}>Конкуренты · {market.competitors.length}</button><button onClick={() => setDrawer('news')}>Новости · {market.news.length}</button><button onClick={() => setDrawer('mentions')}>Упоминания · {market.mentions.length}</button><button onClick={() => setDrawer('alternatives')}>Альтернативы · {market.alternatives.length}</button><button onClick={() => setDrawer('swot')}>SWOT · {swot.length}</button></div>{latestNews && <p className="market-latest">Последний сигнал: {latestNews.title}</p>}{ratedReview && <p className="market-latest">Отзывы: {ratedReview.rating ? `оценка ${ratedReview.rating}` : 'есть оценки'}{ratedReview.count ? ` · ${ratedReview.count} отзывов` : ''}</p>}{threat && <p className="market-latest">Точка внимания: {threat.title}</p>}{!!market.priceComparisons.length ? <div className="price-comparisons"><h3>Только сопоставимые предложения</h3>{market.priceComparisons.map(item => <article key={item.name}><strong>{item.name}</strong><span>Компания: {item.own.price}</span><span>Внешнее предложение: {item.alternative.price}</span><SourceButton item={item.alternative} onOpen={onOpen}>Проверить альтернативу</SourceButton></article>)}</div> : <div className="drawer-context-note"><ShieldCheck size={16} /> Диапазон собственных карточек: {market.ownPriceRange ? `${money(market.ownPriceRange.min)} — ${money(market.ownPriceRange.max)}` : 'нет подтверждённых цен'}. Без сопоставимых пар рыночный диапазон не рассчитываем.</div>}<div className="market-gaps"><h3>Границы управленческого вывода</h3>{market.gaps.map(item => <p key={item}><ShieldCheck size={15} />{item}</p>)}</div>{profile.risks.length > 0 && <div className="external-risks"><h3>Внешние сигналы для проверки</h3>{profile.risks.map(item => <article key={`${item.sourceId}-${item.quote}`}><p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>{item.sourceTitle}</SourceButton></article>)}</div>}</section>}

          {drawer === 'alternatives' && (market.alternatives.length ? <div className="drawer-offerings">{market.alternatives.map((item, index) => <article key={`${item.sourceId}-${index}`}><div><span>Альтернатива{item.offeringName ? `: ${item.offeringName}` : ''}</span><strong>{item.price || 'Цена не указана'}</strong></div><h3>{offeringDisplayName(item)}</h3><blockquote>«{item.quote}»</blockquote><SourceButton item={item} onOpen={onOpen}>{host(item.url)}</SourceButton></article>)}</div> : <EmptyState>Сопоставимых предложений с подтверждающим фрагментом не найдено. Прямой конкурентный контур доступен в отдельном разделе.</EmptyState>)}

          {drawer === 'swot' && <div className="swot-grid">{Object.entries(SWOT_LABELS).map(([category, title]) => { const matches = swot.filter(item => item.category === category); return <article className={`swot-card swot-${category}`} key={category}><span>{title}</span>{matches.length ? matches.map(item => <button key={item.title} onClick={() => item.evidence?.[0] && onOpen(item.evidence[0])}><strong>{item.title}</strong><em>{item.evidence[0].sourceTitle}<ExternalLink size={12} /></em></button>) : <p>Недостаточно подтверждённых данных для отдельного пункта.</p>}</article>; })}</div>}

          {drawer === 'sources' && <>
            <div className="source-scope-tabs" role="tablist" aria-label="Тип материалов"><button role="tab" aria-selected={sourceScope === 'own'} className={sourceScope === 'own' ? 'is-selected' : ''} onClick={() => setSourceScope('own')}>Мои материалы · {sources.filter(source => ['company-site', 'local-document'].includes(source.kind)).length}</button><button role="tab" aria-selected={sourceScope === 'web'} className={sourceScope === 'web' ? 'is-selected' : ''} onClick={() => setSourceScope('web')}>Веб · {sources.filter(source => !['company-site', 'local-document'].includes(source.kind)).length}</button></div>
            <div className="drawer-sources">{visibleSources.map(source => <article key={source.id}><span className="drawer-tag">{source.kind === 'local-document' ? 'Документ на устройстве' : source.kind === 'company-site' ? 'Сайт компании' : source.kind === 'competitor-candidate' ? 'Сайт конкурента' : source.kind === 'news-snippet' ? 'Отраслевые новости' : 'Открытый внешний источник'}{!source.url.startsWith('local://') && ` · ${source.contentOrigin === 'full-page' ? 'Прочитана полная страница' : source.contentOrigin === 'search-snippet' ? 'Поисковый фрагмент' : 'Содержимое страницы'} · Обращение ${dateLabel(source.retrievedAt)}`}</span><h3>{source.title}</h3><p>{source.url}</p>{!source.url.startsWith('local://') && <SourceButton item={source} onOpen={onOpen}>Открыть источник</SourceButton>}</article>)}</div>
          </>}

          {drawer === 'plan' && <section className="drawer-plan"><span className="drawer-tag">Проверяемое решение, не обещание результата</span><h3>{selected.title}</h3><h4>Почему это важно именно здесь</h4><p>{selected.why}</p><h4>Что делаем</h4><p>{selected.action}</p><AuditContract opportunity={selected} /><h4>План реализации</h4><ol className="implementation-steps">{planSteps.map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span>{item}</li>)}</ol><h4>Метрика</h4><p>{selected.metric}</p><section className="pilot-blueprint"><div className="pilot-heading"><Gauge size={16} /><strong>Рамка измеримого пилота</strong></div><dl><div><dt>Исходная метрика</dt><dd>{pilot.baseline}</dd></div><div><dt>Цель</dt><dd>{pilot.target}</dd></div><div><dt>Контрольный период</dt><dd>{pilot.period}</dd></div><div><dt>Данные</dt><dd>{pilot.data}</dd></div><div><dt>Подключения</dt><dd>{pilot.integrations}</dd></div><div><dt>Владелец</dt><dd>{pilot.owner}</dd></div><div><dt>Человеческий контроль</dt><dd>{pilot.humanControl}</dd></div><div><dt>Как считаем эффект</dt><dd>{pilot.effectFormula}</dd></div></dl><div className="pilot-decisions"><p><strong>Остановить</strong>{pilot.stopRule}</p><p><strong>Масштабировать</strong>{pilot.scaleRule}</p></div></section><h4>Основания</h4>{selected.evidence.map(item => <div className="plan-evidence" key={`${item.sourceId}-${item.quote}`}><blockquote>«{item.quote}»</blockquote><SourceButton item={item} onOpen={onOpen}>Открыть основание</SourceButton></div>)}{selected.unknowns.length > 0 && <div className="unknowns"><strong>Что нужно уточнить</strong>{selected.unknowns.map(item => <span key={item}>{item}</span>)}</div>}<button className="primary-action" onClick={onSave}><Download size={16} />{saved ? 'План сохранён' : 'Скачать план пилота · Markdown'}</button></section>}

          {drawer === 'documents' && <section className="drawer-plan"><span className="drawer-tag">{desktop ? 'Локально и только с вашего разрешения' : 'Полная работа с документами — в Windows'}</span><h3>Внутренние данные превращают обзор в экономический разбор</h3><p>Добавьте каталог, прайс, обращения, регламенты и отчёты. Советник свяжет рынок с маржой, реальным процессом и измеримым эффектом.</p>{desktop ? <><button className="documents-action folder-action" onClick={onAddFolder} disabled={folderBusy || adding}><FolderOpen size={18} />{folderBusy ? 'Проверяю папку…' : 'Выбрать рабочую папку'}<ChevronRight size={17} /></button><button className="documents-action" onClick={onAddDocuments} disabled={adding || folderBusy}><FilePlus2 size={18} />{adding ? 'Изучаю документы…' : 'Выбрать отдельные документы'}<ChevronRight size={17} /></button></> : <a className="documents-action" href={WINDOWS_DOWNLOAD} download><Monitor size={18} />Скачать полную версию для Windows<Download size={17} /></a>}<div className="folder-safety"><ShieldCheck size={15} /> {desktop ? 'Только выбранные материалы. Документы обрабатываются локально и не отправляются в облачную модель. Для свежего внешнего рынка нужен интернет.' : 'Браузерная версия не заявляет локальную обработку. Документы на устройстве доступны только в Windows-версии.'}</div></section>}

          {drawer === 'connect' && <Onboarding companyName={companyName} website={research.requestedUrl} opportunity={selected} solution={primarySolution} onOpen={onOpen} onDiscussSelfService={ENTERPRISE ? undefined : discussSelfService} />}
          {drawer === 'enterprise' && <EnterprisePanel research={normalizedResearch} profile={profile} opportunity={selected} solution={primarySolution} companyName={companyName} website={research.requestedUrl} onOpen={onOpen} />}
          {drawer === 'agents' && <AgentShowcase opportunity={selected} companyName={companyName} website={research.requestedUrl} onOpen={onOpen} />}
        </div>
      </aside>
    </div>}

    {showNewAudit && <NewAuditDialog onClose={() => setShowNewAudit(false)} onSubmit={onStartNewAudit} desktop={desktop} hasLocalDocuments={localDocuments.length > 0} />}
  </div>;
}
