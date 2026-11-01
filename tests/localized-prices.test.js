import { describe, expect, it } from 'vitest';
import { translateUi } from '../src/locale.jsx';
import { UI_TRANSLATIONS } from '../src/ui-translations.js';
import { SUPPORTED_LANGUAGES, localeTag } from '../shared/locale.js';

const currencies = { ru: 'RUB', en: 'USD', zh: 'CNY', hi: 'INR', es: 'EUR', ar: 'SAR' };
const zeroKeys = ['promise.free', 'download.windowsFull', 'pilot.connect', 'onboarding.next', 'onboarding.safety', 'onboarding.selfPlan'];

describe('localized zero price', () => {
  it.each(SUPPORTED_LANGUAGES.filter(language => language !== 'ru'))('uses the selected %s language currency instead of rubles', language => {
    const zero = new Intl.NumberFormat(localeTag(language), {
      style: 'currency', currency: currencies[language], maximumFractionDigits: 0,
    }).format(0);
    for (const key of zeroKeys) {
      const translated = translateUi(language, key);
      expect(translated, `${language}/${key}`).not.toContain('0 ₽');
      expect(translated, `${language}/${key}`).toContain(zero);
    }
  });

  it('keeps Russian prices and does not convert nonzero ruble amounts', () => {
    expect(translateUi('ru', 'promise.free')).toBe('Аудит 0 ₽');
    for (const language of SUPPORTED_LANGUAGES) {
      for (const [key, text] of Object.entries(UI_TRANSLATIONS[language])) {
        if (!zeroKeys.includes(key)) expect(translateUi(language, key), `${language}/${key}`).toBe(text);
      }
    }
  });
});
