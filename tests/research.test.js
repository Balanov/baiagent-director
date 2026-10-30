import { describe, expect, it } from 'vitest';
import { companyNameFrom, isReviewMaterial, parsePage, resolvedResearchWarnings } from '../electron/research.mjs';
import { verifyMarketItems } from '../shared/market.js';

const catalogUrl = 'https://shop.example/catalog/items';

describe('commercial card extraction', () => {
  it('keeps the discounted current price and a matching direct internal URL', () => {
    const page = parsePage(`<main><div class="product-card">
      <a href="/product/starwind"><h3>StarWind Virtual SAN</h3></a>
      <span class="price-old">17 990 ₽</span><span>-17%</span><span>14 990₽</span>
    </div></main>`, catalogUrl, 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0]).toMatchObject({ name: 'StarWind Virtual SAN', price: '14 990₽', url: 'https://shop.example/product/starwind' });
    expect(page.offerings[0].quote).toContain('14 990₽');
    expect(verifyMarketItems(page.offerings, [page])).toHaveLength(1);
  });

  it('prefers an explicit current price over an old price', () => {
    const page = parsePage('<main><div class="product-card"><h3>Тариф Профи</h3><span class="price-old">1 000 ₽</span><span class="price-current">790 ₽</span></div></main>', catalogUrl, 'site-1');
    expect(page.offerings[0].price).toBe('790 ₽');
  });

  it('uses a nearby product-code price for an H1, but not an unrelated page price', () => {
    const product = parsePage('<main><div><h1>Телевизор StarWind</h1><span>Код товара: 1779077</span><span>17 990 ₽ −17% 14 990₽</span></div></main>', 'https://shop.example/product/starwind/', 'site-1');
    expect(product.offerings[0]).toMatchObject({ name: 'Телевизор StarWind', price: '14 990₽' });
    const unrelated = parsePage('<main><h1>Тариф «Простой»</h1><section>Другая акция: 500 000 ₽</section></main>', 'https://shop.example/products/tariff/', 'site-1');
    expect(unrelated.offerings[0].price).toBeNull();
  });

  it('selects the BEM card rather than turning its description element into an offering', () => {
    const page = parsePage('<main><div class="by_fefco_catalog-item"><a class="by_fefco_catalog-item__title" href="/catalog/fefco/box-0201/">Короб FEFCO 0201</a><div class="by_fefco_catalog-item__desc">Конструкция 0201 имеет равные клапаны.</div></div></main>', catalogUrl, 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0].name).toBe('Короб FEFCO 0201');
  });

  it('cleans option UI and uses the linked canonical product name', () => {
    const page = parsePage(`<main><div class="product-item"><div class="title"><a href="/catalog/boxes/box-600/">
      Картонная коробка 600х400х150</a><span>Доступны опции под заказ Опции под заказ</span></div><span class="price">95 ₽</span>
    </div></main>`, catalogUrl, 'site-1');
    expect(page.offerings[0]).toMatchObject({ name: 'Картонная коробка 600х400х150', url: 'https://shop.example/catalog/boxes/box-600/' });
  });

  it('does not use an external or textually unrelated link as product evidence', () => {
    const external = parsePage('<main><div class="product-card"><h3>Товар Альфа</h3><a href="https://other.example/product/alpha">Товар Альфа</a><span class="price">100 ₽</span></div></main>', catalogUrl, 'site-1');
    expect(external.offerings[0].url).toBe(catalogUrl);
    const unrelated = parsePage('<main><div class="product-card"><h3>Товар Альфа</h3><a href="/product/beta">Товар Бета</a><span class="price">100 ₽</span></div></main>', catalogUrl, 'site-1');
    expect(unrelated.offerings[0].url).toBe(catalogUrl);
  });

  it('rejects CTA, navigation, legal and address cards but keeps a published category', () => {
    const page = parsePage(`<main><h1>Каталог</h1>
      <div class="product-card"><h3>Как сдать анализы</h3></div>
      <div class="product-card"><h3>Отправить заявку</h3></div>
      <div class="product-card"><h3>Правовая информация</h3></div>
      <div class="product-card"><h3>Москва, ул. Ленина, д. 10</h3></div>
      <div class="category__item"><h3>Картонные коробки</h3></div>
    </main>`, catalogUrl, 'site-1');
    expect(page.offerings.map(item => item.name)).toEqual(['Картонные коробки']);
    expect(page.offerings[0].kind).toBe('product');
  });

  it('extracts an unpriced B2B software offering only on a commercial page', () => {
    const product = parsePage('<main><h1>КонсультантПлюс для юриста</h1><p>Справочная правовая система для профессиональной работы юриста.</p></main>', 'https://shop.example/about/software/law/', 'site-1');
    expect(product.offerings).toHaveLength(1);
    expect(product.offerings[0]).toMatchObject({ name: 'КонсультантПлюс для юриста', price: null });
    const home = parsePage('<main><h1>КонсультантПлюс для юриста</h1><p>Справочная правовая система.</p></main>', 'https://shop.example/', 'site-1');
    expect(home.offerings).toHaveLength(0);
  });
});

