import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Download, FileSearch, Globe2, Laptop, LoaderCircle, LockKeyhole, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { buildPilotPlan } from '../shared/verification.js';
import { researchErrorMessage } from '../shared/research-error.js';
import { DIRECTOR_WINDOWS_DOWNLOAD, ENTERPRISE_WINDOWS_DOWNLOAD, RELEASE_VERSION } from '../shared/release.js';
import ResultDashboard from './ResultDashboard.jsx';
import './styles.css';
import './audit.css';

const DESKTOP = typeof window !== 'undefined' && Boolean(window.director?.isDesktop);
const ENTERPRISE = import.meta.env.MODE === 'enterprise';
const BASE = import.meta.env.BASE_URL;
const WINDOWS_DOWNLOAD = ENTERPRISE ? ENTERPRISE_WINDOWS_DOWNLOAD : DIRECTOR_WINDOWS_DOWNLOAD;
const ANDROID_DOWNLOAD = 'https://baiagent.ru/xray/api/download.php?platform=android';
const PRICE_DOWNLOAD = `${BASE}downloads/BAIagent-B2B-price.xlsx`;
const STAGE_TARGETS = { site: 14, pages: 36, external: 52, model: 68, thinking: 88, verification: 97 };
const WORK_STEPS = [
  { title: 'Узнаю вашу компанию', text: 'Читаю сайт, продукты и открытые материалы.', stages: ['site'] },
  { title: 'Нахожу цифровой след', text: 'Изучаю страницы, предложения и внешние упоминания.', stages: ['pages', 'external', 'model'] },
  { title: 'Собираю варианты действий', text: 'Связываю каждое предложение с конкретным основанием.', stages: ['thinking'] },
  { title: 'Всё проверяю', text: 'Оставляю только то, что можно подтвердить источником.', stages: ['verification'] },
];

