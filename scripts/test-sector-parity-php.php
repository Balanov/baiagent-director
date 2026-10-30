<?php
declare(strict_types=1);
require __DIR__ . '/test-php.php';

$own = fn(string $text, array $offerings = []): array => ['id' => 'site-1', 'kind' => 'company-site', 'url' => 'https://company.example/', 'title' => 'Компания', 'text' => $text, 'offerings' => $offerings];
$software = market_plan([$own('Продукты для юристов и бухгалтеров. Компания — разработчик справочной правовой системы и информационных продуктов.')]);
$collaboration = market_plan([$own('Team collaboration software and a cloud platform for shared work and project management.')]);
$ecommerce = market_plan([$own('Ecommerce software and a cloud commerce platform for online stores.')]);
$engineering = market_plan([$own('Industrial software: CAD, CAM and PLM for engineering teams and the digital twin.')]);
$restaurant = market_plan([$own('Сеть ресторанов русской кухни. Меню: блины, завтраки, супы и десерты.')]);
$marketplace = market_plan([$own('Сервис поиска специалистов. Заказчики описывают задачи, а исполнители присылают предложения. В каталоге есть юристы, курьеры и репетиторы.')]);
$retail = market_plan([$own('Интернет-магазин электроники и бытовой техники. Каталог товаров и розничные продажи.')]);
$logistics = market_plan([$own('СДЭК — транспортная компания для доставки документов, товаров и грузов. Логистические услуги и отправления для бизнеса.')]);
$kamaz = ['companyName' => 'КАМАЗ', 'requestedUrl' => 'https://kamaz.example/', 'sources' => [$own('Производство грузовых автомобилей.', [['name' => 'КАМАЗ 54901']])], 'offerings' => [['name' => 'КАМАЗ 54901']]];
$cdek = ['companyName' => 'CDEK', 'requestedUrl' => 'https://cdek.example/', 'sources' => [$own('')], 'offerings' => []];
$firestarters = ['companyName' => 'ООО «Имидж-Боровичи»', 'requestedUrl' => 'https://firestarters.example/', 'sources' => [$own('Производство товаров для розжига.', [['name' => 'Древесные брикеты']])], 'offerings' => [['name' => 'Древесные брикеты']]];
$siemens = ['companyName' => 'Siemens', 'requestedUrl' => 'https://siemens.example/', 'sources' => [$own('Industrial software and digital products.')], 'offerings' => [['name' => 'Building X']]];
$shopify = ['companyName' => 'Shopify', 'requestedUrl' => 'https://shopify.example/', 'sources' => [$own('Ecommerce software and a cloud platform.')], 'offerings' => []];
$legalReview = ['companyName' => 'КонсультантПлюс', 'requestedUrl' => 'https://company.example/', 'sources' => [$own('Программные продукты для юристов.')], 'offerings' => []];
$restaurantReview = ['companyName' => 'Теремок', 'requestedUrl' => 'https://teremok.example/', 'sources' => [$own('Сеть ресторанов русской кухни. Меню и блины.')], 'offerings' => [['name' => 'Завтрак Богатырский']], 'marketContext' => ['subject' => 'ресторанный сервис']];