describe('editorial and review exclusion', () => {
  it('keeps marketplace categories but never presents customer task cards as its own services', () => {
    const page = parsePage(`<main>
      <div class="categories"><a data-category-name href="/catalog/repair/"><span>Мастера по ремонту</span></a><a data-category-name href="/catalog/tutors/"><span>Репетиторы</span></a></div>
      <section><h2>Задачи, которые доверили клиенты</h2>
        <article class="main-card"><h3>Настройка локальной сети</h3><p>Детали задачи: настроить сервер. 1200 рублей.</p></article>
        <article class="main-card"><h3>SEO</h3><p>Детали задачи: продвинуть интернет-магазин. 10000 рублей.</p></article>
      </section>
    </main>`, 'https://marketplace.example/catalog/services/', 'site-1');
    expect(page.offerings.map(item => item.name).sort()).toEqual(['Мастера по ремонту', 'Репетиторы']);
  });

  it('does not turn article cards into offerings from an article page', () => {
    const page = parsePage(`<html><head><meta property="og:type" content="article"></head><body><article class="product-card"><h3>How Cursor Is Navigating Product Craft</h3><p>Editorial story.</p></article></body></html>`, 'https://shop.example/story/cursor', 'site-1');
    expect(page.offerings).toHaveLength(0);
  });

  it('does not let product wording or card classes override explicit editorial evidence', () => {
    const article = parsePage('<html><head><meta property="og:type" content="article"></head><body><article><h3>Product craft story</h3></article></body></html>', 'https://shop.example/products/product-craft/', 'site-1');
    expect(article.offerings).toHaveLength(0);
    const blog = parsePage('<main><article class="card-content"><h3>Product craft story</h3></article></main>', 'https://shop.example/blog/product-craft/', 'site-1');
    expect(blog.offerings).toHaveLength(0);
  });

  it('recognises schema BlogPosting even without og:type or a blog URL', () => {
    const page = parsePage(`<html><head><script type="application/ld+json">{"@type":"BlogPosting","headline":"Company story"}</script></head><body><article class="product-card"><h3>Company story</h3><span>100 ₽</span></article></body></html>`, 'https://shop.example/story/company', 'site-1');
    expect(page.offerings).toHaveLength(0);
  });

  it('does not mistake a commercial catalogue for editorial merely because WordPress says article', () => {
    const page = parsePage('<html><head><meta property="og:type" content="article"></head><body><div class="category__item"><h2>Свечи уличные</h2></div></body></html>', 'https://shop.example/catalog/', 'site-1');
    expect(page.offerings.map(item => item.name)).toEqual(['Свечи уличные']);
  });

  it('still permits an explicitly structured commercial item on an editorial page', () => {
    const page = parsePage('<html><head><meta property="og:type" content="article"></head><body><div itemtype="https://schema.org/Product"><h3>Jira Software</h3><a href="/software/jira">Jira Software</a></div></body></html>', 'https://shop.example/blog/jira', 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0].name).toBe('Jira Software');
  });

  it.each(['https://shop.example/otzyvy/', 'https://shop.example/reviews/'])('does not extract offerings from %s', url => {
    const page = parsePage('<main><div class="product-card"><h3>Товар Альфа</h3><span class="price">100 ₽</span></div></main>', url, 'site-1');
    expect(page.offerings).toHaveLength(0);
  });
});

