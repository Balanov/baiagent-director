export const SUPPORTED_LANGUAGES = Object.freeze(['ru', 'en', 'zh', 'hi', 'es', 'ar']);
export const DEFAULT_LANGUAGE = 'ru';

export const LANGUAGE_TAGS = Object.freeze({
  ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', hi: 'hi-IN', es: 'es-ES', ar: 'ar-SA',
});

export const LANGUAGE_NAMES = Object.freeze({
  ru: 'Русский', en: 'English', zh: '中文', hi: 'हिन्दी', es: 'Español', ar: 'العربية',
});

export function normalizeLanguage(value, fallback = DEFAULT_LANGUAGE) {
  const primary = String(value || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return SUPPORTED_LANGUAGES.includes(primary) ? primary : fallback;
}

export function parseAcceptLanguage(header = '', fallback = DEFAULT_LANGUAGE) {
  const choices = String(header || '').split(',').map(part => {
    const [tag, ...parameters] = part.trim().split(';');
    const quality = Number(parameters.find(item => item.trim().startsWith('q='))?.split('=')[1] ?? 1);
    return { tag, quality: Number.isFinite(quality) ? quality : 0 };
  }).filter(item => item.tag && item.quality > 0).sort((a, b) => b.quality - a.quality);
  for (const choice of choices) {
    const primary = choice.tag.toLowerCase().split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(primary)) return primary;
    // An unsupported interface language deliberately falls back to English,
    // rather than selecting a lower-priority language the user did not prefer.
    if (primary !== '*') return 'en';
  }
  return fallback;
}

export function preferredLanguage({ explicit, stored, browser, os } = {}) {
  if (explicit && SUPPORTED_LANGUAGES.includes(String(explicit).toLowerCase().split('-')[0])) return normalizeLanguage(explicit);
  if (stored && SUPPORTED_LANGUAGES.includes(String(stored).toLowerCase().split('-')[0])) return normalizeLanguage(stored);
  return parseAcceptLanguage(browser || os || '', DEFAULT_LANGUAGE);
}

export function localeTag(language) {
  return LANGUAGE_TAGS[normalizeLanguage(language)] || LANGUAGE_TAGS.en;
}

export function textDirection(language) {
  return normalizeLanguage(language) === 'ar' ? 'rtl' : 'ltr';
}

function countPattern(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

/**
 * Detects the language of evidence, independently from the interface language.
 * Declared metadata is a hint; a substantial body in another script wins.
 */
export function detectContentLanguage(declared = '', text = '') {
  const body = String(text || '').slice(0, 60000);
  const scripts = [
    ['zh', countPattern(body, /[\u3400-\u4dbf\u4e00-\u9fff]/g), 5],
    ['hi', countPattern(body, /[\u0900-\u097f]/g), 5],
    ['ar', countPattern(body, /[\u0600-\u06ff]/g), 5],
    ['ru', countPattern(body, /[а-яё]/gi), 8],
  ].map(([language, count, minimum]) => ({ language, count, minimum }));
  const strongest = scripts.sort((a, b) => b.count - a.count)[0];
  const letterCount = countPattern(body, /\p{L}/gu);
  // A few foreign navigation items must not outweigh the actual page body.
  if (strongest?.count >= strongest.minimum && strongest.count >= letterCount * 0.02) return strongest.language;

  const words = body.toLowerCase().match(/[\p{L}]+/gu) || [];
  const sample = words.slice(0, 5000).join(' ');
  const spanish = countPattern(sample, /\b(?:el|la|los|las|de|que|y|para|con|una|empresa|servicios|productos|clientes|precio)\b/g)
    + countPattern(sample, /[áéíóúñ¿¡]/g) * 2;
  const english = countPattern(sample, /\b(?:the|and|for|with|our|your|company|services|products|customers|price|business)\b/g);
  if (spanish >= 3 && spanish > english * 0.65) return 'es';
  if (english >= 2) return 'en';
  const metadata = normalizeLanguage(declared, '');
  return metadata || DEFAULT_LANGUAGE;
}

export function researchLanguage(research = {}) {
  // The selected research language is an interface/analysis contract. Individual
  // sources may use another language and must never silently switch this contract.
  // Legacy saved research has no explicit language and follows the original Russian pipeline.
  return research.language && SUPPORTED_LANGUAGES.includes(research.language) ? research.language : DEFAULT_LANGUAGE;
}

export const SEARCH_MARKETS = Object.freeze({
  ru: { tag: 'ru-RU', country: 'RU', news: 'RU:ru', wikipedia: 'ru' },
  en: { tag: 'en-US', country: 'US', news: 'US:en', wikipedia: 'en' },
  zh: { tag: 'zh-CN', country: 'CN', news: 'CN:zh-Hans', wikipedia: 'zh' },
  hi: { tag: 'hi-IN', country: 'IN', news: 'IN:hi', wikipedia: 'hi' },
  es: { tag: 'es-ES', country: 'ES', news: 'ES:es', wikipedia: 'es' },
  ar: { tag: 'ar-SA', country: 'SA', news: 'SA:ar', wikipedia: 'ar' },
});
