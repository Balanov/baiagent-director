<?php
declare(strict_types=1);
require __DIR__ . '/test-php.php';

$clinic = ['industry' => 'healthcare', 'subject' => 'медицинские услуги', 'companyName' => 'Гемотест', 'relevance' => '~медицин~iu'];
$trucks = ['industry' => 'manufacturing', 'subject' => 'грузовые автомобили', 'companyName' => 'КАМАЗ', 'relevance' => '~производств~iu'];
$cdekPlan = market_plan([
    ['kind' => 'company-site', 'title' => 'www.cdek.ru', 'text' => ''],
    ['kind' => 'review-snippet', 'title' => 'CDEK.Shopping — отзывы', 'text' => 'Отзыв о покупке одежды и обуви через интернет-магазин CDEK.Shopping.'],
    ['kind' => 'search-snippet', 'title' => 'СДЭК — услуги курьерской службы для бизнеса', 'text' => 'Курьерская доставка грузов и документов для организаций. Логистические услуги и отправления для бизнеса.'],
    ['kind' => 'search-snippet', 'title' => 'СДЭК отслеживание посылок', 'text' => 'Служба доставки и отслеживание отправлений по трек-номеру.'],
]);
$checks = [
    'medicalSoftwareRejected' => !market_candidate(['title' => 'МИС для клиники', 'url' => 'https://rnova.ru/', 'text' => 'Медицинская информационная система для автоматизации клиник и пациентов.'], $clinic, 'https://gemotest.ru/'),
    'medicalAggregatorRejected' => !market_candidate(['title' => 'Медицинские услуги и запись', 'url' => 'https://docdoc.ru/service', 'text' => 'Агрегатор клиник, выбор врача и цены для пациентов.'], $clinic, 'https://gemotest.ru/'),
    'actualClinicAccepted' => market_candidate(['title' => 'СМ-Клиника — медицинские услуги', 'url' => 'https://clinic.example/services', 'text' => 'Клиника предлагает диагностику, лечение и медицинские услуги по опубликованным ценам.'], $clinic, 'https://gemotest.ru/'),
    'truckServiceRejected' => !market_candidate(['title' => 'Сервисное обслуживание грузовых автомобилей', 'url' => 'https://oil-time.ru/', 'text' => 'Сервисное обслуживание грузовых автомобилей. Замена масла. Запишитесь на обслуживание.'], $trucks, 'https://kamaz.ru/'),
    'truckRentalRejected' => !market_candidate(['title' => 'Грузоперевозки', 'url' => 'https://rent.example/', 'text' => 'Грузовые автомобили в аренду, грузоперевозки по Москве.'], $trucks, 'https://kamaz.ru/'),
    'supplierDirectoryRejected' => !market_candidate(['title' => 'Поставщики грузовых автомобилей', 'url' => 'https://ru.made-in-china.com/manufacturers/truck.html', 'text' => 'Каталог производителей грузовых автомобилей, цены поставщиков.'], $trucks, 'https://kamaz.ru/'),
    'cdekRecognizedAsLogistics' => $cdekPlan['industry'] === 'logistics' && $cdekPlan['subject'] === 'доставка для бизнеса',
    'cdekQueriesAreLogistics' => str_contains($cdekPlan['competitorQueries'][0], 'логистика'),
    'reviewTitleDoesNotBecomeOwnAlias' => $cdekPlan['ownAliases'] === [],
    'clothingSellerRejectedForLogistics' => !market_candidate(['title' => 'Одежда оптом с доставкой', 'url' => 'https://clothes.example/', 'text' => 'Оптовый интернет-магазин одежды. Купить одежду с доставкой по России.'], $cdekPlan, 'https://www.cdek.ru/'),
    'actualLogisticsCompanyAccepted' => market_candidate(['title' => 'Деловые Линии — транспортная компания', 'url' => 'https://logistics.example/services', 'text' => 'Грузоперевозки и доставка грузов для бизнеса. Логистические услуги и тарифы.'], $cdekPlan, 'https://www.cdek.ru/'),
    'sameNameHotelRejectedForRestaurant' => !is_relevant_company_review([
        'title' => 'Мини-отель Теремок, Старая Станица — отзывы', 'url' => 'https://travel.example/hotel/teremok',
        'text' => '15 отзывов. Гостям понравились номера, рекомендую для отдыха. Рядом есть рестораны и кафе.', 'contentOrigin' => 'full-page',
    ], [
        'companyName' => 'Теремок', 'requestedUrl' => 'https://teremok.ru/', 'offerings' => [['name' => 'Завтрак Богатырский']],
        'sources' => [['kind' => 'company-site', 'url' => 'https://teremok.ru/', 'title' => 'Теремок', 'text' => 'Сеть ресторанов русской кухни. Блины, каши и завтраки.', 'offerings' => [['name' => 'Завтрак Богатырский']]]],
        'marketContext' => ['industry' => 'food', 'subject' => 'продукты питания и ресторанный сервис'],
    ]),
];
$result = ['cdekPlan' => $cdekPlan, 'checks' => $checks];
file_put_contents(__DIR__ . '/../validation/market-filters-php-fixture.json', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