describe('logo evidence quality', () => {
  it('prioritizes structured Organization.logo including ImageObject', () => {
    const page = parsePage(`<html><head><script type="application/ld+json">{"@type":"Organization","name":"Example","logo":{"@type":"ImageObject","url":"/structured-logo.svg"}}</script><link rel="icon" href="/favicon.ico"></head><body><img class="brand-logo" src="/markup-logo.svg"></body></html>`, 'https://shop.example/', 'site-1');
    expect(page).toMatchObject({ logo: 'https://shop.example/structured-logo.svg', logoConfidence: 'structured', organizationName: 'Example' });
  });

  it('skips an arbitrary header image and selects a later explicit brand logo', () => {
    const page = parsePage('<header><img src="/flo.png"><img src="/assets/AtlassianHeaderLogo.svg"></header><main>Products for teams.</main>', 'https://shop.example/', 'site-1');
    expect(page.logo).toBe('https://shop.example/assets/AtlassianHeaderLogo.svg');
    expect(page.logoConfidence).toBe('markup');
  });

  it('does not promote an arbitrary header guess or a partner logo', () => {
    const page = parsePage('<header><img src="/promo.png"></header><div class="partners"><img class="partner-logo" src="/partner.png"></div><main>Company description.</main>', 'https://shop.example/', 'site-1');
    expect(page.logo).toBeNull();
    expect(page.warnings.join(' ')).toMatch(/Логотип не определён/);
  });

  it('marks a favicon-only logo as uncertain', () => {
    const page = parsePage('<html><head><link rel="icon" href="/favicon.ico"></head><body><main>Company description with enough readable text.</main></body></html>', 'https://shop.example/', 'site-1');
    expect(page).toMatchObject({ logo: 'https://shop.example/favicon.ico', logoConfidence: 'favicon', logoUncertainty: true });
    expect(page.warnings.join(' ')).toMatch(/не подтверждено/);
  });

  it('does not treat an analytics counter as a company logo', () => {
    const page = parsePage('<html><head><link rel="icon" href="/favicon.ico"></head><body><img src="https://counter.yadro.ru/logo?44.2"><main>Company description with enough readable text.</main></body></html>', 'https://shop.example/', 'site-1');
    expect(page).toMatchObject({ logo: 'https://shop.example/favicon.ico', logoConfidence: 'favicon' });
  });
});

describe('unavailable own-site content', () => {
  it('reports a ServicePipe JavaScript challenge instead of an empty successful page', () => {
    const page = parsePage('<html><head><title>Company</title><script src="https://servicepipe.tech/loaders/challenge.js"></script></head><body><js-challenge-loader></js-challenge-loader></body></html>', 'https://shop.example/', 'site-1');
    expect(page.accessIssue).toBe('javascript-challenge');
    expect(page.offerings).toHaveLength(0);
    expect(page.warnings.join(' ')).toMatch(/JavaScript-challenge/);
  });

  it('reports a generic JavaScript challenge and an empty readable shell', () => {
    const challenge = parsePage('<html><body><p>Checking your browser before accessing the site.</p></body></html>', 'https://shop.example/', 'site-1');
    expect(challenge.accessIssue).toBe('javascript-challenge');
    const empty = parsePage('<html><head><title>Company</title></head><body><div id="app"></div></body></html>', 'https://shop.example/', 'site-1');
    expect(empty.accessIssue).toBe('empty-shell');
    expect(empty.warnings.join(' ')).toMatch(/не содержит доступного текста/);
  });
});

