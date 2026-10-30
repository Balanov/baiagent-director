<?php
declare(strict_types=1);

function market_plan(array $sources): array {
    $software = '~\b(?:saas|software|software as a service|cloud platform|digital products?|mobile apps?|web platform)\b|программн[а-яё]* обеспечени|программн[а-яё]* продукт|справочн[а-яё]* [а-яё-]* ?систем|информационн[а-яё]* (?:систем|продукт|ресурс)|цифров[а-яё]* (?:платформ|продукт|сервис)|облачн[а-яё]* (?:платформ|сервис)|разработчик[а-яё]* (?:программ|систем|платформ|приложен)|онлайн[- ](?:сервис|платформ)|веб[- ](?:сервис|платформ)|мобильн[а-яё]* приложен~iu';
    $marketplace = '~(?:сервис|платформа|маркетплейс)\s+(?:поиска\s+|подбора\s+)?специалист|поиск\s+специалист|специалисты\s+напишут\s+сами|исполнител[а-яё]*\s+(?:пришлют|предложат)|заказчик[а-яё]*\s+и\s+исполнител~iu';
    $industries = [
        'government' => '~министерств|ведомств|муниципальн|государственн[а-яё]* (?:услуг|сервис|орган|портал)|орган[а-яё]* (?:власти|исполнительной)|госуслуг|администраци[яи] (?:города|региона|области|края|республики)~iu',
        'cybersecurity' => '~кибербезопас|антивирус|информационн[а-яё]* безопас|защит[а-яё]* (?:данных|информации)~iu',
        'software' => $software,
        'logistics' => '~логистик|курьерск|оператор доставки|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|отправлени|грузоперевоз|фулфилмент~iu',
        'distribution' => '~дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* (?:оборудования|техники)~iu',
        'manufacturing' => '~производим|производител|производств|собственн[а-яё]* (?:производств|фабрик)|изготавлива|фабрик|завод-изготовител|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси~iu',
        'retail' => '~интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател|электроник|бытов[а-яё]* техник~iu',
        'food' => '~ресторан|пицц|продукт[а-яё]* питания|кейтеринг|кофейн~iu',
        'finance' => '~банк(?!рот)|страхован|лизинг|кредит|плат[её]ж~iu',
        'construction' => '~строительств|стройматериал|инженерн[а-яё]* систем|проектировани~iu',
        'healthcare' => '~медицин|клиник|стоматолог|фармацевт~iu',
        'education' => '~обучени|образован|курсы|тренинг~iu',
        'professional' => '~консалтинг|аудит|юридическ[а-яё]* (?:услуг|компан|консульт|поддержк|сопровожд)|правов[а-яё]* (?:услуг|поддержк|сопровожд)|адвокат|бухгалтерск[а-яё]* (?:услуг|обслужив|сопровожд)~iu',
    ];
    $own = array_values(array_filter($sources, fn($source) => ($source['kind'] ?? '') === 'company-site' && strlen(trim((string)($source['text'] ?? ''))) >= 40));
    $independent = array_values(array_filter($sources, fn($source) => in_array($source['kind'] ?? '', ['search-snippet', 'review-snippet'], true) && strlen(trim((string)($source['text'] ?? ''))) >= 40));
    $basis = $own ?: $independent;
    $primary = ''; $secondary = ''; $offeringText = ''; $offeringItems = [];
    foreach ($basis as $index => $source) {
        $text = preg_replace('~производственн[а-яё]*\s+календар[ьеяю]|исполнительн[а-яё]*\s+производств[а-яё]*|судебн[а-яё]*\s+производств[а-яё]*|производств[а-яё]*\s+по\s+(?:делу|делам)~iu', ' ', ($source['title'] ?? '') . ' ' . ($source['text'] ?? ''));
        if ($index === 0) $primary = $text; else $secondary .= ' ' . $text;
        foreach ($source['offerings'] ?? [] as $offering) {
            $name = clean_text(($offering['name'] ?? '') . ' ' . ($offering['displayName'] ?? ''));
            if ($name !== '') { $offeringItems[] = $name; $offeringText .= ' ' . $name; }
        }
    }
    $strength = [
        'software' => '~\b(?:saas|software|software as a service|team collaboration software|cloud platform)\b|программн[а-яё]* обеспечени|разработчик[а-яё]* (?:справочн|программ|систем|платформ|приложен)|справочн[а-яё]* правов[а-яё]* систем|правообладател[а-яё]* программ|цифров[а-яё]* (?:платформ|продукт)~iu',
        'logistics' => '~курьерск|служб[а-яё]* доставки|доставк[а-яё]* (?:грузов|документов|посылок|отправлений)|транспортн[а-яё]* компан|логистическ[а-яё]* (?:компан|оператор|услуг)~iu',
        'manufacturing' => '~производственн[а-яё]* (?:система|площадк|мощност|процесс)|завод|серийн[а-яё]* автомобил|самосвал|седельн[а-яё]* тягач|шасси~iu',
        'finance' => '~банковск[а-яё]* (?:услуг|продукт|сервис)|банк\s+(?:для|предлагает)|открыть\s+(?:сч[её]т|вклад)|ипотек|дебетов[а-яё]* карт|кредитн[а-яё]* карт~iu',
    ];
    $primaryModels = ['professional' => $marketplace, 'logistics' => '~транспортн[а-яё]*\s+компан|логистическ[а-яё]*\s+(?:компан|оператор)|курьерск[а-яё]*\s+служб|оператор\s+доставки~iu', 'software' => '~\b(?:saas|software as a service|team collaboration software)\b|разработчик[а-яё]*\s+(?:справочн|программ|систем|платформ|приложен)|справочн[а-яё]*\s+правов[а-яё]*\s+систем~iu'];
    $scores = [];
    foreach ($industries as $id => $pattern) {
        $scores[$id] = min(8, preg_match_all($pattern, $primary)) * 4 + min(8, preg_match_all($pattern, $secondary));
        if (isset($strength[$id])) $scores[$id] += min(8, preg_match_all($strength[$id], $primary)) * 6 + min(8, preg_match_all($strength[$id], $secondary)) * 2;
        if (isset($primaryModels[$id]) && preg_match($primaryModels[$id], $primary)) $scores[$id] += 48;
    }
    arsort($scores); $industry = array_key_first($scores); if (($scores[$industry] ?? 0) < 1) $industry = 'professional';
    $serviceMarketplace = $industry === 'professional' && preg_match($marketplace, $primary);
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
    $defaults = ['government' => 'цифровые государственные сервисы', 'logistics' => 'доставка для бизнеса', 'cybersecurity' => 'кибербезопасность', 'software' => 'программные продукты', 'distribution' => 'оборудование', 'manufacturing' => 'продукция', 'retail' => 'товары', 'food' => 'продукты питания', 'finance' => 'финансовые услуги', 'construction' => 'строительство', 'healthcare' => 'медицинские услуги', 'education' => 'обучение', 'professional' => 'профессиональные услуги'];
    $subject = $defaults[$industry] ?? $defaults['professional'];
    $restaurant = $industry === 'food' && preg_match('~сет[ьи][^.!?…]{0,24}ресторан|ресторан[а-яё]*\s+(?:русской\s+)?кухн|ресторанн[а-яё]*\s+сервис|формат[а-яё]*\s+фаст[- ]?к[эе]жуал~iu', $primary) && preg_match('~меню|блюд|блин|завтрак|десерт|суп[аыу]?|пельмен~iu', $primary . ' ' . $secondary);
    if ($restaurant) $subject = 'ресторанный сервис';
    $serviceScopes = [
        'healthcare' => ['стоматологические услуги', 'медицинские услуги', 'услуги красоты'],
        'education' => ['образовательные программы', 'корпоративное обучение'],
        'software' => ['программные продукты'],
        'professional' => ['юридические услуги', 'бухгалтерские и аудиторские услуги', 'туристические услуги', 'гостиничные услуги', 'фитнес-услуги', 'услуги красоты'],
    ];
    $serviceSubjects = array_unique(array_merge(...array_values($serviceScopes)));
    $productIndustries = ['manufacturing', 'retail', 'distribution', 'construction', 'food'];
    $scopedSubjects = isset($serviceScopes[$industry])
        ? array_values(array_filter($subjects, fn($item) => in_array($item[1], $serviceScopes[$industry], true)))
        : (in_array($industry, $productIndustries, true) ? array_values(array_filter($subjects, fn($item) => !in_array($item[1], $serviceSubjects, true))) : []);
    $subjectScores = [];
    if (!$serviceMarketplace && !$restaurant) foreach ($scopedSubjects as [$pattern, $value]) $subjectScores[$value] = min(20, preg_match_all($pattern, $offeringText)) * 12 + min(20, preg_match_all($pattern, $primary)) * 4 + min(20, preg_match_all($pattern, $secondary));
    if ($subjectScores) { arsort($subjectScores); if ((reset($subjectScores) ?: 0) > 0) $subject = array_key_first($subjectScores); }
    $softwareAudience = null;
    if ($industry === 'software') {
        $audiences = [
            ['юристов', '~для\s+юрист|юристу|юристов|правов[а-яё]*\s+систем|for\s+legal(?:\s+teams?)?~iu', '~справочн[а-яё]*\s+правов[а-яё]*\s+систем~iu'],
            ['бухгалтеров', '~для\s+бухгалтер|бухгалтеру|бухгалтеров|for\s+account~iu', null],
            ['кадровых специалистов', '~кадров[а-яё]*\s+специалист|для\s+кадровик|кадровику|кадровиков|for\s+(?:hr|human resources)~iu', null],
            ['специалистов по закупкам', '~специалист[а-яё]*\s+по\s+закупк|для\s+закуп|for\s+procurement~iu', null],
            ['медицинских специалистов', '~медицинск[а-яё]*\s+организац|для\s+врач|for\s+(?:clinicians|medical professionals)~iu', null],
            ['специалистов строительной отрасли', '~строительн[а-яё]*\s+организац|для\s+проектировщик|for\s+(?:architects|construction (?:companies|professionals)|civil engineers)~iu', null],
        ];
        $diverse = count(array_unique($offeringItems)) >= 4 || count($basis) >= 6; $specialists = [];
        foreach ($audiences as [$name, $pattern, $emphasis]) {
            $offeringSupport = count(array_filter($offeringItems, fn($text) => preg_match($pattern, $text)));
            $pageSupport = count(array_filter($basis, fn($source) => preg_match($pattern, ($source['title'] ?? '') . ' ' . ($source['text'] ?? ''))));
            $supported = ($emphasis && (preg_match($emphasis, $primary) || preg_match($emphasis, $secondary))) || (!$diverse && preg_match($pattern, $primary)) || ($offeringSupport >= 2 && $pageSupport >= 2);
            $score = min(20, preg_match_all($pattern, $offeringText)) * 12 + min(20, preg_match_all($pattern, $primary)) * 4 + min(20, preg_match_all($pattern, $secondary));
            if ($emphasis) $score += min(20, preg_match_all($emphasis, $primary)) * 12 + min(20, preg_match_all($emphasis, $secondary)) * 6;
            if ($supported && $score > 0) $specialists[] = ['name' => $name, 'pattern' => $pattern, 'score' => $score];
        }
        usort($specialists, fn($a, $b) => $b['score'] <=> $a['score']);
        if ($specialists) { $subject = 'программные и информационные продукты для ' . $specialists[0]['name']; $softwareAudience = $specialists[0]['pattern']; }
    }
    $relevance = [
        'government' => '~госуслуг|государственн[а-яё]* (?:услуг|сервис|портал)|муниципальн[а-яё]* (?:услуг|сервис|портал)|цифровизац[а-яё]* (?:государственн|муниципальн)~iu',
        'logistics' => '~логистик|доставк|грузоперевоз|фулфилмент|отправлени~iu',
        'cybersecurity' => '~кибербезопас|информационн[а-яё]* безопас|антивирус|защит[а-яё]* (?:данных|информации)~iu',
        'software' => $software,
        'distribution' => '~дистрибью|дистрибуц|оптов[а-яё]* (?:продаж|поставк)|поставк[а-яё]* оборудования~iu',
        'manufacturing' => '~производств|изготавлива|фабрик|оптов~iu',
        'retail' => '~интернет-магазин|розничн[а-яё]* продаж|каталог товаров|покупател~iu',
        'food' => '~ресторан|продукт[а-яё]* питания|кейтеринг|кофейн~iu',
        'finance' => '~банк(?!рот)|страхован|лизинг|кредит|плат[её]ж~iu',
        'construction' => '~строительств|стройматериал|инженерн[а-яё]* систем~iu',
        'healthcare' => '~медицин|клиник|стоматолог|фармацевт~iu',
        'education' => '~обучени|образован|курсы|тренинг~iu',
        'professional' => $serviceMarketplace ? $marketplace : '~консалтинг|аудит|юридическ|правов|адвокат|бухгалтер|внедрен~iu',
    ][$industry];
    $defaultQueries = match($industry) {
        'government' => ['цифровизация государственных услуг платформа', 'портал государственных услуг регион'],
        'logistics' => ['логистика для бизнеса доставка компания', 'доставка для интернет-магазинов компания тарифы'],
        'cybersecurity' => ['кибербезопасность решения для бизнеса компания', 'защита информации продукты для бизнеса'],
        'software' => ['программные продукты разработчик платформа', 'SaaS платформа для бизнеса тарифы'],
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
    $productMarket = in_array($industry, $productIndustries, true) && !$restaurant;
    $queries = $subject !== ($defaults[$industry] ?? $defaults['professional'])
        ? ($productMarket ? [$searchSubject . ' производитель поставщик цены', $searchSubject . ' оптом каталог компания'] : ($industry === 'software' ? [$searchSubject . ' разработчик продукты платформа', $searchSubject . ' тарифы подписка внедрение'] : [$searchSubject . ' компания услуги цены', $searchSubject . ' организации сервис стоимость']))
        : $defaultQueries;
    $softwareText = $primary . ' ' . $offeringText;
    $softwareFamily = $industry !== 'software' ? '' : ($softwareAudience ? 'specialist' : (preg_match('~team collaboration software|teamwork platform|collaboration platform|платформ[а-яё]*\s+(?:для\s+)?совместной\s+работы|\bJira\b|\bConfluence\b|\bBitbucket\b|project management~iu', $softwareText) ? 'collaboration' : (preg_match('~ecommerce|e-commerce|commerce platform|online store|интернет-магазин~iu', $softwareText) ? 'ecommerce' : (preg_match('~\b(?:CAD|CAM|CAE|PLM)\b|product lifecycle|industrial software|digital twin|engineering software|инженерн[а-яё]* (?:программ|продукт|систем)~iu', $softwareText) ? 'engineering' : ''))));
    if ($serviceMarketplace) $queries = ['сервис поиска специалистов заказчики исполнители', 'платформа для специалистов заказы услуги'];
    elseif ($restaurant) $queries = ['сеть ресторанов русской кухни меню', 'ресторан блины меню заказать столик'];
    elseif ($softwareFamily === 'collaboration') $queries = ['team collaboration software platform', 'project management software for teams'];
    elseif ($softwareFamily === 'ecommerce') $queries = ['ecommerce platform enterprise pricing', 'online store platform for business'];
    elseif ($softwareFamily === 'engineering') $queries = ['CAD CAM engineering software products', 'PLM product lifecycle management software'];
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
    return ['industry' => $industry, 'subject' => $subject, 'companyName' => clean_text((string)($basis[0]['companyName'] ?? '')), 'ownAliases' => $ownAliases, 'serviceMarketplace' => $serviceMarketplace, 'softwareFamily' => $softwareFamily, 'softwareAudience' => $softwareAudience, 'competitorQueries' => $queries, 'evidenceQueries' => $evidenceQueries, 'relevance' => $relevance, 'newsQuery' => $newsQuery];
}

function market_subject_pattern(string $subject): string {
    if (str_starts_with($subject, 'программные и информационные продукты для ')) return '~\b(?:saas|software|software as a service|cloud platform|digital products?)\b|программн[а-яё]* обеспечени|программн[а-яё]* продукт|справочн[а-яё]* [а-яё-]* ?систем|информационн[а-яё]* (?:систем|продукт|ресурс)|цифров[а-яё]* (?:платформ|продукт|сервис)~iu';
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
        'ресторанный сервис' => 'ресторан|кафе|фаст[- ]?к[эе]жуал|меню|блин|блюд',
        'программные продукты' => 'saas|программн[а-яё]* обеспечени|платформ', 'доставка для бизнеса' => 'доставк',
        'кибербезопасность' => 'кибербезопас|информационн[а-яё]* безопас',
        'цифровые государственные сервисы' => 'госуслуг|государственн[а-яё]* (?:услуг|сервис|портал)|муниципальн[а-яё]* (?:услуг|сервис|портал)',
    ];
    return '~' . ($roots[$subject] ?? preg_quote($subject, '~')) . '~iu';
}
function market_generic_subject(array $plan): bool {
    return in_array($plan['subject'] ?? '', ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'программные продукты', 'цифровые государственные сервисы'], true);
}
function market_competitor_content(string $text, array $plan): bool {
    if (!market_generic_subject($plan) && !preg_match(market_subject_pattern($plan['subject']), $text)) return false;
    if (market_generic_subject($plan) && !preg_match($plan['relevance'], $text)) return false;
    if (($plan['industry'] ?? '') === 'software') {
        if (preg_match('~юридическ[а-яё]* услуг[а-яё]*\s+(?:оказывают|предоставляют)[^.!?…]{0,100}(?:исполнител|юрист|адвокат)|независим[а-яё]* исполнител[а-яё]*\s*[-—,:]?\s*(?:юрист|адвокат)|юридическ[а-яё]* компан[а-яё]*\s+на\s+платформе~iu', $text)) return false;
        if (($plan['softwareFamily'] ?? '') === 'collaboration' && !preg_match('~team collaboration|teamwork|work management|project management|task management|knowledge management|corporate (?:wiki|messenger|workspace)|\bwiki\b|мессенджер|видеозвон|доски|совместная работа|совместной работы|управлени[а-яё]* проект|управлени[а-яё]* задач|баз[аы] знаний|корпоративн[а-яё]* портал~iu', $text)) return false;
        if (($plan['softwareFamily'] ?? '') === 'ecommerce' && !preg_match('~ecommerce|e-commerce|commerce|online store|checkout|интернет-магазин~iu', $text)) return false;
        if (($plan['softwareFamily'] ?? '') === 'engineering' && !preg_match('~\b(?:CAD|CAM|CAE|PLM)\b|product lifecycle|digital twin|engineering|manufacturing|computer-aided|инженерн[а-яё]* (?:программ|продукт|систем)|промышленн[а-яё]* (?:программ|продукт|систем)~iu', $text)) return false;
        if (($plan['softwareFamily'] ?? '') === 'specialist' && !empty($plan['softwareAudience']) && !preg_match($plan['softwareAudience'], $text)) return false;
        return (bool)preg_match($plan['relevance'], $text);
    }
    if (($plan['subject'] ?? '') === 'ресторанный сервис') return !preg_match('~обучени[а-яё]*\s+(?:официант|персонал)|курсы\s+(?:для\s+)?официант|поставщик[а-яё]*\s+(?:оборудования|мебели)|оборудовани[а-яё]*\s+для\s+ресторан|управлени[а-яё]*\s+ресторан|автоматизац[а-яё]*\s+ресторан|система\s+.*(?:меню|стандартов)~iu', $text) && (bool)preg_match('~сет[ьи][^.!?…]{0,24}ресторан|ресторан[а-яё]*\s+(?:русской\s+)?кухн|блинн[а-яё]*|забронировать|заказать\s+столик~iu', $text);
    if (in_array($plan['industry'] ?? '', ['logistics', 'professional', 'healthcare', 'education', 'finance'], true)) return (bool)preg_match('~цен[аыуе]|стоимост|тариф|прайс|услуг|сервис|консультац|подключ|заказать|записаться|оставить заявку|подписк|внедрен|pricing|subscription|trial|demo|contact sales|get started~iu', $text);
    if (($plan['industry'] ?? '') === 'logistics' && !preg_match('~логистик|курьерск|грузоперевоз|оператор доставки|служб[а-яё]* доставки|отправлени|фулфилмент~iu', $text)) return false;
    return (bool)preg_match('~производств|производител|изготавлива|фабрик|завод|оптов|оптом|цен[аыуе]|стоимост|каталог|купить|поставля|продаж~iu', $text);
}
function excluded_web_source_url(string $url): bool {
    $host = strtolower(preg_replace('~^www\.~', '', parse_url($url, PHP_URL_HOST) ?: ''));
    if (preg_match('~(?:^|\.)(?:avito\.ru|ozon\.[a-z.]+)$~iu', $host)) return true;
    return (bool)preg_match('~(?:^|\.)wildbox\.ru$~iu', $host) && str_starts_with(strtolower(parse_url($url, PHP_URL_PATH) ?: ''), '/brand-analytics/');
}
function market_editorial_page(array $item): bool {
    $path = strtolower((string)(parse_url($item['url'] ?? '', PHP_URL_PATH) ?: ''));
    $type = lower_text(implode(' ', array_filter([$item['pageType'] ?? '', $item['ogType'] ?? '', $item['structuredType'] ?? '', implode(' ', $item['schemaTypes'] ?? [])])));
    return (bool)(preg_match('~(?:^|\s)(?:article|newsarticle|blogposting)(?:\s|$)~iu', $type)
        || preg_match('~/(?:article|articles|wiki|news|press|events?|conferences?|cases?|portfolio|projects?|resources?|blog|gallery|compilations)(?:/|$)~iu', $path)
        || preg_match('~\bобзор\b|рувики|энциклопед|википедия|представили|пресс-центр|конференц[а-яё]*|симпозиум[а-яё]*|\bconference\b|\bcongress\b|\bwhat is\b|\bhow to\b|mailing list~iu', (string)($item['title'] ?? '')));
}
function market_candidate(array $item, array $plan, string $site): bool {
    $candidateHost = strtolower(preg_replace('~^www\.~', '', parse_url($item['url'] ?? '', PHP_URL_HOST) ?: ''));
    $ownHost = strtolower(preg_replace('~^www\.~', '', parse_url($site, PHP_URL_HOST) ?: ''));
    if (!$candidateHost || $candidateHost === $ownHost || str_ends_with($candidateHost, '.' . $ownHost) || excluded_web_source_url((string)($item['url'] ?? ''))) return false;
    if (preg_match('~(?:^|\.)(?:yandex\.ru|ya\.ru|2gis\.ru|zoon\.ru|yell\.ru|wikipedia\.org|wikimedia\.org|duckduckgo\.com|bing\.com|google\.com|rbc\.ru|kommersant\.ru|vedomosti\.ru|vc\.ru|cnews\.ru|tadviser\.ru|interfax\.ru|ria\.ru|iz\.ru|forbes\.ru|frc\.ru|tradedir\.ru|optomtovar\.ru|fabricators\.ru|o-zavodah\.ru|productcenter\.ru|supl\.biz|tiu\.ru|pulscen\.ru|optsbyt\.ru|optlist\.ru|mediam\.ru|ozon\.ru|wildberries\.ru|avito\.ru|sima-land\.ru|vseinstrumenti\.ru|onlinetrade\.ru|auchan\.ru|lemanapro\.ru|mktools\.ru|atann\.ru|farpost\.ru|joom\.ru|checko\.ru|behance\.net|pinterest\.[a-z.]+|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|twitter\.com|x\.com|reddit\.com|quora\.com|medium\.com|seclists\.org|arxiv\.org)$~iu', $candidateHost)) return false;
    $text = clean_text(($item['title'] ?? '') . ' ' . ($item['text'] ?? ''));
    if (market_editorial_page($item)) return false;
    if (!empty($plan['serviceMarketplace']) && !preg_match($plan['relevance'], $text)) return false;
    if (($plan['industry'] ?? '') === 'retail' && preg_match('~оптом|оптов[а-яё]*|дистрибью|дистрибу|\bB2B\b~iu', $text) && !preg_match('~розничн[а-яё]*\s+(?:магазин|продаж)|оптом\s+и\s+в\s+розницу|в\s+розницу~iu', $text)) return false;
    $title = clean_text((string)($item['title'] ?? ''));
    if (!market_generic_subject($plan) && preg_match('~без\s+[^.!?]{0,40}~iu', $title, $negative) && preg_match(market_subject_pattern($plan['subject']), $negative[0])) return false;
    $ownBrand = explode('.', $ownHost)[0]; $aliases = ['cdek' => ['сдэк'], 'kaspersky' => ['касперск'], 'dns' => ['днс']];
    $ownNames = array_values(array_filter(array_map('lower_text', array_merge([(string)($plan['companyName'] ?? ''), $ownBrand], $plan['ownAliases'] ?? [], $aliases[$ownBrand] ?? [])), fn($name) => strlen($name) >= 3));
    foreach ($ownNames as $name) if (str_contains($candidateHost, $name) || str_contains(lower_text($text), $name)) return false;
    if (($plan['industry'] ?? '') === 'logistics') {
        if (preg_match('~интернет-магазин|мебел|корзина|доставка заказов|оплата и доставка~iu', $text) && preg_match('~отправк[а-яё]*\s+через|доставк[а-яё]*\s+(?:через|транспортн)|транспортными компаниями|другие\s+ТК~iu', $text)) return false;
        if (preg_match('~калькулятор|рассчита(?:ть|йте)|расч[её]т\s+(?:стоимости|тарифа|доставки)|calculator|calculate~iu', $text)) {
            $brand = competitor_name($item);
            if (!$brand || !str_contains(lower_text($title), lower_text($brand))) return false;
        } elseif (!preg_match('~логистическ[а-яё]* (?:компан|оператор|услуг)|транспортн[а-яё]*[- ]?(?:логистическ[а-яё]* )?компан|курьерск[а-яё]* (?:служб|доставк|компан)|служб[а-яё]* доставки|оператор доставки|грузоперевоз|фулфилмент|экспедировани|\b3pl\b~iu', $text)) return false;
    }
    if (($plan['industry'] ?? '') === 'healthcare') {
        if (preg_match('~(?:^|\.)(?:docdoc|prodoctorov|napopravku|sberhealth|zoon|yandex|2gis)\.[a-z.]+$~iu', $candidateHost)) return false;
        if (preg_match('~мис\s+для|медицинск[а-яё]*\s+информационн[а-яё]*\s+систем|автоматизац[а-яё]*\s+клиник|it[- ]?решени[а-яё]*\s+для\s+клиник|сервис\s+онлайн-записи|агрегатор~iu', $text)) return false;
        if (!preg_match('~клиник|лаборатор|медицинск[а-яё]*\s+центр|диагностик|стационар|пациент~iu', $text)) return false;
    }
    if (($plan['subject'] ?? '') === 'грузовые автомобили') {
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
    if (!empty($plan['serviceMarketplace']) && !preg_match($plan['relevance'], $text)) return false;
    if (!preg_match('~рынок|рынк[аеу]|динамик|спрос|производств|завод|фабрик|экспорт|импорт|подорожа|подеше|цен[аыуе]|запуск~iu', $text)) return false;
    return (bool)preg_match(market_generic_subject($plan) ? $plan['relevance'] : market_subject_pattern($plan['subject']), $text);
}
function market_evidence(array $item, array $plan, string $kind): bool {
    $text = clean_text(($item['title'] ?? '') . ' ' . ($item['text'] ?? ''));
    if (strlen($text) < 60) return false;
    if (!empty($plan['serviceMarketplace']) && !preg_match($plan['relevance'], $text)) return false;
    if (!preg_match(market_generic_subject($plan) ? $plan['relevance'] : market_subject_pattern($plan['subject']), $text)) return false;
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
function text_length(string $value): int { return function_exists('mb_strlen') ? mb_strlen($value) : (preg_match_all('/./us', $value, $matches) ?: 0); }
function upper_text(string $value): string {
    if (function_exists('mb_strtoupper')) return mb_strtoupper($value);
    return strtr($value, ['а'=>'А','б'=>'Б','в'=>'В','г'=>'Г','д'=>'Д','е'=>'Е','ё'=>'Ё','ж'=>'Ж','з'=>'З','и'=>'И','й'=>'Й','к'=>'К','л'=>'Л','м'=>'М','н'=>'Н','о'=>'О','п'=>'П','р'=>'Р','с'=>'С','т'=>'Т','у'=>'У','ф'=>'Ф','х'=>'Х','ц'=>'Ц','ч'=>'Ч','ш'=>'Ш','щ'=>'Щ','ъ'=>'Ъ','ы'=>'Ы','ь'=>'Ь','э'=>'Э','ю'=>'Ю','я'=>'Я']);
}
function codepoint_utf8(int $code): string {
    if ($code <= 0x7f) return chr($code);
    if ($code <= 0x7ff) return chr(0xc0 | ($code >> 6)) . chr(0x80 | ($code & 0x3f));
    if ($code <= 0xffff) return chr(0xe0 | ($code >> 12)) . chr(0x80 | (($code >> 6) & 0x3f)) . chr(0x80 | ($code & 0x3f));
    return chr(0xf0 | ($code >> 18)) . chr(0x80 | (($code >> 12) & 0x3f)) . chr(0x80 | (($code >> 6) & 0x3f)) . chr(0x80 | ($code & 0x3f));
}
function decode_punycode_label(string $label): string {
    if (!str_starts_with($label, 'xn--')) return $label;
    $encoded = strtolower(substr($label, 4)); $output = []; $n = 128; $i = 0; $bias = 72; $index = 0;
    $delimiter = strrpos($encoded, '-');
    if ($delimiter !== false) {
        $basic = substr($encoded, 0, $delimiter);
        if (preg_match('/[^\x00-\x7f]/', $basic)) return $label;
        foreach (str_split($basic) as $character) $output[] = ord($character);
        $index = $delimiter + 1;
    }
    $adapt = function(int $delta, int $points, bool $first): int {
        $value = intdiv($delta, $first ? 700 : 2); $value += intdiv($value, $points); $k = 0;
        while ($value > 455) { $value = intdiv($value, 35); $k += 36; }
        return $k + intdiv(36 * $value, $value + 38);
    };
    while ($index < strlen($encoded)) {
        $previous = $i; $weight = 1;
        for ($k = 36; ; $k += 36) {
            if ($index >= strlen($encoded)) return $label;
            $code = ord($encoded[$index++]);
            $digit = $code >= 48 && $code <= 57 ? $code - 22 : ($code >= 97 && $code <= 122 ? $code - 97 : -1);
            if ($digit < 0 || $digit > intdiv(PHP_INT_MAX - $i, $weight)) return $label;
            $i += $digit * $weight;
            $threshold = $k <= $bias ? 1 : ($k >= $bias + 26 ? 26 : $k - $bias);
            if ($digit < $threshold) break;
            $factor = 36 - $threshold;
            if ($weight > intdiv(PHP_INT_MAX, $factor)) return $label;
            $weight *= $factor;
        }
        $bias = $adapt($i - $previous, count($output) + 1, $previous === 0);
        $n += intdiv($i, count($output) + 1); $i %= count($output) + 1;
        if ($n > 0x10ffff) return $label;
        array_splice($output, $i, 0, [$n]); $i++;
    }
    return implode('', array_map('codepoint_utf8', $output));
}
function competitor_name(array $source): string {
    $legalForm = '~^(?:ООО|АО|ПАО|ЗАО|ИП)\s+~iu';
    $genericTitle = '~^(?:(?:логистика|кибербезопасность|доставка|производство|профессиональные услуги|спички|средства для розжига|розжиг)(?:\s+для\s+|$)|(?:аутсорсинг|производитель оптом|производители|услуги|каталог|главная|информационные ресурсы|document|www)|(?:collaboration|project management|team collaboration)(?:\s+(?:software|platform|tool))*)$~iu';
    $normalize = function(string $value) use ($legalForm): string {
        $cleaned = trim(preg_replace('~^(?:интернет-магазин|официальный сайт|компания)\s+~iu', '', preg_replace($legalForm, '', clean_text($value))) ?? '');
        return preg_match('~^(?:www\.)?([\p{L}\p{N}-]+)\.[a-z]{2,}$~iu', $cleaned, $match) ? $match[1] : $cleaned;
    };
    $usable = function(string $value, int $limit = 70) use ($genericTitle): bool {
        $length = text_length($value);
        return $length >= 3 && $length <= $limit && !preg_match($genericTitle, $value)
            && !preg_match('~(?:\.{3}|…)|купить|каталог|цен[аыуе]|стоимост|оптом|доставка|производств|решения для|официальный сайт|рассчита|калькулятор|^www$|^(?:online\s+)?project management\b~iu', $value);
    };
    $structured = $normalize(preg_split('/[|—–·:]|\s+-\s+/u', clean_text((string)($source['organizationName'] ?? '') ?: (string)($source['siteName'] ?? '')))[0]);
    if ($usable($structured, 100)) return $structured;
    $rawTitle = clean_text((string)($source['title'] ?? ''));
    if (preg_match('~^(?:(?:ООО|АО|ПАО|ЗАО|ИП)\s+)?([А-ЯЁA-Z][А-ЯЁA-Z0-9-]{2,})(?:$|\s)~u', $rawTitle, $match) && !preg_match('~^(?:ООО|АО|ПАО|ЗАО|ИП|WWW)$~iu', $match[1])) return $match[1];
    $parts = preg_split('/[|—–·:]|\s+-\s+/u', $rawTitle, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    foreach ($parts as $part) {
        $candidate = trim(preg_replace('~\s+для\s+(?:бизнеса|компаний|организаций|юристов|бухгалтеров).*$~iu', '', preg_replace('~^(?:тарифы|цены|прайс|стоимость)\s+~iu', '', $normalize($part))) ?? '');
        if ($usable($candidate)) return $candidate;
    }
    if (preg_match('~(?:^|\s)([А-ЯЁA-Z][А-ЯЁA-Z0-9-]{2,})(?:$|\s)~u', $rawTitle, $match) && !preg_match('~^(?:ООО|АО|ПАО|ЗАО|ИП|WWW)$~iu', $match[1])) return $match[1];
    $brand = site_identity((string)($source['url'] ?? ''))['brand']; $brand = decode_punycode_label($brand) ?: 'Компания';
    return text_length($brand) <= 7 ? upper_text($brand) : $brand;
}
function relevant_market_quote(array $source, array $plan): string {
    $sentences = array_values(array_filter(array_merge([(string)($source['title'] ?? '')], preg_split('/(?<=[.!?…])\s+/u', (string)($source['text'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: []), fn($sentence) => $sentence !== ''));
    $matching = [];
    foreach (array_map('clean_text', $sentences) as $sentence) {
        if (strlen($sentence) < 18 || !market_competitor_content($sentence, $plan)) continue;
        $score = min(strlen($sentence), 240) / 40 + (preg_match('~производств|изготавлива|поставля|продаж|купить|каталог|цен[аыуе]|стоимост|услуг|сервис|оптом~iu', $sentence) ? 4 : 0);
        $matching[] = ['sentence' => $sentence, 'score' => $score];
    }
    usort($matching, fn($a, $b) => $b['score'] <=> $a['score']);
    return $matching ? limit_text($matching[0]['sentence'], 420) : '';
}
function is_review_material(array $item): bool {
    if (in_array($item['pageType'] ?? '', ['article', 'search'], true) || preg_match('~(?:^|/)search(?:/|$)~i', (string)(parse_url($item['url'] ?? '', PHP_URL_PATH) ?: ''))) return false;
    $text = ($item['title'] ?? '') . ' ' . ($item['text'] ?? '');
    if (preg_match('~отзыв[а-яё]* сотрудник|отзыв[а-яё]* о работодател|работа в |условия труда|зарплат|карьерных возможност~iu', $text)) return false;
    if (preg_match('~аналитик[аи]|продажи бренда|объ[её]м продаж~iu', $text)) return false;
    $host = strtolower(preg_replace('~^www\.~', '', parse_url($item['url'] ?? '', PHP_URL_HOST) ?: ''));
    $reviewHost = (bool)preg_match('~(?:^|\.)(?:irecommend\.ru|otzovik\.com)$~i', $host);
    $path = (string)(parse_url($item['url'] ?? '', PHP_URL_PATH) ?: '');
    $trustedMapReview = (preg_match('~(?:^|\.)yandex\.[a-z.]+$~i', $host) && preg_match('~/maps/org/~i', $path)) || (preg_match('~(?:^|\.)2gis\.[a-z.]+$~i', $host) && preg_match('~/firm/~i', $path));
    return (bool)preg_match('~отзыв|рейтинг|оценк|review|rating~iu', $text) && ($reviewHost || ($trustedMapReview && preg_match('~\d+\s*(?:отзыв|reviews?)~iu', $text)) || (bool)preg_match('~\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд(?:ую|уем|уете|уешь|уют|овал[аи]?)(?:\s|$|[,.!?])|не рекоменд|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен|качество|персонал|доставк|возврат~iu', $text));
}
function review_normalized(string $value): string {
    return trim(preg_replace('/\s+/u', ' ', str_replace(['«','»','"','“','”',"'",'’','®','™'], '', lower_text(clean_text($value)))) ?? '');
}
function review_company_aliases(array $context, array $sources): array {
    $research = $context['research'] ?? $context; $home = null;
    foreach ($sources as $source) if (($source['kind'] ?? '') === 'company-site') { $home = $source; break; }
    $home ??= $sources[0] ?? [];
    $rawNames = [$context['companyName'] ?? $research['companyName'] ?? '', $home['companyName'] ?? '', $home['organizationName'] ?? '', $home['siteName'] ?? ''];
    $rawNames = array_merge($rawNames, $context['ownAliases'] ?? $research['ownAliases'] ?? []);
    $aliases = [];
    foreach ($rawNames as $rawName) {
        $value = preg_replace('~^(?:ООО|АО|ПАО|ЗАО|ИП)\s+~iu', '', clean_text((string)$rawName));
        $parts = array_merge([$value], preg_split('/\s+(?:-|—|–|\|)\s+|\s*[\\:]\s*/u', $value) ?: []);
        if (preg_match_all('/[«"“]([^»"”]{3,70})[»"”]/u', $value, $matches)) $parts = array_merge($parts, $matches[1]);
        foreach ($parts as $part) {
            $alias = review_normalized($part); $length = text_length($alias);
            if ($length >= 3 && $length <= 70 && !preg_match('~^(?:главная|официальный сайт|компания)$~iu', $alias)) {
                $aliases[$alias] = true;
                $spacedAlias = trim(preg_replace('~\s*[-–—]+\s*~u', ' ', $alias) ?? '');
                $words = preg_split('/\s+/u', $spacedAlias, -1, PREG_SPLIT_NO_EMPTY) ?: [];
                if ($spacedAlias !== $alias && $words && count(array_filter($words, fn($word) => text_length($word) < 3)) === 0) $aliases[$spacedAlias] = true;
            }
        }
    }
    $siteUrl = $context['siteUrl'] ?? $research['siteUrl'] ?? $research['requestedUrl'] ?? $home['url'] ?? '';
    $brand = explode('.', strtolower(preg_replace('~^www\.~', '', parse_url($siteUrl, PHP_URL_HOST) ?: '')))[0];
    if (text_length($brand) >= 3) {
        $aliases[$brand] = true;
        foreach (['cdek' => ['сдэк'], 'kaspersky' => ['касперск'], 'dns' => ['днс']][$brand] ?? [] as $alias) $aliases[$alias] = true;
    }
    return array_keys($aliases);
}
function review_offering_aliases(array $context, array $sources): array {
    $research = $context['research'] ?? $context; $offerings = $context['offerings'] ?? $research['offerings'] ?? [];
    foreach ($sources as $source) if (($source['kind'] ?? '') === 'company-site') $offerings = array_merge($offerings, $source['offerings'] ?? []);
    $aliases = [];
    foreach ($offerings as $offering) foreach ([$offering['name'] ?? '', $offering['displayName'] ?? ''] as $name) {
        $alias = review_normalized($name); $length = text_length($alias);
        if ($length >= 4 && $length <= 100 && !preg_match('~^(?:продукция|продукты|товары|услуги|сервисы|доставка|products?|services?|software|platform)$~iu', $alias) && !preg_match('~заказать|прайс-лист|узнать цену|получить предложение~iu', $alias)) $aliases[$alias] = true;
    }
    return array_keys($aliases);
}
function review_purposeful_mention(string $text, array $aliases): bool {
    foreach ($aliases as $alias) {
        $offset = 0;
        while (($index = strpos($text, $alias, $offset)) !== false) {
            preg_match('/.{0,56}$/us', substr($text, 0, $index), $match);
            if (!preg_match('~(?:доставк[а-яё]*|комплектац[а-яё]*|shipping|delivery|carrier|для|на|под|совместим[а-яё]*(?:\s+с)?|compatible\s+(?:with|for)|for)(?:\s+[\w-]+){0,3}\s*$~iu', $match[0] ?? '')) return true;
            $offset = $index + strlen($alias);
        }
    }
    return false;
}
function review_fuzzy_offering(string $text, array $aliases, array $companyAliases = []): bool {
    $companyTokens = [];
    foreach ($companyAliases as $alias) foreach (preg_split('/[^\p{L}\p{N}]+/u', $alias, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $token) $companyTokens[$token] = true;
    foreach ($aliases as $alias) {
        if (text_length($alias) > 60 || count(preg_split('/\s+/u', $alias)) > 3) continue;
        foreach (preg_split('/[^\p{L}\p{N}]+/u', $alias, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $token) {
            if (text_length($token) < 5 || isset($companyTokens[$token]) || preg_match('~^(?:продукц|продукт|товар|услуг|сервис|доставк|product|service|software|platform|digital|solution)~iu', $token)) continue;
            if (str_contains($text, limit_text($token, 6))) return true;
        }
    }
    return false;
}
function is_relevant_company_review(array $item, array $context): bool {
    $research = $context['research'] ?? $context; $sources = $context['sources'] ?? $research['sources'] ?? [];
    $title = review_normalized((string)($item['title'] ?? '')); $text = review_normalized($title . ' ' . (string)($item['text'] ?? ''));
    $path = (string)(parse_url($item['url'] ?? '', PHP_URL_PATH) ?: '');
    $experiencePattern = '~(?:^|[\s.!?])(?:я|мы|мне|нам|мной|наш[а-яё]*)(?:\s|$|[,.!?])|\b(?:i|we|my|our)\b|купил|покупал|заказывал|пользу(?:юсь|емся)|используем|сотрудничаем|рекомендую\b|не\s+рекомендую\b|понравил|доволен|недоволен|достоинства\s*:|недостатки\s*:|установил|ездил|съездили|разжигаются|работает\b|сломал~iu';
    $detailPattern = '~\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд(?:ую|уем|уете|уешь|уют|овал[аи]?)(?:\s|$|[,.!?])|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен|качество|персонал|доставк|возврат~iu';
    $strongDetailPattern = '~\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд(?:ую|уем|уете|уешь|уют|овал[аи]?)(?:\s|$|[,.!?])|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен~iu';
    if (!$text || preg_match('~отзыв[а-яё]* сотрудник|отзыв[а-яё]* о работодател|работа в |зарплат~iu', $title) || preg_match('~условия труда|карьерных возможност~iu', $text)) return false;
    if (preg_match('~аналитик[аи]|продажи бренда|объ[её]м продаж~iu', $text)) return false;
    $hasExperience = (bool)preg_match($experiencePattern, $text);
    $body = review_normalized((string)($item['text'] ?? ''));
    $emptyReviewPage = (bool)preg_match('~рейтинг\s*0\s*\(?0\)?|0\s+отзыв|отзывов\s*0|пока нет отзывов|нет отзывов|оставьте первый отзыв|написать первый отзыв~iu', $body);
    $requiredDetailPattern = ($item['contentOrigin'] ?? '') === 'full-page' ? $detailPattern : $strongDetailPattern;
    if (($emptyReviewPage && !$hasExperience) || (!$hasExperience && !preg_match($requiredDetailPattern, $body))) return false;
    if (preg_match('~/menu(?:/|$)~i', $path) && !$hasExperience && !preg_match('~\d+\s*(?:отзыв|reviews?)~iu', $text)) return false;
    $reviewPath = (bool)preg_match('~/(?:review|reviews|otzyv|otzyvy|otzyvy_vladelcev)[\w.-]*~i', $path);
    $declaredType = review_normalized(implode(' ', array_merge([$item['pageType'] ?? '', $item['ogType'] ?? '', $item['structuredType'] ?? ''], $item['schemaTypes'] ?? [])));
    $substantiveArticle = preg_match('~обзор|review~iu', $title) && $hasExperience && preg_match($detailPattern, $text);
    if (preg_match('~/search(?:/|$)~i', $path) || preg_match('~результаты\s+поиска|поиск\s+товаров~iu', $title)) return false;
    if (preg_match('~(?:^|\s)(?:article|newsarticle|blogposting)(?:\s|$)~iu', $declaredType) && !$reviewPath && !preg_match('~отзыв|review~iu', $title) && !$substantiveArticle) return false;
    if ((preg_match('~^как\s+(?!я\b|мы\b|мо[йяи]\b)~iu', $title) || preg_match('~инструкци|руководство|дистрибьютор|дистрибутор~iu', $title)) && !$reviewPath) return false;
    if (!preg_match('~отзыв|рейтинг|оценк|review|rating~iu', $text) || (!preg_match($detailPattern, $text) && !$hasExperience)) return false;
    $companyAliases = review_company_aliases($context, $sources); $offeringAliases = review_offering_aliases($context, $sources);
    $fuzzyOffering = review_fuzzy_offering($text, $offeringAliases, $companyAliases);
    $matchingTitle = preg_replace('~\s*[-–—]+\s*~u', ' ', $title) ?? $title;
    $directCompanyTitle = (bool)array_filter($companyAliases, fn($alias) => str_contains($matchingTitle, $alias));
    $companyInTitle = review_purposeful_mention($matchingTitle, $companyAliases) || ($directCompanyTitle && $fuzzyOffering);
    $searchSnippet = ($item['contentOrigin'] ?? '') === 'search-snippet';
    $companyInMaterial = review_purposeful_mention($searchSnippet ? $body : $text, $companyAliases);
    $exactBodyOffering = (bool)array_filter($offeringAliases, fn($alias) => str_contains($body, $alias));
    $snippetOfferingMatch = !$searchSnippet || $exactBodyOffering || review_fuzzy_offering($body, $offeringAliases, $companyAliases);
    $exactOffering = false; foreach ($offeringAliases as $alias) if (str_contains($text, $alias)) { $exactOffering = true; break; }
    $offeringMatch = $exactOffering || ($companyInTitle && $fuzzyOffering);
    $supplierBeforeCompany = false;
    if (preg_match('~поставщик|дилер|дистрибьютор|дистрибутор|автосалон~iu', $title, $supplier, PREG_OFFSET_CAPTURE)) foreach ($companyAliases as $alias) {
        $companyAt = strpos($title, $alias); if ($companyAt !== false && $companyAt > $supplier[0][1]) { $supplierBeforeCompany = true; break; }
    }
    if ($supplierBeforeCompany && !$exactOffering) return false;
    $productPage = (bool)(preg_match('~/(?:product|products|goods|item|catalog|katalog)(?:/|$)~i', $path) || preg_match('~(?:^|\s)товар\s*[—:]|отзыв[а-яё]*\s+о\s+товаре|отзывы\s+покупателей\s+и\s+пользователей~iu', $text));
    if ($productPage && (!$hasExperience || ($offeringAliases ? !$offeringMatch : !$companyInTitle))) return false;
    if (preg_match('~/shop(?:/|$)~i', $path) && $offeringAliases && !$offeringMatch) {
        $ownText = '';
        foreach ($sources as $source) if (($source['kind'] ?? '') === 'company-site') $ownText .= ' ' . ($source['title'] ?? '') . ' ' . ($source['text'] ?? '');
        $ownText = review_normalized($ownText);
        if ($ownText && !preg_match('~интернет-магазин|розничн[а-яё]*\s+(?:магазин|продаж)~iu', $ownText)) return false;
    }
    $market = $context['marketContext'] ?? $research['marketContext'] ?? [];
    if (($market['industry'] ?? '') === 'logistics' && preg_match('~(?:^|[\s.])shopping\b|шопп?инг~iu', $title)) return false;
    $reviewHost = strtolower(preg_replace('~^www\.~', '', parse_url($item['url'] ?? '', PHP_URL_HOST) ?: ''));
    $trustedCompanyMap = (preg_match('~(?:^|\.)yandex\.[a-z.]+$~i', $reviewHost) && preg_match('~/maps/org/~i', $path)) || (preg_match('~(?:^|\.)2gis\.[a-z.]+$~i', $reviewHost) && preg_match('~/firm/~i', $path));
    $directCompanyReview = $trustedCompanyMap && $companyInTitle && $companyInMaterial;
    if (!empty($market['subject']) && !$offeringMatch && !$directCompanyReview) {
        $sameMarket = in_array($market['subject'], ['продукция', 'товары', 'оборудование', 'профессиональные услуги', 'программные продукты', 'цифровые государственные сервисы'], true)
            ? (!empty($market['relevance']) && preg_match($market['relevance'], $text))
            : preg_match(market_subject_pattern($market['subject']), $text);
        if (!$sameMarket) return false;
    }
    return $companyInMaterial || ($offeringMatch && $snippetOfferingMatch);
}
