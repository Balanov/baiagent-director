import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check, CheckCircle2, ChevronRight, ClipboardList, Download, ExternalLink, FilePlus2, FileSearch, FileText, FolderOpen, Gauge, Globe2, Home, Image, Layers3, Lightbulb, LoaderCircle, MessageSquareText, Monitor, Plus, Rocket, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { offeringDisplayName } from '../shared/advisor.js';
import { buildPilotBlueprint } from '../shared/pilot.js';
import { answerInternationalAdvisor } from '../shared/advisor-prompts.js';
import { DIRECTOR_WINDOWS_DOWNLOAD } from '../shared/release.js';
import { useLocale } from './locale.jsx';

const STEPS = [['audit', Home], ['direction', Lightbulb], ['plan', ClipboardList], ['pilot', Rocket], ['documents', FolderOpen]];
const CATEGORIES = { revenue: 'direction.revenue', cost: 'direction.cost', offering: 'direction.offering' };
const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

function SourceLink({ item, onOpen, children }) {
  return <button className="source-button" onClick={() => onOpen(item)}>{children || item.sourceTitle || host(item.url)}<ExternalLink size={14} /></button>;
}

function Empty({ children }) { return <div className="drawer-empty"><ShieldCheck size={22} /><p>{children}</p></div>; }

function Advisor({ result, selected, step, desktop, onStep, onSave, saved }) {
  const { t } = useLocale();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMessages([]); }, [result.research.requestedUrl]);
  async function submit(event, suggestion) {
    event?.preventDefault();
    const question = String(suggestion || input).trim();
    if (!question || busy) return;
    setInput(''); setBusy(true);
    const history = messages.slice(-8);
    setMessages(items => [...items, { role: 'user', text: question }]);
    try {
      const response = desktop
        ? await window.director.advisor({ question, history, opportunityId: selected.id })
        : answerInternationalAdvisor({ question, research: result.research, analysis: result.analysis, opportunity: selected });
      setMessages(items => [...items, { role: 'advisor', text: response.answer, citations: response.citations || [] }]);
    } catch (error) {
      setMessages(items => [...items, { role: 'advisor', text: t('chat.localError', { message: error.message }), citations: [] }]);
    } finally { setBusy(false); }
  }
  const suggestions = [1, 2, 3].map(number => t(`${desktop ? 'chat' : 'chat.web'}Suggestion${number}`));
  const next = step === 'audit' ? 'direction' : step === 'direction' ? 'plan' : step === 'plan' ? 'pilot' : 'audit';
  return <aside className="advisor-panel international-advisor">
    <div className="advisor-header"><div><span className="workspace-kicker">{t('chat.title')}</span><h2>{step === 'audit' ? t('chat.step.audit') : step === 'direction' ? t('chat.step.direction') : step === 'plan' ? t('chat.step.plan') : step === 'pilot' ? t('chat.step.pilot') : t('chat.step.documents')}</h2></div><Sparkles size={22} /></div>
    <div className="advisor-context-card"><span className="workspace-kicker">{t('chat.research')}</span><h3>{step === 'audit' ? result.research.companyName : selected.title}</h3><p>{step === 'audit' ? result.analysis.summary : selected.action}</p></div>
    <div className="advisor-source-list">
      <span><FileSearch size={15} />{t('common.sources', { count: result.research.sources.length })}</span>
      <span><Globe2 size={15} />{t('common.competitors', { count: result.research.competitors?.length || 0 })}</span>
      <span><MessageSquareText size={15} />{t('common.reviews', { count: result.research.reviews?.length || 0 })}</span>
    </div>
    <div className="advisor-messages" aria-live="polite">
      {!messages.length && <div className="advisor-suggestions">{suggestions.map(text => <button key={text} onClick={() => submit(null, text)}>{text}<ChevronRight size={15} /></button>)}</div>}
      {messages.map((message, index) => <article className={`advisor-message is-${message.role}`} key={index}><small>{message.role === 'user' ? t('chat.you') : t(desktop ? 'chat.localMode' : 'chat.navigator')}</small><p>{message.text}</p>{message.citations?.map((item, citation) => <blockquote key={citation}>“{item.quote}”<a href={item.url} target="_blank" rel="noreferrer">{item.sourceTitle || host(item.url)}<ExternalLink size={12} /></a></blockquote>)}</article>)}
      {busy && <div className="advisor-thinking"><LoaderCircle className="spin" size={17} />{t('chat.thinking')}</div>}
    </div>
    <form className="advisor-input" onSubmit={submit}><textarea value={input} onChange={event => setInput(event.target.value)} placeholder={t('chat.placeholder')} rows={2} maxLength={1200} /><button type="submit" disabled={!input.trim() || busy} aria-label={t('chat.send')}><Send size={18} /></button></form>
    <small className="advisor-boundary">{t(desktop ? 'chat.boundaryLocal' : 'chat.boundaryWeb')}</small>
    <div className="advisor-actions">
      {step !== 'pilot' && step !== 'documents' && <button className="advisor-next" onClick={() => onStep(next)}>{t(next === 'direction' ? 'direction.to' : next === 'plan' ? 'direction.toPlan' : 'plan.toPilot')}<ArrowRight size={18} /></button>}
      {step === 'plan' && <button className="advisor-text-action" onClick={onSave}>{saved ? <Check size={16} /> : <Download size={16} />}{t(saved ? 'common.savedPlan' : 'common.downloadPlan')}</button>}
      {step === 'pilot' && <><a className="advisor-next" href="https://2aos.ru/" target="_blank" rel="noreferrer">{t('pilot.connect')}<ArrowUpRight size={18} /></a><a className="advisor-text-action" href="https://2aos.ru/" target="_blank" rel="noreferrer">{t('pilot.marketplace')}<ArrowUpRight size={15} /></a></>}
      {step === 'documents' && <button className="advisor-next" onClick={() => onStep('audit')}>{t('nav.toAudit')}<ArrowRight size={18} /></button>}
    </div>
  </aside>;
}