describe('canonical commercial evidence', () => {
  it('extracts linked menu dishes without prices and ignores unrelated editorial cards', () => {
    const page = parsePage(`<main>
      <section class="menu-list">
        <a class="product-card" href="/menu/berry-pancake/"><article><h2>Блин с ягодами</h2><span>290 ₽</span></article></a>
        <a class="product-card" href="/menu/herb-omelette/"><article><h2>Омлет с зеленью</h2></article></a>
      </section>
      <section class="interior-story"><article><h2>Дубовый стол у окна</h2></article></section>
    </main>`, 'https://cafe.example/', 'site-1');
    expect(page.offerings).toHaveLength(2);
    expect(page.offerings.map(item => item.name).sort()).toEqual(['Блин с ягодами', 'Омлет с зеленью']);
    expect(page.offerings.find(item => item.name === 'Омлет с зеленью')).toMatchObject({ price: null, url: 'https://cafe.example/menu/herb-omelette/', quote: 'Омлет с зеленью' });
    expect(verifyMarketItems(page.offerings, [page])).toHaveLength(2);
  });

  it('uses structured SoftwareApplication metadata for a marketing H1', () => {
    const page = parsePage(`<html><head><script type="application/ld+json">{"@type":"SoftwareApplication","name":"Jira","url":"https://vendor.example/software/jira"}</script></head><body><main><article class="main-card"><h1>Turn plans into agent-ready tasks</h1><p>Jira helps teams deliver work.</p></article></main></body></html>`, 'https://vendor.example/software/jira', 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0]).toMatchObject({ name: 'Jira', price: null });
    expect(verifyMarketItems(page.offerings, [page])).toHaveLength(1);
  });

  it('uses a matching direct anchor for collection cards and keeps distinct products', () => {
    const page = parsePage(`<main>
      <div class="product-card"><a href="/software/confluence" aria-label="Confluence"><h3>Bring all your team knowledge together</h3><span>Confluence</span></a></div>
      <div class="product-card"><a href="/software/jira" aria-label="Jira"><h3>Move every project plan forward</h3><span>Jira</span></a></div>
    </main>`, 'https://vendor.example/software', 'site-1');
    expect(page.offerings.map(item => item.name).sort()).toEqual(['Confluence', 'Jira']);
  });

  it('recovers a product name from its own lead copy instead of a marketing H1', () => {
    const page = parsePage('<html><head><title>Atlassian</title></head><body><main><h1>Turn plans into agent-ready tasks</h1><p>Jira brings teams together to reach the next level of productivity with AI agents that orchestrate, plan, and track projects at scale.</p></main></body></html>', 'https://vendor.example/software/jira', 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0]).toMatchObject({ name: 'Jira', price: null, quote: expect.stringMatching(/^Jira brings teams together/) });
    expect(verifyMarketItems(page.offerings, [page])).toHaveLength(1);
  });

  it('uses a confirmed product name from the title instead of a slogan or a generic path', () => {
    const page = parsePage('<html><head><title>Acme Talent | Workforce planning | Acme</title></head><body><main><h1>Plan the skills behind your biggest bets</h1><p>Acme Talent is the workforce planning app.</p></main></body></html>', 'https://vendor.example/software/talent', 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0].name).toBe('Acme Talent');
  });

  it('does not present a resource or academic library as a product', () => {
    const page = parsePage('<html><head><title>Engineering videos and learning resources</title></head><body><main><article class="main-card"><h1>Designcenter CAD asset library</h1><p>Videos, webinars and articles.</p></article></main></body></html>', 'https://vendor.example/products/designcenter/cad-software/asset-library/', 'site-1');
    expect(page.offerings).toHaveLength(0);
  });

  it('recovers a short path-backed product name from OG metadata', () => {
    const page = parsePage('<html><head><meta property="og:title" content="Sell with Shop"></head><body><main><h1>Reach the world’s best Shoppers</h1><p>Shop connects merchants and buyers.</p></main></body></html>', 'https://vendor.example/shop', 'site-1');
    expect(page.offerings).toHaveLength(1);
    expect(page.offerings[0].name).toBe('Shop');
  });

  it('drops an unresolved long marketing thesis without a price', () => {
    const page = parsePage('<main><h1>Bring every team and every workflow together on one intelligent platform built for the future of collaborative work</h1><p>A vision for modern work.</p></main>', 'https://vendor.example/software', 'site-1');
    expect(page.offerings).toHaveLength(0);
  });

  it('excludes store-locator pages rather than treating their addresses as products', () => {
    const page = parsePage('<main><article><h1>Store addresses and pickup points</h1><p>Find the nearest location.</p></article></main>', 'https://shop.example/about/stores/', 'site-1');
    expect(page.offerings).toHaveLength(0);
  });

  it('excludes partner sections structurally but not ordinary product copy mentioning partners', () => {
    const page = parsePage(`<main><section class="partner-directory"><div class="product-card"><h3>External Engineering</h3></div></section><div class="product-card"><h3>Team Platform</h3><p>Integrates with partner APIs.</p></div></main>`, 'https://vendor.example/software', 'site-1');
    expect(page.offerings.map(item => item.name)).toEqual(['Team Platform']);
  });
});

