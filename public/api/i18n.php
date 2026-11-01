<?php
declare(strict_types=1);

// Search localisation is not a claim about the company's country. Only the
// language of the requested interface and of public evidence is selected here.
const RESEARCH_LANGUAGES = ['ru', 'en', 'zh', 'hi', 'es', 'ar'];
const RESEARCH_SEARCH_MARKETS = [
    'ru' => ['ru-RU', 'RU', 'ru', 'RU:ru'],
    'en' => ['en-US', 'US', 'en', 'US:en'],
    'zh' => ['zh-CN', 'CN', 'zh', 'CN:zh-Hans'],
    'hi' => ['hi-IN', 'IN', 'hi', 'IN:hi'],
    'es' => ['es-ES', 'ES', 'es', 'ES:es'],
    'ar' => ['ar-SA', 'SA', 'ar', 'SA:ar'],
];

function research_language(): string { return $GLOBALS['research_language'] ?? 'ru'; }
function research_normalize_language(string $value, string $fallback = 'en'): string {
    $primary = strtolower(explode('-', str_replace('_', '-', trim($value)))[0]);
    return in_array($primary, RESEARCH_LANGUAGES, true) ? $primary : $fallback;
}
function research_accept_language(string $header, string $fallback = 'en'): string {
    $choices = [];
    foreach (explode(',', $header) as $index => $part) {
        $pieces = array_map('trim', explode(';', $part));
        $tag = $pieces[0] ?? ''; $quality = 1.0;
        foreach (array_slice($pieces, 1) as $parameter) if (str_starts_with($parameter, 'q=')) $quality = (float)substr($parameter, 2);
        if ($tag !== '' && $quality > 0) $choices[] = ['tag' => $tag, 'quality' => $quality, 'index' => $index];
    }
    usort($choices, fn($a, $b) => ($b['quality'] <=> $a['quality']) ?: ($a['index'] <=> $b['index']));
    foreach ($choices as $choice) {
        $primary = strtolower(explode('-', $choice['tag'])[0]);
        if (in_array($primary, RESEARCH_LANGUAGES, true)) return $primary;
        if ($primary !== '*') return 'en';
    }
    return $fallback;
}
function research_set_language(string $requested = '', string $header = ''): string {
    $language = $requested !== '' && in_array(strtolower(explode('-', $requested)[0]), RESEARCH_LANGUAGES, true)
        ? research_normalize_language($requested)
        : ($requested !== '' ? 'en' : research_accept_language($header, 'ru'));
    $GLOBALS['research_language'] = $language;
    return $language;
}
function research_detect_language(string $declared, string $text): string {
    $body = substr($text, 0, 60000);
    $scripts = [
        'zh' => ['~\p{Han}~u', 5], 'hi' => ['~\p{Devanagari}~u', 5],
        'ar' => ['~\p{Arabic}~u', 5], 'ru' => ['~[а-яё]~iu', 8],
    ];
    $best = ['language' => '', 'count' => 0, 'minimum' => 0];
    foreach ($scripts as $language => [$pattern, $minimum]) {
        $count = preg_match_all($pattern, $body);
        if ($count > $best['count']) $best = ['language' => $language, 'count' => $count, 'minimum' => $minimum];
    }
    $letters = preg_match_all('~\p{L}~u', $body);
    if ($best['count'] >= $best['minimum'] && $best['count'] >= $letters * .02) return $best['language'];
    $sample = strtolower($body);
    $spanish = preg_match_all('~\b(?:el|la|los|las|de|que|y|para|con|una|empresa|servicios|productos|clientes|precio)\b~iu', $sample) + preg_match_all('~[áéíóúñ¿¡]~iu', $sample) * 2;
    $english = preg_match_all('~\b(?:the|and|for|with|our|your|company|services|products|customers|price|business)\b~i', $sample);
    if ($spanish >= 3 && $spanish > $english * .65) return 'es';
    if ($english >= 2) return 'en';
    return research_normalize_language($declared, 'en');
}

