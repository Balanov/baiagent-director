<?php
declare(strict_types=1);
$_SERVER['REQUEST_METHOD'] = 'CLI';
$source = file_get_contents(__DIR__ . '/../public/api/research.php');
$prefix = substr($source, 5, strpos($source, "\ntry {") - 5);
$prefix = str_replace("require_once __DIR__ . '/market.php';", "require_once __DIR__ . '/../public/api/market.php';", $prefix);
eval($prefix);
$cdek = company_name_from(['title' => 'www.cdek.ru'], 'https://www.cdek.ru/');
$kasperskyPage = parse_page('<html><head><title>Защитные решения кибербезопасности для дома и бизнеса | Лаборатория Касперского</title></head><body>Решения для бизнеса</body></html>', 'https://www.kaspersky.ru/', 'site-k');
$kaspersky = company_name_from($kasperskyPage, 'https://www.kaspersky.ru/');
$structuredPage = parse_page('<html><head><script type="application/ld+json">{"@type":"Organization","name":"Kaspersky"}</script></head><body>Решения</body></html>', 'https://www.kaspersky.ru/', 'site-j');
$shortBrand = relevant_search_result('CDEK расширяет сеть', 'https://example.org/cdek', 'Новость о CDEK', 'https://www.cdek.ru/', 'CDEK');
$soapPlan = market_plan([['kind' => 'company-site', 'companyName' => 'ММК', 'title' => 'Мыловаренная компания', 'text' => 'Собственное производство натурального мыла. Изготавливаем мыло ручной работы и косметику оптом.']]);
$clinicPlan = market_plan([['kind' => 'company-site', 'companyName' => 'Клиника', 'title' => 'Стоматология для всей семьи', 'text' => 'Медицинская клиника. Стоматологические услуги: лечение зубов, имплантация и протезирование.']]);
$lawPlan = market_plan([['kind' => 'company-site', 'companyName' => 'Адвокатское бюро', 'title' => 'Адвокатское бюро', 'text' => 'Юридические услуги и правовая поддержка бизнеса. Практики: разрешение споров, банкротство, сопровождение кредитных сделок и налоговое консультирование.']]);
$evidence = ['title' => 'Рынок мыла: динамика спроса', 'text' => 'Исследование рынка мыла показывает рост спроса и изменение объёма продаж в текущем году.'];
$customer = ['title' => 'Как выбрать мыло', 'text' => 'Покупатели и клиенты при выборе мыла оценивают состав, качество и читают отзывы о производителе.'];
$price = ['title' => 'Цены на мыло оптом', 'text' => 'Сравнение цен и тарифов поставщиков мыла: стоимость зависит от состава и объёма партии.'];
$wrongEvidence = ['title' => 'Рынок станков', 'text' => 'Исследование рынка промышленного оборудования показывает динамику спроса и рост производства станков.'];
$firePlan = market_plan([['kind' => 'company-site', 'companyName' => 'ООО «Имидж-Боровичи»', 'title' => 'Производство спичек и средств для розжига в России - IMAGE', 'text' => 'Собственное производство спичек и средств для розжига. Поставляем продукцию оптом.']]);
$ownProduct = ['title' => 'Спички для пикника 30 шт Image', 'url' => 'https://trofey.ru/catalog/spichki_image/', 'text' => 'Спички для пикника 30 шт Image. Купить товар для розжига по цене интернет-магазина.'];
$decodedWithReplacedUtf8 = json_decode(encode_json(['text' => "Доказательство\xB1сохранено"]), true);
$GLOBALS['research_deadline'] = microtime(true) - 1;
$expiredFetchRejected = false;
try { fetch_public('https://example.com/'); } catch (RuntimeException $error) { $expiredFetchRejected = str_contains($error->getMessage(), 'лимит времени'); }
$partialWeb = [['id' => 'web-1', 'kind' => 'review-snippet', 'url' => 'https://example.com/review', 'title' => 'Отзыв', 'text' => 'Сохранённая поисковая цитата', 'contentOrigin' => 'search-snippet']];
$partialWarnings = [];
enrich_external($partialWeb, 'https://company.example/', [], $partialWarnings);
unset($GLOBALS['research_deadline']);
$englishWithRussianMenu = research_detect_language('en', str_repeat('Our company provides products and services for customers with clear prices and reliable business support. ', 12) . ' Меню Отзывы Контакты');
research_set_language('en');
$englishWarning = research_translated_notice('Логотип не определён: изображения без явных признаков бренда не используются.');
research_set_language('ru');
$checks = [
    'phpMatchesJavaScriptLanguageThreshold' => $englishWithRussianMenu === 'en',
    'phpDiagnosticsUseSelectedLanguage' => !preg_match('~[а-яё]~iu', $englishWarning),
    'expiredBudgetStopsNetworkFetch' => $expiredFetchRejected,
    'partialCoverageIsReported' => count($partialWarnings) === 1 && $partialWeb[0]['text'] === 'Сохранённая поисковая цитата',
    'cdek' => $cdek === 'CDEK',
    'kaspersky' => $kaspersky === 'Лаборатория Касперского',
    'structured' => $structuredPage['organizationName'] === 'Kaspersky',
    'shortBrand' => $shortBrand,
    'soapIndustry' => $soapPlan['industry'] === 'manufacturing',
    'soapSubject' => $soapPlan['subject'] === 'мыло',
    'soapQueries' => str_contains($soapPlan['competitorQueries'][0], 'мыло'),
    'clinicIndustry' => $clinicPlan['industry'] === 'healthcare',
    'clinicSubject' => $clinicPlan['subject'] === 'стоматологические услуги',
    'lawIndustry' => $lawPlan['industry'] === 'professional',
    'lawSubject' => $lawPlan['subject'] === 'юридические услуги',
    'lawQueries' => str_contains($lawPlan['competitorQueries'][0], 'юридические услуги'),
    'evidenceKinds' => array_column($soapPlan['evidenceQueries'], 'kind') === ['industry-snippet', 'customer-snippet', 'market-price-snippet'],
    'industryEvidence' => market_evidence($evidence, $soapPlan, 'industry-snippet'),
    'customerEvidence' => market_evidence($customer, $soapPlan, 'customer-snippet'),
    'priceEvidence' => market_evidence($price, $soapPlan, 'market-price-snippet'),
    'wrongEvidenceRejected' => !market_evidence($wrongEvidence, $soapPlan, 'industry-snippet'),
    'commercialCatalog' => market_candidate(['title' => 'Мыло оптом — каталог', 'url' => 'https://supplier-catalog.example/', 'text' => 'Каталог натурального мыла. Купить оптом по цене поставщика.'], $soapPlan, 'https://soap.example/'),
    'marketplaceRejected' => !market_candidate(['title' => 'Мыло оптом — каталог', 'url' => 'https://www.ozon.ru/category/soap', 'text' => 'Каталог натурального мыла. Купить оптом по цене поставщика.'], $soapPlan, 'https://soap.example/'),
    'avitoRejected' => !market_candidate(['title' => 'Спички и средства для розжига', 'url' => 'https://www.avito.ru/catalog/rozzhig', 'text' => 'Купить спички и средства для розжига по цене продавца.'], $firePlan, 'https://firestarters.ru/'),
    'avitoSourceRejected' => excluded_web_source_url('https://www.avito.ru/catalog/rozzhig'),
    'ozonMarketplaceRejected' => !market_candidate(['title' => 'Розжиг для мангала', 'url' => 'https://www.ozon.uz/product/rozzhig', 'text' => 'Купить средство для розжига по цене продавца.'], $firePlan, 'https://firestarters.ru/'),
    'analyticsSourceRejected' => excluded_web_source_url('https://wildbox.ru/brand-analytics/image'),
    'ownAliasExtracted' => in_array('IMAGE', $firePlan['ownAliases'], true),
    'ownProductRejected' => !market_candidate($ownProduct, $firePlan, 'https://firestarters.ru/'),
    'negativeSubjectRejected' => !market_candidate(['title' => 'Косметика без мыла', 'url' => 'https://factory.example/', 'text' => 'Производим натуральное мыло и поставляем продукцию оптом.'], $soapPlan, 'https://soap.example/'),
    'reviewHost' => is_review_material(['title' => 'Спички — отзыв покупателя', 'url' => 'https://irecommend.ru/content/matches', 'text' => 'Негативный отзыв о товаре и личный опыт использования.']),
    'analyticsNotReview' => !is_review_material(['title' => 'Аналитика, продажи бренда', 'url' => 'https://wildbox.ru/brand-analytics/image', 'text' => 'Средняя оценка товаров и 0 отзывов. Объём продаж бренда за неделю.']),
    'subdomainBrand' => competitor_name(['title' => 'CH', 'url' => 'https://ch.rusles-35.ru/catalog/']) === 'rusles-35',
    'wwwNotBrand' => competitor_name(['title' => 'WWW', 'url' => 'https://www.supplier.ru/']) === 'supplier',
    'genericRozhigNotBrand' => competitor_name(['title' => 'Розжиг', 'url' => 'https://yarmaco.ru/']) === 'YARMACO',
    'industryNews' => str_contains($soapPlan['newsQuery'], 'мыло') && str_contains($soapPlan['newsQuery'], 'производство'),
    'invalidUtf8DoesNotEmptyResponse' => is_array($decodedWithReplacedUtf8) && str_contains($decodedWithReplacedUtf8['text'] ?? '', 'Доказательство') && str_contains($decodedWithReplacedUtf8['text'] ?? '', "\u{FFFD}"),
];
echo json_encode(['values' => ['cdek' => $cdek, 'kaspersky' => $kaspersky, 'soapPlan' => $soapPlan, 'clinicPlan' => $clinicPlan], 'checks' => $checks], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
