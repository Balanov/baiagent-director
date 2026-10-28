<?php
declare(strict_types=1);
require __DIR__ . '/test-php.php';

$name = 'Смартфон Samsung Galaxy A08 4/128Gb, синий';
$productPage = parse_page(
    '<html><head><title>' . $name . ' — купить</title>'
    . '<meta property="og:image" content="/images/a08.jpg"></head><body>'
    . '<div>Другой товар 999 ₽ ' . str_repeat('x', 2000) . '</div>'
    . '<main><h1>' . $name . '</h1><p>Характеристики товара</p>'
    . '<div><span>17 790</span><span>₽</span><s>22 990 ₽</s></div>'
    . '</main></body></html>',
    'https://shop.example/product/smartphone-a08/',
    'site-product'
);
$product = $productPage['offerings'][0] ?? [];
$reviewPage = parse_page(
    '<html><head><title>Отзывы</title></head><body><h1>' . $name . '</h1><p>17 790 ₽</p></body></html>',
    'https://shop.example/product/smartphone-a08/otzyvy/',
    'site-review'
);
$review = $reviewPage['offerings'][0] ?? [];
$categoryPage = parse_page(
    '<html><head><title>Сертификаты</title></head><body><h1><span>Подарочные сертификаты</span><span>Подарочные сертификаты</span></h1><p>5000₽ Подарочный сертификат</p></body></html>',
    'https://shop.example/catalog/podarochnye-sertifikaty/',
    'site-category'
);
$checks = [
    'detailNamePreserved' => ($product['name'] ?? '') === $name,
    'detailPriceExtracted' => ($product['price'] ?? '') === '17 790₽',
    'detailQuoteContainsPrice' => str_contains($product['quote'] ?? '', '17 790') && str_contains($product['quote'] ?? '', $name),
    'unrelatedDistantPriceRejected' => ($product['price'] ?? '') !== '999 ₽',
    'pageImageUsed' => ($product['image'] ?? '') === 'https://shop.example/images/a08.jpg',
    'reviewPriceNotReused' => ($review['price'] ?? null) === null,
    'duplicatedHeadingCollapsed' => offering_name('Подарочные сертификатыПодарочные сертификаты') === 'Подарочные сертификаты',
    'categoryHeadingDeduplicated' => ($categoryPage['offerings'][0]['name'] ?? '') === 'Подарочные сертификаты',
    'categoryPriceNotAssigned' => ($categoryPage['offerings'][0]['price'] ?? null) === null,
];
$result = ['product' => $product, 'review' => $review, 'category' => $categoryPage['offerings'][0] ?? null, 'checks' => $checks];
file_put_contents(__DIR__ . '/../validation/product-fallback-php-fixture.json', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
