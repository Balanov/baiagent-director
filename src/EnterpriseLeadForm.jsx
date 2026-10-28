import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Mail, ShieldCheck, X } from 'lucide-react';
import { submitEnterpriseLead } from '../shared/enterprise-lead.js';

export default function EnterpriseLeadForm({ company, website, process, hypothesis, mailto, onClose }) {
  const [fields, setFields] = useState({ name: '', phone: '', email: '', company, way: 'Любой', comment: '' });
  const [state, setState] = useState({ status: 'idle', message: '' });
  const dialog = useRef(null);
  const firstInput = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstInput.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll('button:not([disabled]), input, select, textarea, a[href]') || [])];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [onClose]);
  const update = event => setFields(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setState({ status: 'sending', message: '' });
    try {
      await submitEnterpriseLead({ ...fields, website, process, hypothesis });
      setState({ status: 'success', message: 'Заявка принята сервером. Мы свяжемся с вами выбранным способом.' });
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Не удалось передать заявку.' });
    }
  }
  return <div className="enterprise-lead-overlay" onClick={event => { if (event.target === event.currentTarget && state.status !== 'sending') onClose(); }}>
    <section className="enterprise-lead-dialog" role="dialog" aria-modal="true" aria-labelledby="enterprise-lead-title" ref={dialog}>
      <button className="enterprise-lead-close" aria-label="Закрыть форму" onClick={onClose} disabled={state.status === 'sending'}><X size={19} /></button>
      {state.status === 'success' ? <div className="enterprise-lead-success" role="status"><CheckCircle2 size={35} /><h3 id="enterprise-lead-title">Заявка принята</h3><p>{state.message}</p><button className="enterprise-panel__primary-action" onClick={onClose}>Вернуться к аудиту</button></div> : <>
        <span className="enterprise-panel__label">Первичный аудит · 0 ₽</span>
        <h3 id="enterprise-lead-title">Обсудим процесс и данные вашей компании</h3>
        <p>Никакого автоматического заказа внедрения. Сначала согласуем процесс, ограничения и критерий результата.</p>
        <div className="enterprise-lead-context"><span>Процесс для разбора</span><strong>{process}</strong><small>{website}</small></div>
        <form onSubmit={submit}>
          <div className="enterprise-lead-fields">
            <label>Ваше имя *<input ref={firstInput} name="name" value={fields.name} onChange={update} autoComplete="name" maxLength={120} required /></label>
            <label>Компания<input name="company" value={fields.company} onChange={update} autoComplete="organization" maxLength={180} /></label>
            <label>Телефон<input name="phone" type="tel" value={fields.phone} onChange={update} autoComplete="tel" maxLength={80} /></label>
            <label>Email<input name="email" type="email" value={fields.email} onChange={update} autoComplete="email" maxLength={160} /></label>
            <label>Способ связи<select name="way" value={fields.way} onChange={update}><option>Любой</option><option>Telegram</option><option>WhatsApp</option><option>Звонок</option><option>Email</option></select></label>
            <label className="enterprise-lead-comment">Комментарий<textarea name="comment" value={fields.comment} onChange={update} maxLength={1500} placeholder="Что важно учесть при аудите?" /></label>
          </div>
          {state.status === 'error' && <p className="enterprise-lead-error" role="alert">{state.message} <a href={mailto}>Открыть подготовленное письмо</a></p>}
          <button className="enterprise-panel__primary-action enterprise-lead-submit" type="submit" disabled={state.status === 'sending'}><Mail size={18} />{state.status === 'sending' ? 'Передаём заявку…' : 'Отправить заявку на аудит'}<ArrowUpRight size={17} /></button>
        </form>
        <p className="enterprise-panel__mail-note"><ShieldCheck size={14} /> Заявка отправится только после нажатия. Дальнейшие работы — по согласованному объёму и прайсу.</p>
      </>}
    </section>
  </div>;
}
