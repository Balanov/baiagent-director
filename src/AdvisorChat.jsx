import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, CheckCircle2, Download, Globe2, LoaderCircle, LockKeyhole, MessageCircle, Monitor, Send, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { answerAdvisor } from '../shared/advisor.js';
import { createAdvisorActionOutcome, routeAdvisorCommand } from '../shared/advisor-actions.js';
import { DIRECTOR_WINDOWS_DOWNLOAD, ENTERPRISE_WINDOWS_DOWNLOAD } from '../shared/release.js';

const WINDOWS_DOWNLOAD = import.meta.env.MODE === 'enterprise' ? ENTERPRISE_WINDOWS_DOWNLOAD : DIRECTOR_WINDOWS_DOWNLOAD;
const LOCAL_SUGGESTIONS = ['Что вы поняли о моём бизнесе?', 'Где главный риск?', 'Что сделать на этой неделе?', 'Как вы работаете офлайн?'];
const WEB_SUGGESTIONS = ['Что продаёт компания?', 'Кто конкуренты?', 'Что говорят клиенты?', 'С чего начать пилот?'];
const STEP_LABELS = { audit: 'Аудит компании', direction: 'Выбор направления', plan: 'План проверки', pilot: 'Измеримый пилот', documents: 'Документы' };
const CONFIRMED_ACTIONS = new Set(['add_documents', 'exclude_documents', 'export_pilot', 'reset_session']);
const OUTCOME_LABELS = { completed: 'Выполнено', canceled: 'Отменено', error: 'Ошибка' };

function actionPreview(action, opportunity) {
  if (action.type === 'add_documents') return {
    title: 'Добавить документы в исследование?',
    detail: 'Откроется системный выбор файлов. После выбора документы будут прочитаны локально, а результат перестроен с их учётом.',
    confirmLabel: 'Выбрать документы',
  };
  if (action.type === 'exclude_documents') return {
    title: 'Исключить документы из текущего анализа?',
    detail: 'Реестр документов в сессии будет очищен, а результат перестроен без них. Исходные файлы на диске останутся.',
    confirmLabel: 'Исключить и перестроить',
  };
  if (action.type === 'export_pilot') return {
    title: 'Сохранить план пилота?',
    detail: `Для направления «${opportunity?.processName || opportunity?.title || 'выбранный процесс'}». Откроется системный диалог выбора места сохранения.`,
    confirmLabel: 'Выбрать место и сохранить',
  };
  return {
    title: 'Очистить текущую сессию?',
    detail: 'Текущие результаты, гипотезы и реестр документов в сессии удаляются безвозвратно; исходные файлы на диске остаются.',
    confirmLabel: 'Очистить сессию',
  };
}

function journalMessage(outcome) {
  return { role: 'advisor', kind: 'journal', status: outcome.status, text: outcome.message };
}

