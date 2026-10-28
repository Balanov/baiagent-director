<?php
declare(strict_types=1);
require __DIR__ . '/test-php.php';

$page = parse_page(
    '<html><head><title>Гемотест — анализы</title></head><body><main>'
    . '<h1>Анализы</h1><section><article><a href="/analysis/liver-kidney/">'
    . '<h3>Печень<br>и почки</h3><span>От<strong>350</strong> ₽</span>'
    . '</a></article></section></main></body></html>',
    'https://gemotest.ru/analysis/',
    'site-spacing'
);
$offering = $page['offerings'][0] ?? [];
$checks = [
    'nestedWordsSeparated' => ($offering['name'] ?? '') === 'Печень и почки',
    'nestedPriceSeparated' => ($offering['price'] ?? '') === 'От 350 ₽' && str_contains($offering['quote'] ?? '', 'От 350 ₽'),
    'noMergedLiverKidneys' => !str_contains(json_encode($offering, JSON_UNESCAPED_UNICODE), 'Печеньи'),
];
$result = ['offering' => $offering, 'checks' => $checks];
file_put_contents(__DIR__ . '/../validation/card-spacing-php-fixture.json', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
