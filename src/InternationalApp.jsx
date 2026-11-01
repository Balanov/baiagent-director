import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Download, FileSearch, Globe2, LoaderCircle, LockKeyhole, Monitor, ShieldCheck } from 'lucide-react';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { buildPilotPlan } from '../shared/verification.js';
import { normalizeUserHypothesis } from '../shared/hypothesis.js';
import { DIRECTOR_WINDOWS_DOWNLOAD, DIRECTOR_RELEASE_VERSION } from '../shared/release.js';
import InternationalDashboard from './InternationalDashboard.jsx';
import OwnEcosystemResult from './OwnEcosystemResult.jsx';
import { isOwnEcosystemWebsite } from '../shared/own-ecosystem.js';
import { LanguageSwitcher, useLocale } from './locale.jsx';

const DESKTOP = typeof window !== 'undefined' && Boolean(window.director?.isDesktop);
const BASE = import.meta.env.BASE_URL;
const TARGETS = { site: 14, pages: 36, external: 52, model: 68, thinking: 88, verification: 97 };
const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

async function researchOnWeb(url, language, onProgress) {
  onProgress({ stage: 'site' });
  const endpoint = import.meta.env.VITE_RESEARCH_ENDPOINT || 'https://baiagent.ru/xray/api/research.php';
  const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(language)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Research server: HTTP ${response.status}`);
  onProgress({ stage: 'thinking' });
  const analysis = createEvidenceBasedFallback(data.sources, data.requestedUrl, data);
  onProgress({ stage: 'verification' });
  return { research: { ...data, language: data.language || language }, analysis };
}

function Visual({ active }) { return <div className={`director-visual ${active ? 'is-active' : ''}`} aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="director-core"><img src={`${BASE}images/app-icon.png`} alt="" /></div><span className="signal signal-one" /><span className="signal signal-two" /><span className="signal signal-three" /></div>; }

export default function InternationalApp() {
  const { t, language, locale } = useLocale();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [percent, setPercent] = useState(2);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef(null);
  const selected = result?.analysis.opportunities.find(item => item.id === selectedId) || result?.analysis.opportunities[0];
  const steps = [1, 2, 3, 4].map(number => ({ title: t(`working.step${number}`), text: t(`working.step${number}Text`), stages: [['site'], ['pages', 'external', 'model'], ['thinking'], ['verification']][number - 1] }));
  const stepIndex = Math.max(0, steps.findIndex(step => step.stages.includes(progress?.stage)));
  const target = phase === 'result' ? 100 : TARGETS[progress?.stage] || 8;
  useEffect(() => {
    if (!DESKTOP) return undefined;
    return window.director.onProgress(update => setProgress(update));
  }, []);
  useEffect(() => {
    if (phase !== 'working') return undefined;
    const started = Date.now(); setElapsed(0);
    const timer = setInterval(() => { setElapsed(Math.floor((Date.now() - started) / 1000)); setPercent(value => Math.min(target, value + Math.max(0.2, (target - value) * 0.06))); }, 180);
    return () => clearInterval(timer);
  }, [phase, target]);
  useEffect(() => {
    if (result && result.research.language && result.research.language !== language) { setResult(null); setPhase('idle'); setProgress(null); setError(''); }
  }, [language, result]);
  function friendlyStatus() {
    if (progress?.stage === 'model' && progress.progress < 1) return t('working.model', { percent: Math.round(progress.progress * 100) });
    return steps[stepIndex]?.text || t('working.prepare');
  }
  function timeLabel() {
    const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60;
    return t(minutes ? 'time.minutes' : 'time.seconds', { minutes, seconds: String(seconds).padStart(2, '0') });
  }
  function openSource(source) {
    const targetUrl = typeof source === 'string' ? source : source?.url;
    if (!targetUrl || targetUrl.startsWith('local://')) return;
    if (DESKTOP) window.director.openExternal(targetUrl); else window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
  async function start(event, requestedUrl) {
    event?.preventDefault();
    const targetUrl = String(requestedUrl || url).trim();
    if (!targetUrl || phase === 'working') return;
    setUrl(targetUrl);
    if (isOwnEcosystemWebsite(targetUrl)) {
      setPhase('own'); setResult(null); setSelectedId(null); setError(''); setSaved(false); setProgress(null);
      return;
    }
    setPhase('working'); setResult(null); setSelectedId(null); setError(''); setSaved(false); setProgress(null); setPercent(2);
    try {
      const data = DESKTOP ? await window.director.research(targetUrl, language) : await researchOnWeb(targetUrl, language, setProgress);
      setResult(data); setSelectedId(data.analysis.opportunities[0]?.id || null); setPhase('result');
    } catch (reason) { console.error(reason); setError(reason.message || t('hero.errorHint')); setPhase('error'); }
  }
  async function reset() {
    if (DESKTOP) await window.director.resetSession();
    setPhase('idle'); setResult(null); setSelectedId(null); setProgress(null); setError(''); setSaved(false); setUrl('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  async function startNewAudit(nextUrl) { if (DESKTOP) await window.director.resetSession(); await start(null, nextUrl); }
  function applyResult(data) { setResult(data); setSelectedId(data.analysis.opportunities[0]?.id || null); setSaved(false); }
  async function createHypothesis(input) {
    if (!result || !input?.brief?.trim()) throw new Error(t('direction.whatTest'));
    if (DESKTOP) {
      const response = await window.director.createHypothesis(input);
      if (response.status !== 'completed') throw new Error(t('chat.error'));
      setResult(response.result); setSelectedId(response.opportunityId); setSaved(false); return response;
    }
    const opportunity = normalizeUserHypothesis({}, input, undefined, language);
    setResult(current => ({ ...current, analysis: { ...current.analysis, opportunities: [...current.analysis.opportunities, opportunity] } }));
    setSelectedId(opportunity.id); return { status: 'completed', opportunityId: opportunity.id };
  }
  async function savePilot() {
    if (!selected || !result) return;
    try {
      if (DESKTOP) {
        const response = await window.director.savePilot(selected.id);
        if (response.saved) setSaved(true); return;
      }
      const content = buildPilotPlan(result.analysis, selected, result.research.sources);
      const blobUrl = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = blobUrl; anchor.download = 'BAIagent-pilot.md'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000); setSaved(true);
    } catch (reason) { setError(reason.message); }
  }
  async function addDocuments(folder = false) {
    if (!DESKTOP) return;
    folder ? setFolderBusy(true) : setAdding(true); setError('');
    try {
      const response = folder ? await window.director.addFolder() : await window.director.addDocuments();
      if (response.status === 'completed' && response.result) applyResult(response.result);
    } catch (reason) { setError(reason.message); }
    finally { folder ? setFolderBusy(false) : setAdding(false); }
  }
  async function forgetFolder() {
    if (!DESKTOP) return; setFolderBusy(true);
    try { const response = await window.director.forgetFolder(); if (response.result) applyResult(response.result); }
    catch (reason) { setError(reason.message); } finally { setFolderBusy(false); }
  }
  return <div className="app-shell international-app">
    <header className="topbar"><div className="brand"><a className="brand-home" href="https://baiagent.ru/" target="_blank" rel="noreferrer"><img src={`${BASE}images/baiagent-logo.png`} alt="BAIagent" /></a><span className="brand-divider" /><span className="brand-product">{t('brand.product')}</span></div><div className="topbar-right"><div className="trust"><LockKeyhole size={15} /><span>{t(DESKTOP ? 'trust.local' : 'trust.web')}</span></div><LanguageSwitcher compact /></div></header>
    {(phase === 'idle' || phase === 'error') && <main className="welcome"><section className="welcome-copy"><div className="eyebrow"><span className="live-dot" />{t('hero.eyebrow')}</div><h1>{t('hero.title')}<br /><span>{t('hero.titleAccent')}</span></h1><p className="lead">{t('hero.lead')}</p><form className="launch-form" onSubmit={start}><label htmlFor="intl-company-url">{t('hero.urlLabel')}</label><div className="url-control"><Globe2 size={21} /><input ref={inputRef} id="intl-company-url" type="text" inputMode="url" autoComplete="url" placeholder={t('hero.urlPlaceholder')} value={url} onChange={event => setUrl(event.target.value)} autoFocus /><button type="submit" disabled={!url.trim()}><span>{t('hero.submit')}</span><ArrowRight size={20} /></button></div></form>{error && <div className="inline-error" role="alert">{error}<span>{t('hero.errorHint')}</span></div>}<div className="promises"><span><Check size={15} />{t('promise.free')}</span><span><Check size={15} />{t('promise.noForms')}</span><span><Check size={15} />{t('promise.evidence')}</span></div>{!DESKTOP && <a className="hero-download" href={DIRECTOR_WINDOWS_DOWNLOAD} download><Download size={19} /><span><strong>{t('download.windows')}</strong><small>{t('download.windowsFull')}</small></span></a>}</section><section className="welcome-preview"><Visual active /><div className="preview-card"><div className="preview-top"><span>{t('preview.title')}</span><span className="preview-badge">{t('preview.badge')}</span></div>{[1, 2, 3].map(number => <div className="preview-step" key={number}><span className="step-number">0{number}</span><span>{t(`preview.item${number}`)}</span></div>)}<div className="preview-bottom"><ShieldCheck size={18} /><span>{t('preview.footer')}</span></div></div></section></main>}
    {(phase === 'idle' || phase === 'error') && !DESKTOP && <section className="downloads-section downloads-simple"><a className="simple-download-primary" href={DIRECTOR_WINDOWS_DOWNLOAD} download><Monitor size={22} /><span><strong>{t('download.windows')}</strong><small>{t('download.versionFree', { version: DIRECTOR_RELEASE_VERSION })}</small></span><Download size={18} /></a></section>}
    {phase === 'working' && <main className="working-view"><section className="working-hero"><div><div className="eyebrow"><span className="live-dot" />{t('working.eyebrow')}</div><h1>{t('working.title')} <span>{Math.round(percent)}%</span></h1><p>{friendlyStatus()}</p></div><Visual active /></section><div className="progress-track" aria-label={t('working.progress', { percent: Math.round(percent) })}><span style={{ width: `${percent}%` }} /></div><section className="activity-card"><div className="activity-heading"><FileSearch size={20} /><span>{t('working.activity')}</span><LoaderCircle className="spin" size={18} /></div><div className="activity-list">{steps.map((step, index) => <div className={`activity-row ${index < stepIndex ? 'is-done' : ''} ${index === stepIndex ? 'is-current' : ''}`} key={step.title}>{index < stepIndex ? <CheckCircle2 size={20} /> : index === stepIndex ? <LoaderCircle className="spin" size={20} /> : <span className="step-dot" />}<div><strong>{step.title}</strong><span>{index === stepIndex ? friendlyStatus() : step.text}</span></div></div>)}</div><div className="live-activity"><div className="live-activity-top"><span className="activity-pulse"><i /><i /><i /></span><div className="live-message"><small>{t('working.now')}</small><strong>{host(url)} · {friendlyStatus()}</strong></div><span className="elapsed">{t('working.elapsed', { time: timeLabel() })}</span></div><p>{t('working.realOnly')}</p></div><div className="activity-note"><ShieldCheck size={18} />{t('working.note')}</div></section></main>}
    {phase === 'own' && <OwnEcosystemResult onReset={reset} />}
    {phase === 'result' && result && selected && <InternationalDashboard result={result} selected={selected} onSelect={id => { setSelectedId(id); setSaved(false); }} onReset={reset} onStartNewAudit={startNewAudit} onOpen={openSource} onSave={savePilot} saved={saved} desktop={DESKTOP} onAddDocuments={() => addDocuments(false)} onAddFolder={() => addDocuments(true)} onForgetFolder={forgetFolder} onCreateHypothesis={createHypothesis} adding={adding} folderBusy={folderBusy} error={error} />}
    <button className="developer-credit" onClick={() => openSource('https://balanov.pro/')} aria-label="Anton Balanov"><img src={`${BASE}images/balanov-logo.png`} alt="Anton Balanov" /></button>
  </div>;
}
