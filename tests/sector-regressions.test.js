import { describe, expect, it } from 'vitest';
import { companyNameFrom, companyNameFromPages, parsePage } from '../electron/research.mjs';
import { createEvidenceBasedFallback } from '../shared/fallback.js';

function analysisFor(sources, requestedUrl, companyName) {
  const research = {
    companyName,
    requestedUrl,
    sources,
    offerings: sources.flatMap(source => source.offerings || []),
  };
  return createEvidenceBasedFallback(sources, requestedUrl, research);
}

describe('marketplace identity and catalog', () => {
  it('recovers a hostname-confirmed brand from the descriptive lead, not the slogan', () => {
    const source = {
      title: 'Выбирайте профи',
      text: 'Профи.ру — сервис поиска специалистов. Заказчики сравнивают анкеты, а специалисты откликаются на задачи.',
    };
    expect(companyNameFrom(source, 'https://profi.ru/')).toBe('Профи.ру');
    expect(companyNameFrom({ title: 'Выбирайте лучшее', text: 'Профи.ру — сервис поиска специалистов.' }, 'https://unrelated.example/')).not.toBe('Профи.ру');
  });

  it('keeps semantic marketplace categories but rejects customer request boards as company offerings', () => {
    const board = parsePage(`<main><h1>Настройка локальной сети</h1><h2>Детали задачи</h2><p>Настроить сервер заказчика.</p><p>Похожие заказы. Отклики исполнителей. Специалисты откликнутся.</p><article><h3>Настройка серверов</h3></article></main>`, 'https://profi.ru/it/network/', 'site-2');
    expect(board.offerings).toEqual([]);

    const page = parsePage(`<html><head><title>Выбирайте профи</title><meta name="description" content="Профи.ру — сервис поиска специалистов"></head><body><main><h1>Профи.ру</h1><p>Сервис поиска специалистов. Специалисты напишут сами.</p><a href="/tutors/"><span><span data-shmid="category_name">Репетиторы</span><span data-shmid="category_count">100 специалистов</span></span></a><a href="/repair/"><span><span data-shmid="category_name">Мастера по ремонту</span><span data-shmid="category_count">200 специалистов</span></span></a></main></body></html>`, 'https://profi.ru/', 'site-1');
    expect(page.offerings.map(item => item.name)).toEqual(['Репетиторы', 'Мастера по ремонту']);
    expect(page.offerings.every(item => item.quote.includes(item.name))).toBe(true);
    const analysis = analysisFor([page], 'https://profi.ru/', companyNameFrom(page, 'https://profi.ru/'));
    expect(analysis.companyName).toBe('Профи.ру');
    expect(analysis.profile.businessModel).toBe('service-marketplace');
    expect(analysis.opportunities.every(item => /платформ|специалист|категор/i.test(`${item.processName} ${item.action}`))).toBe(true);
    expect(analysis.opportunities.map(item => item.processName).join(' ')).not.toMatch(/юридическ|договор/i);
  });
});

