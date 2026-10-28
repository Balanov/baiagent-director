<?php
declare(strict_types=1);

function market_plan(array $sources): array {
    $industries = [
        'government' => '~министерств|ведомств|муниципальн|государственн[а-яё]* (?:услуг|сервис|орган|портал)|орган[а-яё]* (?:власти|исполнительной)|госуслуг|администраци[яи] (?:города|региона|области|края|республики)~iu',
        'cybersecurity' => '~кибербезопас|антивирус|информационн[а-яё]* безопас|защит[а-яё]* (?:данных|информации)~iu',
        'logistics' => '~логистик|курьерск|оператор доставки|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|отправлени|грузоперевоз|фулфилмент~iu',
        'distribution' => '~дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* (?:оборудования|техники)~iu',
        'manufacturing' => '~производим|производител|производств|собственн[а-яё]* (?:производств|фабрик)|изготавлива|фабрик|завод-изготовител|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси~iu',
        'retail' => '~интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател|электроник|бытов[а-яё]* техник~iu',
        'food' => '~ресторан|пицц|продукт[а-яё]* питания|кейтеринг|кофейн~iu',
        'finance' => '~банк(?!рот)|страхован|лизинг|кредит|плат[её]ж~iu',
        'construction' => '~строительств|стройматериал|инженерн[а-яё]* систем|проектировани~iu',
        'healthcare' => '~медицин|клиник|стоматолог|фармацевт~iu',
        'education' => '~обучени|образован|курсы|тренинг~iu',
        'professional' => '~консалтинг|аудит|юридическ|правов|адвокат|бухгалтер|внедрен~iu',
    ];
    $own = array_values(array_filter($sources, fn($source) => ($source['kind'] ?? '') === 'company-site' && strlen(trim((string)($source['text'] ?? ''))) >= 40));
    $independent = array_values(array_filter($sources, fn($source) => in_array($source['kind'] ?? '', ['search-snippet', 'review-snippet'], true) && strlen(trim((string)($source['text'] ?? ''))) >= 40));
    $basis = $own ?: $independent;
    $primary = ''; $secondary = ''; $offeringText = '';
    foreach ($basis as $index => $source) {
        $text = ($source['title'] ?? '') . ' ' . ($source['text'] ?? '');
        if ($index === 0) $primary = $text; else $secondary .= ' ' . $text;
        foreach ($source['offerings'] ?? [] as $offering) $offeringText .= ' ' . ($offering['name'] ?? '') . ' ' . ($offering['displayName'] ?? '');
    }
    $strength = [
        'logistics' => '~курьерск|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|логистическ[а-яё]* (?:компан|оператор|услуг)~iu',
        'manufacturing' => '~производственн[а-яё]* (?:система|площадк|мощност|процесс)|завод|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси~iu',
        'finance' => '~банковск[а-яё]* (?:услуг|продукт|сервис)|банк\s+(?:для|предлагает)|открыть\s+(?:сч[её]т|вклад)|ипотек|дебетов[а-яё]* карт|кредитн[а-яё]* карт~iu',
    ];
    $scores = [];
    foreach ($industries as $id => $pattern) {
        $scores[$id] = min(8, preg_match_all($pattern, $primary)) * 4 + min(8, preg_match_all($pattern, $secondary));
        if (isset($strength[$id])) $scores[$id] += min(8, preg_match_all($strength[$id], $primary)) * 6 + min(8, preg_match_all($strength[$id], $secondary)) * 2;
    }
    arsort($scores); $industry = array_key_first($scores); if (($scores[$industry] ?? 0) < 1) $industry = 'professional';
    $subjects = [
        ['~мыл[аоуе]~iu', 'мыло'], ['~металлопрокат|металлопродукц|стальн|листов[а-яё]* сталь~iu', 'металлопродукция'],
        ['~мебел~iu', 'мебель'], ['~косметик~iu', 'косметика'], ['~электроник|бытов[а-яё]* техник~iu', 'электроника'], ['~стройматериал~iu', 'стройматериалы'],
        ['~стоматолог|зубн[а-яё]* (?:имплант|протез|лечени)~iu', 'стоматологические услуги'], ['~медицинск[а-яё]* (?:клиник|центр|услуг)|клиник~iu', 'медицинские услуги'],
        ['~юридическ[а-яё]* (?:услуг|компан|консульт)|адвокат|юрист~iu', 'юридические услуги'], ['~бухгалтерск[а-яё]* (?:услуг|обслужив|сопровожд)|аудит~iu', 'бухгалтерские и аудиторские услуги'],
        ['~недвижимост|квартир|застройщ|ипотек~iu', 'недвижимость'], ['~ремонт[а-яё]* (?:квартир|помещени|домов)|отделочн[а-яё]* работ~iu', 'ремонт и отделка помещений'],
        ['~онлайн[- ]?(?:курс|школ|обучени)|образовательн[а-яё]* (?:программ|услуг)~iu', 'образовательные программы'], ['~корпоративн[а-яё]* обучени|тренинг~iu', 'корпоративное обучение'],
        ['~спич|розжиг|древесн[а-яё]* (?:ролл|брикет)|сух[а-яё]* горюч|щеп[а-яё]* для копчен~iu', 'товары для розжига'],
        ['~упаковк|тар[аыуе]\b~iu', 'упаковка'], ['~полиграф|печат[а-яё]* (?:продукц|услуг)|типограф~iu', 'полиграфические услуги'],
        ['~грузов[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|бортов[а-яё]* автомобил|шасси~iu', 'грузовые автомобили'],
        ['~автозапчаст|автосервис|ремонт[а-яё]* автомобил~iu', 'автотовары и автосервис'], ['~химическ[а-яё]* (?:продукц|сырь)|промышленн[а-яё]* хим~iu', 'промышленная химия'],
        ['~пластик|полимер~iu', 'полимерная продукция'], ['~туристическ[а-яё]* (?:услуг|поездк)|туроператор|турагент~iu', 'туристические услуги'],
        ['~гостиниц|отел[ьеяю]~iu', 'гостиничные услуги'], ['~фитнес|спортивн[а-яё]* клуб~iu', 'фитнес-услуги'],
        ['~салон[а-яё]* красот|косметолог~iu', 'услуги красоты'], ['~складск[а-яё]* (?:техник|оборудован)|погрузчик~iu', 'складская техника'],
        ['~промышленн[а-яё]* оборудован|станк[а-яё]*|компрессор~iu', 'промышленное оборудование'], ['~одежд|обув[ьи]~iu', 'одежда и обувь'],
        ['~продукт[а-яё]* питания|бакале|кондитерск~iu', 'продукты питания'], ['~saas|программн[а-яё]* обеспечени|it[- ]?платформ|цифров[а-яё]* платформ~iu', 'программные продукты'],
    ];
    $defaults = ['government' => 'цифровые государственные сервисы', 'logistics' => 'доставка для бизнеса', 'cybersecurity' => 'кибербезопасность', 'distribution' => 'оборудование', 'manufacturing' => 'продукция', 'retail' => 'товары', 'food' => 'продукты питания', 'finance' => 'финансовые услуги', 'construction' => 'строительство', 'healthcare' => 'медицинские услуги', 'education' => 'обучение', 'professional' => 'профессиональные услуги'];
    $subject = $defaults[$industry] ?? $defaults['professional'];
    $serviceScopes = [
        'healthcare' => ['стоматологические услуги', 'медицинские услуги', 'услуги красоты'],
        'education' => ['образовательные программы', 'корпоративное обучение'],
        'professional' => ['юридические услуги', 'бухгалтерские и аудиторские услуги', 'туристические услуги', 'гостиничные услуги', 'фитнес-услуги', 'услуги красоты', 'программные продукты'],
    ];
    $serviceSubjects = array_unique(array_merge(...array_values($serviceScopes)));
    $productIndustries = ['manufacturing', 'retail', 'distribution', 'construction', 'food'];
    $scopedSubjects = isset($serviceScopes[$industry])
        ? array_values(array_filter($subjects, fn($item) => in_array($item[1], $serviceScopes[$industry], true)))
        : (in_array($industry, $productIndustries, true) ? array_values(array_filter($subjects, fn($item) => !in_array($item[1], $serviceSubjects, true))) : []);
    $subjectScores = [];
    foreach ($scopedSubjects as [$pattern, $value]) $subjectScores[$value] = min(20, preg_match_all($pattern, $offeringText)) * 12 + min(20, preg_match_all($pattern, $primary)) * 4 + min(20, preg_match_all($pattern, $secondary));
    if ($subjectScores) { arsort($subjectScores); if ((reset($subjectScores) ?: 0) > 0) $subject = array_key_first($subjectScores); }
    $relevance = [
        'government' => '~госуслуг|государственн[а-яё]* (?:услуг|сервис|портал)|муниципальн[а-яё]* (?:услуг|сервис|портал)|цифровизац[а-яё]* (?:государственн|муниципальн)~iu',
        'logistics' => '~логистик|доставк|грузоперевоз|фулфилмент|отправлени~iu',
        'cybersecurity' => '~кибербезопас|информационн[а-яё]* безопас|антивирус|защит[а-яё]* (?:данных|информации)~iu',
        'distribution' => '~дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* оборудования~iu',
        'manufacturing' => '~производств|изготавлива|фабрик|оптов~iu',
        'retail' => '~интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател~iu',
        'food' => '~ресторан|продукт[а-яё]* питания|кейтеринг|кофейн~iu',
        'finance' => '~банк(?!рот)|страхован|лизинг|кредит|плат[её]ж~iu',
        'construction' => '~строительств|стройматериал|инженерн[а-яё]* систем~iu',
        'healthcare' => '~медицин|клиник|стоматолог|фармацевт~iu',
        'education' => '~обучени|образован|курсы|тренинг~iu',
        'professional' => '~консалтинг|аудит|юридическ|правов|адвокат|бухгалтер|внедрен~iu',
    ][$industry];
    $defaultQueries = match($industry) {
        'government' => ['цифровизация государственных услуг платформа', 'портал государственных услуг регион'],
        'logistics' => ['логистика для бизнеса доставка компания', 'доставка для интернет-магазинов компания тарифы'],
        'cybersecurity' => ['кибербезопасность решения для бизнеса компания', 'защита информации продукты для бизнеса'],
        'distribution' => ['дистрибуция оборудования поставки компания', 'оптовые поставки оборудование каталог'],
        'manufacturing' => ['производитель оптом продукция купить', 'производство продукция каталог компания'],
        'retail' => ['интернет-магазин каталог товары цены', 'купить интернет-магазин электроника'],
        'food' => ['продукты питания производитель оптом', 'ресторанный сервис компания'],
        'finance' => ['финансовые услуги для бизнеса компания', 'банк для бизнеса сервисы'],
        'construction' => ['строительство инженерные решения компания', 'стройматериалы производитель поставщик'],
        'healthcare' => ['медицинские услуги клиника', 'медицина для бизнеса компания'],
        'education' => ['корпоративное обучение компания курсы', 'образование для бизнеса программы'],
        default => ['консалтинг для бизнеса компания услуги', 'аудит юридические услуги компания'],
    };
    $searchSubject = $subject === 'товары для розжига' ? 'спички ' . $subject : $subject;
    $queries = $subject !== ($defaults[$industry] ?? $defaults['professional'])
        ? (in_array($industry, $productIndustries, true) ? [$searchSubject . ' производитель поставщик цены', $searchSubject . ' оптом каталог компания'] : [$searchSubject . ' компания услуги цены', $searchSubject . ' организации сервис стоимость'])
        : $defaultQueries;
    $year = gmdate('Y');
    $evidenceQueries = [
        ['kind' => 'industry-snippet', 'query' => $searchSubject . ' рынок динамика спрос ' . $year, 'message' => 'Проверяю отраслевую динамику и спрос: ' . $subject],
        ['kind' => 'customer-snippet', 'query' => $searchSubject . ' как выбрать отзывы жалобы клиенты', 'message' => 'Ищу критерии выбора и повторяющиеся жалобы: ' . $subject],
        ['kind' => 'market-price-snippet', 'query' => $searchSubject . ' цены тарифы стоимость сравнение', 'message' => 'Собираю рыночный ценовой контекст: ' . $subject],
    ];
    $newsQuery = $subject === 'товары для розжига' ? 'спички производство' : '"' . $searchSubject . '" (рынок OR производство OR спрос OR цены)';
    $titleParts = preg_split('/\s*(?:\||—|–|\s+-\s+)\s*/u', clean_text((string)($own[0]['title'] ?? '')), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $ownAlias = count($titleParts) > 1 ? clean_text((string)end($titleParts)) : '';
    $ownAliases = strlen($ownAlias) >= 3 && strlen($ownAlias) <= 100 ? [$ownAlias] : [];
    return ['industry' => $industry, 'subject' => $subject, 'companyName' => clean_text((string)($basis[0]['companyName'] ?? '')), 'ownAliases' => $ownAliases, 'competitorQueries' => $queries, 'evidenceQueries' => $evidenceQueries, 'relevance' => $relevance, 'newsQuery' => $newsQuery];
}

function market_subject_pattern(string $subject): string {
    $roots = [
        'мыло' => 'мыл', 'металлопродукция' => 'металло', 'мебель' => 'мебел', 'косметика' => 'косметик', 'электроника' => 'электрон',
        'стройматериалы' => 'стройматериал', 'стоматологические услуги' => 'стоматолог', 'медицинские услуги' => 'медицин|клиник',
        'юридические услуги' => 'юридическ|юрист|адвокат', 'бухгалтерские и аудиторские услуги' => 'бухгалтер|аудит',
        'недвижимость' => 'недвижимост|квартир|ипотек', 'ремонт и отделка помещений' => 'ремонт|отделочн',
        'образовательные программы' => 'образован|обучени|курс', 'корпоративное обучение' => 'корпоративн[а-яё]* обучени|тренинг',
        'товары для розжига' => 'спич|розжиг|древесн[а-яё]* (?:ролл|брикет)|сух[а-яё]* горюч|щеп[а-яё]* для копчен',
        'упаковка' => 'упаковк|тар[аыуе]\b', 'полиграфические услуги' => 'полиграф|типограф|печат',
        'грузовые автомобили' => 'грузов[а-яё]* автомобил|самосвал|тягач|бортов[а-яё]* автомобил|шасси',
        'автотовары и автосервис' => 'автозапчаст|автосервис|автомобил', 'промышленная химия' => 'химическ|химия',
        'полимерная продукция' => 'полимер|пластик', 'туристические услуги' => 'турист|туроператор|турагент',
        'гостиничные услуги' => 'гостиниц|отел', 'фитнес-услуги' => 'фитнес', 'услуги красоты' => 'красот|косметолог',
        'складская техника' => 'складск[а-яё]* техник|погрузчик', 'промышленное оборудование' => 'промышленн[а-яё]* оборудован|станк|компрессор',
        'одежда и обувь' => 'одежд|обув', 'продукты питания' => 'продукт[а-яё]* питания|бакале|кондитерск',
        'программные продукты' => 'saas|программн[а-яё]* обеспечени|платформ', 'доставка для бизнеса' => 'доставк',
        'кибербезопасность' => 'кибербезопас|информационн[а-яё]* безопас',
    ];
    return '~' . ($roots[$subject] ?? preg_quote($subject, '~')) . '~iu';
}
function market_competitor_content(string $text, array $plan): bool {
    $generic = ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'цифровые государственные сервисы'];
    if (($plan['industry'] ?? '') === 'logistics' && !preg_match('~логистик|курьерск|грузоперевоз|оператор доставки|служб[а-яё]* доставки|отправлени|фулфилмент~iu', $text)) return false;
    $isGeneric = in_array($plan['subject'], $generic, true);
    if (!$isGeneric && !preg_match(market_subject_pattern($plan['subject']), $text)) return false;
    if ($isGeneric && !preg_match($plan['relevance'], $text)) return false;
    if (in_array($plan['industry'] ?? '', ['logistics', 'professional', 'government', 'cybersecurity', 'healthcare', 'education'], true)) return (bool)preg_match('~услуг|сервис|тариф|стоимост|цен[аыуе]|заказать|доставк|перевоз|отправлени|консультац|внедрен|защит~iu', $text);
    return (bool)preg_match('~производств|производител|изготавлива|фабрик|завод|оптов|оптом|цен[аыуе]|стоимост|каталог|купить|поставля|продаж~iu', $text);
}
function excluded_web_source_url(string $url): bool {
    $host = strtolower(preg_replace('~^www\.~', '', parse_url($url, PHP_URL_HOST) ?: ''));
    if (preg_match('~(?:^|\.)(?:avito\.ru|ozon\.[a-z.]+)$~iu', $host)) return true;
    return (bool)preg_match('~(?:^|\.)wildbox\.ru$~iu', $host) && str_starts_with(strtolower(parse_url($url, PHP_URL_PATH) ?: ''), '/brand-analytics/');
}
function market_candidate(array $item, array $plan, string $site): bool {
    $candidateHost = strtolower(preg_replace('~^www\.~', '', parse_url($item['url'] ?? '', PHP_URL_HOST) ?: ''));
    $ownHost = strtolower(preg_replace('~^www\.~', '', parse_url($site, PHP_URL_HOST) ?: ''));
    if (!$candidateHost || $candidateHost === $ownHost || str_ends_with($candidateHost, '.' . $ownHost) || excluded_web_source_url((string)($item['url'] ?? ''))) return false;
    if (preg_match('~(?:^|\.)(?:yandex\.ru|ya\.ru|2gis\.ru|zoon\.ru|yell\.ru|wikipedia\.org|wikimedia\.org|duckduckgo\.com|bing\.com|google\.com|rbc\.ru|kommersant\.ru|vedomosti\.ru|vc\.ru|cnews\.ru|tadviser\.ru|interfax\.ru|ria\.ru|iz\.ru|forbes\.ru|frc\.ru|tradedir\.ru|optomtovar\.ru|fabricators\.ru|o-zavodah\.ru|productcenter\.ru|supl\.biz|tiu\.ru|pulscen\.ru|optsbyt\.ru|optlist\.ru|mediam\.ru|ozon\.ru|wildberries\.ru|avito\.ru|sima-land\.ru|vseinstrumenti\.ru|onlinetrade\.ru|auchan\.ru|lemanapro\.ru|mktools\.ru|atann\.ru|farpost\.ru|joom\.ru)$~iu', $candidateHost)) return false;
    $text = clean_text(($item['title'] ?? '') . ' ' . ($item['text'] ?? ''));
    $title = clean_text((string)($item['title'] ?? '')); $generic = ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'цифровые государственные сервисы'];
    if (!in_array($plan['subject'], $generic, true) && preg_match('~без\s+[^.!?]{0,40}~iu', $title, $negative) && preg_match(market_subject_pattern($plan['subject']), $negative[0])) return false;
    $ownBrand = explode('.', $ownHost)[0]; $aliases = ['cdek' => ['сдэк'], 'kaspersky' => ['касперск'], 'dns' => ['днс']];
    $ownNames = array_values(array_filter(array_map('lower_text', array_merge([(string)($plan['companyName'] ?? ''), $ownBrand], $plan['ownAliases'] ?? [], $aliases[$ownBrand] ?? [])), fn($name) => strlen($name) >= 3));
    foreach ($ownNames as $name) if (str_contains($candidateHost, $name) || str_contains(lower_text($text), $name)) return false;
    if ($plan['industry'] === 'healthcare') {
        if (preg_match('~(?:^|\.)(?:docdoc|prodoctorov|napopravku|sberhealth|zoon|yandex|2gis)\.[a-z.]+$~iu', $candidateHost)) return false;
        if (preg_match('~мис\s+для|медицинск[а-яё]*\s+информационн[а-яё]*\s+систем|автоматизац[а-яё]*\s+клиник|it[- ]?решени[а-яё]*\s+для\s+клиник|сервис\s+онлайн-записи|агрегатор~iu', $text)) return false;
        if (!preg_match('~клиник|лаборатор|медицинск[а-яё]*\s+центр|диагностик|стационар|пациент~iu', $text)) return false;
    }
    if ($plan['subject'] === 'грузовые автомобили') {
        if (preg_match('~(?:^|\.)(?:made-in-china\.com|alibaba\.com|aliexpress\.com)$~iu', $candidateHost)) return false;
        if (preg_match('~запчаст|аксессуар|сувенир|кондиционер|сервисн[а-яё]*\s+обслуживан|автосервис|ремонт|грузоперевозк|аренд[аыуе]?\s+(?:грузов|авто|транспорт)~iu', $text)) return false;
        $vehicle = '(?:грузов[а-яё]*\s+автомобил[ья]|грузовик[а-яё]*|самосвал[а-яё]*|седельн[а-яё]*\s+тягач[а-яё]*|бортов[а-яё]*\s+автомобил[ья])';
        $commerce = '(?:производ[а-яё]*|изготавлива[а-яё]*|прода[а-яё]*|купить|каталог|дилер[а-яё]*|автосалон[а-яё]*|цен[аыуе])';
        if (!preg_match('~' . $commerce . '[^.!?…]{0,120}' . $vehicle . '|' . $vehicle . '[^.!?…]{0,120}' . $commerce . '~iu', $text)) return false;
    }
    if (strlen($text) < 18 || !market_competitor_content($text, $plan)) return false;
    if (preg_match('~отзывы о|рейтинг компаний|топ-\d|лучшие компании|новости|статья|блог|руководство|как защитить|что такое|википедия|производители .*в России|\d+\s+поставщик|найдено\s+\d+\s+(?:компан|изготовител)~iu', $text)) return false;
    if (preg_match('~/(?:suppliers|producers)(?:/|$)~i', parse_url($item['url'], PHP_URL_PATH) ?: '')) return false;
    return true;
}
function market_news(array $item, array $plan): bool {
    $text = clean_text(($item['title'] ?? '') . ' ' . ($item['text'] ?? '')); $published = strtotime((string)($item['publishedAt'] ?? ''));
    if (strlen($text) < 20 || !$published || $published > time() + 172800 || time() - $published >= 548 * 86400) return false;
    if (preg_match('~как спичк|спички пироманьяку|рассада|рассаду~iu', $text)) return false;
    if (!preg_match('~рынок|рынк[аеу]|динамик|спрос|производств|завод|фабрик|экспорт|импорт|подорожа|подеше|цен[аыуе]|запуск~iu', $text)) return false;
    $generic = ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'цифровые государственные сервисы'];
    return (bool)preg_match(in_array($plan['subject'], $generic, true) ? $plan['relevance'] : market_subject_pattern($plan['subject']), $text);
}
function market_evidence(array $item, array $plan, string $kind): bool {
    $text = clean_text(($item['title'] ?? '') . ' ' . ($item['text'] ?? ''));
    if (strlen($text) < 60) return false;
    $generic = ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'цифровые государственные сервисы'];
    if (!preg_match(in_array($plan['subject'], $generic, true) ? $plan['relevance'] : market_subject_pattern($plan['subject']), $text)) return false;
    if ($kind === 'customer-snippet') return (bool)preg_match('~выбир|выбор|отзыв|жалоб|клиент|покупател|качеств|сервис~iu', $text);
    if ($kind === 'market-price-snippet') return (bool)preg_match('~цен[аыуе]|стоимост|тариф|прайс|бюджет~iu', $text);
    return (bool)preg_match('~рынок|рынк[аеу]|динамик|спрос|рост[аеу]?|снижен|объ[её]м|тренд|прогноз|исследован|статистик~iu', $text);
}
function market_news_search(string $query): array {
    $result = fetch_public('https://news.google.com/rss/search?q=' . rawurlencode($query) . '&hl=ru&gl=RU&ceid=RU:ru');
    $xml = @simplexml_load_string($result['body']); $items = [];
    if ($xml) foreach ($xml->channel->item as $entry) {
        $title = clean_text((string)$entry->title); $url = clean_text((string)$entry->link); $text = clean_text((string)$entry->description) ?: $title;
        if ($title && $url) $items[] = ['title' => $title, 'url' => $url, 'text' => $text, 'publishedAt' => clean_text((string)$entry->pubDate) ?: null];
        if (count($items) >= 6) break;
    }
    return $items;
}
function competitor_name(array $source): string {
    $legalForm = '~^(?:ООО|АО|ПАО|ЗАО|ИП)\s+~iu';
    $genericTitle = '~^(?:логистика|кибербезопасность|доставка|производство|профессиональные услуги|спички|средства для розжига|розжиг)(?:\s+для\s+|$)~iu';
    $structured = trim(preg_replace($legalForm, '', trim(preg_split('/[|—–·:]|\s+-\s+/u', clean_text((string)($source['organizationName'] ?? '') ?: (string)($source['siteName'] ?? '')))[0])));
    if (strlen($structured) >= 3 && strlen($structured) <= 300 && !preg_match($genericTitle, $structured) && !preg_match('~^(?:www|главная|официальный сайт)$~iu', $structured)) return limit_text($structured, 100);
    $title = trim(preg_replace($legalForm, '', trim(preg_split('/[|—–·:]|\s+-\s+/u', clean_text((string)($source['title'] ?? '')))[0])));
    if (strlen($title) >= 3 && strlen($title) <= 210 && !preg_match($genericTitle, $title) && !preg_match('~купить|каталог|цены|оптом|доставка|производство|решения для|официальный сайт|^www$~iu', $title)) return $title;
    if (preg_match('/(?:^|\s)([А-ЯЁA-Z][А-ЯЁA-Z-]{2,})(?:$|\s)/u', $title, $match) && !preg_match('~^(?:ООО|АО|ПАО|ЗАО|ИП|WWW)$~iu', $match[1])) return $match[1];
    $brand = site_identity('https://' . (parse_url($source['url'] ?? '', PHP_URL_HOST) ?: 'company.ru'))['brand'];
    return strlen($brand) <= 7 && !str_starts_with($brand, 'xn--') ? strtoupper($brand) : $brand;
}
function relevant_market_quote(array $source, array $plan): string {
    $generic = ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'цифровые государственные сервисы'];
    $pattern = in_array($plan['subject'], $generic, true) ? $plan['relevance'] : market_subject_pattern($plan['subject']);
    $sentences = preg_split('/(?<=[.!?…])\s+/u', (string)($source['text'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $matching = [];
    foreach (array_map('clean_text', $sentences) as $sentence) {
        if (strlen($sentence) < 18 || !preg_match($pattern, $sentence)) continue;
        $score = min(strlen($sentence), 240) / 40 + (preg_match('~производств|изготавлива|поставля|продаж|купить|каталог|цен[аыуе]|стоимост|услуг|сервис|оптом~iu', $sentence) ? 4 : 0);
        $matching[] = ['sentence' => $sentence, 'score' => $score];
    }
    usort($matching, fn($a, $b) => $b['score'] <=> $a['score']);
    return $matching ? limit_text($matching[0]['sentence'], 420) : '';
}
function is_review_material(array $item): bool {
    $text = ($item['title'] ?? '') . ' ' . ($item['text'] ?? '');
    if (preg_match('~отзыв[а-яё]* сотрудник|отзыв[а-яё]* о работодател|работа в |условия труда|зарплат|карьерных возможност~iu', $text)) return false;
    if (preg_match('~аналитик[аи]|продажи бренда|объ[её]м продаж~iu', $text)) return false;
    $host = strtolower(preg_replace('~^www\.~', '', parse_url($item['url'] ?? '', PHP_URL_HOST) ?: ''));
    $reviewHost = (bool)preg_match('~(?:^|\.)(?:irecommend\.ru|otzovik\.com)$~i', $host);
    return (bool)preg_match('~отзыв|рейтинг|оценк|review|rating~iu', $text) && ($reviewHost || (bool)preg_match('~\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд|не рекоменд|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен|качество|персонал|доставк|возврат~iu', $text));
}
