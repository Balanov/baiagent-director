import { describe, expect, it } from 'vitest';
import { createBusinessProfile } from '../shared/business.js';

const own = (id, text, title = 'Компания') => ({ id, kind: 'company-site', url: `https://company.example/${id}`, title, text });

describe('software business classification', () => {
  it('recognises collaboration software from the company own sources', () => {
    const research = {
      companyName: 'Atlassian',
      sources: [
        own('site-1', "Atlassian's team collaboration software like Jira, Confluence and Trello helps teams complete shared work.", 'Atlassian'),
        own('site-2', 'The cloud platform connects apps, agents and digital products for software teams.', 'Atlassian Platform'),
      ],
    };
    const profile = createBusinessProfile(research);
    expect(profile.industry.id).toBe('software');
    expect(profile.industry.evidence).toMatchObject({ sourceId: 'site-1' });
    expect(profile.industry.evidence.quote).toMatch(/collaboration software/i);
  });

  it('distinguishes a legal information system developer from a law firm', () => {
    const research = {
      companyName: 'КонсультантПлюс',
      sources: [
        own('site-1', 'Продукты для юристов и бухгалтеров. Законы, судебная практика, исполнительное производство и производственный календарь. Купить систему.', 'КонсультантПлюс'),
        own('site-2', 'Компания является разработчиком справочной правовой системы и правообладателем программ. Информационные продукты можно настроить для отраслевых специалистов.', 'О компании и продуктах'),
      ],
    };
    const profile = createBusinessProfile(research);
    expect(profile.industry.id).toBe('software');
    expect(profile.industry.id).not.toBe('professional');
    expect(profile.industry.id).not.toBe('manufacturing');
    expect(profile.industry.evidence).toMatchObject({ sourceId: 'site-2' });
    expect(profile.industry.evidence.quote).toMatch(/разработчиком справочной правовой системы/i);
  });

  it('does not turn software implementation into professional services merely because of внедрение', () => {
    const profile = createBusinessProfile({
      sources: [own('site-1', 'Внедрение программного обеспечения и облачной платформы для бухгалтеров. Наша компания — разработчик программных продуктов.')],
    });
    expect(profile.industry.id).toBe('software');
  });

  it('keeps an actual legal services firm in the professional industry', () => {
    const profile = createBusinessProfile({
      sources: [own('site-1', 'Юридические услуги и правовая поддержка бизнеса. Адвокаты ведут арбитражные споры и сопровождают сделки.')],
    });
    expect(profile.industry.id).toBe('professional');
  });
});

describe('industry evidence quality', () => {
  it('uses the business description instead of an employee story mentioning restaurants', () => {
    const profile = createBusinessProfile({
      companyName: 'Сеть ресторанов',
      sources: [
        own('site-1', 'Мы придерживаемся подхода к быстрому питанию. Меню. Блины и супы.', 'Сеть ресторанов русской кухни'),
        own('site-2', '«Компания» — сеть ресторанов русской кухни. Теремок вырастил меня от повара до руководителя, наши сотрудники работают в ресторанах и обучают новых сотрудников ресторанного дела.', 'О компании'),
      ],
    });
    expect(profile.industry.id).toBe('food');
    expect(profile.industry.evidence.quote).toBe('«Компания» — сеть ресторанов русской кухни.');
    expect(profile.industry.evidence.quote).not.toMatch(/повара до руководителя/i);
  });
});

describe('identity-first business classification', () => {
  it('does not let secondary service categories outweigh an explicit specialist marketplace', () => {
    const profile = createBusinessProfile({
      companyName: 'Сервис специалистов',
      sources: [
        own('site-1', 'Сервис поиска специалистов: репетиторы, мастера по ремонту, тренеры и другие профи. Специалисты напишут сами, заказчики сравнят предложения.', 'Сервис специалистов'),
        own('site-2', 'Курьерская экспресс-доставка, доставка посылок, грузоперевозки и другие услуги курьеров в одной из категорий каталога.', 'Разные специалисты'),
      ],
    });
    expect(profile.industry.id).toBe('professional');
    expect(profile.industry.id).not.toBe('logistics');
    expect(profile.industry.evidence).toMatchObject({ sourceId: 'site-1' });
    expect(profile.industry.evidence.quote).toMatch(/сервис поиска специалистов/i);
    expect(profile.businessModel).toBe('service-marketplace');
    expect(profile.industry.label).toBe('Платформа поиска специалистов и услуг');
  });

  it('prefers a first-party business description to an unrelated industry review', () => {
    const profile = createBusinessProfile({
      companyName: 'CDEK',
      sources: [
        { id: 'review', kind: 'review-snippet', title: 'Отзывы о доставке', text: 'Клиент описывает доставку грузов и опыт работы транспортной компании.', url: 'https://reviews.example/cdek' },
        own('site-1', 'СДЭК — транспортная компания для доставки документов, товаров и грузов. Партнёры отслеживают статус отправлений.', 'CDEK'),
      ],
    });
    expect(profile.industry.id).toBe('logistics');
    expect(profile.industry.evidence.sourceId).toBe('site-1');
    expect(profile.industry.evidence.quote).toContain('транспортная компания');
  });
});
