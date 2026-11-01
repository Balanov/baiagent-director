<?php
declare(strict_types=1);
$_SERVER['REQUEST_METHOD'] = 'CLI';
$source = file_get_contents(__DIR__ . '/../public/api/research.php');
$prefix = substr($source, 5, strpos($source, "\ntry {") - 5);
$prefix = str_replace("require_once __DIR__ . '/market.php';", "require_once __DIR__ . '/../public/api/market.php';", $prefix);
eval($prefix);

research_set_language('es');
$correosSources = [[
    'id' => 'site-1', 'kind' => 'company-site', 'companyName' => 'Correos', 'title' => 'Correos',
    'text' => 'Sigue tu envío, envía paquetes y cartas. Servicios de paquetería, logística, transporte y entrega para particulares y empresas.',
    'offerings' => [['name' => 'Paq Estándar'], ['name' => 'Carta Certificada']],
]];
$correosPlan = market_plan($correosSources);
$correosSite = 'https://www.correos.es/';
$dhl = ['title' => 'España', 'url' => 'https://mydhl.express.dhl/es/es/home.html', 'text' => 'DHL ofrece servicios de logística, transporte, paquetería y entrega para empresas. Consulte precios y envíos.'];

research_set_language('en');
$atlassianSources = [[
    'id' => 'site-1', 'kind' => 'company-site', 'companyName' => 'Atlassian', 'title' => 'Atlassian',
    'text' => 'Atlassian develops Jira and Confluence, team collaboration software and project management products for businesses.',
    'offerings' => [['name' => 'Jira'], ['name' => 'Confluence'], ['name' => 'Bitbucket']],
]];
$atlassianPlan = market_plan($atlassianSources);
$collaborationText = 'Project management software and team collaboration platform for business. Start a trial on our work management platform.';

research_set_language('zh');
$mideaSources = [[
    'id' => 'site-1', 'kind' => 'company-site', 'companyName' => 'Midea Group', 'title' => 'Midea Group',
    'text' => 'Midea Group manufactures home appliances and smart home products. Industrial Technology provides global industrial clients with intelligent products and solutions.',
    'offerings' => [['name' => 'Smart Home'], ['name' => 'Industrial Technology'], ['name' => '智能家居']],
]];
$mideaPlan = market_plan($mideaSources);

$componentPage = parse_page('<html><head><title>Parcels</title></head><body><acme-product-offer><h2 slot="title">National parcel delivery</h2><p>Send parcels to every region.</p><acme-action href-link="/services/national-parcels"><span>See delivery service</span></acme-action></acme-product-offer></body></html>', 'https://post-example.com/', 'site-component');
$componentNames = array_column($componentPage['offerings'], 'name');