function mobilePlatform() {
  if (DESKTOP || typeof navigator === 'undefined') return 'desktop';
  const agent = navigator.userAgent || '';
  if (/Android/i.test(agent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Mobi/i.test(agent)) return 'mobile';
  return 'desktop';
}

function openLink(url) {
  if (DESKTOP) window.director.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

function Brand() {
  return <div className="brand" aria-label={ENTERPRISE ? 'Balanov.PRO' : 'BAIagent и A2OS'}>
    <button className="brand-home" onClick={() => openLink(ENTERPRISE ? 'https://balanov.pro/' : 'https://baiagent.ru/')} aria-label={ENTERPRISE ? 'Открыть Balanov.PRO' : 'Открыть baiagent.ru'}>
      {ENTERPRISE ? <strong className="enterprise-brand-name">Balanov.PRO</strong> : <img src={`${BASE}images/baiagent-logo.png`} alt="Ai" />}
    </button>
    <span className="brand-divider" />
    {ENTERPRISE ? <span className="brand-product">ИИ-советник</span> : <button className="brand-a2os" onClick={() => openLink('https://2aos.ru/')} aria-label="Открыть 2aos.ru">2AOS</button>}
  </div>;
}

function DirectorVisual({ active = false, done = false }) {
  return <div className={`director-visual ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`} aria-hidden="true">
    <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    <div className="director-core">{done ? <Check size={42} strokeWidth={2.4} /> : <img src={`${BASE}images/app-icon.png`} alt="" />}</div>
    <span className="signal signal-one" /><span className="signal signal-two" /><span className="signal signal-three" />
  </div>;
}

function saveWebPilot(result, opportunity) {
  const content = buildPilotPlan(result.analysis, opportunity, result.research.sources);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'BAIagent-pilot.md'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function researchOnWeb(url, onProgress) {
  onProgress({ stage: 'site' });
  const endpoint = import.meta.env.VITE_RESEARCH_ENDPOINT || 'https://baiagent.ru/xray/api/research.php';
  const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Сервер исследования: HTTP ${response.status}`);
  onProgress({ stage: 'thinking' });
  const analysis = createEvidenceBasedFallback(data.sources, data.requestedUrl, data);
  onProgress({ stage: 'verification' });
  return { research: data, analysis };
}

function currentStep(stage) {
  const index = WORK_STEPS.findIndex(step => step.stages.includes(stage));
  return index < 0 ? 0 : index;
}

function friendlyStatus(progress) {
  if (!progress) return 'Подготавливаю исследование — ничего настраивать не нужно.';
  if (progress.stage === 'model' && progress.progress < 1) return `Первый запуск: подготавливаю ИИ-модуль (${Math.round(progress.progress * 100)}%). Дальше он будет уже на вашем компьютере.`;
  return WORK_STEPS[currentStep(progress.stage)].text;
}

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} мин ${String(rest).padStart(2, '0')} с` : `${rest} с`;
}

function PlatformDownloads() {
  const platform = mobilePlatform();
  if (DESKTOP || platform === 'ios' || platform === 'mobile') return null;
  if (ENTERPRISE) return <section className="downloads-section downloads-simple" aria-label="Скачать Balanov.PRO Enterprise">
    <a className="simple-download-primary" href={ENTERPRISE_WINDOWS_DOWNLOAD} download><Monitor size={22} /><span><strong>Скачать Balanov.PRO Enterprise</strong><small>Windows · версия {RELEASE_VERSION} · первичный аудит 0 ₽</small></span><Download size={18} /></a>
  </section>;
  if (platform === 'android') return <section className="downloads-section mobile-download" aria-label="Скачать приложение для Android">
    <div className="platform-icon"><Smartphone size={22} /></div><div><h2>Приложение для Android</h2><p>Бесплатно · без WebView</p></div>
    <a className="platform-download" href={ANDROID_DOWNLOAD}><Download size={18} /> Скачать для Android</a>
  </section>;
  return <section className="downloads-section downloads-simple" aria-label="Скачать приложение">
    <a className="simple-download-primary" href={WINDOWS_DOWNLOAD} download><Monitor size={22} /><span><strong>Скачать для Windows</strong><small>Версия {RELEASE_VERSION} · бесплатно</small></span><Download size={18} /></a>
    <details className="other-platforms"><summary>Другие платформы и прайс</summary><div><span><Smartphone size={17} /> Android</span><a href={ANDROID_DOWNLOAD}>Скачать</a><span><Laptop size={17} /> macOS и Linux</span><small>Скоро</small><a href={PRICE_DOWNLOAD} download>Прайс на решения BAIagent<ArrowUpRight size={15} /></a></div></details>
  </section>;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [displayedPercent, setDisplayedPercent] = useState(2);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activityLog, setActivityLog] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!DESKTOP) return undefined;
    return window.director.onProgress(update => {
      setProgress(update);
      if (update.message) setActivityLog(items => items.includes(update.message) ? items : [...items, update.message].slice(-5));
    });
  }, []);

  useEffect(() => {
    if (phase !== 'working') return undefined;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const targetPercent = useMemo(() => {
    if (phase === 'result') return 100;
    const stage = progress?.stage || 'site';
    const base = STAGE_TARGETS[stage] || 8;
    if (stage === 'model' && typeof progress?.progress === 'number') return Math.min(68, 48 + progress.progress * 20);
    return base;
  }, [phase, progress]);

  useEffect(() => {
    if (phase !== 'working') return undefined;
    const timer = setInterval(() => {
      setDisplayedPercent(current => {
        if (current >= targetPercent) return current;
        return Math.min(targetPercent, current + Math.max(0.08, (targetPercent - current) * 0.055));
      });
    }, 120);
    return () => clearInterval(timer);
  }, [phase, targetPercent]);

  const percent = phase === 'result' ? 100 : Math.round(displayedPercent);
  const selected = result?.analysis.opportunities.find(item => item.id === selectedId) || result?.analysis.opportunities[0];
  const liveMessage = progress?.draftChars > 0 ? `${progress.message}: ${progress.draftChars.toLocaleString('ru-RU')} знаков` : progress?.message || friendlyStatus(progress);

  async function start(event) {
    event?.preventDefault();
    if (!url.trim() || phase === 'working') return;
    setPhase('working'); setError(''); setResult(null); setSaved(false); setProgress(null); setActivityLog([]); setDisplayedPercent(2);
    try {
      const data = DESKTOP ? await window.director.research(url) : await researchOnWeb(url, setProgress);
      setResult(data); setSelectedId(data.analysis.opportunities[0]?.id || null); setPhase('result');
    } catch (reason) {
      console.error(reason);
      setError(researchErrorMessage(reason)); setPhase('error');
    }
  }

  function reset() {
    setPhase('idle'); setResult(null); setProgress(null); setError(''); setSaved(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function preparePilot() {
    if (!selected || !result) return;
    if (DESKTOP) {
      const response = await window.director.savePilot(selected.id);
      if (response.saved) setSaved(true);
    } else {
      saveWebPilot(result, selected); setSaved(true);
    }
  }

  async function addDocuments() {
    if (!DESKTOP || adding) return;
    setAdding(true); setError('');
    try {
      const data = await window.director.addDocuments();
      setResult(data); setSelectedId(data.analysis.opportunities[0]?.id || null);
    } catch (reason) { setError(reason.message); } finally { setAdding(false); }
  }

  async function addFolder() {
    if (!DESKTOP || folderBusy) return;
    setFolderBusy(true); setError('');
    try {
      const data = await window.director.addFolder();
      setResult(data); setSelectedId(data.analysis.opportunities[0]?.id || null);
    } catch (reason) { setError(reason.message); } finally { setFolderBusy(false); }
  }

  async function forgetFolder() {
    if (!DESKTOP || folderBusy) return;
    setFolderBusy(true); setError('');
    try {
      const data = await window.director.forgetFolder();
      setResult(data); setSelectedId(data.analysis.opportunities[0]?.id || null);
    } catch (reason) { setError(reason.message); } finally { setFolderBusy(false); }
  }

  function openSource(source) {
    const url = typeof source === 'string' ? source : source?.url;
    if (url && !url.startsWith('local://')) openLink(url);
  }

  function useBrowserOnPhone() {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return <div className="app-shell">
    <header className="topbar">
      <Brand />
      <div className="topbar-right">
        <div className="trust"><LockKeyhole size={15} /><span>{DESKTOP ? 'Локальный ИИ · документы на вашем устройстве' : ENTERPRISE ? 'Balanov.PRO · аудит компании, отдела или министерства' : 'Веб — экспресс-аудит · полный разбор в Windows'}</span></div>
      </div>
    </header>

    {(phase === 'idle' || phase === 'error') && <>
      <main className="welcome">
        <section className="welcome-copy">
          <div className="eyebrow"><span className="live-dot" /> {ENTERPRISE ? 'Balanov.PRO · ИИ-советник для бизнеса' : 'Бесплатный ИИ-советник для вашего бизнеса'}</div>
          <h1>Ваш бизнес —<br /><span>в контексте рынка.</span></h1>
          <p className="lead">{ENTERPRISE ? 'Проведите бесплатный аудит по сайту: советник определит профиль, предложит конкретный процесс и сопоставит его с реальными кейсами и прайсом вендора. Затем — архитектура, команда и измеримый пилот.' : 'ИИ-советник изучает предложения, конкурентов и клиентский контекст, затем предлагает один приоритетный и два запасных процесса. Факты отделены от гипотез, у каждого решения есть метрики, риски и критерии остановки.'}</p>
          <form className="launch-form" onSubmit={start}>
            <label htmlFor="company-url">{ENTERPRISE ? 'Сайт компании, ведомства или проекта' : 'Сайт вашей компании'}</label>
            <div className="url-control">
              <Globe2 size={21} />
              <input ref={inputRef} id="company-url" type="text" inputMode="url" autoComplete="url" placeholder="например, company.ru" value={url} onChange={event => setUrl(event.target.value)} autoFocus />
              <button type="submit" disabled={!url.trim()}><span>{ENTERPRISE ? 'Провести аудит бесплатно' : 'Разобрать мой бизнес'}</span><ArrowRight size={20} /></button>
            </div>
          </form>
          {error && <div className="inline-error" role="alert">{error}<span>Проверьте адрес и доступность сайта.</span></div>}
          <div className="promises"><span><Check size={15} /> Аудит 0 ₽</span><span><Check size={15} /> Без анкет</span><span><Check size={15} /> Источники и критерии приёмки</span></div>
          {ENTERPRISE ? <button className="hero-download" onClick={() => openLink('https://balanov.pro/all')}><ArrowUpRight size={19} /><span><strong>Экосистема Balanov.PRO</strong><small>Разработка, внедрение, безопасность и ИИ-инфраструктура</small></span></button> : <>
            {!DESKTOP && mobilePlatform() === 'desktop' && <a className="hero-download" href={WINDOWS_DOWNLOAD} download><Download size={19} /><span><strong>Скачать для Windows</strong><small>Полный советник и документы · 0 ₽</small></span></a>}
            {!DESKTOP && mobilePlatform() === 'android' && <a className="hero-download" href={ANDROID_DOWNLOAD}><Download size={19} /><span><strong>Скачать для Android</strong><small>Нативное приложение · бесплатно</small></span></a>}
            {!DESKTOP && ['ios', 'mobile'].includes(mobilePlatform()) && <button className="hero-download hero-browser" onClick={useBrowserOnPhone}><Globe2 size={19} /><span><strong>Экспресс-аудит в браузере</strong><small>Полный локальный советник — в Windows</small></span></button>}
          </>}
        </section>
        <section className="welcome-preview" aria-label="Что найдёт ИИ-советник">
          <DirectorVisual active />
          <div className="preview-card">
            <div className="preview-top"><span>Что вы получите</span><span className="preview-badge">за один запуск</span></div>
            {(ENTERPRISE ? ['Профиль компании или ведомства по открытым материалам', 'Процесс, данные, интеграции, риски и приёмка', 'Релевантные кейсы, цены вендора и следующий шаг'] : ['Товары и услуги с точными источниками', 'Карта рынка: конкуренты, отзывы и отраслевые сигналы', 'Приоритетный процесс, приёмка и план измеримого пилота']).map((item, index) => <div className="preview-step" key={item}><span className="step-number">0{index + 1}</span><span>{item}</span></div>)}
            <div className="preview-bottom"><ShieldCheck size={18} /><span>{ENTERPRISE ? 'Первичный аудит — 0 ₽. Стоимость следующих работ определяется только после согласования объёма.' : 'Веб — экспресс-аудит. Полный локальный советник — в Windows.'}</span></div>
          </div>
        </section>
      </main>
      <PlatformDownloads />
    </>}

    {phase === 'working' && <main className="working-view">
      <section className="working-hero">
        <div><div className="eyebrow"><span className="live-dot" /> ИИ-советник проводит аудит</div><h1>Знакомлюсь с вашим бизнесом <span>{percent}%</span></h1><p>{friendlyStatus(progress)}</p></div>
        <DirectorVisual active />
      </section>
      <div className="progress-track" aria-label={`Выполнено ${percent}%`}><span style={{ width: `${percent}%` }} /></div>
      <section className="activity-card">
        <div className="activity-heading"><FileSearch size={20} /><span>Понятный процесс — ничего делать не нужно</span><LoaderCircle className="spin" size={18} /></div>
        <div className="activity-list">
          {WORK_STEPS.map((step, index) => {
            const current = currentStep(progress?.stage);
            const done = index < current;
            const active = index === current;
            return <div className={`activity-row ${done ? 'is-done' : ''} ${active ? 'is-current' : ''}`} key={step.title}>
              {done ? <CheckCircle2 size={20} /> : active ? <LoaderCircle className="spin" size={20} /> : <span className="step-dot" />}
              <div><strong>{step.title}</strong><span>{active ? friendlyStatus(progress) : step.text}</span></div>
            </div>;
          })}
        </div>
        <div className="live-activity">
          <div className="live-activity-top"><span className="activity-pulse"><i /><i /><i /></span><div className="live-message"><small>Сейчас</small><strong>{liveMessage}</strong></div><span className="elapsed">Работаю {formatElapsed(elapsed)}</span></div>
          <div className="activity-wave" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          {activityLog.length > 1 && <div className="factual-events" aria-label="Выполненные действия">{activityLog.slice(0, -1).slice(-3).map(message => <span key={message}><Check size={12} />{message}</span>)}</div>}
          <p>Здесь отображаются только реальные действия. Если идёт формирование выводов, счётчик знаков меняется по мере работы.</p>
        </div>
        <div className="activity-note"><ShieldCheck size={18} /> Я сам соберу данные, свяжу выводы с источниками и покажу результат.</div>
      </section>
    </main>}

    {phase === 'result' && result && selected && <ResultDashboard
      result={result} selected={selected} onSelect={id => { setSelectedId(id); setSaved(false); }}
      onReset={reset} onOpen={openSource} onSave={preparePilot} saved={saved} desktop={DESKTOP}
      onAddDocuments={addDocuments} onAddFolder={addFolder} onForgetFolder={forgetFolder}
      adding={adding} folderBusy={folderBusy} error={error} onUseBrowser={useBrowserOnPhone}
    />}

    <button className="developer-credit" onClick={() => openLink('https://balanov.pro/')} aria-label="Антон Баланов — открыть balanov.pro"><img src={`${BASE}images/balanov-logo.png`} alt="Антон Баланов" /></button>
  </div>;
}