export default function AdvisorChat({ research, analysis, opportunity, onOpen, desktop = false, step = 'audit', context, actions, onAction }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const locked = busy || actionBusy || Boolean(pendingAction);

  useEffect(() => { setMessages([]); setBusy(false); setActionBusy(false); setPendingAction(null); setInput(''); }, [research.createdAt]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }, [messages, busy, actionBusy]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [step]);

  async function executeAction(action) {
    setActionBusy(true);
    let outcome;
    try {
      outcome = await onAction(action);
      if (!outcome || !['completed', 'canceled', 'error'].includes(outcome.status) || outcome.success !== (outcome.status === 'completed')) {
        throw new Error('операция не вернула проверяемый результат');
      }
    } catch (error) {
      outcome = createAdvisorActionOutcome('error', `Действие не выполнено: ${error.message}`);
    }
    setMessages(items => [...items, journalMessage(outcome)]);
    setActionBusy(false);
    return outcome;
  }

  async function confirmAction() {
    if (!pendingAction || actionBusy) return;
    setMessages(items => items.map(message => message.kind === 'action-preview' && message.status === 'pending' ? { ...message, status: 'busy' } : message));
    const outcome = await executeAction(pendingAction);
    setMessages(items => items.map(message => message.kind === 'action-preview' && message.status === 'busy' ? { ...message, status: outcome.status } : message));
    setPendingAction(null);
  }

  function cancelAction() {
    if (!pendingAction || actionBusy) return;
    setMessages(items => [
      ...items.map(message => message.kind === 'action-preview' && message.status === 'pending' ? { ...message, status: 'canceled' } : message),
      journalMessage(createAdvisorActionOutcome('canceled', 'Действие отменено до выполнения. Ничего не изменилось.')),
    ]);
    setPendingAction(null);
  }

  async function askLocal(question) {
    const text = String(question || '').trim();
    if (!text || locked) return;
    const routed = routeAdvisorCommand(text, {
      desktop,
      steps: Object.keys(STEP_LABELS),
      opportunities: analysis.opportunities,
      selectedOpportunityId: opportunity?.id,
      hasDocuments: research.sources.some(source => source.kind === 'local-document'),
    });
    setMessages(items => [...items, { role: 'user', text }]);
    setInput('');
    if (routed) {
      if (!routed.ok) {
        setMessages(items => [...items, journalMessage(createAdvisorActionOutcome('error', routed.error.message))]);
        return;
      }
      if (CONFIRMED_ACTIONS.has(routed.action.type)) {
        setMessages(items => [...items, { role: 'advisor', kind: 'action-preview', status: 'pending', action: routed.action }]);
        setPendingAction(routed.action);
        return;
      }
      await executeAction(routed.action);
      return;
    }

    const history = messages.filter(message => !message.error && !message.kind).slice(-8).map(message => ({ role: message.role, text: message.answer || message.text }));
    setBusy(true);
    try {
      const response = await window.director.advisor({ question: text, history, opportunityId: opportunity?.id });
      setMessages(items => [...items, { role: 'advisor', ...response }]);
    } catch (error) {
      setMessages(items => [...items, { role: 'advisor', error: true, answer: `Не смог завершить локальный ответ: ${error.message}. Исследование и источники остались доступны — попробуйте повторить вопрос.` }]);
    } finally { setBusy(false); }
  }

  function askNavigator(question) {
    const response = answerAdvisor(question, research, analysis, opportunity);
    setMessages(items => [...items, { role: 'user', text: question }, { role: 'advisor', ...response }]);
  }

  return <aside className={`advisor-chat ${desktop ? 'is-local' : 'is-web'}`} aria-label="Советник по исследованию">
    <header className="advisor-chat-header">
      <div className="advisor-avatar">{desktop ? <Sparkles size={22} strokeWidth={1.8} /> : <MessageCircle size={22} strokeWidth={1.8} />}</div>
      <div className="advisor-identity"><span className="advisor-step-label">{STEP_LABELS[step] || 'Исследование'}</span><h2>Советник</h2><div className={`advisor-status ${desktop ? 'is-local' : 'is-web'}`}>{desktop ? <ShieldCheck size={15} /> : <Globe2 size={15} />}<span>{desktop ? <><strong>100% безопасно</strong><small>На вашем ПК</small></> : <><strong>Веб-навигатор</strong><small>Открытые источники · не локальная модель</small></>}</span></div></div>
    </header>

    <div className="advisor-boundary">{desktop ? <LockKeyhole size={16} /> : <ShieldCheck size={16} />}<p>{desktop ? 'Диалог и документы работают локально после загрузки модели. Для свежего рынка нужен интернет.' : 'Готовые запросы к собранным данным. Без имитации полноценного ИИ-чата в браузере.'}</p></div>

    <div className="advisor-scroll" ref={scrollRef}>
      {context && <div className="advisor-step-context" key={step}>{context}</div>}
      {!messages.length && <div className="advisor-suggestions" aria-label="Готовые вопросы">{(desktop ? LOCAL_SUGGESTIONS : WEB_SUGGESTIONS).map(item => <button key={item} disabled={locked} onClick={() => desktop ? askLocal(item) : askNavigator(item)}>{item}</button>)}</div>}
      {!!messages.length && <div className="advisor-messages" aria-live="polite">{messages.map((message, index) => {
        const preview = message.kind === 'action-preview' ? actionPreview(message.action, opportunity) : null;
        return <article className={`advisor-message is-${message.role}`} key={`${message.role}-${index}`}>
          <div className="message-role">{message.role === 'user' ? <UserRound size={16} /> : <Bot size={16} />}<span>{message.kind === 'journal' ? 'Журнал действий' : message.role === 'user' ? 'Вы' : message.mode === 'evidence-navigator' ? 'Проверенный ответ по источникам' : desktop ? 'BAIagent · локально' : 'Навигатор'}</span></div>
          {message.notice && <p className="message-verification-note">{message.notice}</p>}
          {preview ? <><p><strong>{preview.title}</strong></p><p>{preview.detail}</p>{message.status === 'pending' && <div className="advisor-step-actions"><button type="button" className="advisor-next" onClick={confirmAction} disabled={actionBusy}>{preview.confirmLabel}</button><button type="button" className="advisor-text-action" onClick={cancelAction} disabled={actionBusy}>Отмена</button></div>}</> : <p>{message.kind === 'journal' && <strong>{OUTCOME_LABELS[message.status]}: </strong>}{message.answer || message.text}</p>}
          {!!message.citations?.length && <div className="message-citations">{message.citations.map((citation, citationIndex) => <button key={`${citation.sourceId}-${citationIndex}`} onClick={() => onOpen(citation)}><CheckCircle2 size={15} /><span>{citation.sourceTitle || citation.sourceId}</span><ArrowUpRight size={14} />{citation.quote && <small>«{citation.quote}»</small>}</button>)}</div>}
        </article>;
      })}{busy && <div className="advisor-thinking" role="status"><LoaderCircle className="spin" size={18} /> Сопоставляю вопрос с исследованием и нашим разговором…</div>}{actionBusy && <div className="advisor-thinking" role="status"><LoaderCircle className="spin" size={18} /> Выполняю действие и жду фактический результат…</div>}<div ref={endRef} /></div>}
    </div>

    {actions && <div className="advisor-step-actions">{actions}</div>}
    {desktop ? <form className="advisor-input" onSubmit={event => { event.preventDefault(); askLocal(input); }}>
      <input value={input} onChange={event => setInput(event.target.value)} disabled={locked} maxLength={1200} placeholder="Спросите о бизнесе или плане…" aria-label="Вопрос локальному советнику" />
      <button type="submit" disabled={!input.trim() || locked} aria-label="Отправить вопрос">{busy || actionBusy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
    </form> : <div className="advisor-windows-cta"><div><Monitor size={20} /><span><strong>Полный советник — в Windows</strong><small>Свободный диалог · свои документы · локально</small></span></div><a href={WINDOWS_DOWNLOAD} download>Скачать<Download size={16} /></a></div>}
  </aside>;
}