describe('software product selection', () => {
  it('does not select an enterprise path label and never matches Shop inside Shopify', () => {
    for (const url of ['https://www.shopify.com/enterprise', 'https://www.shopify.com/solutions/b2b/enterprise']) {
      const enterprise = parsePage('<main><h1>B2B for enterprise</h1><p>Transform your wholesale commerce.</p></main>', url, 'site-2');
      expect(enterprise.offerings.map(item => item.name)).not.toContain('B2B for enterprise');
    }
    const productIndex = parsePage('<main><h1>Our software</h1><article><h2>Optimize strategy and outcomes confidently</h2><p>Explore our collections.</p></article><article><h2>Ship high-quality software fast</h2><p>Rovo Dev, Pipelines and Bitbucket.</p></article></main>', 'https://www.atlassian.com/software', 'site-3');
    expect(productIndex.offerings).toEqual([]);
    const nestedProduct = parsePage('<main><h1>Any agent. Any model. One team.</h1><p>Plan, orchestrate and scale with Jira for AI-native development.</p></main>', 'https://www.atlassian.com/software/jira/dev', 'site-4');
    expect(nestedProduct.offerings.map(item => item.name)).toEqual(['Jira']);
    const collection = parsePage('<main><h1>High-velocity service management, powered by AI</h1><p>Elevate support experiences with Service Collection.</p></main>', 'https://www.atlassian.com/collections/service', 'site-5');
    expect(collection.offerings).toEqual([]);

    const home = {
      id: 'site-1', kind: 'company-site', companyName: 'Shopify', url: 'https://www.shopify.com/', title: 'Shopify',
      text: 'Shopify is a cloud platform and software as a service for commerce. Agentic Storefronts helps merchants reach buyers in AI chats.',
      offerings: [{ name: 'Agentic Storefronts', displayName: 'Agentic Storefronts', kind: 'product', price: null, quote: 'Agentic Storefronts helps merchants reach buyers in AI chats.', sourceId: 'site-1', url: 'https://www.shopify.com/agentic-storefronts' }],
    };
    const legacy = { id: 'site-3', kind: 'company-site', companyName: 'Shopify', url: 'https://www.shopify.com/shop', title: 'Reach shoppers', text: 'Sell to millions of high-intent shoppers on Shop. Just by joining Shopify.', offerings: [{ name: 'Reach the world’s best Shoppers', displayName: 'Reach the world’s best Shoppers', kind: 'product', price: null, quote: 'Sell to millions of high-intent shoppers on Shop.', sourceId: 'site-3', url: 'https://www.shopify.com/shop' }] };
    const analysis = analysisFor([home, legacy], 'https://www.shopify.com/', 'Shopify');
    expect(analysis.swot.filter(item => item.category === 'strength').map(item => item.title).join(' ')).toContain('Agentic Storefronts');
    expect(analysis.swot.filter(item => item.category === 'strength').map(item => item.title).join(' ')).not.toContain('B2B for enterprise');
  });
});

describe('process-specific logistics evidence', () => {
  it('uses tracking evidence for statuses and rejects a generic industry review for that claim', () => {
    const sources = [
      { id: 'site-1', kind: 'company-site', companyName: 'CDEK', url: 'https://cdek.example/', title: 'CDEK', text: 'СДЭК — транспортная компания для доставки документов, товаров и грузов. Можно оформить отправление и рассчитать стоимость доставки по параметрам заказа.' },
      { id: 'site-2', kind: 'company-site', companyName: 'CDEK', url: 'https://cdek.example/tracking', title: 'Отслеживание', text: 'Партнёры могут скачать мобильное приложение, которое позволяет отслеживать статус отправлений и получать уведомления.' },
      { id: 'site-3', kind: 'company-site', companyName: 'CDEK', url: 'https://cdek.example/documents', title: 'Документы', text: 'Накладные и сопроводительные документы передаются при оформлении отправления. Акт расхождения фиксирует повреждение.' },
      { id: 'review-1', kind: 'review-snippet', url: 'https://reviews.example/cdek', title: 'Отзыв', text: 'Клиент описывает опыт доставки грузов транспортной компанией и жалуется на обслуживание.' },
    ];
    const analysis = analysisFor(sources, 'https://cdek.example/', 'CDEK');
    const statuses = analysis.opportunities.find(item => item.processName === 'Клиентские статусы доставки и правила исключений');
    expect(statuses).toBeDefined();
    expect(statuses.evidence[0].quote).toMatch(/отслеживать статус отправлений/i);
    expect(statuses.evidence[0].sourceId).not.toBe('review-1');
    expect(analysis.opportunities.length).toBeGreaterThanOrEqual(2);
    expect(analysis.opportunities.every(item => item.acceptance.cases.length === 6)).toBe(true);
  });

  it('does not replace a substantive tracking source with a short external complaint', () => {
    const sources = [
      { id: 'site-1', kind: 'company-site', companyName: 'CDEK', url: 'https://cdek.example/', title: 'CDEK', text: 'СДЭК — транспортная компания для доставки документов, товаров и грузов. Можно оформить отправление и рассчитать стоимость доставки по параметрам заказа.' },
      { id: 'review-1', kind: 'review-snippet', url: 'https://reviews.example/cdek', title: 'Отзыв о доставке', text: 'Статус заказа не менялся около 3 дней, это было неудобно.' },
      { id: 'web-3', kind: 'search-snippet', url: 'https://partner.example/cdek', title: 'Инструменты партнёров', text: 'У партнеров СДЭК есть возможность скачать мобильное приложение, которое позволит отслеживать статус отправлений и получать уведомления.' },
    ];
    const analysis = analysisFor(sources, 'https://cdek.example/', 'CDEK');
    const statuses = analysis.opportunities.find(item => item.processName === 'Клиентские статусы доставки и правила исключений');
    expect(statuses.evidence[0].sourceId).toBe('web-3');
    expect(statuses.evidence[0].quote).toContain('позволит отслеживать статус отправлений');
  });

  it('keeps the third logistics process when a risk signal and a long webpage are present', () => {
    const tracking = 'У партнеров СДЭК есть возможность скачать мобильное приложение, которое позволит отслеживать статус отправлений и получать уведомления.';
    const sources = [
      { id: 'site-1', kind: 'company-site', companyName: 'CDEK', url: 'https://cdek.example/', title: 'CDEK', text: 'СДЭК — транспортная компания для доставки документов, товаров и грузов. Можно оформить отправление и рассчитать стоимость доставки по параметрам заказа.' },
      { id: 'web-1', kind: 'search-snippet', url: 'https://news.example/cdek', title: 'Новости CDEK', text: 'Санкционные ограничения затронули международную логистику CDEK и требуют проверки актуальности.' },
      { id: 'web-3', kind: 'search-snippet', url: 'https://partner.example/cdek', title: 'Инструменты партнёров', text: `Отслеживание посылок CDEK Рассчитать доставку Тендеры Фулфилмент Статьи Читать все статьи Как настроить интеграцию. ${tracking}` },
    ];
    const analysis = analysisFor(sources, 'https://cdek.example/', 'CDEK');
    const statuses = analysis.opportunities.find(item => item.processName === 'Клиентские статусы доставки и правила исключений');
    expect(statuses).toBeDefined();
    expect(statuses.title).not.toMatch(/непрерывности/i);
    expect(statuses.evidence[0].quote).toBe(tracking);
  });
});