$checks = [
    'legalSoftware' => $software['industry'] === 'software' && $software['subject'] === 'программные и информационные продукты для юристов',
    'legalQueries' => str_contains($software['competitorQueries'][0], 'разработчик') && !str_contains($software['competitorQueries'][0], 'юридические услуги'),
    'lawFirmRejected' => !market_candidate(['title' => 'Юридические услуги', 'url' => 'https://law.example/', 'text' => 'Юридические услуги оказывают адвокаты. Стоимость юридического сопровождения указана в прайсе.'], $software, 'https://company.example/'),
    'legalSoftwareAccepted' => market_candidate(['title' => 'Справочная правовая система', 'url' => 'https://legal-software.example/', 'text' => 'Разработчик информационной системы и программных продуктов для юристов. Пробный доступ и внедрение.'], $software, 'https://company.example/'),
    'ecommerceFamily' => $ecommerce['softwareFamily'] === 'ecommerce',
    'engineeringFamily' => $engineering['softwareFamily'] === 'engineering',
    'collaborationFamily' => $collaboration['softwareFamily'] === 'collaboration',
    'collaborationAccepted' => market_candidate(['title' => 'Тарифы VK WorkSpace для бизнеса', 'url' => 'https://workspace.example/tariffs/', 'text' => 'SaaS и облачная платформа: корпоративный мессенджер, доски и видеозвонки для команд.'], $collaboration, 'https://company.example/'),
    'unrelatedSoftwareRejected' => !market_candidate(['title' => 'Защищённое мобильное рабочее место', 'url' => 'https://mobile.example/', 'text' => 'Программное обеспечение и цифровая платформа для работы с документами на мобильном устройстве.'], $collaboration, 'https://company.example/'),
    'restaurantMarket' => $restaurant['subject'] === 'ресторанный сервис',
    'restaurantFurnitureRejected' => !market_candidate(['title' => 'Мебельная фабрика', 'url' => 'https://furniture.example/', 'text' => 'Производим мебель для дома, кафе и ресторанов. Столы и стулья по доступным ценам.'], $restaurant, 'https://company.example/'),
    'restaurantAccepted' => market_candidate(['title' => 'Ресторан русской кухни', 'url' => 'https://restaurant.example/', 'text' => 'Сеть ресторанов. В меню блины, завтраки, супы и десерты. Заказать столик.'], $restaurant, 'https://company.example/'),
    'restaurantTrainingRejected' => !market_candidate(['title' => 'Курсы официантов', 'url' => 'https://school.example/', 'text' => 'Обучение официантов и другого персонала в кафе и ресторане. Система структурированного каталога меню и стандартов.'], $restaurant, 'https://company.example/'),
    'marketplaceModel' => !empty($marketplace['serviceMarketplace']) && str_contains($marketplace['competitorQueries'][0], 'поиска специалистов'),
    'courierNotMarketplace' => !market_candidate(['title' => 'Курьерская служба', 'url' => 'https://courier.example/', 'text' => 'Курьерские услуги и доставка посылок. Тарифы и стоимость.'], $marketplace, 'https://company.example/'),
    'marketplaceAccepted' => market_candidate(['title' => 'Платформа специалистов', 'url' => 'https://marketplace.example/', 'text' => 'Платформа поиска специалистов. Заказчики и исполнители обсуждают услуги и цены.'], $marketplace, 'https://company.example/'),
    'agencyPortfolioRejected' => !market_candidate(['title' => 'FindPRO — сервис поиска специалистов', 'url' => 'https://agency.example/projects/findpro/', 'text' => 'Платформа поиска специалистов. Заказчики и исполнители обсуждают услуги и цены.'], $marketplace, 'https://company.example/'),
    'wholesaleNotRetail' => !market_candidate(['title' => 'Электроника оптом', 'url' => 'https://wholesale.example/', 'text' => 'Оптовый магазин электроники. Продаем только оптом, минимальная сумма заказа 15 000 рублей.'], $retail, 'https://company.example/'),
    'retailerAccepted' => market_candidate(['title' => 'Интернет-магазин электроники', 'url' => 'https://retailer.example/', 'text' => 'Купить электронику в розницу. Каталог товаров, корзина и цены для покупателей.'], $retail, 'https://company.example/'),
    'logisticsMarket' => $logistics['industry'] === 'logistics',
    'merchantDeliveryRejected' => !market_candidate(['title' => 'Оплата и доставка | Интернет-магазин FURNIMAX', 'url' => 'https://furniture.example/delivery/', 'text' => 'Доставка заказов от 2000 ₽. Отправка через транспортные компании и другие ТК. Условия доставки мебели и получения заказа в интернет-магазине.'], $logistics, 'https://cdek.example/'),
    'editorialCompetitorRejected' => !market_candidate(['title' => 'Программы для юристов: обзор лучших решений', 'url' => 'https://editorial.example/article/software', 'text' => 'Программные продукты и информационная система для юристов. Пробный доступ и внедрение.'], $software, 'https://company.example/'),
    'conferenceCompetitorRejected' => !market_candidate(['title' => 'Двадцать первая Международная Конференция', 'url' => 'https://library.example/events/conference/', 'text' => 'Конференция библиотек и информационных ресурсов. Программные продукты и информационные системы для юристов, регистрация участников.'], $software, 'https://company.example/'),
    'punycodeName' => competitor_name(['title' => 'Производитель оптом', 'url' => 'https://xn--d1atcelt5b.xn--p1ai/']) === 'ПРОТДЫХ',
    'titleAcronym' => competitor_name(['title' => 'RAUTAGRILL Древесный уголь и средства для розжига', 'url' => 'https://rautagrill.example/']) === 'RAUTAGRILL',
    'structuredName' => competitor_name(['siteName' => 'Сварожич', 'title' => 'Производитель оптом', 'url' => 'https://xn--d1atcelt5b.xn--p1ai/']) === 'Сварожич',
    'workspaceName' => competitor_name(['title' => 'Тарифы VK WorkSpace для бизнеса', 'url' => 'https://workspace.example/tariffs/']) === 'VK WorkSpace',
    'domainSiteName' => competitor_name(['siteName' => 'GOMARKT.RU', 'title' => 'Электроника оптом', 'url' => 'https://gomarkt.example/']) === 'GOMARKT',
    'genericTitleFallback' => competitor_name(['title' => 'Логистика для бизнеса - аутсорсинг', 'url' => 'https://www.dellin.ru/']) === 'DELLIN',
    'pramoRejected' => !is_relevant_company_review(['title' => 'Диск сцепления PRAMO для КАМАЗ — отзывы', 'url' => 'https://reviews.example/product/pramo-clutch', 'text' => '9 отзывов про товар PRAMO. Диск сцепления на автомобиль КАМАЗ. Установил без проблем, качество отличное. Товар — PRAMO 14-1601130.'], $kamaz),
    'deliveryProductRejected' => !is_relevant_company_review(['title' => 'Сапборд надувной Ocean SUP-board — реальные отзывы', 'url' => 'https://market.example/product/sup-board/', 'text' => 'Реальные отзывы покупателей. Комплектация: доставка CDEK. Прекрасный сап. Съездили в поездку по озёрам.'], $cdek),
    'generalCatalogRejected' => !is_relevant_company_review(['title' => 'Продукция России — 87000 товаров в каталоге', 'url' => 'https://catalog.example/products/page-1349', 'text' => 'Каталог товаров и производителей. КонсультантПлюс в общем списке поставщиков. 5 отзывов о разных товарах.'], $legalReview),
    'productWithoutExperienceRejected' => !is_relevant_company_review(['title' => 'Брикет для розжига Имидж-Боровичи 32 шт — купить', 'url' => 'https://market.example/product/image-briquettes', 'text' => '149,99 ₽. 4,6 оценки, 5 отзывов. Рекомендуем. Купить с доставкой. Подробнее о товаре и характеристиках.'], $firestarters),
    'ownProductReviewAccepted' => is_relevant_company_review(['title' => 'Брикет для розжига Имидж-Боровичи 32 шт — отзывы', 'url' => 'https://market.example/product/image-briquettes', 'text' => '5 отзывов. Наталья: отлично разжигаются, всем рекомендую. Юлия: очень мне понравился этот брикет.'], $firestarters),
    'howToReviewRejected' => !is_relevant_company_review(['title' => 'Как покупать товары за границей: четыре способа', 'url' => 'https://editorial.example/list/shopping/', 'text' => 'CDEK Shopping: рейтинг и отзывы. Мы заказывали товар и рекомендуем несколько способов доставки.'], $cdek),
    'searchReviewRejected' => !is_relevant_company_review(['title' => 'CDEK — отзывы и рейтинг', 'url' => 'https://market.example/search?text=CDEK', 'text' => '5 отзывов. Мы заказывали доставку CDEK и остались довольны.'], $cdek),
    'distributorRejected' => !is_relevant_company_review(['title' => 'Официальный дистрибьютор Siemens', 'url' => 'https://distributor.example/', 'text' => 'Дистрибьютор Siemens. Отзывы и рейтинг оборудования, 5 отзывов.'], $siemens),
    'applianceRejected' => !is_relevant_company_review(['title' => 'Стиральная машина Siemens — отзывы', 'url' => 'https://reviews.example/catalog/washing-machine', 'text' => 'Отзывы покупателей и пользователей. Я купил стиральную машину Siemens и рекомендую её. 5 отзывов.'], $siemens),
    'storeRejected' => !is_relevant_company_review(['title' => 'Siemens — отзывы', 'url' => 'https://reviews.example/shop/siemens-centre.example', 'text' => '91 отзыв про интернет-магазин Siemens. Я заказывал бытовую технику и доволен доставкой.'], $siemens),
    'softwareReviewAccepted' => is_relevant_company_review(['title' => 'Shopify — обзор и отзывы', 'pageType' => 'article', 'url' => 'https://software-reviews.example/shopify', 'text' => 'Наша оценка: 4,0 из 5. Мы используем Shopify и рекомендуем сервис. Плюсы и минусы, 4 отзыва пользователей.'], $shopify),
    'menuRejected' => !is_relevant_company_review(['title' => 'Актуальное меню ресторана Теремок. Отзывы о блюдах и их цены.', 'url' => 'https://reviews.example/teremok/menu/', 'text' => 'Меню от владельца. Блины сладкие. Доставка блюд. Завтрак Богатырский.'], $restaurantReview),
    'restaurantExperienceAccepted' => is_relevant_company_review(['title' => 'Теремок — меню и отзывы', 'url' => 'https://reviews.example/teremok/menu/', 'text' => 'Меню и 120 отзывов. Я заказывал блины, всё понравилось.'], $restaurantReview),
    'articleNotReviewMaterial' => !is_review_material(['pageType' => 'article', 'title' => 'CDEK — отзывы', 'url' => 'https://reviews.example/cdek', 'text' => '5 отзывов, рекомендую.']),
    'searchNotReviewMaterial' => !is_review_material(['title' => 'CDEK — отзывы', 'url' => 'https://market.example/search?text=CDEK', 'text' => '5 отзывов, рекомендую.']),
    'emptyReviewShellRejected' => !is_relevant_company_review(['title' => 'КАМАЗ 54901 отзывы владельцев | Авито', 'contentOrigin' => 'full-page', 'url' => 'https://www.avito.ru/otzyvy_vladelcev/kamaz/54901', 'text' => 'Авито — объявления на сайте Авито. Избранное Корзина Вход и регистрация Разместить объявление. Политика конфиденциальности. Оплачивая услуги на Авито, вы принимаете оферту. Авито использует рекомендательные технологии.'], $kamaz),
    'emptySupplierReviewRejected' => !is_relevant_company_review(['title' => 'ООО «АВТОРОСТ» - Поставщик грузовых автомобилей Камаз', 'contentOrigin' => 'full-page', 'url' => 'https://www.rateshops.ru/info/ooo-avtorost', 'text' => 'Реальные отзывы на ООО «АВТОРОСТ». Рейтинг 0(0) Отзывов 0 (0 положительных, 0 отрицательных). Занимаемся сборкой и продажей спецтехники на шасси Камаз.'], $kamaz),
    'pinterestCompetitorRejected' => !market_candidate(['title' => 'Innovative Project Management Software', 'url' => 'https://ru.pinterest.com/ideas/project-management/123/', 'text' => 'Find and save ideas about innovative project management software on Pinterest.'], $collaboration, 'https://company.example/'),
    'specificCollaborationQuote' => relevant_market_quote(['title' => 'Team Collaboration Software for Gmail | Gmelius', 'text' => 'An AI agent is software that can take a goal and carry it out. Gmelius provides team collaboration through shared inboxes and helps teams manage work.'], $collaboration) === 'Team Collaboration Software for Gmail | Gmelius',
    'shoppingServiceReviewRejected' => !is_relevant_company_review(['title' => 'CDEK. Shopping — отзывы', 'url' => 'https://reviews.yandex.ru/shop/cdek.shopping', 'text' => '11289 отзывов про интернет-магазин CDEK. Shopping. Я заказывал товар из-за границы, доставка заняла месяц.'], ['companyName' => 'CDEK', 'requestedUrl' => 'https://www.cdek.ru/', 'sources' => [$own('Транспортная компания и доставка грузов для бизнеса.')], 'offerings' => [], 'marketContext' => ['industry' => 'logistics', 'subject' => 'доставка для бизнеса']]),
];

