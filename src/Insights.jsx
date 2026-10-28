import { Building2, ExternalLink, FileSearch, Globe2, MessageSquareText, ShieldCheck } from 'lucide-react';

const SWOT_LABELS = {
  strength: ['Сильные стороны', 'Что уже подтверждено материалами'],
  weakness: ['Точки внимания', 'Что стоит проверить в первую очередь'],
  opportunity: ['Возможности', 'Где можно провести измеримый пилот'],
  threat: ['Риски', 'Что видно по подтверждённым данным'],
};

function sentences(text = '') {
  return text.match(/[^.!?…]+[.!?…]?/g)?.map(value => value.trim()).filter(value => value.length >= 12 && value.length <= 420) || [];
}

export function businessOfferings(sources = []) {
  const seen = new Set();
  return sources.filter(source => source.kind === 'company-site').flatMap(source => sentences(source.text)
    .filter(sentence => /товар|услуг|продукт|продукц|решени|сервис|производ|постав|разработ/i.test(sentence))
    .map(quote => ({ quote, sourceId: source.id, sourceTitle: source.title, url: source.url })))
    .filter(item => {
      const key = item.quote.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function DigitalFootprint({ research, onOpen }) {
  const sources = research.sources || [];
  const external = sources.filter(source => source.kind === 'search-snippet');
  const local = sources.filter(source => source.kind === 'local-document');
  const reviews = external.filter(source => /отзыв|рейтинг|оценк|review|rating/i.test(`${source.title} ${source.text}`));
  const offerings = businessOfferings(sources);
  const channels = new Set(external.map(source => host(source.url)).filter(Boolean));
  return <section className="digital-footprint">
    <div className="section-heading-row"><div><span className="section-kicker">Не только сайт</span><h2>Цифровой след компании</h2><p>Открытые материалы, внешние упоминания и рабочие документы — раздельно, чтобы не смешивать факты.</p></div><span className="evidence-badge"><ShieldCheck size={16} /> Источник у каждого блока</span></div>
    <div className="footprint-metrics">
      <div><Globe2 size={18} /><strong>{sources.filter(source => source.kind === 'company-site').length}</strong><span>страниц компании</span></div>
      <div><MessageSquareText size={18} /><strong>{external.length}</strong><span>внешних упоминаний</span></div>
      <div><Building2 size={18} /><strong>{channels.size}</strong><span>внешних площадок</span></div>
      <div><FileSearch size={18} /><strong>{local.length}</strong><span>рабочих документов</span></div>
    </div>
    <div className="footprint-grid">
      <div className="offerings-panel"><h3>Товары, услуги и предложения</h3><p className="panel-intro">Дословные фрагменты с материалов компании.</p>{offerings.length ? <div className="offering-list">{offerings.map(item => <button key={`${item.sourceId}-${item.quote}`} onClick={() => onOpen(item)}><span>«{item.quote}»</span><small>{item.sourceTitle}<ExternalLink size={13} /></small></button>)}</div> : <div className="empty-evidence">В изученных страницах не найдено достаточно конкретного описания предложения.</div>}</div>
      <div className="mentions-panel"><h3>Внешние упоминания{reviews.length ? ' и отзывы' : ''}</h3><p className="panel-intro">То, что реально найдено в этом запуске. Отсутствие результата не означает отсутствие упоминаний в интернете.</p>{external.length ? <div className="mention-list">{external.slice(0, 4).map(source => <button key={source.id} onClick={() => onOpen(source)}><span><strong>{source.title}</strong><small>{host(source.url)}{/отзыв|рейтинг|оценк|review|rating/i.test(`${source.title} ${source.text}`) ? ' · отзывы или оценка' : ' · открытое упоминание'}</small></span><ExternalLink size={14} /></button>)}</div> : <div className="empty-evidence">Внешних упоминаний в этом запуске не найдено. Можно углубить исследование вручную или добавить рабочие материалы.</div>}</div>
    </div>
  </section>;
}

export function SwotOverview({ items = [], onOpen }) {
  return <section className="swot-section">
    <div className="section-heading-row"><div><span className="section-kicker">Для руководителя</span><h2>SWOT по найденным материалам</h2><p>Это проверяемые управленческие гипотезы, а не заключение аудита. Каждый заполненный пункт можно раскрыть через источник.</p></div></div>
    <div className="swot-grid">{Object.entries(SWOT_LABELS).map(([category, [title, subtitle]]) => {
      const matches = items.filter(item => item.category === category);
      return <article className={`swot-card swot-${category}`} key={category}><span>{title}</span><small>{subtitle}</small>{matches.length ? matches.map(item => <button key={`${category}-${item.title}`} onClick={() => item.evidence?.[0] && onOpen(item.evidence[0])}><strong>{item.title}</strong>{item.evidence?.[0] && <em>Источник: {item.evidence[0].sourceTitle}<ExternalLink size={12} /></em>}</button>) : <p>Недостаточно подтверждённых данных для вывода.</p>}</article>;
    })}</div>
  </section>;
}
