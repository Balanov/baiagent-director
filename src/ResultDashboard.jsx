import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Bot, Building2, Check, CheckCircle2, ChevronRight, Download, ExternalLink, FilePlus2, FileSearch, FolderOpen, Gauge, Globe2, Image, Layers3, MessageSquareText, Monitor, Newspaper, RotateCcw, ShieldCheck, Sparkles, Trash2, TrendingUp, X } from 'lucide-react';
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
function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Дата не указана' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date); }
function accent(value) { const hash = [...String(value)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 0); return `hsl(${hash} 68% 42%)`; }
function EmptyState({ children }) { return <div className="drawer-empty"><ShieldCheck size={22} /><p>{children}</p></div>; }
function SourceButton({ item, onOpen, children }) { return <button className="source-button" onClick={() => onOpen(item)}>{children || item.sourceTitle || host(item.url)}<ExternalLink size={13} /></button>; }

export default function ResultDashboard({ result, selected, onSelect, onReset, onOpen, onSave, saved, desktop, onAddDocuments, onAddFolder, onForgetFolder, adding, folderBusy, error }) {
  const [drawer, setDrawer] = useState(null);
  const [sourceScope, setSourceScope] = useState('own');
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
  const latestNews = market.news[0];
  const ratedReview = market.reviews.find(item => item.rating || item.count);
  const threat = swot.find(item => item.category === 'threat');

  useEffect(() => {
    if (!drawer) return undefined;
    const close = event => { if (event.key === 'Escape') setDrawer(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);

  const drawerTitles = {
    offerings: 'Товары и услуги с точными источниками', reviews: 'Отзывы, оценки и темы клиентского опыта',
    alternatives: 'Сопоставимые товары и услуги', competitors: 'Прямой конкурентный контур', news: 'Отраслевые сигналы и динамика', mentions: 'Независимые упоминания о компании',
    market: 'Рыночная картина и границы выводов', swot: 'SWOT по подтверждённым материалам', sources: 'Все материалы исследования',
    agents: 'Готовые ИИ-агенты BAIagent', plan: 'Процесс, приёмка и критерии результата', documents: 'Больше инсайтов из ваших данных',
    enterprise: 'Balanov.PRO · решение для enterprise и госсектора',
    connect: primarySolution ? 'Автономный агент для выбранного процесса' : 'Индивидуальное внедрение', advisor: desktop ? 'Локальный ИИ-советник' : 'Советник: экспресс в вебе, полный диалог в Windows',
  };

  return <>
    <main className="result-view result-dashboard" data-analysis-mode={result.analysis.mode || 'evidence-rules'} style={{ '--company-accent': accent(companyName) }}>
      <section className="recognition-card recognition-compact">
        <div className="recognition-main">
          <div className="recognition-icon">{companyLogo && <img src={companyLogo} alt="" onError={event => { event.currentTarget.remove(); }} />}<Building2 size={23} /></div>
          <div><div className="eyebrow"><CheckCircle2 size={14} /> Мы вас узнали · {profile.industry?.label || 'профиль уточняется'}</div><h1>{companyName}</h1><button className="domain-link" onClick={() => onOpen(research.requestedUrl)}>{domain}<ExternalLink size={12} /></button></div>
        </div>
        <div className="recognition-actions"><button className="advisor-top-action" onClick={() => setDrawer('advisor')}><Bot size={17} /><span><strong>{desktop ? 'Спросить советника' : 'Открыть советника'}</strong><small>{desktop ? 'Свободный локальный диалог' : 'Экспресс + полный диалог в Windows'}</small></span><ArrowRight size={15} /></button></div>
      </section>

      <details className="company-details"><summary>Профиль компании и управленческое резюме <ChevronRight size={15} /></summary><div className="company-details-body"><div><span>Чем занимается</span><strong>{profile.industry?.label || 'Нужны дополнительные материалы'}</strong></div><div><span>Для кого</span><strong>{profile.segments.length ? profile.segments.map(item => item.label).join(' · ') : 'Сегменты пока не подтверждены'}</strong></div><p>{result.analysis.summary}</p></div></details>

      {(research.warnings?.length || result.analysis.warning) && <div className="research-warning" role="status"><ShieldCheck size={17} /><div><strong>Покрытие источников ограничено</strong><span>{[...new Set([...(research.warnings || []), result.analysis.warning].filter(Boolean))].slice(0, 2).join(' ')} Результат основан только на полученных материалах и не считается полным охватом.</span></div></div>}

      <div className="result-primary-grid">
        <section className="offerings-showcase">
          <div className="showcase-heading"><div><span className="section-kicker">Ваше предложение · по карточкам сайта</span><h2>Что компания продаёт</h2></div><button onClick={() => setDrawer('offerings')}>Все {offerings.length || ''}<ChevronRight size={16} /></button></div>
          {offerings.length ? <div className="offerings-grid">{offerings.slice(0, 4).map((item, index) => <button className="offering-card" key={`${item.name}-${item.price || 'no-price'}-${index}`} onClick={() => setDrawer('offerings')}>
            <div className="offering-image">{item.image ? <img src={item.image} alt="" loading="lazy" onError={event => { event.currentTarget.parentElement.classList.add('is-empty'); event.currentTarget.remove(); }} /> : <Image size={19} />}</div>
            <div className="offering-card-copy"><span className="offering-kind">{item.kind === 'service' ? 'Услуга' : 'Товар'}<ExternalLink size={12} /></span><strong>{offeringDisplayName(item)}</strong><span className={item.price ? 'offering-price' : 'offering-price is-unknown'}>{item.price || 'Условия по запросу'}</span></div>
          </button>)}</div> : <div className="offerings-empty"><Layers3 size={28} /><strong>Карточки предложений не распознаны</strong><p>Добавьте каталог в полной версии — советник разберёт его локально.</p><button onClick={() => setDrawer('documents')}>Добавить каталог<ArrowRight size={15} /></button></div>}
          <div className="showcase-proof"><ShieldCheck size={14} /><span>Каждая позиция открывается с цитатой и первоисточником.</span></div>
        </section>

        <section className="recommendation-card recommendation-compact">
          <div className="opportunity-categories" role="tablist" aria-label="Приоритетная и запасные инициативы">{opportunities.map(item => <button role="tab" aria-selected={item.id === selected.id} className={item.id === selected.id ? 'is-selected' : ''} key={item.id} onClick={() => onSelect(item.id)}><span>{String(item.priority?.rank || opportunities.indexOf(item) + 1).padStart(2, '0')} · {CATEGORY_LABELS[item.category] || 'Возможность'}</span><small>{item.processName || item.title}</small></button>)}</div>
          <div className="recommendation-content">
            <div className="recommendation-label"><TrendingUp size={13} /> {selected.priority?.label || 'Приоритетная гипотеза'}</div>
            <h2>{selected.processName || selected.title}</h2>
            {selected.owner && <small className="priority-explanation">Владелец проверки: {selected.owner}</small>}
            {selected.input && selected.output && <div className="process-flow-preview"><div><span>Вход</span><strong>{selected.input}</strong></div><div><span>Измеримый результат процесса</span><strong>{selected.output}</strong></div></div>}
            {selected.processEvidence?.note && <div className={`process-evidence-note is-${selected.processEvidence.status}`}><ShieldCheck size={15} /><span><strong>{selected.processEvidence.status === 'published-process' ? 'Процесс описан в собственном источнике' : selected.processEvidence.status === 'customer-experience' ? 'Сигнал клиентского опыта' : 'Отраслевая гипотеза · не подтверждённый процесс'}</strong>{selected.processEvidence.note}</span></div>}
            <div className="compact-action"><span>Как проверяем решение</span><strong>{selected.processAction || selected.action}</strong></div>
            <button className="compact-metric" onClick={() => setDrawer('plan')}><Gauge size={17} /><span><small>Процесс, приёмка и риски</small>{selected.businessMetric || selected.metric}</span><ChevronRight size={16} /></button>
          </div>
          <div className="agent-inline"><div><span><Sparkles size={13} /> {ENTERPRISE ? 'Enterprise-решение Balanov.PRO' : primarySolution ? 'Решение этого сценария' : 'Сначала уточним границы задачи'}</span><strong>{ENTERPRISE ? 'Аудит → архитектура → команда → измеримый пилот' : primaryAgent}</strong>{ENTERPRISE ? <small>Заявка и первичный аудит — 0 ₽. Дальнейшие работы — по согласованному объёму.</small> : primarySolution && <small>{formatRubles(primarySolution.monthly)}/мес · установка {formatRubles(primarySolution.setup)} · запуск {primarySolution.launchDays} дн.</small>}</div><button onClick={() => setDrawer(ENTERPRISE ? 'enterprise' : 'connect')}>{ENTERPRISE || primarySolution ? 'Подключить 0 руб.' : 'Запросить аудит за 0 ₽'}<ArrowUpRight size={17} /></button></div>
          <button className="enterprise-entry" onClick={() => setDrawer('enterprise')}><span>{ENTERPRISE ? 'Кейсы, цены вендора и архитектура решения' : 'Нужна разработка или внедрение в крупном контуре?'}<small>Balanov.PRO · бесплатный аудит процессов и инфраструктуры</small></span><ArrowRight size={15} /></button>
          <div className="recommendation-links"><button onClick={() => setDrawer('plan')}>План и доказательства</button><button onClick={onSave}>{saved ? <Check size={13} /> : <Download size={13} />}{saved ? 'План сохранён' : 'Скачать план'}</button></div>
        </section>
      </div>

      <section className="market-radar" aria-label="Карта компании и рынка">
        <div className="market-radar-heading"><span><BarChart3 size={15} /> Карта компании и рынка</span><button onClick={() => setDrawer('market')}>Вся картина<ArrowRight size={13} /></button></div>
        <div className="market-radar-grid">
          <button onClick={() => setDrawer('competitors')}><Globe2 size={17} /><span><small>Конкуренты · {market.competitors.length}</small><strong>{market.competitors.length ? market.competitors.slice(0, 2).map(item => item.name).join(' · ') : 'Контур не подтверждён'}</strong></span><ChevronRight size={14} /></button>
          <button onClick={() => setDrawer('reviews')}><MessageSquareText size={17} /><span><small>Отзывы · {market.reviews.length} источников</small><strong>{ratedReview ? `${ratedReview.rating ? `Оценка ${ratedReview.rating}` : 'Есть оценки'}${ratedReview.count ? ` · ${ratedReview.count} отзывов` : ''}` : 'Открытых отзывов не найдено'}</strong></span><ChevronRight size={14} /></button>
          <button onClick={() => setDrawer('mentions')}><FileSearch size={17} /><span><small>Упоминания · {market.mentions.length}</small><strong>{market.mentions.length ? market.mentions[0].sourceTitle : 'Независимый след не найден'}</strong></span><ChevronRight size={14} /></button>
          <button onClick={() => setDrawer('news')}><Newspaper size={17} /><span><small>Динамика · свежие сигналы</small><strong>{latestNews ? latestNews.title.split(' - ')[0] : 'Свежих публикаций не найдено'}</strong></span><ChevronRight size={14} /></button>
          <button className="is-swot" onClick={() => setDrawer('swot')}><Layers3 size={17} /><span><small>SWOT · {swot.length} из 4 направлений</small><strong>{threat?.title || 'Выводы только по доказательствам'}</strong></span><ChevronRight size={14} /></button>
        </div>
      </section>

      <div className="result-bottom-links"><button onClick={() => setDrawer('sources')}><FileSearch size={13} /> {sources.length} источников</button><button onClick={() => setDrawer('alternatives')}>Сопоставимые предложения · {market.alternatives.length}</button><button onClick={() => setDrawer('documents')}><FolderOpen size={13} />{desktop ? 'Добавить документы' : 'Полная версия в Windows'}</button><button onClick={() => setDrawer('agents')}>24 решения экосистемы</button><button className="reset-action" onClick={onReset}><RotateCcw size={12} /> Новое исследование</button>{sources.some(source => source.kind === 'local-document') && desktop && <button onClick={onForgetFolder}><Trash2 size={12} /> Убрать локальные документы</button>}</div>
      {error && <div className="inline-error" role="alert">{error}</div>}
    </main>

    {drawer && <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDrawer(null); }}>
      <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-label={drawerTitles[drawer]}>
        <div className="drawer-header"><div><span className="section-kicker">{ENTERPRISE ? 'Balanov.PRO · ИИ-советник' : 'BAIagent · ИИ-советник для бизнеса'}</span><h2>{drawerTitles[drawer]}</h2></div><button autoFocus onClick={() => setDrawer(null)} aria-label="Закрыть"><X size={21} /></button></div>
        <div className="drawer-body">
          {drawer === 'offerings' && (offerings.length ? <div className="drawer-offerings">{offerings.map((item, index) => <article key={`${item.name}-${index}`}><div><span>{item.kind === 'service' ? 'Услуга' : 'Товар'}</span><strong>{item.price || 'Условия по запросу'}</strong></div><h3>{offeringDisplayName(item)}</h3>{item.image && <img className="drawer-product-image" src={item.image} alt={offeringDisplayName(item)} loading="lazy" />}<blockquote>«{item.quote}»</blockquote><SourceButton item={item} onOpen={onOpen} /></article>)}</div> : <EmptyState>В изученных страницах не найдено конкретных карточек. Добавьте каталог или прайс компании.</EmptyState>)}

          {drawer === 'competitors' && (market.competitors.length ? <><div className="drawer-context-note"><ShieldCheck size={16} /> Прямые внешние сайты из того же продуктового поискового поля. Это конкурентный контур, а не утверждение о равной доле рынка.</div><div className="drawer-sources">{market.competitors.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">Конкурентный кандидат · {host(item.url)}</span><h3>{item.name}</h3><p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>Открыть сайт конкурента</SourceButton></article>)}</div></> : <EmptyState>Прямые сайты конкурентов не подтверждены в этом запуске. Это ограничение поиска, а не отсутствие конкуренции.</EmptyState>)}

          {drawer === 'news' && (market.news.length ? <><div className="drawer-context-note"><Newspaper size={16} /> Публикации за последние 18 месяцев. Они показывают информационный фон, а не количественный индекс рынка.</div><div className="drawer-sources">{market.news.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">{dateLabel(item.publishedAt)}</span><h3>{item.title}</h3><p>{item.quote}</p><SourceButton item={item} onOpen={onOpen}>Открыть публикацию</SourceButton></article>)}</div></> : <EmptyState>Свежих релевантных отраслевых публикаций не найдено. Мы не подставляем старые или unrelated новости ради заполнения блока.</EmptyState>)}

          {drawer === 'reviews' && (market.reviews.length ? <div className="drawer-sources">{market.reviews.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">{item.rating ? `Оценка ${item.rating}` : 'Клиентский опыт'}{item.count ? ` · ${item.count} отзывов` : ''}</span><h3>{item.sourceTitle}</h3>{!!item.themes.length && <div className="review-themes">{item.themes.map(theme => <span key={theme}>{theme}</span>)}</div>}<p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>{host(item.url)}</SourceButton></article>)}</div> : <EmptyState>Подтверждённых отзывов в этом запуске нет. Это ограничение исследования, а не вывод о репутации.</EmptyState>)}

          {drawer === 'mentions' && (market.mentions.length ? <><div className="drawer-context-note"><ShieldCheck size={16} /> Независимые материалы именно о компании: профиль, клиенты, партнёрства и другие упоминания. Полноту текста и дату обращения видно у каждого источника.</div><div className="drawer-sources">{market.mentions.map((item, index) => <article key={`${item.sourceId}-${index}`}><span className="drawer-tag">{item.contentOrigin === 'full-page' ? 'Прочитана полная страница' : 'Поисковый фрагмент'} · {host(item.url)}</span><h3>{item.sourceTitle}</h3><p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>Открыть упоминание</SourceButton></article>)}</div></> : <EmptyState>Независимых упоминаний именно о компании в этом запуске не найдено. Это ограничение поискового корпуса, а не доказательство отсутствия цифрового следа.</EmptyState>)}

          {drawer === 'market' && <section className="market-analysis"><div className="market-observations">{market.observations.map(item => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>{!!market.priceComparisons.length ? <div className="price-comparisons"><h3>Только сопоставимые предложения</h3>{market.priceComparisons.map(item => <article key={item.name}><strong>{item.name}</strong><span>Компания: {item.own.price}</span><span>Внешнее предложение: {item.alternative.price}</span><SourceButton item={item.alternative} onOpen={onOpen}>Проверить альтернативу</SourceButton></article>)}</div> : <div className="drawer-context-note"><ShieldCheck size={16} /> Диапазон собственных карточек: {market.ownPriceRange ? `${money(market.ownPriceRange.min)} — ${money(market.ownPriceRange.max)}` : 'нет подтверждённых цен'}. Без сопоставимых пар рыночный диапазон не рассчитываем.</div>}<div className="market-gaps"><h3>Границы управленческого вывода</h3>{market.gaps.map(item => <p key={item}><ShieldCheck size={15} />{item}</p>)}</div>{profile.risks.length > 0 && <div className="external-risks"><h3>Внешние сигналы для проверки</h3>{profile.risks.map(item => <article key={`${item.sourceId}-${item.quote}`}><p>«{item.quote}»</p><SourceButton item={item} onOpen={onOpen}>{item.sourceTitle}</SourceButton></article>)}</div>}</section>}

          {drawer === 'alternatives' && (market.alternatives.length ? <div className="drawer-offerings">{market.alternatives.map((item, index) => <article key={`${item.sourceId}-${index}`}><div><span>Альтернатива{item.offeringName ? `: ${item.offeringName}` : ''}</span><strong>{item.price || 'Цена не указана'}</strong></div><h3>{offeringDisplayName(item)}</h3><blockquote>«{item.quote}»</blockquote><SourceButton item={item} onOpen={onOpen}>{host(item.url)}</SourceButton></article>)}</div> : <EmptyState>Сопоставимых предложений с подтверждающим фрагментом не найдено. Прямой конкурентный контур доступен в отдельном разделе.</EmptyState>)}

          {drawer === 'swot' && <div className="swot-grid">{Object.entries(SWOT_LABELS).map(([category, title]) => { const matches = swot.filter(item => item.category === category); return <article className={`swot-card swot-${category}`} key={category}><span>{title}</span>{matches.length ? matches.map(item => <button key={item.title} onClick={() => item.evidence?.[0] && onOpen(item.evidence[0])}><strong>{item.title}</strong><em>{item.evidence[0].sourceTitle}<ExternalLink size={12} /></em></button>) : <p>Недостаточно подтверждённых данных для отдельного пункта.</p>}</article>; })}</div>}

          {drawer === 'sources' && <>
            <div className="source-scope-tabs" role="tablist" aria-label="Тип материалов">
              <button role="tab" aria-selected={sourceScope === 'own'} className={sourceScope === 'own' ? 'is-selected' : ''} onClick={() => setSourceScope('own')}>Мои материалы · {sources.filter(source => ['company-site', 'local-document'].includes(source.kind)).length}</button>
              <button role="tab" aria-selected={sourceScope === 'web'} className={sourceScope === 'web' ? 'is-selected' : ''} onClick={() => setSourceScope('web')}>Веб · {sources.filter(source => !['company-site', 'local-document'].includes(source.kind)).length}</button>
            </div>
            <div className="drawer-sources">{visibleSources.map(source => <article key={source.id}><span className="drawer-tag">{source.kind === 'local-document' ? 'Документ на устройстве' : source.kind === 'company-site' ? 'Сайт компании' : source.kind === 'competitor-candidate' ? 'Сайт конкурента' : source.kind === 'news-snippet' ? 'Отраслевая новость' : 'Открытый внешний источник'}{!source.url.startsWith('local://') && ` · ${source.contentOrigin === 'full-page' ? 'Прочитана полная страница' : source.contentOrigin === 'search-snippet' ? 'Поисковый фрагмент' : 'Содержимое страницы'} · Обращение ${dateLabel(source.retrievedAt)}`}</span><h3>{source.title}</h3><p>{source.url}</p>{!source.url.startsWith('local://') && <SourceButton item={source} onOpen={onOpen}>Открыть источник</SourceButton>}</article>)}</div>
          </>}

          {drawer === 'plan' && <section className="drawer-plan"><span className="drawer-tag">Проверяемое решение, не обещание результата</span><h3>{selected.title}</h3><h4>Почему это важно именно здесь</h4><p>{selected.why}</p><h4>Что делаем</h4><p>{selected.action}</p><AuditContract opportunity={selected} /><h4>План реализации</h4><ol className="implementation-steps">{(selected.steps?.length ? selected.steps : ['Зафиксировать исходную метрику.', 'Собрать эталонный набор и правила остановки.', 'Провести ограниченный пилот.', 'Сравнить результат и принять решение.']).map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol><h4>Метрика</h4><p>{selected.metric}</p><section className="pilot-blueprint"><div className="pilot-heading"><Gauge size={16} /><strong>Рамка измеримого пилота</strong></div><dl><div><dt>Исходная метрика</dt><dd>{pilot.baseline}</dd></div><div><dt>Цель</dt><dd>{pilot.target}</dd></div><div><dt>Контрольный период</dt><dd>{pilot.period}</dd></div><div><dt>Данные</dt><dd>{pilot.data}</dd></div><div><dt>Подключения</dt><dd>{pilot.integrations}</dd></div><div><dt>Владелец</dt><dd>{pilot.owner}</dd></div><div><dt>Человеческий контроль</dt><dd>{pilot.humanControl}</dd></div><div><dt>Как считаем эффект</dt><dd>{pilot.effectFormula}</dd></div></dl><div className="pilot-decisions"><p><strong>Остановить</strong>{pilot.stopRule}</p><p><strong>Масштабировать</strong>{pilot.scaleRule}</p></div></section><h4>Основания</h4>{selected.evidence.map(item => <div className="plan-evidence" key={`${item.sourceId}-${item.quote}`}><blockquote>«{item.quote}»</blockquote><SourceButton item={item} onOpen={onOpen}>Открыть основание</SourceButton></div>)}{selected.unknowns.length > 0 && <div className="unknowns"><strong>Что нужно уточнить</strong>{selected.unknowns.map(item => <span key={item}>{item}</span>)}</div>}<button className="primary-action" onClick={onSave}><Download size={16} />{saved ? 'План сохранён' : 'Скачать план пилота'}</button></section>}

          {drawer === 'documents' && <section className="drawer-plan"><span className="drawer-tag">Локально и только с вашего разрешения</span><h3>Внутренние данные превращают обзор в экономический разбор</h3><p>Добавьте каталог, прайс, обращения, регламенты и отчёты. Советник свяжет рынок с маржой, реальным процессом и измеримым эффектом.</p>{desktop ? <><button className="documents-action folder-action" onClick={onAddFolder} disabled={folderBusy || adding}><FolderOpen size={18} />{folderBusy ? 'Проверяю папку…' : 'Выбрать рабочую папку'}<ChevronRight size={17} /></button><button className="documents-action" onClick={onAddDocuments} disabled={adding || folderBusy}><FilePlus2 size={18} />{adding ? 'Изучаю документы…' : 'Выбрать отдельные документы'}<ChevronRight size={17} /></button></> : <a className="documents-action" href={WINDOWS_DOWNLOAD} download><Monitor size={18} />Скачать полную версию для Windows<Download size={17} /></a>}<div className="folder-safety"><ShieldCheck size={15} /> Только выбранные материалы. Документы обрабатываются локально и не отправляются в облачную модель. Для свежего внешнего рынка нужен интернет.</div></section>}

          {drawer === 'connect' && <Onboarding companyName={companyName} website={research.requestedUrl} opportunity={selected} solution={primarySolution} onOpen={onOpen} />}
          {drawer === 'enterprise' && <EnterprisePanel research={normalizedResearch} profile={profile} opportunity={selected} solution={primarySolution} companyName={companyName} website={research.requestedUrl} onOpen={onOpen} />}
          {drawer === 'advisor' && <AdvisorChat research={normalizedResearch} analysis={result.analysis} opportunity={selected} onOpen={onOpen} desktop={desktop} />}
          {drawer === 'agents' && <AgentShowcase opportunity={selected} companyName={companyName} website={research.requestedUrl} onOpen={onOpen} />}
        </div>
      </aside>
    </div>}
  </>;
}
