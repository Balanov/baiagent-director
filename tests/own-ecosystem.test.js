import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OwnEcosystemResult from '../src/OwnEcosystemResult.jsx';
import { LocaleProvider, translateUi } from '../src/locale.jsx';
import { SUPPORTED_LANGUAGES } from '../shared/locale.js';
import { isOwnEcosystemWebsite, ownEcosystemHostname, OWN_ECOSYSTEM_DOMAINS } from '../shared/own-ecosystem.js';

const ownUrls = [
  'https://balanov.pro/', 'https://balanov.pro/all', 'https://balanov.pro/team',
  'https://baiagent.ru/', 'https://baiagent.ru/franchise', 'https://baiagent.ru/xray/',
  'https://baiagent.ru/free/', 'https://baiagent.ru/advisor/',
  'https://2aos.ru/', 'https://attractor.network/', 'https://paritet.dev/',
  'https://svoi.balanov.pro/', 'https://startpervyh.ru/', 'https://antonkids.ru/',
];

describe('Пасхалка для продуктов экосистемы', () => {
  it.each(ownUrls)('узнаёт собственный адрес %s', url => {
    expect(isOwnEcosystemWebsite(url)).toBe(true);
  });

  it.each(OWN_ECOSYSTEM_DOMAINS)('узнаёт %s с www, без схемы, с путём и в верхнем регистре', domain => {
    expect(isOwnEcosystemWebsite(`WWW.${domain.toUpperCase()}/some/path?source=test`)).toBe(true);
    expect(isOwnEcosystemWebsite(`  https://${domain}/all  `)).toBe(true);
    expect(ownEcosystemHostname(`http://sub.${domain}:8080/path`)).toBe(`sub.${domain}`);
  });

  it.each([
    'https://example.com/', 'https://balanov.pro.evil.example/', 'https://notbaiagent.ru/',
    'https://evil.example/?next=https://balanov.pro/all', 'https://balanov.pro@evil.example/',
    'baiagent ru', '', null, 'javascript:alert(1)',
  ])('не перехватывает чужой или некорректный адрес %s', url => {
    expect(isOwnEcosystemWebsite(url)).toBe(false);
  });

  it.each(SUPPORTED_LANGUAGES)('переводит весь экран на язык %s', language => {
    for (const key of ['own.kicker', 'own.title', 'own.message', 'own.action', 'own.note']) {
      expect(translateUi(language, key)).not.toBe(key);
      expect(translateUi(language, key).length).toBeGreaterThan(2);
    }
  });

  it('показывает отдельный экран и возвращает к проверке другой компании', () => {
    const html = renderToStaticMarkup(createElement(LocaleProvider, null, createElement(OwnEcosystemResult, { onReset: () => {} })));
    expect(html).toContain('Не может быть!');
    expect(html).toContain('Пожалуй, это единственная компания без точек роста — всё уже идеально! :)');
    expect(html).toContain('Проверить другую компанию');
    expect(html).toContain('не результат аудита');
    expect(html).toContain('type="button"');
  });
});
