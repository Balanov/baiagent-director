import { describe, expect, it } from 'vitest';
import { cleanOfferingName, dedupeOfferings, extractPrice, isUsefulOfferingName, verifyMarketItem } from '../shared/market.js';

describe('published price extraction and verification', () => {
  it('uses the current price after an old price and discount, never the percentage', () => {
    expect(extractPrice('17 990 ₽ −17% 14 990 ₽')).toBe('14 990 ₽');
    expect(extractPrice('17 990- 17%14 990₽')).toBe('14 990₽');
    expect(extractPrice('Скидка 17%')).toBeNull();
  });

  it('does not mistake tiered prices for a discount sequence', () => {
    expect(extractPrice('от 600 шт. — 95 руб/шт.; от 1000 шт. — 90 руб/шт.; от 2000 шт. — 85 руб/шт.')).toBe('95 руб');
    expect(extractPrice('Стоимость: от 1 250 000 ₽ за проект')).toBe('от 1 250 000 ₽');
  });

  it('confirms amount and currency in the quote despite whitespace differences', () => {
    const source = { id: 'site-1', url: 'https://shop.example/catalog', title: 'Каталог', text: 'Смартфон Aurora X5 17 990 ₽ −17% 14 990₽' };
    const verified = verifyMarketItem({ name: 'Смартфон Aurora X5', price: '14 990 ₽', quote: 'Смартфон Aurora X5 17 990 ₽ −17% 14 990₽', sourceId: source.id }, [source]);
    expect(verified).toMatchObject({ name: 'Смартфон Aurora X5', price: '14 990 ₽' });
  });

  it('drops an unconfirmed price without dropping the offering itself', () => {
    const source = { id: 'site-1', url: 'https://shop.example/catalog', title: 'Каталог', text: 'Кресло «Атлант». Диван «Лофт» — 45 000 ₽.' };
    const verified = verifyMarketItem({ name: 'Кресло «Атлант»', price: '45 000 ₽', quote: 'Кресло «Атлант»', sourceId: source.id }, [source]);
    expect(verified).not.toBeNull();
    expect(verified.price).toBeNull();
  });
});

describe('offering name cleanup and filtering', () => {
  it.each([
    ['Картонная коробка 600х400х150 Доступны опции под заказ Опции под заказ', 'Картонная коробка 600х400х150'],
    ['Подарочные сертификатыПодарочные сертификаты', 'Подарочные сертификаты'],
    ['Подарочные сертификаты Подарочные сертификаты', 'Подарочные сертификаты'],
    ['Jira part of software collection', 'Jira'],
    ['Confluence Part of Service Collection', 'Confluence'],
  ])('cleans UI and duplicated labels in %s', (input, expected) => {
    expect(cleanOfferingName(input)).toBe(expected);
  });

  it.each([
    'Как сдать анализы', 'Доступные анализы', 'Больше об ОМС', 'Правовая информация',
    'Лицензии РФ и ЕАЭС', 'Собственные научные базы', 'Как мы работаем',
    'Отправить заявку', 'Заказать прайс-лист', 'Отзывы покупателей',
    'Москва, ул. Ленина, д. 10', 'Part of Strategy Collection', 'Products', 'Services',
  ])('rejects navigation, CTA, address and editorial label %s', name => {
    expect(isUsefulOfferingName(name)).toBe(false);
  });

  it.each(['Картонные коробки', 'Анализ крови', 'Подарочные сертификаты', 'КонсультантПлюс для юриста', 'Свечи уличные'])('keeps the published commercial category or offering %s', name => {
    expect(isUsefulOfferingName(name)).toBe(true);
  });
});

describe('evidence-aware offering deduplication', () => {
  it('collapses repeated catalogue cards after cleanup', () => {
    const items = dedupeOfferings([
      { name: 'Коробка 600х400х150 Доступны опции под заказ Опции под заказ', price: '95 ₽', image: 'https://shop.example/box.jpg', url: 'https://shop.example/catalog/boxes/', quote: 'Коробка 600х400х150 — 95 ₽' },
      { name: 'Коробка 600х400х150', price: '95₽', image: 'https://shop.example/box.jpg', url: 'https://shop.example/catalog/boxes/', quote: 'Коробка 600х400х150 — 95₽' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Коробка 600х400х150');
  });

  it('merges different labels backed by the same direct product URL', () => {
    const items = dedupeOfferings([
      { name: 'Серийные автомобили', price: null, image: 'https://shop.example/truck-a.jpg', url: 'https://shop.example/product/truck-a/', quote: 'Серийные автомобили' },
      { name: 'Truck A 4x2', price: null, image: 'https://shop.example/truck-a.jpg', url: 'https://shop.example/product/truck-a/', quote: 'Truck A 4x2' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Truck A 4x2');
  });

  it('merges equal name and price despite different URLs and images', () => {
    const items = dedupeOfferings([
      { name: 'Диагностическая панель', price: '2 500 ₽', image: 'https://lab.example/panel-a.jpg', url: 'https://lab.example/panels/heart/', quote: 'Диагностическая панель — 2 500 ₽' },
      { name: 'Диагностическая панель', price: '2 500₽', image: 'https://lab.example/panel-b.jpg', url: 'https://lab.example/panels/cardio/', quote: 'Диагностическая панель — 2 500₽' },
    ]);
    expect(items).toHaveLength(1);
  });

  it('preserves different confirmed prices and distinct unpriced offerings', () => {
    const items = dedupeOfferings([
      { name: 'Диагностическая панель', price: '2 500 ₽', url: 'https://lab.example/panels/a/', quote: 'Диагностическая панель — 2 500 ₽' },
      { name: 'Диагностическая панель', price: '3 100 ₽', url: 'https://lab.example/panels/a/', quote: 'Диагностическая панель — 3 100 ₽' },
      { name: 'Расширенная панель', price: null, url: 'https://lab.example/panels/b/', quote: 'Расширенная панель' },
    ]);
    expect(items).toHaveLength(3);
  });

  it('prefers the most complete compatible record without using landing URLs as identity', () => {
    const [complete] = dedupeOfferings([
      { name: 'Коробка 600х400х150', price: null, image: null, url: 'https://shop.example/catalog/boxes/', quote: 'Коробка 600х400х150' },
      { name: 'Коробка 600х400х150', price: null, image: 'https://shop.example/box.jpg', url: 'https://shop.example/catalog/boxes/box-a/', quote: 'Коробка 600х400х150' },
    ]);
    expect(complete).toMatchObject({ price: null, image: 'https://shop.example/box.jpg', url: 'https://shop.example/catalog/boxes/box-a/' });
  });
});
