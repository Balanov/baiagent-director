import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, CheckCircle2, Download, LoaderCircle, LockKeyhole, Monitor, Send, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { answerAdvisor } from '../shared/advisor.js';
import { DIRECTOR_WINDOWS_DOWNLOAD, ENTERPRISE_WINDOWS_DOWNLOAD } from '../shared/release.js';

const WINDOWS_DOWNLOAD = import.meta.env.MODE === 'enterprise' ? ENTERPRISE_WINDOWS_DOWNLOAD : DIRECTOR_WINDOWS_DOWNLOAD;
const LOCAL_SUGGESTIONS = ['Что вы поняли о моём бизнесе?', 'Где главный риск?', 'Что сделать на этой неделе?', 'Как вы работаете офлайн?'];
const WEB_SUGGESTIONS = ['Что продаёт компания?', 'Кто конкуренты?', 'Что говорят клиенты?', 'С чего начать пилот?'];

export default function AdvisorChat({ research, analysis, opportunity, onOpen, desktop = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { setMessages([]); setBusy(false); }, [research.createdAt]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  async function askLocal(question) {
    const text = String(question || '').trim();
    if (!text || busy) return;
    const history = messages.filter(message => !message.error).slice(-8).map(message => ({ role: message.role, text: message.answer || message.text }));
    setMessages(items => [...items, { role: 'user', text }]);
    setInput(''); setBusy(true);
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

  return <section className={`advisor-chat ${desktop ? 'is-local' : 'is-web'}`}>
    <div className="advisor-chat-intro">
      <div className="advisor-avatar">{desktop ? <Sparkles size={24} /> : <Bot size={24} />}</div>
      <div><span className="section-kicker">{desktop ? 'Локальный ИИ · свободный диалог' : 'Веб · экспресс-навигатор'}</span><h3>{desktop ? 'Обсудим бизнес, рынок и следующий шаг' : 'Быстрые ответы по этому исследованию'}</h3><p>{desktop ? 'Можно уточнять, спорить и спрашивать о моей работе. Помню контекст разговора, отделяю факты от гипотез и не выдаю неизвестное за известное.' : 'Здесь доступны готовые запросы к собранным данным. Свободный диалог с локальной моделью, уточнения и ваши документы — в Windows-версии.'}</p></div>
    </div>
    <div className="advisor-boundary">{desktop ? <LockKeyhole size={15} /> : <ShieldCheck size={15} />}{desktop ? 'После загрузки модели диалог и документы работают локально, в том числе офлайн. Для свежего рынка нужен интернет.' : 'Без имитации полноценного ИИ-чата в браузере'}</div>
    {!messages.length && <div className="advisor-suggestions">{(desktop ? LOCAL_SUGGESTIONS : WEB_SUGGESTIONS).map(item => <button key={item} disabled={busy} onClick={() => desktop ? askLocal(item) : askNavigator(item)}>{item}</button>)}</div>}
    {!!messages.length && <div className="advisor-messages">{messages.map((message, index) => <div className={`advisor-message is-${message.role}`} key={`${message.role}-${index}`}>
      <div className="message-role">{message.role === 'user' ? <UserRound size={15} /> : <Bot size={15} />}<span>{message.role === 'user' ? 'Вы' : desktop ? 'BAIagent · локально' : 'Навигатор'}</span></div>
      <p>{message.answer || message.text}</p>
      {!!message.citations?.length && <div className="message-citations">{message.citations.map((citation, citationIndex) => <button key={`${citation.sourceId}-${citationIndex}`} onClick={() => onOpen(citation)}><CheckCircle2 size={13} /><span>{citation.sourceTitle || citation.sourceId}</span><ArrowUpRight size={12} />{citation.quote && <small>«{citation.quote}»</small>}</button>)}</div>}
    </div>)}{busy && <div className="advisor-thinking"><LoaderCircle className="spin" size={17} /> Сопоставляю вопрос с исследованием и нашим разговором…</div>}<div ref={endRef} /></div>}
    {desktop ? <form className="advisor-input" onSubmit={event => { event.preventDefault(); askLocal(input); }}>
      <input value={input} onChange={event => setInput(event.target.value)} disabled={busy} maxLength={1200} placeholder="Спросите о бизнесе, рынке или моей работе…" aria-label="Вопрос локальному советнику" />
      <button type="submit" disabled={!input.trim() || busy} aria-label="Отправить вопрос">{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button>
    </form> : <div className="advisor-windows-cta"><div><Monitor size={20} /><span><strong>Полный советник — бесплатно в Windows</strong><small>Свободный диалог · свои документы · офлайн после загрузки модели</small></span></div><a href={WINDOWS_DOWNLOAD} download>Скачать<Download size={16} /></a></div>}
  </section>;
}