function international_copy(string $language): array {
    static $copy = [
        'en' => [
            'subjects' => ['software' => 'business software and cloud platforms', 'food' => 'restaurant and food delivery services', 'logistics' => 'business logistics and delivery', 'retail' => 'online retail products', 'manufacturing' => 'manufactured products', 'distribution' => 'equipment distribution', 'construction' => 'construction and engineering services', 'healthcare' => 'healthcare services', 'education' => 'professional education', 'finance' => 'financial services', 'cybersecurity' => 'cybersecurity solutions', 'government' => 'digital public services', 'professional' => 'professional services'],
            'queries' => ['software' => ['business software cloud platform pricing', 'enterprise software products provider'], 'food' => ['restaurant food delivery menu company', 'fast food restaurant menu order'], 'logistics' => ['business logistics delivery company pricing', 'freight delivery services provider'], 'retail' => ['online store products prices', 'retail product catalogue company'], 'manufacturing' => ['manufacturer products catalogue pricing', 'industrial products manufacturer supplier'], 'distribution' => ['equipment distributor catalogue company', 'business equipment supplier pricing'], 'construction' => ['construction engineering services company', 'building materials supplier contractor'], 'healthcare' => ['healthcare clinic services pricing', 'medical services provider clinic'], 'education' => ['professional education courses provider', 'business training programmes pricing'], 'finance' => ['business financial services provider', 'business banking services pricing'], 'cybersecurity' => ['business cybersecurity solutions provider', 'enterprise information security products'], 'government' => ['digital public services platform provider', 'government services digital platform'], 'professional' => ['professional business services company', 'consulting professional services pricing']],
            'signals' => ['software' => 'software|cloud|developer platform', 'food' => 'restaurant|food|menu|chicken|burger|pizza|delivery', 'logistics' => 'logistics|freight|shipping|courier|delivery', 'retail' => 'retail|online store|shop|products', 'manufacturing' => 'manufactur|factory|industrial products', 'distribution' => 'distributor|wholesale|equipment', 'construction' => 'construction|building|engineering', 'healthcare' => 'healthcare|medical|clinic|patient', 'education' => 'education|training|courses', 'finance' => 'financial|banking|insurance|payments', 'cybersecurity' => 'cybersecurity|information security', 'government' => 'government|public services', 'professional' => 'consulting|professional services|legal|accounting'],
            'market' => 'market demand trends', 'customers' => 'how to choose customer reviews complaints', 'prices' => 'prices pricing comparison', 'news' => 'market OR demand OR prices OR production',
            'commercial' => 'pricing|price|products?|services?|solutions?|platform|software|catalogue|catalog|order|delivery|contact sales|get started|subscription|buy|shop', 'customer' => 'choose|customer|review|complaint|quality|service|experience', 'price' => 'price|pricing|cost|subscription|budget', 'trend' => 'market|demand|growth|decline|trend|forecast|research|statistics|production', 'newsSignal' => 'market|demand|production|launch|growth|price|industry|sales',
            'reviews' => ['reviews rating', 'customer reviews Google Maps', 'customers partners news', 'customer reviews Trustpilot Google', 'reviews price', 'buy price alternative'],
        ],
        'es' => [
            'subjects' => ['software' => 'software empresarial y plataformas en la nube', 'food' => 'restaurantes y entrega de comida', 'logistics' => 'logística y entrega para empresas', 'retail' => 'productos de comercio electrónico', 'manufacturing' => 'productos manufacturados', 'distribution' => 'distribución de equipos', 'construction' => 'construcción e ingeniería', 'healthcare' => 'servicios sanitarios', 'education' => 'formación profesional', 'finance' => 'servicios financieros', 'cybersecurity' => 'soluciones de ciberseguridad', 'government' => 'servicios públicos digitales', 'professional' => 'servicios profesionales'],
            'queries' => ['software' => ['software empresarial nube precios proveedor', 'plataforma software para empresas'], 'food' => ['restaurante entrega comida menú empresa', 'comida rápida restaurante menú pedido'], 'logistics' => ['logística entrega empresas precios', 'transporte mercancías servicios proveedor'], 'retail' => ['tienda online productos precios', 'catálogo productos empresa'], 'manufacturing' => ['fabricante productos catálogo precios', 'productos industriales fabricante proveedor'], 'distribution' => ['distribuidor equipos catálogo empresa', 'proveedor equipos empresas precios'], 'construction' => ['construcción ingeniería servicios empresa', 'materiales construcción proveedor'], 'healthcare' => ['clínica servicios médicos precios', 'proveedor servicios sanitarios'], 'education' => ['formación profesional cursos empresa', 'formación empresas precios'], 'finance' => ['servicios financieros empresas proveedor', 'banca empresas precios'], 'cybersecurity' => ['ciberseguridad empresas soluciones proveedor', 'seguridad información productos empresa'], 'government' => ['servicios públicos digitales plataforma', 'digitalización administración plataforma'], 'professional' => ['servicios profesionales empresas', 'consultoría servicios profesionales precios']],
            'signals' => ['software' => 'software|nube', 'food' => 'restaurante|comida|menú|entrega', 'logistics' => 'logística|transporte|entrega|env[ií]os?|paquetes?|paquetería|cartas?', 'retail' => 'tienda|productos|minorista', 'manufacturing' => 'fabricante|manufactura|industrial', 'distribution' => 'distribuidor|equipos', 'construction' => 'construcción|ingeniería', 'healthcare' => 'salud|médic|clínica', 'education' => 'educación|formación|cursos', 'finance' => 'financier|banca|seguros', 'cybersecurity' => 'ciberseguridad|seguridad de la información', 'government' => 'gobierno|servicios públicos', 'professional' => 'consultoría|servicios profesionales'],
            'market' => 'mercado demanda tendencias', 'customers' => 'cómo elegir opiniones quejas clientes', 'prices' => 'precios comparativa tarifas', 'news' => 'mercado OR demanda OR precios OR producción',
            'commercial' => 'precios?|productos?|servicios?|soluciones|plataforma|software|catálogo|pedido|entrega|suscripción|comprar|consultoría', 'customer' => 'elegir|cliente|opiniones|quejas|calidad|servicio|experiencia', 'price' => 'precio|tarifa|coste|suscripción|presupuesto', 'trend' => 'mercado|demanda|crecimiento|descenso|tendencia|previsión|investigación|estadísticas|producción', 'newsSignal' => 'mercado|demanda|producción|lanzamiento|crecimiento|precio|sector|ventas',
            'reviews' => ['opiniones valoración', 'opiniones clientes Google Maps', 'clientes socios noticias', 'opiniones clientes Trustpilot Google', 'opiniones precio', 'comprar precio alternativa'],
        ],
        'zh' => [
            'subjects' => ['software' => '企业软件与云平台', 'food' => '餐饮与食品配送服务', 'logistics' => '企业物流与配送', 'retail' => '在线零售商品', 'manufacturing' => '工业制造产品', 'distribution' => '设备分销', 'construction' => '建筑与工程服务', 'healthcare' => '医疗健康服务', 'education' => '职业教育', 'finance' => '金融服务', 'cybersecurity' => '网络安全解决方案', 'government' => '数字政务服务', 'professional' => '专业商业服务'],
            'queries' => ['software' => ['企业软件 云平台 价格 服务商', '企业软件 产品 平台'], 'food' => ['餐厅 食品 配送 菜单 公司', '快餐 餐厅 菜单 订餐'], 'logistics' => ['企业 物流 配送 公司 价格', '货运 配送 服务 供应商'], 'retail' => ['在线商店 商品 价格', '零售 商品 目录 公司'], 'manufacturing' => ['制造商 产品 目录 价格', '工业产品 制造商 供应商'], 'distribution' => ['设备 经销商 目录 公司', '企业 设备 供应商 价格'], 'construction' => ['建筑 工程 服务 公司', '建筑材料 供应商 承包商'], 'healthcare' => ['医疗 诊所 服务 价格', '医疗服务 机构 诊所'], 'education' => ['职业教育 课程 机构', '企业培训 课程 价格'], 'finance' => ['企业 金融 服务 机构', '企业 银行 服务 价格'], 'cybersecurity' => ['企业 网络安全 解决方案 服务商', '企业 信息安全 产品'], 'government' => ['数字 政务 服务 平台', '政府 服务 数字 平台'], 'professional' => ['专业 商业 服务 公司', '咨询 专业 服务 价格']],
            'signals' => ['software' => '软件|云', 'food' => '餐|食品|菜单|配送', 'logistics' => '物流|配送|货运', 'retail' => '零售|商店|商品', 'manufacturing' => '制造|工厂|工业', 'distribution' => '经销|设备|批发', 'construction' => '建筑|工程', 'healthcare' => '医疗|诊所|健康', 'education' => '教育|培训|课程', 'finance' => '金融|银行|保险', 'cybersecurity' => '网络安全|信息安全', 'government' => '政务|政府', 'professional' => '咨询|专业服务'],
            'market' => '市场 需求 趋势', 'customers' => '如何选择 客户 评价 投诉', 'prices' => '价格 费用 对比', 'news' => '市场 OR 需求 OR 价格 OR 生产',
            'commercial' => '价格|产品|服务|解决方案|平台|软件|目录|订购|配送|订阅|购买|咨询', 'customer' => '选择|客户|评价|投诉|质量|服务|体验', 'price' => '价格|费用|成本|订阅|预算', 'trend' => '市场|需求|增长|下降|趋势|预测|研究|统计|生产', 'newsSignal' => '市场|需求|生产|发布|增长|价格|行业|销售',
            'reviews' => ['客户 评价 评分', '客户 评价 地图', '客户 合作伙伴 新闻', '客户 评价 大众点评', '评价 价格', '购买 价格 替代'],
        ],
        'hi' => [
            'subjects' => ['software' => 'व्यावसायिक सॉफ्टवेयर और क्लाउड प्लेटफ़ॉर्म', 'food' => 'रेस्तरां और खाद्य डिलीवरी सेवाएँ', 'logistics' => 'व्यावसायिक लॉजिस्टिक्स और डिलीवरी', 'retail' => 'ऑनलाइन खुदरा उत्पाद', 'manufacturing' => 'निर्मित उत्पाद', 'distribution' => 'उपकरण वितरण', 'construction' => 'निर्माण और इंजीनियरिंग सेवाएँ', 'healthcare' => 'स्वास्थ्य सेवाएँ', 'education' => 'व्यावसायिक शिक्षा', 'finance' => 'वित्तीय सेवाएँ', 'cybersecurity' => 'साइबर सुरक्षा समाधान', 'government' => 'डिजिटल सार्वजनिक सेवाएँ', 'professional' => 'व्यावसायिक सेवाएँ'],
            'queries' => ['software' => ['व्यावसायिक सॉफ्टवेयर क्लाउड कीमत प्रदाता', 'एंटरप्राइज सॉफ्टवेयर उत्पाद'], 'food' => ['रेस्तरां खाद्य डिलीवरी मेनू कंपनी', 'फास्ट फूड रेस्तरां मेनू ऑर्डर'], 'logistics' => ['व्यापार लॉजिस्टिक्स डिलीवरी कंपनी कीमत', 'माल ढुलाई सेवा प्रदाता'], 'retail' => ['ऑनलाइन स्टोर उत्पाद कीमत', 'खुदरा उत्पाद सूची कंपनी'], 'manufacturing' => ['निर्माता उत्पाद सूची कीमत', 'औद्योगिक उत्पाद निर्माता आपूर्तिकर्ता'], 'distribution' => ['उपकरण वितरक सूची कंपनी', 'व्यापार उपकरण आपूर्तिकर्ता कीमत'], 'construction' => ['निर्माण इंजीनियरिंग सेवा कंपनी', 'निर्माण सामग्री आपूर्तिकर्ता'], 'healthcare' => ['क्लिनिक स्वास्थ्य सेवा कीमत', 'चिकित्सा सेवा प्रदाता'], 'education' => ['व्यावसायिक शिक्षा पाठ्यक्रम प्रदाता', 'व्यावसायिक प्रशिक्षण कीमत'], 'finance' => ['व्यापार वित्तीय सेवा प्रदाता', 'व्यावसायिक बैंकिंग कीमत'], 'cybersecurity' => ['व्यापार साइबर सुरक्षा समाधान प्रदाता', 'एंटरप्राइज सूचना सुरक्षा उत्पाद'], 'government' => ['डिजिटल सार्वजनिक सेवा मंच', 'सरकारी सेवा डिजिटल मंच'], 'professional' => ['व्यावसायिक व्यापार सेवा कंपनी', 'परामर्श व्यावसायिक सेवा कीमत']],
            'signals' => ['software' => 'सॉफ्टवेयर|क्लाउड', 'food' => 'रेस्तरां|खाद्य|मेनू|डिलीवरी', 'logistics' => 'लॉजिस्टिक्स|डिलीवरी|ढुलाई', 'retail' => 'खुदरा|स्टोर|उत्पाद', 'manufacturing' => 'निर्माता|उत्पादन|औद्योगिक', 'distribution' => 'वितरक|उपकरण', 'construction' => 'निर्माण|इंजीनियरिंग', 'healthcare' => 'स्वास्थ्य|चिकित्सा|क्लिनिक', 'education' => 'शिक्षा|प्रशिक्षण|पाठ्यक्रम', 'finance' => 'वित्त|बैंक|बीमा', 'cybersecurity' => 'साइबर सुरक्षा|सूचना सुरक्षा', 'government' => 'सरकारी|सार्वजनिक', 'professional' => 'परामर्श|व्यावसायिक सेवा'],
            'market' => 'बाजार मांग रुझान', 'customers' => 'कैसे चुनें ग्राहक समीक्षा शिकायत', 'prices' => 'कीमत मूल्य तुलना', 'news' => 'बाजार OR मांग OR कीमत OR उत्पादन',
            'commercial' => 'कीमत|मूल्य|उत्पाद|सेवा|समाधान|मंच|सॉफ्टवेयर|सूची|ऑर्डर|डिलीवरी|खरीद|परामर्श', 'customer' => 'चुनें|ग्राहक|समीक्षा|शिकायत|गुणवत्ता|सेवा|अनुभव', 'price' => 'कीमत|मूल्य|लागत|बजट', 'trend' => 'बाजार|मांग|वृद्धि|गिरावट|रुझान|पूर्वानुमान|शोध|आँकड़े|उत्पादन', 'newsSignal' => 'बाजार|मांग|उत्पादन|लॉन्च|वृद्धि|कीमत|उद्योग|बिक्री',
            'reviews' => ['ग्राहक समीक्षा रेटिंग', 'ग्राहक समीक्षा Google Maps', 'ग्राहक भागीदार समाचार', 'ग्राहक समीक्षा Google', 'समीक्षा कीमत', 'खरीद कीमत विकल्प'],
        ],
        'ar' => [
            'subjects' => ['software' => 'برمجيات الأعمال والمنصات السحابية', 'food' => 'المطاعم وخدمات توصيل الطعام', 'logistics' => 'الخدمات اللوجستية والتوصيل للأعمال', 'retail' => 'منتجات التجزئة الإلكترونية', 'manufacturing' => 'المنتجات الصناعية', 'distribution' => 'توزيع المعدات', 'construction' => 'خدمات البناء والهندسة', 'healthcare' => 'خدمات الرعاية الصحية', 'education' => 'التعليم المهني', 'finance' => 'الخدمات المالية', 'cybersecurity' => 'حلول الأمن السيبراني', 'government' => 'الخدمات الحكومية الرقمية', 'professional' => 'الخدمات المهنية للأعمال'],
            'queries' => ['software' => ['برمجيات أعمال منصة سحابية أسعار مزود', 'برمجيات للشركات منتجات'], 'food' => ['مطعم توصيل طعام قائمة شركة', 'وجبات سريعة مطعم قائمة طلب'], 'logistics' => ['خدمات لوجستية توصيل للشركات أسعار', 'شحن وتوصيل بضائع شركة'], 'retail' => ['متجر إلكتروني منتجات أسعار', 'منتجات تجزئة كتالوج شركة'], 'manufacturing' => ['شركة تصنيع منتجات كتالوج أسعار', 'منتجات صناعية مصنع مورد'], 'distribution' => ['موزع معدات كتالوج شركة', 'مورد معدات للشركات أسعار'], 'construction' => ['شركة خدمات بناء وهندسة', 'مورد مواد بناء مقاول'], 'healthcare' => ['عيادة خدمات طبية أسعار', 'مزود خدمات رعاية صحية'], 'education' => ['دورات تعليم مهني مزود', 'تدريب للشركات أسعار'], 'finance' => ['خدمات مالية للشركات مزود', 'خدمات مصرفية للأعمال أسعار'], 'cybersecurity' => ['حلول أمن سيبراني للشركات مزود', 'منتجات أمن المعلومات للشركات'], 'government' => ['منصة خدمات حكومية رقمية', 'التحول الرقمي للخدمات الحكومية'], 'professional' => ['شركة خدمات مهنية للأعمال', 'خدمات استشارية مهنية أسعار']],
            'signals' => ['software' => 'برمجيات|سحابية', 'food' => 'مطعم|طعام|وجبات|توصيل', 'logistics' => 'لوجست|توصيل|شحن', 'retail' => 'تجزئة|متجر|منتجات', 'manufacturing' => 'تصنيع|مصنع|صناعية', 'distribution' => 'موزع|معدات', 'construction' => 'بناء|هندسة', 'healthcare' => 'صحية|طبية|عيادة', 'education' => 'تعليم|تدريب|دورات', 'finance' => 'مالية|مصرفية|تأمين', 'cybersecurity' => 'أمن سيبراني|أمن المعلومات', 'government' => 'حكومية|حكومة', 'professional' => 'استشارات|خدمات مهنية'],
            'market' => 'السوق الطلب الاتجاهات', 'customers' => 'كيفية الاختيار آراء العملاء شكاوى', 'prices' => 'الأسعار التعرفة مقارنة', 'news' => 'السوق OR الطلب OR الأسعار OR الإنتاج',
            'commercial' => 'سعر|أسعار|منتج|خدمات|حلول|منصة|برمجيات|كتالوج|طلب|توصيل|اشتراك|شراء|استشارات', 'customer' => 'اختيار|عميل|عملاء|آراء|شكاوى|جودة|خدمة|تجربة', 'price' => 'سعر|أسعار|تكلفة|اشتراك|ميزانية', 'trend' => 'سوق|طلب|نمو|انخفاض|اتجاه|توقعات|بحث|إحصاءات|إنتاج', 'newsSignal' => 'سوق|طلب|إنتاج|إطلاق|نمو|سعر|صناعة|مبيعات',
            'reviews' => ['آراء العملاء تقييم', 'آراء العملاء خرائط Google', 'عملاء شركاء أخبار', 'آراء العملاء Google', 'آراء سعر', 'شراء سعر بديل'],
        ],
    ];
    return $copy[$language] ?? $copy['en'];
}

