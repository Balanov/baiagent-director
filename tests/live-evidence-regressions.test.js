import { describe, expect, it } from 'vitest';
import { createMarketSearchPlan, isCompetitorCandidate, isRelevantCompanyReview, relevantMarketQuote } from '../shared/market-plan.js';

const kamaz = {
  companyName: 'КАМАЗ', requestedUrl: 'https://kamaz.ru/',
  sources: [{ kind: 'company-site', url: 'https://kamaz.ru/', title: 'КАМАЗ', text: 'Производство грузовых автомобилей.', offerings: [{ name: 'КАМАЗ 54901' }] }],
  offerings: [{ name: 'КАМАЗ 54901' }],
};
const atlassianPlan = createMarketSearchPlan({
  companyName: 'Atlassian',
  sources: [{ kind: 'company-site', url: 'https://www.atlassian.com/', title: 'Atlassian', text: 'Team collaboration software and a cloud platform for shared work and project management.' }],
  offerings: [],
}, { industry: { id: 'software' } });

describe('regressions found by live evidence arbitration', () => {
  it('rejects an empty review shell even when the title contains a model number', () => {
    expect(isRelevantCompanyReview({
      title: 'КАМАЗ 54901 отзывы владельцев | Авито', contentOrigin: 'full-page',
      url: 'https://www.avito.ru/otzyvy_vladelcev/semi_trailer_truck/kamaz/54901',
      text: 'Авито — объявления на сайте Авито. Избранное Корзина Вход и регистрация Разместить объявление. Политика конфиденциальности. Оплачивая услуги на Авито, вы принимаете оферту. Авито использует рекомендательные технологии.',
    }, kamaz)).toBe(false);
  });

  it('rejects a third-party supplier page with zero reviews', () => {
    expect(isRelevantCompanyReview({
      title: 'ООО «АВТОРОСТ» - Поставщик грузовых автомобилей Камаз', contentOrigin: 'full-page',
      url: 'https://www.rateshops.ru/info/ooo-avtorost',
      text: 'Реальные отзывы на ООО «АВТОРОСТ». Рейтинг 0(0) Отзывов 0 (0 положительных, 0 отрицательных). Занимаемся сборкой и продажей спецтехники на шасси Камаз.',
    }, kamaz)).toBe(false);
  });

  it('does not treat a Pinterest ideas page as a software competitor', () => {
    expect(isCompetitorCandidate({
      title: 'Innovative Project Management Software', url: 'https://ru.pinterest.com/ideas/innovative-project-management-software/123/',
      text: 'Find and save ideas about innovative project management software on Pinterest. Discover best ideas and inspiration.',
    }, atlassianPlan, 'https://www.atlassian.com/')).toBe(false);
  });

  it('quotes collaboration evidence instead of a generic AI definition', () => {
    const source = { title: 'Team Collaboration Software for Gmail | Gmelius', text: 'An AI agent is software that can take a goal and carry it out. Gmelius provides team collaboration through shared inboxes and helps teams manage work.' };
    expect(relevantMarketQuote(source, atlassianPlan)).toBe('Team Collaboration Software for Gmail | Gmelius');
  });

  it('quotes the commercial project-management claim instead of a customer occupation list', () => {
    const source = { text: 'They are product developers, woodworkers, music industry folks, logistics pros, publishers, event planners, marketers, architects and software designers. Basecamp is project management software for teams that need to manage projects and coordinate work.' };
    expect(relevantMarketQuote(source, atlassianPlan)).toContain('project management software');
  });

  it('does not attribute the separate CDEK Shopping service to the logistics company', () => {
    const cdek = {
      companyName: 'CDEK', requestedUrl: 'https://www.cdek.ru/',
      sources: [{ kind: 'company-site', url: 'https://www.cdek.ru/', title: 'CDEK', text: 'Транспортная компания и доставка грузов для бизнеса.' }],
      offerings: [], marketContext: { industry: 'logistics', subject: 'доставка для бизнеса' },
    };
    expect(isRelevantCompanyReview({
      title: 'CDEK. Shopping — отзывы', url: 'https://reviews.yandex.ru/shop/cdek.shopping',
      text: '11289 отзывов про интернет-магазин CDEK. Shopping. Я заказывал товар из-за границы, доставка заняла месяц.',
    }, cdek)).toBe(false);
  });
});
