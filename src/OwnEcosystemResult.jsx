import { ArrowRight, Heart, PartyPopper } from 'lucide-react';
import { useLocale } from './locale.jsx';
import './own-ecosystem.css';

export default function OwnEcosystemResult({ onReset }) {
  const { t } = useLocale();
  return <main className="own-ecosystem">
    <section className="own-ecosystem-card" aria-labelledby="own-ecosystem-title">
      <div className="own-ecosystem-icon" aria-hidden="true"><PartyPopper size={34} strokeWidth={1.7} /></div>
      <span className="own-ecosystem-kicker"><Heart size={14} aria-hidden="true" />{t('own.kicker')}</span>
      <h1 id="own-ecosystem-title">{t('own.title')}</h1>
      <p>{t('own.message')}</p>
      <button type="button" onClick={onReset}>{t('own.action')}<ArrowRight size={19} aria-hidden="true" /></button>
      <small>{t('own.note')}</small>
    </section>
  </main>;
}