export default function InternationalDashboard({ result, selected, onSelect, onOpen, onSave, saved, desktop, onStartNewAudit, onAddDocuments, onAddFolder, onForgetFolder, onCreateHypothesis, adding, folderBusy, error }) {
  const { t, locale } = useLocale();
  const [step, setStep] = useState('audit');
  const [drawer, setDrawer] = useState(null);
  const [activeOffering, setActiveOffering] = useState(null);
  const [showNewAudit, setShowNewAudit] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [hypothesisOpen, setHypothesisOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [constraints, setConstraints] = useState('');
  const [busy, setBusy] = useState(false);
  const research = result.research;
  const sources = useMemo(() => research.sources.filter(source => source.text), [research]);
  const offerings = research.offerings || sources.flatMap(source => source.offerings || []);
  const market = result.analysis.market || { competitors: research.competitors || [], reviews: research.reviews || [], news: research.news || [], mentions: [], alternatives: research.alternatives || [], observations: [], gaps: [] };
  const profile = result.analysis.profile || {};
  const pilot = useMemo(() => buildPilotBlueprint(selected), [selected]);
  const companyName = result.analysis.companyName || research.companyName;
  const logo = research.companyLogo || sources.find(source => source.logo)?.logo;
  const localDocuments = sources.filter(source => source.kind === 'local-document');
  const planSteps = selected.steps?.length ? selected.steps : selected.workSteps?.map(item => item.description) || [];
  const swot = result.analysis.swot || [];
  const news = market.news || research.news || [];
  const mentions = market.mentions || [];
  const drawerTitles = { company: 'drawer.company', offerings: 'drawer.offerings', offering: 'drawer.offering', reviews: 'drawer.reviews', competitors: 'drawer.competitors', news: 'drawer.news', mentions: 'drawer.mentions', market: 'drawer.market', swot: 'drawer.swot', sources: 'drawer.sources', plan: 'drawer.plan', documents: 'drawer.documents' };
  const openOfferings = () => { setActiveOffering(null); setDrawer('offerings'); };
  const showDrawer = value => { setActiveOffering(null); setDrawer(value); };
  async function createHypothesis(event) {
    event.preventDefault(); if (!brief.trim() || busy) return;
    setBusy(true);
    try { await onCreateHypothesis({ brief, constraints }); setBrief(''); setConstraints(''); setHypothesisOpen(false); }
    finally { setBusy(false); }
  }
  async function newAudit(event) {
    event.preventDefault(); if (!newUrl.trim()) return;
    setBusy(true);
    try { await onStartNewAudit(newUrl); setShowNewAudit(false); } finally { setBusy(false); }
  }
  return <div className={`workspace-shell ${step === 'audit' ? 'is-audit' : 'has-rail'}`}>
    {step !== 'audit' && <nav className="workspace-rail" aria-label={t('nav.workspace')}><button className="rail-brand" onClick={() => setStep('audit')}>Ai</button><div className="rail-navigation">{STEPS.map(([id, Icon]) => <button key={id} className={step === id ? 'is-active' : ''} onClick={() => setStep(id)}><Icon size={20} /><span>{t(`nav.${id}`)}</span></button>)}</div><div className={`rail-trust ${desktop ? 'is-local' : 'is-web'}`}><ShieldCheck size={20} /><strong>{t(desktop ? 'nav.local' : 'nav.web')}</strong><span>{t(desktop ? 'nav.localDetail' : 'nav.webDetail')}</span></div></nav>}
    <div className="workspace-stage">
      <main className="workspace-window workspace-main result-view result-dashboard">
        <div className="workspace-screen" key={step}>
          {step === 'audit' && <>
            <header className="audit-company-header enter-group"><div className="audit-company-identity"><div className="audit-company-logo">{logo ? <img src={logo} alt={companyName} onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Building2 size={26} />}</div><div><div className="audit-company-name"><h1>{companyName}</h1><button className="new-audit-trigger" onClick={() => setShowNewAudit(true)} aria-label={t('audit.new')}><Plus size={18} /></button></div><button className="domain-link" onClick={() => onOpen(research.requestedUrl)}>{host(research.requestedUrl)}<ExternalLink size={14} /></button></div></div><button className="soft-action" onClick={() => showDrawer('company')}>{t('audit.moreCompany')}</button></header>
            <p className="audit-company-description">{profile.industry?.label || research.marketContext?.subject || t('audit.profilePending')}{profile.segments?.length ? ` · ${profile.segments.map(item => item.label).join(' · ')}` : ''}</p>
            {(research.warnings?.length || result.analysis.warning) && <div className="research-warning" role="status"><ShieldCheck size={18} /><div><strong>{t('audit.limited')}</strong><span>{t('audit.limitedDetail')}</span></div></div>}
            <div className="workspace-section-heading"><div><h2>{t('audit.offerings')}</h2><p>{offerings.length ? t('audit.offeringsFound', { shown: Math.min(8, offerings.length), total: offerings.length }) : t('audit.offeringsEmpty')}</p></div><button className="soft-action" onClick={openOfferings}>{t('audit.allOfferings')}<ChevronRight size={16} /></button></div>
            {offerings.length ? <div className="offerings-grid audit-offerings enter-cards">{offerings.slice(0, 8).map((item, index) => <button className="offering-card" key={`${item.name}-${index}`} onClick={() => { setActiveOffering(item); setDrawer('offering'); }}><div className="offering-image">{item.image ? <img src={item.image} alt={offeringDisplayName(item)} onError={event => { event.currentTarget.parentElement.classList.add('is-empty'); event.currentTarget.remove(); }} /> : <Image size={22} />}</div><div className="offering-card-copy"><span className="offering-kind">{t(item.kind === 'service' ? 'common.service' : 'common.product')}<ExternalLink size={13} /></span><strong>{offeringDisplayName(item)}</strong><span className={item.price ? 'offering-price' : 'offering-price is-unknown'}>{item.price || t('common.onRequest')}</span></div></button>)}</div> : <div className="offerings-empty"><Layers3 size={30} /><strong>{t('audit.noOfferings')}</strong><p>{t('audit.noOfferingsDetail')}</p><button onClick={() => setStep('documents')}>{t('audit.addMaterials')}<ArrowRight size={16} /></button></div>}
            <div className="audit-footer-links"><button onClick={() => showDrawer('sources')}><FileSearch size={16} />{t('common.sources', { count: sources.length })}</button><button onClick={() => showDrawer('competitors')}>{t('common.competitors', { count: market.competitors.length })}</button><button onClick={() => showDrawer('reviews')}>{t('common.reviews', { count: market.reviews.length })}</button><button onClick={() => setStep('documents')}><FolderOpen size={16} />{t(desktop ? 'audit.addDocuments' : 'audit.docsWindows')}</button></div>
          </>}
          {step === 'direction' && <>
            <header className="workspace-heading enter-group"><div><span className="workspace-kicker">{t('direction.kicker')}</span><h1>{t('direction.title')}</h1><p>{t('direction.subtitle')}</p></div><button className="workspace-back" onClick={() => setStep('audit')}><ArrowLeft size={17} />{t('common.back')}</button></header>
            <div className="direction-list enter-cards">{result.analysis.opportunities.map((item, index) => <button key={item.id} className={`direction-card ${item.id === selected.id ? 'is-selected' : ''}`} onClick={() => onSelect(item.id)}><span className="direction-number">{String(index + 1).padStart(2, '0')}</span><span className="direction-copy"><span className="workspace-kicker">{t(CATEGORIES[item.category] || 'direction.opportunity')}</span><strong>{item.title}</strong><span>{item.action}</span><small><Gauge size={15} />{item.metric}</small></span><span className="direction-check">{item.id === selected.id ? <CheckCircle2 size={22} /> : <ChevronRight size={20} />}</span></button>)}</div>
            <div className="hypothesis-actions"><button className="soft-action" onClick={() => setHypothesisOpen(value => !value)}><Plus size={16} />{t('direction.own')}</button></div>
            {hypothesisOpen && <form className="hypothesis-composer" onSubmit={createHypothesis}><label htmlFor="intl-brief">{t('direction.whatTest')}</label><textarea id="intl-brief" value={brief} onChange={event => setBrief(event.target.value)} placeholder={t('direction.briefPlaceholder')} required maxLength={1600} /><label htmlFor="intl-constraints">{t('direction.constraints')} <span>{t('direction.optional')}</span></label><textarea id="intl-constraints" value={constraints} onChange={event => setConstraints(event.target.value)} placeholder={t('direction.constraintsPlaceholder')} maxLength={2000} /><p>{t('direction.notice')}</p><button className="primary-action" disabled={!brief.trim() || busy}>{busy ? t('direction.saving') : t('direction.add')}<ArrowRight size={16} /></button></form>}
            <div className="workspace-summary"><Sparkles size={20} /><div><span className="workspace-kicker">{t(selected.origin === 'user' ? 'direction.user' : 'direction.selected')}</span><strong>{selected.title}</strong><p>{selected.why}</p></div></div>
          </>}
          {step === 'plan' && <>
            <header className="workspace-heading"><div><span className="workspace-kicker">{t('plan.kicker')}</span><h1>{t('plan.title')}</h1><p>{selected.title}</p></div><button className="workspace-back" onClick={() => setStep('direction')}><ArrowLeft size={17} />{t('common.back')}</button></header>
            <ol className="plan-step-list enter-cards">{planSteps.map((text, index) => <li key={index}><span className="direction-number">{String(index + 1).padStart(2, '0')}</span><div><span className="workspace-kicker">{t('plan.step', { number: index + 1 })} · {t(index === 0 ? 'plan.preparation' : index === planSteps.length - 1 ? 'plan.decision' : 'plan.check')}</span><strong>{text}</strong></div></li>)}</ol>
            <div className="workspace-summary"><ClipboardList size={20} /><div><span className="workspace-kicker">{t('plan.output')}</span><strong>{selected.output || t('plan.defaultOutput')}</strong><p>{selected.action}</p></div></div>
            <div className="workspace-inline-actions"><button className="soft-action" onClick={() => showDrawer('plan')}>{t('plan.evidence')}<ArrowRight size={16} /></button><button className="soft-action" onClick={onSave}>{saved ? <Check size={16} /> : <Download size={16} />}{t(saved ? 'common.savedPlan' : 'common.downloadPlan')}</button></div>
          </>}
          {step === 'pilot' && <>
            <header className="workspace-heading"><div><span className="workspace-kicker">{t('pilot.kicker')}</span><h1>{t('pilot.title')}</h1><p>{t('pilot.subtitle')}</p></div><button className="workspace-back" onClick={() => setStep('plan')}><ArrowLeft size={17} />{t('common.back')}</button></header>
            <div className="pilot-card-list enter-cards"><article><Gauge size={21} /><div><span className="workspace-kicker">{t('pilot.metric')}</span><h2>{selected.metric}</h2><p><strong>{t('pilot.baseline')}:</strong> {pilot.baseline}</p><p><strong>{t('pilot.target')}:</strong> {pilot.target}</p></div></article><article><ClipboardList size={21} /><div><span className="workspace-kicker">{t('pilot.periodOwner')}</span><h2>{pilot.period}</h2><p>{pilot.owner}</p><p>{pilot.humanControl}</p></div></article><article className="is-selected"><Sparkles size={21} /><div><span className="workspace-kicker">{t('pilot.solution')}</span><h2>{t('pilot.connect')}</h2><p>{t('plan.noAuto')}</p></div></article></div>
            <div className="workspace-summary"><ShieldCheck size={20} /><div><span className="workspace-kicker">{t('pilot.stop')}</span><strong>{pilot.stopRule}</strong><p><strong>{t('pilot.scale')}:</strong> {pilot.scaleRule}</p></div></div>
            <div className="workspace-inline-actions"><button className="soft-action" onClick={() => showDrawer('plan')}>{t('pilot.acceptance')}{selected.acceptance?.cases?.length ? ` · ${t('pilot.cases', { count: selected.acceptance.cases.length })}` : ''}<ArrowRight size={16} /></button><a className="soft-action" href="https://2aos.ru/" target="_blank" rel="noreferrer">{t('pilot.ecosystem')}<ArrowUpRight size={16} /></a></div>
          </>}
          {step === 'documents' && <>
            <header className="workspace-heading"><div><span className="workspace-kicker">{t('documents.kicker')}</span><h1>{t('documents.title')}</h1><p>{t('documents.subtitle')}</p></div><button className="workspace-back" onClick={() => setStep('audit')}><ArrowLeft size={17} />{t('common.back')}</button></header>
            <div className="document-actions enter-cards">{desktop ? <><button onClick={onAddFolder} disabled={folderBusy || adding}><FolderOpen size={22} /><span><strong>{t(folderBusy ? 'documents.checkingFolder' : 'documents.chooseFolder')}</strong><small>{t('documents.readOnly')}</small></span><ChevronRight size={18} /></button><button onClick={onAddDocuments} disabled={adding || folderBusy}><FilePlus2 size={22} /><span><strong>{t(adding ? 'documents.reading' : 'documents.chooseFiles')}</strong><small>{t('documents.formats')}</small></span><ChevronRight size={18} /></button></> : <a href={DIRECTOR_WINDOWS_DOWNLOAD} download><Monitor size={22} /><span><strong>{t('documents.fullWindows')}</strong><small>{t('documents.fullWindowsDetail')}</small></span><Download size={18} /></a>}</div>
            <div className="workspace-inline-actions"><button className="soft-action" onClick={() => showDrawer('documents')}>{t('documents.access')}<ArrowRight size={16} /></button></div>
            <section className="document-registry"><div className="workspace-section-heading"><div><h2>{t('documents.added')}</h2><p>{localDocuments.length ? t('documents.inResearch', { count: localDocuments.length }) : t('documents.none')}</p></div>{localDocuments.length > 0 && desktop && <button className="soft-action danger-soft" onClick={onForgetFolder}><Trash2 size={16} />{t('documents.exclude')}</button>}</div>{localDocuments.length ? <div className="document-list">{localDocuments.map(source => <article key={source.id}><FileText size={20} /><div><strong>{source.title}</strong><p>{t('documents.local')}</p></div><ShieldCheck size={18} /></article>)}</div> : <div className="document-empty"><FileText size={26} /><p>{t('documents.empty')}</p></div>}</section>
            <div className={`documents-privacy ${desktop ? 'is-local' : 'is-web'}`}><ShieldCheck size={19} /><p>{t(desktop ? 'documents.privacyLocal' : 'documents.privacyWeb')}</p></div>
          </>}
          {error && <div className="inline-error workspace-error" role="alert">{error}</div>}
        </div>
      </main>
      <Advisor result={result} selected={selected} step={step} desktop={desktop} onStep={setStep} onSave={onSave} saved={saved} />
    </div>
    <footer className="workspace-signature">BAIagent · Anton Nikolaevich Balanov</footer>
    {drawer && <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDrawer(null); }}><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-label={t(drawerTitles[drawer])}><div className="drawer-header"><div><span className="section-kicker">BAIagent</span><h2>{t(drawerTitles[drawer])}</h2></div><button autoFocus onClick={() => setDrawer(null)} aria-label={t('common.close')}><X size={21} /></button></div><div className="drawer-body">
      {drawer === 'company' && <section className="drawer-plan"><span className="drawer-tag">{t('drawer.sourceData')}</span><h3>{companyName}</h3><p>{result.analysis.summary}</p><div className="company-drawer-facts"><article><span>{t('drawer.whatDoes')}</span><strong>{profile.industry?.label || research.marketContext?.subject}</strong></article><article><span>{t('drawer.audience')}</span><strong>{profile.segments?.map(item => item.label).join(' · ') || t('common.notSpecified')}</strong></article><article><span>{t('drawer.collected')}</span><strong>{t('audit.marketStats', { competitors: market.competitors.length, mentions: mentions.length })}</strong></article></div><SourceLink item={{ url: research.requestedUrl }} onOpen={onOpen}>{t('drawer.openCompany')}</SourceLink></section>}
      {drawer === 'offering' && activeOffering && <section className="drawer-plan"><span className="drawer-tag">{t(activeOffering.kind === 'service' ? 'common.service' : 'common.product')}</span>{activeOffering.image && <img className="drawer-product-image offering-detail-image" src={activeOffering.image} alt={offeringDisplayName(activeOffering)} />}<h3>{offeringDisplayName(activeOffering)}</h3><p className="offering-detail-price">{activeOffering.price || t('common.onRequest')}</p><blockquote>“{activeOffering.quote}”</blockquote><SourceLink item={activeOffering} onOpen={onOpen}>{t('drawer.openOriginal')}</SourceLink></section>}
      {drawer === 'offerings' && (offerings.length ? <div className="drawer-offerings">{offerings.map((item, index) => <article key={index}><div><span>{t(item.kind === 'service' ? 'common.service' : 'common.product')}</span><strong>{item.price || t('common.onRequest')}</strong></div><h3>{offeringDisplayName(item)}</h3>{item.image && <img className="drawer-product-image" src={item.image} alt={offeringDisplayName(item)} loading="lazy" />}<blockquote>“{item.quote}”</blockquote><SourceLink item={item} onOpen={onOpen} /></article>)}</div> : <Empty>{t('drawer.emptyOfferings')}</Empty>)}
      {['competitors', 'reviews', 'news', 'mentions'].includes(drawer) && ((drawer === 'competitors' ? market.competitors : drawer === 'reviews' ? market.reviews : drawer === 'news' ? news : mentions).length ? <div className="drawer-sources">{(drawer === 'competitors' ? market.competitors : drawer === 'reviews' ? market.reviews : drawer === 'news' ? news : mentions).map((item, index) => <article key={index}><span className="drawer-tag">{host(item.url)}{item.publishedAt ? ` · ${new Intl.DateTimeFormat(locale).format(new Date(item.publishedAt))}` : ''}</span><h3>{item.name || item.sourceTitle || item.title}</h3><p>“{item.quote}”</p><SourceLink item={item} onOpen={onOpen}>{t('drawer.openSource')}</SourceLink></article>)}</div> : <Empty>{t(`drawer.empty${drawer[0].toUpperCase()}${drawer.slice(1)}`)}</Empty>)}
      {drawer === 'market' && <section className="market-analysis"><div className="market-observations">{market.observations.map(item => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div><div className="market-quick-links"><button onClick={() => showDrawer('competitors')}>{t('common.competitors', { count: market.competitors.length })}</button><button onClick={() => showDrawer('news')}>{t('drawer.news')} · {news.length}</button><button onClick={() => showDrawer('mentions')}>{t('drawer.mentions')} · {mentions.length}</button><button onClick={() => showDrawer('swot')}>SWOT · {swot.length}</button></div><div className="market-gaps">{market.gaps.map(item => <p key={item}><ShieldCheck size={15} />{item}</p>)}</div></section>}
      {drawer === 'swot' && <div className="swot-grid">{['strength', 'weakness', 'opportunity', 'threat'].map(category => { const matches = swot.filter(item => item.category === category); return <article className={`swot-card swot-${category}`} key={category}><span>{t(`swot.${category}`)}</span>{matches.length ? matches.map(item => <button key={item.title} onClick={() => item.evidence?.[0] && onOpen(item.evidence[0])}><strong>{item.title}</strong><em>{item.evidence[0]?.sourceTitle}<ExternalLink size={12} /></em></button>) : <p>{t('drawer.swotEmpty')}</p>}</article>; })}</div>}
      {drawer === 'sources' && <div className="drawer-sources">{sources.map(source => <article key={source.id}><span className="drawer-tag">{t(source.kind === 'local-document' ? 'drawer.localDocument' : source.kind === 'company-site' ? 'drawer.companySite' : source.kind === 'competitor-candidate' ? 'drawer.competitorSite' : source.kind === 'news-snippet' ? 'drawer.industryNews' : 'drawer.externalSource')} · {host(source.url)}</span><h3>{source.title}</h3><p>{source.url}</p>{!source.url.startsWith('local://') && <SourceLink item={source} onOpen={onOpen}>{t('drawer.openSource')}</SourceLink>}</article>)}</div>}
      {drawer === 'plan' && <section className="drawer-plan"><span className="drawer-tag">{t('drawer.hypothesisTag')}</span><h3>{selected.title}</h3><h4>{t('drawer.whyHere')}</h4><p>{selected.why}</p><h4>{t('drawer.whatDo')}</h4><p>{selected.action}</p><h4>{t('drawer.implementation')}</h4><ol className="implementation-steps">{planSteps.map((item, index) => <li key={index}><span>{index + 1}</span>{item}</li>)}</ol><h4>{t('drawer.metric')}</h4><p>{selected.metric}</p><section className="pilot-blueprint"><div className="pilot-heading"><Gauge size={16} /><strong>{t('drawer.pilotFrame')}</strong></div><dl>{[['baseline', pilot.baseline], ['period', pilot.period], ['data', pilot.data], ['integrations', pilot.integrations], ['owner', pilot.owner], ['humanControl', pilot.humanControl], ['effect', pilot.effectFormula]].map(([key, value]) => <div key={key}><dt>{t(key === 'baseline' || key === 'target' ? `pilot.${key}` : key === 'effect' ? 'drawer.effect' : `drawer.${key}`)}</dt><dd>{value}</dd></div>)}</dl><div className="pilot-decisions"><p><strong>{t('drawer.stop')}</strong>{pilot.stopRule}</p><p><strong>{t('drawer.scale')}</strong>{pilot.scaleRule}</p></div></section>{selected.acceptance?.cases && <div className="acceptance-cases"><h4>{t('pilot.acceptance')}</h4>{selected.acceptance.cases.map(item => <article key={item.id}><strong>{item.name}</strong><p>{item.input}</p><p>{item.expected}</p></article>)}</div>}<h4>{t('drawer.evidence')}</h4>{selected.evidence.map((item, index) => <div className="plan-evidence" key={index}><blockquote>“{item.quote}”</blockquote><SourceLink item={item} onOpen={onOpen}>{t('drawer.openEvidence')}</SourceLink></div>)}{selected.unknowns?.length > 0 && <div className="unknowns"><strong>{t('drawer.unknowns')}</strong>{selected.unknowns.map(item => <span key={item}>{item}</span>)}</div>}<button className="primary-action" onClick={onSave}><Download size={16} />{t(saved ? 'common.savedPlan' : 'common.downloadPlan')}</button></section>}
      {drawer === 'documents' && <section className="drawer-plan"><span className="drawer-tag">{t(desktop ? 'nav.local' : 'nav.web')}</span><h3>{t('documents.access')}</h3><p>{t(desktop ? 'documents.accessDetail' : 'documents.webDetail')}</p><div className="folder-safety"><ShieldCheck size={15} />{t(desktop ? 'documents.privacyLocal' : 'documents.privacyWeb')}</div></section>}
    </div></aside></div>}
    {showNewAudit && <div className="new-audit-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowNewAudit(false); }}><section className="new-audit-dialog" role="dialog" aria-modal="true"><div className="new-audit-heading"><div><span className="workspace-kicker">{t('newAudit.kicker')}</span><h2>{t('newAudit.title')}</h2><p>{t('newAudit.subtitle')}</p></div><button onClick={() => setShowNewAudit(false)}><X size={21} /></button></div><form onSubmit={newAudit}><label htmlFor="intl-new-url">{t('newAudit.url')}</label><div className="new-audit-input"><Globe2 size={19} /><input id="intl-new-url" value={newUrl} onChange={event => setNewUrl(event.target.value)} placeholder="https://company.com" required /></div><div className="new-audit-warning" role="alert"><ShieldCheck size={21} /><strong>{t('newAudit.warning')}</strong></div><p className="new-audit-behavior"><strong>{t('newAudit.behavior')}</strong> {t(desktop ? 'newAudit.desktopBehavior' : 'newAudit.webBehavior')}</p><div className="new-audit-actions"><button type="button" className="new-audit-cancel" onClick={() => setShowNewAudit(false)}>{t('common.cancel')}</button><button className="primary-action" disabled={busy || !newUrl.trim()}>{busy ? t('newAudit.pending') : t('newAudit.confirm')}<ArrowRight size={17} /></button></div></form></section></div>}
  </div>;
}
