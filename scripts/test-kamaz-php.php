<?php
declare(strict_types=1);
require __DIR__ . '/test-php.php';
$home = parse_page(file_get_contents(__DIR__ . '/../validation/html/kamaz-home.html'), 'https://kamaz.ru/', 'site-1');
$production = parse_page(file_get_contents(__DIR__ . '/../validation/html/kamaz-production.html'), 'https://kamaz.ru/production/', 'site-2');
$serial = parse_page(file_get_contents(__DIR__ . '/../validation/html/kamaz-serial.html'), 'https://kamaz.ru/production/serial/', 'site-3');
$company = company_name_from_pages([$home, $production, $serial], 'https://kamaz.ru/');
$plan = market_plan([$home, $production, $serial]);
$plan['companyName'] = $company;
$model = null;
foreach ($serial['offerings'] as $offering) if ($offering['name'] === 'KAMAZ-4308-5S на КПГ') $model = $offering;
$competitor = ['title' => 'Завод грузовых автомобилей', 'url' => 'https://truck-factory.example/', 'text' => 'Производим грузовые автомобили. Каталог самосвалов и седельных тягачей, технические характеристики и условия покупки.'];
$checks = [
    'companyIdentity' => (bool)preg_match('~kamaz|камаз~iu', $company),
    'manufacturingIndustry' => $plan['industry'] === 'manufacturing',
    'truckMarket' => $plan['subject'] === 'грузовые автомобили',
    'realModelCount' => count($serial['offerings']) >= 50,
    'linkedModel' => $model !== null && $model['url'] === 'https://kamaz.ru/production/serial/bortovye-avtomobili/kamaz-4308-5s-na-kpg/',
    'originalImage' => $model !== null && str_starts_with((string)$model['image'], 'https://kamaz.ru/upload/'),
    'allModelsHaveImages' => !array_filter($serial['offerings'], fn($item) => empty($item['image']) || $item['url'] === $serial['url']),
    'noSeminarOrCategory' => !array_filter($serial['offerings'], fn($item) => preg_match('~семинар|серийные автомобили~iu', $item['name'])),
    'commercialCompetitor' => market_candidate($competitor, $plan, 'https://kamaz.ru/'),
    'substantiveQuote' => str_contains(relevant_market_quote($competitor, $plan), 'самосвал'),
    'propertyMarketRejected' => !market_candidate(['title' => 'Village Fest', 'url' => 'https://property.example/', 'text' => 'Аренда недвижимости и организация мероприятий. Продажа и стоимость услуг.'], $plan, 'https://kamaz.ru/'),
];
$result = ['company' => $company, 'industry' => $plan['industry'], 'subject' => $plan['subject'], 'models' => count($serial['offerings']), 'modelsWithImages' => count(array_filter($serial['offerings'], fn($item) => !empty($item['image']))), 'checks' => $checks];
file_put_contents(__DIR__ . '/../validation/kamaz-php-fixture.json', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