$checks = [
    'correosIndustry' => $correosPlan['industry'] === 'logistics',
    'correosOwnOfferings' => in_array('Paq Estándar', $correosPlan['ownOfferingNames'], true),
    'dhlAccepted' => market_candidate($dhl, $correosPlan, $correosSite),
    'dhlName' => competitor_name($dhl) === 'DHL',
    'descriptiveSloganRejected' => competitor_name(['title' => 'Transporte y Entrega de Mercancías | Logística Confiable', 'url' => 'https://www.servientrega.com/', 'text' => 'Servicios de transporte y paquetería para empresas.']) === 'servientrega',
    'unconfirmedTldNotUsed' => competitor_name(array_merge($dhl, ['text' => 'Servicios de logística y entrega.'])) === 'EXPRESS',
    'ownOfferingRejected' => !market_candidate(['title' => 'Paq Estándar', 'url' => 'https://www.correos.es/envios/paq-estandar', 'text' => $dhl['text']], $correosPlan, $correosSite),
    'spanishListicleRejected' => !international_competitor_page(['title' => 'Los 100 mejores transportistas de Londres', 'url' => 'https://example.es/transportista/', 'text' => 'Servicios de transporte y paquetería.']),
    'mailboxReviewRejected' => !international_review_material(['title' => 'Opiniones sobre buzón de correos', 'url' => 'https://example.org/buzon-de-correos/', 'text' => '12 opiniones. Recomiendo este buzón de correos por su calidad.']),
    'atlassianCollaboration' => $atlassianPlan['softwareFamily'] === 'collaboration',
    'ownBitbucketRejected' => !market_candidate(['title' => 'Bitbucket', 'url' => 'https://bitbucket.org/', 'text' => $collaborationText], $atlassianPlan, 'https://www.atlassian.com/'),
    'plannerAccepted' => market_candidate(['title' => 'Microsoft Planner', 'url' => 'https://www.microsoft.com/en-us/microsoft-365/planner', 'text' => $collaborationText], $atlassianPlan, 'https://www.atlassian.com/'),
    'networkingRejected' => !market_candidate(['title' => 'Networking Software - Cisco', 'url' => 'https://www.cisco.com/site/us/en/products/networking/software/index.html', 'text' => 'Networking software and cloud platform for enterprise networks.'], $atlassianPlan, 'https://www.atlassian.com/'),
    'mideaIndustry' => $mideaPlan['industry'] === 'manufacturing',
    'mideaProductFamily' => $mideaPlan['productFamily'] === 'home-appliances' && $mideaPlan['subject'] === '家电与智能家居产品',
    'mideaOwnOfferings' => in_array('Smart Home', $mideaPlan['ownOfferingNames'], true),
    'homeApplianceCompetitorAccepted' => market_competitor_content('We manufacture refrigerators, washing machines and smart home appliances. View products and prices.', $mideaPlan),
    'industrialMicroscopesRejected' => !market_competitor_content('Industrial microscopes manufactured for laboratories. Browse products and buy.', $mideaPlan),
    'chineseNewsHostRejected' => !international_competitor_page(['title' => 'news.zol.com.cn/1266/12660762.html', 'url' => 'https://news.zol.com.cn/1266/12660762.html', 'text' => '四款适配全屋取暖的机型推荐']),
    'chineseEditorialTextRejected' => !international_competitor_page(['title' => '智造再升级 湖北移动5G+AI...', 'url' => 'https://example.cn/product/12.html', 'text' => '首页 > 产品大全 > 智造再升级 新闻焦点']),
    'webComponentOffering' => in_array('National parcel delivery', $componentNames, true),
    'webComponentLink' => ($componentPage['links'][0]['href'] ?? '') === '/services/national-parcels',
    'routeTitlesAreNotBrands' => competitor_name(['title' => 'Transporte España', 'url' => 'https://zakatrans.com/']) === 'zakatrans' && competitor_name(['title' => 'Envíos desde China a Bahrein', 'url' => 'https://www.tonlexing.com/es/bahrain/']) === 'tonlexing',
    'chineseControlsRejected' => !array_filter(['了解更多', 'EN', '报装报修', '服务进度查询', '在线客服', '美的业务'], 'useful_offering'),
    'numericAliasesStayStrings' => !array_filter(review_offering_aliases(['offerings' => [['name' => '2026']]], []), fn($alias) => !is_string($alias)),
    'dictionaryReviewRejected' => !international_review_material(['title' => 'Sany - Chinesisch Übersetzung - Englisch Beispiele | Reverso Context', 'url' => 'https://context.reverso.net/übersetzung/englisch-chinesisch/Sany', 'text' => 'Translation dictionary with service examples and reviews.']),
];

echo json_encode(['checks' => $checks, 'values' => [
    'correos' => ['industry' => $correosPlan['industry'], 'subject' => $correosPlan['subject']],
    'atlassian' => ['industry' => $atlassianPlan['industry'], 'family' => $atlassianPlan['softwareFamily']],
    'midea' => ['industry' => $mideaPlan['industry'], 'subject' => $mideaPlan['subject']],
    'componentNames' => $componentNames,
]], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
if (in_array(false, $checks, true)) exit(1);