describe('page-type and final-warning filters', () => {
  it('rejects article and search pages as review material before relevance checks', () => {
    const text = '100 reviews, rating 4.8, качество и доставка';
    expect(isReviewMaterial({ url: 'https://reviews.example/company', title: 'Company reviews', text })).toBe(true);
    expect(isReviewMaterial({ url: 'https://reviews.example/company', title: 'Отзывы и рейтинг', text: 'Клиенты отмечают отзывчивые сотрудники, качество и доставка.' })).toBe(true);
    expect(isReviewMaterial({ url: 'https://jobs.example/company', title: 'Отзывы сотрудников', text: 'Работа в компании, условия труда.' })).toBe(false);
    expect(isReviewMaterial({ url: 'https://editorial.example/list/company', pageType: 'article', title: 'Company reviews', text })).toBe(false);
    expect(isReviewMaterial({ url: 'https://market.example/search?text=company', title: 'Company reviews', text })).toBe(false);
    const article = parsePage('<html><head><meta property="og:type" content="article"></head><body><main>Company reviews, rating 4.8, качество и доставка.</main></body></html>', 'https://editorial.example/list/company', 'web-1');
    const search = parsePage('<html><head><script type="application/ld+json">{"@type":"SearchResultsPage"}</script></head><body><main>Company reviews, rating 4.8, качество и доставка.</main></body></html>', 'https://market.example/results', 'web-2');
    expect(article.pageType).toBe('article');
    expect(search.pageType).toBe('search');
    expect(isReviewMaterial(article)).toBe(false);
    expect(isReviewMaterial(search)).toBe(false);
  });

  it('removes favicon warnings only after a stronger logo was selected', () => {
    const faviconWarning = 'Логотип определён только по favicon; визуальное соответствие бренду не подтверждено.';
    expect(resolvedResearchWarnings([faviconWarning], 'markup')).toEqual([]);
    expect(resolvedResearchWarnings([faviconWarning], 'favicon')).toEqual([faviconWarning]);
  });
});

describe('promotional logo rejection', () => {
  it('does not use hero, banner or product-local branding as the company logo', () => {
    const page = parsePage('<main><section class="hero-banner"><img class="brand-logo" src="/brand-hero.png"></section><div class="product-logo"><img src="/product-brand.svg" alt="Product logo"></div><p>Company description.</p></main>', 'https://vendor.example/', 'site-1');
    expect(page.logo).toBeNull();
    expect(page.warnings.join(' ')).toMatch(/Логотип не определён/);
  });
});
