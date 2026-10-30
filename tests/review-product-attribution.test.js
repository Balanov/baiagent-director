import { describe, expect, it } from 'vitest';
import { isRelevantCompanyReview } from '../shared/market-plan.js';

const context = (companyName, requestedUrl, text, offeringName) => ({
  companyName,
  requestedUrl,
  sources: [{ kind: 'company-site', url: requestedUrl, title: companyName, text, offerings: [{ name: offeringName }] }],
  offerings: [{ name: offeringName }],
});

describe('product review attribution', () => {
  it('accepts a real experience with a known product category from the company', () => {
    const research = context('ООО «Имидж-Боровичи»', 'https://firestarters.example/', 'Производство товаров для розжига.', 'Древесные брикеты');
    expect(isRelevantCompanyReview({
      title: 'Брикет для розжига Имидж-Боровичи 32 шт — отзывы',
      url: 'https://market.example/product/image-briquettes',
      text: '5 отзывов. Наталья: отлично разжигаются, всем рекомендую. Юлия: очень мне понравился этот брикет.',
    }, research)).toBe(true);
  });

  it('rejects a search snippet whose quote describes another manufacturer', () => {
    const research = context('ООО «Имидж-Боровичи»', 'https://firestarters.ru/', 'Производство спичек и товаров для розжига.', 'Спички для пикника 30 шт.');
    const review = {
      title: 'Спички Имидж- Боровичи для пикника "Дача" 30 шт. — отзывы',
      url: 'https://irecommend.ru/content/real-product-review',
      text: 'Итак, сегодня мой отзыв будет посвящен спичкам бытовым ГОСТ 1820-2001 от фирмы-производителя Красная… Подставка для подогрева чайника Glassware Сердечки.',
      contentOrigin: 'search-snippet',
    };
    expect(isRelevantCompanyReview(review, research)).toBe(false);
    expect(isRelevantCompanyReview({ ...review, text: 'Купил спички для пикника 30 шт.: быстро разжигаются, рекомендую. 5 отзывов.' }, research)).toBe(true);
  });

  it('does not turn a compatible third-party part into the manufacturer review', () => {
    const research = context('КАМАЗ', 'https://kamaz.example/', 'Производство грузовых автомобилей.', 'КАМАЗ 54901');
    expect(isRelevantCompanyReview({
      title: 'Диск сцепления PRAMO для КАМАЗ — отзывы',
      url: 'https://reviews.example/product/pramo-clutch',
      text: '9 отзывов про товар PRAMO. Диск сцепления на автомобиль КАМАЗ. Установил без проблем, качество отличное. Товар — PRAMO 14-1601130.',
    }, research)).toBe(false);
  });
});
