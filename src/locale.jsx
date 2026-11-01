import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, localeTag, normalizeLanguage, preferredLanguage, textDirection } from '../shared/locale.js';
import { UI_TRANSLATIONS } from './ui-translations.js';

const LocaleContext = createContext(null);

function initialLanguage() {
  if (typeof window === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  let stored = '';
  try { stored = window.localStorage.getItem('baiagent.uiLanguage') || ''; } catch { /* Storage is optional. */ }
  return preferredLanguage({ explicit: query, stored, browser: window.navigator.languages?.join(',') || window.navigator.language });
}

const ZERO_CURRENCIES = Object.freeze({ ru: 'RUB', en: 'USD', zh: 'CNY', hi: 'INR', es: 'EUR', ar: 'SAR' });

export function localizeZeroPrice(language, text) {
  const normalized = normalizeLanguage(language);
  if (normalized === 'ru') return String(text);
  const zero = new Intl.NumberFormat(localeTag(normalized), {
    style: 'currency', currency: ZERO_CURRENCIES[normalized], maximumFractionDigits: 0,
  }).format(0);
  return String(text).replaceAll('0 ₽', zero);
}

function translate(language, key, params = {}) {
  const template = UI_TRANSLATIONS[language]?.[key] ?? UI_TRANSLATIONS.en[key] ?? UI_TRANSLATIONS.ru[key] ?? key;
  const text = String(template).replace(/\{(\w+)\}/g, (match, name) => params[name] === undefined ? match : String(params[name]));
  return localizeZeroPrice(language, text);
}

export function LocaleProvider({ children }) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = localeTag(language);
    document.documentElement.dir = textDirection(language);
    try { window.localStorage.setItem('baiagent.uiLanguage', language); } catch { /* Storage is optional. */ }
    const url = new URL(window.location.href);
    if (url.searchParams.get('lang') !== language) {
      url.searchParams.set('lang', language);
      window.history.replaceState(window.history.state, '', url);
    }
    document.title = translate(language, 'meta.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', translate(language, 'meta.description'));
  }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage,
    direction: textDirection(language),
    locale: localeTag(language),
    t: (key, params) => translate(language, key, params),
  }), [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}

export function translateUi(language, key, params = {}) {
  return translate(normalizeLanguage(language), key, params);
}

export function LanguageSwitcher({ compact = false }) {
  const { language, setLanguage, t } = useLocale();
  return <label className={`language-switcher ${compact ? 'is-compact' : ''}`} title={t('language.label')}>
    <Languages size={16} aria-hidden="true" />
    <span className="sr-only">{t('language.label')}</span>
    <select value={language} onChange={event => setLanguage(event.target.value)} aria-label={t('language.label')}>
      {SUPPORTED_LANGUAGES.map(item => <option key={item} value={item}>{LANGUAGE_NAMES[item]}</option>)}
    </select>
  </label>;
}