function international_pattern(string $source): string { return '~' . $source . '~iu'; }
function international_market_plan(array $sources, string $language): array {
    $copy = international_copy($language);
    $basis = array_values(array_filter($sources, fn($source) => strlen(trim((string)($source['text'] ?? ''))) >= 40 && !in_array($source['kind'] ?? '', ['competitor-candidate', 'industry-snippet', 'customer-snippet', 'market-price-snippet', 'alternative-snippet', 'news-snippet'], true)));
    $primary = ''; $secondary = ''; $ownOfferingNames = [];
    foreach ($basis as $index => $source) {
        $text = ($source['title'] ?? '') . ' ' . ($source['text'] ?? '');
        if ($index === 0) {
            // Navigation and late links must not outweigh the company's main profile.
            $primary = preg_match('/^.{0,8000}/us', $text, $head) ? $head[0] : $text;
        } else $secondary .= ' ' . $text;
        if (($source['kind'] ?? '') === 'company-site') foreach ($source['offerings'] ?? [] as $offering) {
            $name = clean_text((string)($offering['displayName'] ?? $offering['name'] ?? ''));
            if ($name !== '') $ownOfferingNames[$name] = true;
        }
    }
    $scores = []; $patterns = [];
    foreach ($copy['signals'] as $id => $signal) {
        // Recognise the evidence even if its language differs from the UI.
        $all = [$signal];
        foreach (['en', 'es', 'zh', 'hi', 'ar'] as $other) $all[] = international_copy($other)['signals'][$id];
        $patterns[$id] = international_pattern(implode('|', $all));
        $scores[$id] = min(8, preg_match_all($patterns[$id], $primary)) * 4 + min(8, preg_match_all($patterns[$id], $secondary));
    }
    arsort($scores); $industry = array_key_first($scores);
    if (($scores[$industry] ?? 0) < 1) $industry = 'professional';
    $subject = $copy['subjects'][$industry] ?? $copy['subjects']['professional'];
    $queries = $copy['queries'][$industry] ?? $copy['queries']['professional'];
    $ownText = $primary . ' ' . $secondary . ' ' . implode(' ', array_keys($ownOfferingNames));
    $productFamily = ''; $familyPattern = null;
    $softwareFamily = $industry === 'software' && preg_match('~jira|confluence|team collaboration|project management|work management|управлени[а-яё]* проект~iu', $ownText) ? 'collaboration' : '';
    if ($softwareFamily === 'collaboration') $queries = ['team collaboration software for business', 'project management software for teams'];
    if (in_array($industry, ['manufacturing', 'retail', 'distribution'], true) && preg_match('~home appliances?|smart home|electrical equipment|ceiling fans|consumer electronics|бытов[а-яё]* техник|家电|智能家居|घरेलू उपकरण|أجهزة منزلية~iu', $ownText)) {
        $productFamily = 'home-appliances';
        $family = [
            'en' => ['home appliances and smart home products', ['home appliances smart home manufacturer products', 'major home appliances manufacturer catalogue']],
            'es' => ['electrodomésticos y productos para el hogar inteligente', ['fabricante electrodomésticos hogar inteligente productos', 'fabricante grandes electrodomésticos catálogo']],
            'zh' => ['家电与智能家居产品', ['home appliances smart home manufacturer products', '家电 智能家居 制造商 产品']],
            'hi' => ['घरेलू उपकरण और स्मार्ट होम उत्पाद', ['home appliances smart home manufacturer products India', 'electrical equipment home appliances manufacturer catalogue India']],
            'ar' => ['الأجهزة المنزلية ومنتجات المنزل الذكي', ['home appliances smart home manufacturer products Middle East', 'major home appliances manufacturer catalogue']],
        ][$language] ?? ['home appliances and smart home products', ['home appliances smart home manufacturer products']];
        [$subject, $queries] = $family;
        $familyPattern = international_pattern('home appliances?|smart home|refrigerators?|washing machines?|air conditioners?|ceiling fans|kitchen appliances?|electrical equipment|lighting|switches|cables|electrodomésticos|家电|智能家居|冰箱|洗衣机|空调|风扇|घरेलू उपकरण|स्मार्ट होम|पंखे|बिजली उपकरण|أجهزة منزلية|منزل ذكي|ثلاجات|غسالات|مكيفات|مراوح');
        $patterns[$industry] = international_pattern(preg_replace('/^~|~iu$/', '', $patterns[$industry]) . '|' . 'home appliances?|smart home|refrigerators?|washing machines?|air conditioners?|ceiling fans|electrical equipment|家电|智能家居');
    }
    return [
        'language' => $language, 'industry' => $industry, 'subject' => $subject,
        'companyName' => clean_text((string)($basis[0]['companyName'] ?? '')), 'ownAliases' => [],
        'ownOfferingNames' => array_keys($ownOfferingNames),
        'genericSubject' => !$productFamily, 'serviceMarketplace' => false, 'softwareFamily' => $softwareFamily, 'softwareAudience' => null,
        'productFamily' => $productFamily, 'productFamilyPattern' => $familyPattern,
        'competitorQueries' => $queries,
        'evidenceQueries' => [
            ['kind' => 'industry-snippet', 'query' => $subject . ' ' . $copy['market'] . ' ' . gmdate('Y'), 'message' => $subject . ' · ' . $copy['market']],
            ['kind' => 'customer-snippet', 'query' => $subject . ' ' . $copy['customers'], 'message' => $subject . ' · ' . $copy['customers']],
            ['kind' => 'market-price-snippet', 'query' => $subject . ' ' . $copy['prices'], 'message' => $subject . ' · ' . $copy['prices']],
        ],
        'relevance' => $patterns[$industry], 'subjectPattern' => $patterns[$industry],
        // Evidence may be published in a language different from the interface.
        'commercialPattern' => international_pattern(implode('|', array_column(array_map('international_copy', ['en', 'es', 'zh', 'hi', 'ar']), 'commercial'))),
        'customerPattern' => international_pattern(implode('|', array_column(array_map('international_copy', ['en', 'es', 'zh', 'hi', 'ar']), 'customer'))),
        'pricePattern' => international_pattern(implode('|', array_column(array_map('international_copy', ['en', 'es', 'zh', 'hi', 'ar']), 'price'))),
        'trendPattern' => international_pattern(implode('|', array_column(array_map('international_copy', ['en', 'es', 'zh', 'hi', 'ar']), 'trend'))),
        'newsSignal' => international_pattern(implode('|', array_column(array_map('international_copy', ['en', 'es', 'zh', 'hi', 'ar']), 'newsSignal'))), 'newsQuery' => '"' . $subject . '" (' . $copy['news'] . ')',
    ];
}
function international_plan(array $plan): bool { return ($plan['language'] ?? 'ru') !== 'ru'; }
function company_research_queries(string $company, string $language): array {
    if ($language === 'ru') return ['"' . $company . '" отзывы рейтинг', '"' . $company . '" отзывы Яндекс Карты', '"' . $company . '"', '"' . $company . '" клиенты партнеры новости'];
    $copy = international_copy($language)['reviews'];
    return ['"' . $company . '" ' . $copy[0], '"' . $company . '" ' . $copy[1], '"' . $company . '"', '"' . $company . '" ' . $copy[2]];
}
function product_research_query(string $name, string $mode, string $language): string {
    if ($language === 'ru') return '"' . $name . '" ' . ($mode === 'reviews' ? 'отзывы цена' : 'купить цена аналог');
    $copy = international_copy($language)['reviews'];
    return '"' . $name . '" ' . $copy[$mode === 'reviews' ? 4 : 5];
}
function research_generic_offering(string $name): bool {
    $name = trim($name);
    return (bool)preg_match('~^(?:products?|services?|solutions?|software|platform|home|menu|pricing|shop|store|catalogue|catalog|learn more|read more|more|buy now|order now|contact us|get started|productos|servicios|soluciones|precios|catálogo|inicio|leer más|comprar|pedir|产品|服务|解决方案|价格|首页|更多|了解更多|购买|报装报修|售后服务|在线客服|美的业务|our businesses|english|中文|español|हिन्दी|العربية|en|es|zh|hi|ar|उत्पाद|सेवाएँ|समाधान|कीमत|होम|और पढ़ें|खरीदें|منتجات|خدمات|حلول|أسعار|الرئيسية|المزيد|شراء)$~iu', $name)
        || (bool)preg_match('~^报装|^报修|^售后服务$|^在线客服$|查询$~iu', $name);
}
function international_competitor_page(array $item): bool {
    $url = (string)($item['url'] ?? ''); $host = strtolower((string)(parse_url($url, PHP_URL_HOST) ?: '')); $path = (string)(parse_url($url, PHP_URL_PATH) ?: '');
    if (!$host) return false;
    if (preg_match('~(?:^|\.)(?:wikipedia\.org|crunchbase\.com|pr\.com|pinterest\.[a-z.]+|pikbest\.com|dreamstime\.com|depositphotos\.com|vecteezy\.com|europages\.[a-z.]+|fastercapital\.com|daypo\.com|talabat\.com|snoonu\.com|unstore\.io|daleeeel\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|reddit\.com|quora\.com|medium\.com|g2\.com|capterra\.com|getapp\.com|softwareadvice\.com|made-in-china\.com|alibaba\.com|aliexpress\.com|aeroexpo\.[a-z.]+|directindustry\.[a-z.]+|wearesellers\.com|dealmoon\.com)$~iu', $host) || preg_match('~^(?:news|blog|press|media)\.~iu', $host) || preg_match('~\.pdf(?:\.html)?$~iu', $path)) return false;
    if (preg_match('~/(?:news|articles?|blog|posts?|contenido|content|guides?|resources?|wiki|directory|locations|marketplace|categories|category|question|questions|suppliers|producers)(?:/|$)~iu', $path)) return false;
    $evidence = ($item['title'] ?? '') . ' ' . ($item['text'] ?? '');
    return !preg_match('~(?:best|top|mejores)\s+\d+|\d+\s+(?:best|top|mejores)\b|customer reviews|what is|how to choose|market report|price list template|manufacturers?,?\s+suppliers?|all products? (?:catalog|catalogue)|\btest\b|\bquiz\b|examen|[?？]|推荐|怎么|如何|新闻|产品大全|资讯|攻略~iu', $evidence);
}
function international_review_material(array $item): bool {
    $host = strtolower((string)(parse_url((string)($item['url'] ?? ''), PHP_URL_HOST) ?: ''));
    if (in_array($item['pageType'] ?? '', ['article', 'search'], true) || preg_match('~(?:^|/)search(?:/|$)~i', (string)(parse_url($item['url'] ?? '', PHP_URL_PATH) ?: '')) || preg_match('~(?:^|\.)(?:ambitionbox\.com|reverso\.net|dictionary\.cambridge\.org|collinsdictionary\.com|wordreference\.com|bab\.la|linguee\.com)$~iu', $host)) return false;
    $text = ($item['title'] ?? '') . ' ' . ($item['text'] ?? '') . ' ' . ($item['url'] ?? '');
    if (preg_match('~employee reviews?|employees?\s+(?:rate|review)|working at|workplace|job security|work-life balance|career growth|salary|buz[oó]n(?:es)?\s+de\s+correos|buzon-de-correos|mailbox|letterbox|отзыв[а-яё]* сотрудник|условия труда|зарплат~iu', $text)) return false;
    $marker = '~reviews?|rating|opiniones|reseñas|valoración|评价|评分|समीक्षा|रेटिंग|مراجعات|تقييم|آراء|отзыв|рейтинг|оценк~iu';
    $detail = '~\d+\s*(?:reviews?|opiniones|reseñas|条评价|समीक्षाएँ|مراجعة|отзыв)|\d[.,]\d\s*(?:out of\s*5|de\s*5|से\s*5|من\s*5|из\s*5)|\b(?:i|we|my|our)\b|recommend|quality|service|delivery|recomiendo|no recomiendo|calidad|servicio|推荐|好评|差评|की सिफारिश|गुणवत्ता|أنصح|لا أنصح|جودة|рекоменд|качество~iu';
    return preg_match($marker, $text) && preg_match($detail, $text);
}
function international_relevant_review(array $item, array $context): bool {
    if (!international_review_material($item)) return false;
    $sources = $context['sources'] ?? [];
    $title = review_normalized((string)($item['title'] ?? ''));
    $body = review_normalized((string)($item['text'] ?? ''));
    $text = $title . ' ' . $body;
    $companyAliases = review_company_aliases($context, $sources);
    $offeringAliases = review_offering_aliases($context, $sources);
    $companyMatch = review_purposeful_mention($title, $companyAliases) || review_purposeful_mention($body, $companyAliases);
    $offeringMatch = (bool)array_filter($offeringAliases, fn($alias) => str_contains($text, $alias));
    if (!$companyMatch && !$offeringMatch) return false;
    $experience = '~\b(?:i|we|my|our)\b|recommend|quality|service|delivery|recomiendo|no recomiendo|calidad|servicio|推荐|好评|差评|की सिफारिश|गुणवत्ता|أنصح|لا أنصح|جودة|рекоменд|качество~iu';
    $rating = '~\d+\s*(?:reviews?|opiniones|reseñas|条评价|समीक्षाएँ|مراجعة|отзыв)|\d[.,]\d\s*(?:out of\s*5|de\s*5|से\s*5|من\s*5|из\s*5)~iu';
    if (preg_match('~0\s+(?:reviews?|opiniones|reseñas|条评价|समीक्षाएँ|مراجعة)|no reviews yet|sin opiniones|لا توجد مراجعات~iu', $body) && !preg_match($experience, $text)) return false;
    return preg_match($experience, $text) || preg_match($rating, $text);
}
function research_translated_notice(string $message): string {
    if (research_language() === 'ru') return $message;
    $language = research_language();
    $partial = str_contains($message, 'лимит времени') || str_contains($message, 'загружены частично') || str_contains($message, 'изучены частично');
    $coverage = str_contains($message, 'собственного сайта') || str_contains($message, 'главной страницы');
    if ($partial || $coverage) {
        $notices = [
            'partial' => ['en' => 'Some sources could not be studied within the time limit. Only retrieved evidence is included.', 'es' => 'Algunas fuentes no pudieron estudiarse dentro del límite. Solo se incluyen las evidencias obtenidas.', 'zh' => '部分来源因时限未能研究，仅保留已获取的证据。', 'hi' => 'समय सीमा के कारण कुछ स्रोत नहीं खोले जा सके। केवल प्राप्त प्रमाण शामिल हैं।', 'ar' => 'تعذر دراسة بعض المصادر ضمن المهلة. تم تضمين الأدلة التي تم الحصول عليها فقط.'],
            'coverage' => ['en' => 'The company website text is unavailable or insufficient. The profile uses independent sources and needs verification.', 'es' => 'El texto del sitio no está disponible o es insuficiente. El perfil usa fuentes independientes y requiere verificación.', 'zh' => '公司网站文本不可用或不足。企业信息来自独立来源，仍需核实。', 'hi' => 'कंपनी की साइट का पाठ उपलब्ध नहीं या अपर्याप्त है। प्रोफ़ाइल स्वतंत्र स्रोतों पर आधारित है और जाँच ज़रूरी है।', 'ar' => 'نص موقع الشركة غير متاح أو غير كاف. يعتمد الملف على مصادر مستقلة ويحتاج إلى تحقق.'],
        ];
        return $notices[$partial ? 'partial' : 'coverage'][$language];
    }
    $translations = [
        'Логотип не определён: изображения без явных признаков бренда не используются.' => ['en' => 'No logo was confirmed: images without explicit brand markers are not used.', 'es' => 'No se confirmó el logotipo: no se usan imágenes sin señales explícitas de la marca.', 'zh' => '未能确认标志：不会使用没有明确品牌特征的图片。', 'hi' => 'लोगो की पुष्टि नहीं हुई: स्पष्ट ब्रांड संकेतों के बिना चित्रों का उपयोग नहीं किया गया।', 'ar' => 'لم يتم تأكيد الشعار: لا تستخدم الصور التي لا تحمل علامات واضحة للعلامة التجارية.'],
        'Логотип определён только по favicon; визуальное соответствие бренду не подтверждено.' => ['en' => 'The logo was inferred only from the favicon; its visual match to the brand is unconfirmed.', 'es' => 'El logotipo se dedujo solo del favicon; su correspondencia visual con la marca no está confirmada.', 'zh' => '标志仅根据网站图标推测，尚未确认其与品牌的视觉一致性。', 'hi' => 'लोगो केवल फ़ेविकॉन से अनुमानित है; ब्रांड से दृश्य मिलान की पुष्टि नहीं हुई।', 'ar' => 'تم استنتاج الشعار من أيقونة الموقع فقط؛ ولم يتم تأكيد تطابقه البصري مع العلامة التجارية.'],
        'Сайт вернул JavaScript-challenge: содержимое страницы недоступно без браузерной проверки.' => ['en' => 'The site returned a JavaScript challenge: page content is unavailable without browser verification.', 'es' => 'El sitio devolvió un desafío de JavaScript: el contenido requiere verificación en el navegador.', 'zh' => '网站返回了 JavaScript 验证：需要通过浏览器验证才能读取内容。', 'hi' => 'साइट ने JavaScript चुनौती दी: ब्राउज़र सत्यापन के बिना सामग्री उपलब्ध नहीं है।', 'ar' => 'أعاد الموقع تحدي JavaScript: المحتوى غير متاح دون تحقق عبر المتصفح.'],
        'Страница не содержит доступного текста: содержимое сайта не было получено.' => ['en' => 'The page has no readable text: website content could not be retrieved.', 'es' => 'La página no contiene texto legible: no se pudo obtener el contenido del sitio.', 'zh' => '页面没有可读取的文本：未能获取网站内容。', 'hi' => 'पृष्ठ में पढ़ने योग्य पाठ नहीं है: वेबसाइट की सामग्री प्राप्त नहीं हो सकी।', 'ar' => 'لا تحتوي الصفحة على نص مقروء: تعذر الحصول على محتوى الموقع.'],
        'Укажите сайт компании' => ['en' => 'Enter the company website', 'es' => 'Indique el sitio web de la empresa', 'zh' => '请输入公司网站', 'hi' => 'कंपनी की वेबसाइट दर्ज करें', 'ar' => 'أدخل موقع الشركة'],
        'Нужен обычный публичный адрес сайта' => ['en' => 'Enter a regular public website address', 'es' => 'Introduzca una dirección web pública válida', 'zh' => '请输入有效的公开网站地址', 'hi' => 'मान्य सार्वजनिक वेबसाइट पता दर्ज करें', 'ar' => 'أدخل عنوان موقع عام صالحاً'],
        'Нестандартные порты не используются' => ['en' => 'Non-standard ports are not supported', 'es' => 'No se admiten puertos no estándar', 'zh' => '不支持非标准端口', 'hi' => 'गैर-मानक पोर्ट समर्थित नहीं हैं', 'ar' => 'المنافذ غير القياسية غير مدعومة'],
        'По адресу нет читаемой веб-страницы' => ['en' => 'No readable web page was found at this address', 'es' => 'No se encontró una página legible en esta dirección', 'zh' => '此地址没有可读取的网页', 'hi' => 'इस पते पर पढ़ने योग्य वेबपेज नहीं मिला', 'ar' => 'لم توجد صفحة مقروءة على هذا العنوان'],
        'Не удалось получить текст открытых источников' => ['en' => 'No readable public source text could be retrieved', 'es' => 'No se pudo obtener texto de fuentes públicas', 'zh' => '无法读取公开来源文本', 'hi' => 'सार्वजनिक स्रोतों का पाठ प्राप्त नहीं हो सका', 'ar' => 'تعذر الحصول على نص من المصادر العامة'],
        'Слишком много запросов. Попробуйте через несколько минут.' => ['en' => 'Too many requests. Please try again in a few minutes.', 'es' => 'Demasiadas solicitudes. Inténtelo de nuevo en unos minutos.', 'zh' => '请求过多，请几分钟后重试。', 'hi' => 'बहुत अधिक अनुरोध। कुछ मिनट बाद प्रयास करें।', 'ar' => 'طلبات كثيرة. حاول مرة أخرى بعد دقائق.'],
    ];
    return $translations[$message][research_language()] ?? $translations[$message]['en'] ?? $message;
}