describe('identity and evidence provenance', () => {
  it('never lets an external product domain replace the company identity', () => {
    const own = { id: 'site-1', kind: 'company-site', title: 'CDEK — транспортная компания', text: 'CDEK оказывает услуги доставки документов и грузов.' };
    const external = { id: 'web-1', kind: 'search-snippet', title: 'Новый сервис', text: 'CDEK.Shopping — сервис для заказа товаров с доставкой.' };
    expect(companyNameFromPages([own, external], 'https://cdek.ru/')).toBe('CDEK');
    expect(companyNameFromPages([{ ...own, title: 'Shopify' }, { ...external, text: 'shopify.com — сервис для коммерции.' }], 'https://www.shopify.com/')).toBe('Shopify');
    expect(companyNameFrom(external, 'https://cdek.ru/')).toBe('CDEK');
  });

  it('keeps the first-party product card when a general review is also available', () => {
    const productQuote = 'Седельный тягач 65659-СА имеет двигатель мощностью 483 л.с. и предназначен для перевозки грузов.';
    const sources = [
      { id: 'site-1', kind: 'company-site', companyName: 'КАМАЗ', url: 'https://kamaz.example/', title: 'КАМАЗ', text: 'КАМАЗ — производитель грузовых автомобилей и специальной техники.' },
      { id: 'site-2', kind: 'company-site', companyName: 'КАМАЗ', url: 'https://kamaz.example/products/65659', title: 'Тягач 65659-СА', text: productQuote, offerings: [{ name: '65659-СА', displayName: '65659-СА', kind: 'product', quote: productQuote, sourceId: 'site-2', url: 'https://kamaz.example/products/65659' }] },
      { id: 'review-1', kind: 'review-snippet', url: 'https://reviews.example/kamaz', title: 'Отзыв о покупке', text: 'Покупатель оценивает качество обслуживания и условия приобретения техники у производителя.' },
    ];
    const analysis = analysisFor(sources, 'https://kamaz.example/', 'КАМАЗ');
    const cards = analysis.opportunities.find(item => item.processName === 'Подготовка доказуемых карточек продукции и документов');
    expect(cards.evidence[0].sourceId).toBe('site-2');
    expect(cards.evidence[0].quote).toBe(productQuote);
  });
});
