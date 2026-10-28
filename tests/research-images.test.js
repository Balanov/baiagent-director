import { describe, expect, it } from 'vitest';
import { parsePage } from '../electron/research.mjs';

const url = 'https://shop.example/catalog/items';

describe('product image extraction', () => {
  it('skips placeholders and supports lazy images and srcset', () => {
    const page = parsePage(`<!doctype html><html><head><title>Каталог</title></head><body>
      <div class="product-card"><h3>Устройство Альфа</h3><span class="price">1 000 ₽</span>
        <img src="/images/placeholder.gif"><img data-src="/images/alfa.jpg">
      </div>
      <div class="product-card"><h3>Устройство Бета</h3><span class="price">2 000 ₽</span>
        <img src="/images/1x1.gif" data-srcset="/images/beta-small.jpg 480w, /images/beta-large.jpg 960w">
      </div>
    </body></html>`, url, 'site-1');

    expect(page.offerings).toHaveLength(2);
    expect(page.offerings[0].image).toBe('https://shop.example/images/alfa.jpg');
    expect(page.offerings[1].image).toBe('https://shop.example/images/beta-large.jpg');
  });

  it('never lends a page image to every product card', () => {
    const page = parsePage(`<!doctype html><html><head><title>Каталог</title><meta property="og:image" content="/images/shared.jpg"></head><body>
      <div class="product-card"><h3>Услуга Альфа</h3><span class="price">1 000 ₽</span></div>
      <div class="product-card"><h3>Услуга Бета</h3><span class="price">2 000 ₽</span></div>
    </body></html>`, url, 'site-1');

    expect(page.offerings).toHaveLength(2);
    expect(page.offerings.map(item => item.image)).toEqual([null, null]);
  });

  it('uses the page image only for a single card or an H1 fallback', () => {
    const single = parsePage(`<!doctype html><html><head><title>Товар</title><meta property="og:image" content="/images/single.jpg"></head><body>
      <div itemtype="https://schema.org/Product"><h3>Товар Один</h3><span class="price">3 000 ₽</span></div>
    </body></html>`, url, 'site-1');
    expect(single.offerings).toHaveLength(1);
    expect(single.offerings[0].image).toBe('https://shop.example/images/single.jpg');

    const fallback = parsePage(`<!doctype html><html><head><title>Услуга</title><meta property="og:image" content="/images/service.jpg"></head><body>
      <h1>Аудит бизнес-процессов</h1><p>Подробное описание услуги аудита бизнес-процессов.</p>
    </body></html>`, 'https://shop.example/services/audit', 'site-2');
    expect(fallback.offerings).toHaveLength(1);
    expect(fallback.offerings[0].image).toBe('https://shop.example/images/service.jpg');
  });
});