$lazy = parse_page('<html><head><meta property="og:type" content="article"><script type="application/ld+json">{"@type":"Organization","name":"Acme","logo":"/brand.svg"}</script></head><body><a class="logo" href="/"><img data-src="/logo-real.png" src="/pixel.png"></a><article class="product-card"><a href="/catalog/blin"><img data-src="/blin-large.jpg" src="/placeholder.png"><h3>Блин А</h3></a><span class="price">350 ₽</span></article></body></html>', 'https://acme.example/catalog/', 'site-1');
$checks['pageMetadata'] = $lazy['pageType'] === 'article' && $lazy['organizationName'] === 'Acme' && in_array('Organization', $lazy['schemaTypes'], true);
$checks['strongLogo'] = $lazy['logoConfidence'] === 'structured' && $lazy['logo'] === 'https://acme.example/brand.svg' && empty($lazy['logoUncertainty']);
$checks['lazyProductImage'] = ($lazy['offerings'][0]['image'] ?? '') === 'https://acme.example/blin-large.jpg';
$checks['offeringUrl'] = ($lazy['offerings'][0]['url'] ?? '') === 'https://acme.example/catalog/blin';
$checks['resolvedLogoWarnings'] = resolved_research_warnings(['Логотип определён только по favicon; визуальное соответствие бренду не подтверждено.', 'Другое предупреждение'], 'structured') === ['Другое предупреждение'];

file_put_contents(__DIR__ . '/../validation/sector-parity-php.json', json_encode(['checks' => $checks, 'plans' => ['software' => $software, 'restaurant' => $restaurant, 'marketplace' => $marketplace]], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode($checks, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
