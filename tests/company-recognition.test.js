import { describe, expect, it } from 'vitest';
import { companyNameFrom, companyNameFromPages, parsePage } from '../electron/research.mjs';
import { createBusinessProfile } from '../shared/business.js';
import { marketSubject } from '../shared/market-plan.js';
import { enterpriseRecommendations } from '../shared/enterprise.js';

const kamazText = 'Производственная система и завод-изготовитель. Серийные автомобили, самосвалы, седельные тягачи, бортовые автомобили и шасси. Лизинг от производителя, лизинговые программы с партнерами, банковские реквизиты.';

describe('company identity and industry recognition', () => {
  it('does not treat a legal form or generic official-site title as the company', () => {
    const sources = [
      { title: 'Официальный сайт ПАО', siteName: '' },
      { title: "Официальный сайт ПАО 'КАМАЗ'", siteName: "Официальный сайт ПАО 'КАМАЗ'" },
    ];
    expect(companyNameFrom(sources[0], 'https://www.kamaz.ru/')).toBe('KAMAZ');
    expect(companyNameFromPages(sources, 'https://www.kamaz.ru/')).toBe('КАМАЗ');
  });

  it('uses a confirmed organization or repeated title brand instead of a homepage slogan', () => {
    const consultant = [
      { title: '"КонсультантПлюс" - законодательство РФ: кодексы и законы', text: 'Справочная правовая система.' },
      { title: 'Новости КонсультантПлюс', organizationName: 'КонсультантПлюс', text: 'О компании.' },
    ];
    const restaurant = [
      { title: 'Теремок - официальный сайт сети ресторанов русской кухни', text: 'Сеть ресторанов.' },
      { title: 'О компании - Теремок', text: 'О сети ресторанов.' },
    ];
    expect(companyNameFromPages(consultant, 'https://www.consultant.ru/')).toBe('КонсультантПлюс');
    expect(companyNameFromPages(restaurant, 'https://teremok.ru/')).toBe('Теремок');
    expect(companyNameFromPages([{ title: 'Выбирайте лучшее для ваших задач', text: 'Описание услуг.' }], 'https://profi.ru/')).toMatch(/^profi$/i);
  });

  it('does not let manufacturer leasing navigation outweigh actual production', () => {
    const research = { companyName: 'КАМАЗ', sources: [{ id: 'site-1', kind: 'company-site', title: 'КАМАЗ', url: 'https://kamaz.ru/', text: kamazText }] };
    const profile = createBusinessProfile(research);
    expect(profile.industry.id).toBe('manufacturing');
    expect(profile.industry.evidence.quote).not.toContain('Лизинговые программы');
    expect(marketSubject(research, profile).subject).toBe('грузовые автомобили');
  });

  it('recognises common first-person manufacturing wording', () => {
    const research = { companyName: 'АгроТех', sources: [{ id: 'site-1', kind: 'company-site', title: 'АгроТех', text: 'Производим сельскохозяйственную технику и поставляем запасные части.' }] };
    expect(createBusinessProfile(research).industry.id).toBe('manufacturing');
  });

  it('still recognises a bank from its core financial services', () => {
    const research = { companyName: 'Банк', sources: [{ id: 'site-1', kind: 'company-site', title: 'Банк', text: 'Банк для бизнеса и частных клиентов. Открыть счёт и вклад, оформить дебетовую карту и ипотеку.' }] };
    expect(createBusinessProfile(research).industry.id).toBe('finance');
  });

  it('recognises the courier business instead of an ancillary shopping service', () => {
    const research = { companyName: 'CDEK', sources: [
      { id: 'site-1', kind: 'company-site', title: 'www.cdek.ru', text: '' },
      { id: 'web-1', kind: 'review-snippet', title: 'CDEK.Shopping — отзывы', text: 'Отзыв о покупке одежды и обуви через интернет-магазин CDEK.Shopping.' },
      { id: 'web-2', kind: 'search-snippet', title: 'СДЭК — услуги курьерской службы', text: 'Курьерская доставка грузов и документов для организаций. Логистические услуги и отправления для бизнеса.' },
      { id: 'web-3', kind: 'search-snippet', title: 'СДЭК отслеживание посылок', text: 'Служба доставки и отслеживание отправлений по трек-номеру.' },
    ] };
    const profile = createBusinessProfile(research);
    expect(profile.industry.id).toBe('logistics');
    expect(profile.industry.evidence.quote).toMatch(/курьерск|доставк|отправлени/i);
  });

  it('does not cut an industry citation before the matching service or append interface debris', () => {
    const texts = [
      `${'Описание клиентского опыта и доставки без лишних обещаний '.repeat(12)}ShoppingКурьерские услуги4,317 498 оценок11 270отзывовЧитать отзывыПерейти на сайтcdek.`,
      'ShoppingКурьерские услуги4,317 498 оценок11 270отзывовЧитать отзывыПерейти на сайтcdek.',
    ];
    for (const text of texts) {
      const research = { companyName: 'CDEK', sources: [{ id: 'web-1', kind: 'review-snippet', title: 'CDEK.Shopping — отзывы', url: 'https://reviews.example/cdek', text }] };
      const quote = createBusinessProfile(research).industry.evidence.quote;
      expect(quote).toContain('Курьерские услуги');
      expect(quote).not.toContain('оценок');
      expect(quote).not.toContain('Читать отзывы');
      expect(text).toContain(quote);
    }
  });
});

describe('linked table products and vendor relevance', () => {
  it('extracts each linked model, its own image and a source-specific URL', () => {
    const page = parsePage(`<!doctype html><html><head><title>Самосвалы</title></head><body><h1>Самосвалы</h1><table><tr>
      <td><a href="/models/a"><img src="/images/a.jpg"></a></td><td><a href="/models/a">Модель А-100</a></td><td>6х6</td><td>35000 кг</td></tr>
      <tr><td><a href="/models/b"><img data-src="/images/b.jpg"></a></td><td><a href="/models/b">Модель Б-200</a></td><td>6х4</td><td>25000 кг</td></tr>
    </table></body></html>`, 'https://manufacturer.example/catalog/trucks/', 'site-1');
    expect(page.offerings).toHaveLength(2);
    expect(page.offerings[0]).toMatchObject({ name: 'Модель А-100', image: 'https://manufacturer.example/images/a.jpg', url: 'https://manufacturer.example/models/a' });
    expect(page.offerings[0].quote).toContain('Модель А-100 · 6х6 · 35000 кг');
    expect(page.offerings[1].image).toBe('https://manufacturer.example/images/b.jpg');
  });

  it('ignores unrelated external bank and ecommerce text when matching vendor cases', () => {
    const result = enterpriseRecommendations({
      research: {
        offerings: [{ name: 'Модель А-100', displayName: 'Модель А-100' }],
        sources: [{ kind: 'competitor-candidate', title: 'Случайный источник', text: 'Персонализация банка, карточный бизнес, интернет-магазин, отзывы, модерация и CatBoost.' }],
      },
      profile: { industry: { id: 'manufacturing', label: 'Производство и продажа продукции' }, topOfferings: ['Модель А-100'] },
      opportunity: { processName: 'Передача требований из продаж в производство', action: 'Проверить спецификацию и версии документов.' },
    });
    expect(result.cases.map(item => item.id)).not.toContain('ai-bank-personalization');
    expect(result.cases.map(item => item.id)).not.toContain('ai-ecommerce-personalization');
    expect(result.cases.map(item => item.id)).not.toContain('ai-review-nlp');
  });
});
