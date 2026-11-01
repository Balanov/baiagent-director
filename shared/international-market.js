import { normalizeLanguage, researchLanguage } from './locale.js';

const COPY = {
  en: {
    subjects: { software: 'business software and cloud platforms', food: 'restaurant and food delivery services', logistics: 'business logistics and delivery', retail: 'online retail products', manufacturing: 'manufactured products', distribution: 'equipment distribution', construction: 'construction and engineering services', healthcare: 'healthcare services', education: 'professional education', finance: 'financial services', cybersecurity: 'cybersecurity solutions', government: 'digital public services', professional: 'professional services' },
    queries: { software: ['business software cloud platform pricing', 'enterprise software products provider'], food: ['restaurant food delivery menu company', 'fast food restaurant menu order'], logistics: ['business logistics delivery company pricing', 'freight delivery services provider'], retail: ['online store products prices', 'retail product catalogue company'], manufacturing: ['manufacturer products catalogue pricing', 'industrial products manufacturer supplier'], distribution: ['equipment distributor catalogue company', 'business equipment supplier pricing'], construction: ['construction engineering services company', 'building materials supplier contractor'], healthcare: ['healthcare clinic services pricing', 'medical services provider clinic'], education: ['professional education courses provider', 'business training programmes pricing'], finance: ['business financial services provider', 'business banking services pricing'], cybersecurity: ['business cybersecurity solutions provider', 'enterprise information security products'], government: ['digital public services platform provider', 'government services digital platform'], professional: ['professional business services company', 'consulting professional services pricing'] },
    market: 'market demand trends', customers: 'how to choose customer reviews complaints', prices: 'prices pricing comparison', news: 'market OR demand OR prices OR production', commercial: /pricing|price|products?|services?|solutions?|platform|software|catalogue|catalog|order|delivery|contact sales|get started|subscription|buy|shop/i,
    customer: /choose|customer|review|complaint|quality|service|experience/i, price: /price|pricing|cost|subscription|budget/i, trend: /market|demand|growth|decline|trend|forecast|research|statistics|production/i, newsSignal: /market|demand|production|launch|growth|price|industry|sales/i,
  },
  es: {
    subjects: { software: 'software empresarial y plataformas en la nube', food: 'restaurantes y entrega de comida', logistics: 'logística y entrega para empresas', retail: 'productos de comercio electrónico', manufacturing: 'productos manufacturados', distribution: 'distribución de equipos', construction: 'construcción e ingeniería', healthcare: 'servicios sanitarios', education: 'formación profesional', finance: 'servicios financieros', cybersecurity: 'soluciones de ciberseguridad', government: 'servicios públicos digitales', professional: 'servicios profesionales' },
    queries: { software: ['software empresarial nube precios proveedor', 'plataforma software para empresas'], food: ['restaurante entrega comida menú empresa', 'comida rápida restaurante menú pedido'], logistics: ['logística entrega empresas precios', 'transporte mercancías servicios proveedor'], retail: ['tienda online productos precios', 'catálogo productos empresa'], manufacturing: ['fabricante productos catálogo precios', 'productos industriales fabricante proveedor'], distribution: ['distribuidor equipos catálogo empresa', 'proveedor equipos empresas precios'], construction: ['construcción ingeniería servicios empresa', 'materiales construcción proveedor'], healthcare: ['clínica servicios médicos precios', 'proveedor servicios sanitarios'], education: ['formación profesional cursos empresa', 'formación empresas precios'], finance: ['servicios financieros empresas proveedor', 'banca empresas precios'], cybersecurity: ['ciberseguridad empresas soluciones proveedor', 'seguridad información productos empresa'], government: ['servicios públicos digitales plataforma', 'digitalización administración plataforma'], professional: ['servicios profesionales empresas', 'consultoría servicios profesionales precios'] },
    market: 'mercado demanda tendencias', customers: 'cómo elegir opiniones quejas clientes', prices: 'precios comparativa tarifas', news: 'mercado OR demanda OR precios OR producción', commercial: /precios?|productos?|servicios?|soluciones|plataforma|software|catálogo|pedido|entrega|suscripción|comprar|consultoría/i,
    customer: /elegir|cliente|opiniones|quejas|calidad|servicio|experiencia/i, price: /precio|tarifa|coste|suscripción|presupuesto/i, trend: /mercado|demanda|crecimiento|descenso|tendencia|previsión|investigación|estadísticas|producción/i, newsSignal: /mercado|demanda|producción|lanzamiento|crecimiento|precio|sector|ventas/i,
  },
  zh: {
    subjects: { software: '企业软件与云平台', food: '餐饮与食品配送服务', logistics: '企业物流与配送', retail: '在线零售商品', manufacturing: '工业制造产品', distribution: '设备分销', construction: '建筑与工程服务', healthcare: '医疗健康服务', education: '职业教育', finance: '金融服务', cybersecurity: '网络安全解决方案', government: '数字政务服务', professional: '专业商业服务' },
    queries: { software: ['企业软件 云平台 价格 服务商', '企业软件 产品 平台'], food: ['餐厅 食品 配送 菜单 公司', '快餐 餐厅 菜单 订餐'], logistics: ['企业 物流 配送 公司 价格', '货运 配送 服务 供应商'], retail: ['在线商店 商品 价格', '零售 商品 目录 公司'], manufacturing: ['制造商 产品 目录 价格', '工业产品 制造商 供应商'], distribution: ['设备 经销商 目录 公司', '企业 设备 供应商 价格'], construction: ['建筑 工程 服务 公司', '建筑材料 供应商 承包商'], healthcare: ['医疗 诊所 服务 价格', '医疗服务 机构 诊所'], education: ['职业教育 课程 机构', '企业培训 课程 价格'], finance: ['企业 金融 服务 机构', '企业 银行 服务 价格'], cybersecurity: ['企业 网络安全 解决方案 服务商', '企业 信息安全 产品'], government: ['数字 政务 服务 平台', '政府 服务 数字 平台'], professional: ['专业 商业 服务 公司', '咨询 专业 服务 价格'] },
    market: '市场 需求 趋势', customers: '如何选择 客户 评价 投诉', prices: '价格 费用 对比', news: '市场 OR 需求 OR 价格 OR 生产', commercial: /价格|产品|服务|解决方案|平台|软件|目录|订购|配送|订阅|购买|咨询/,
    customer: /选择|客户|评价|投诉|质量|服务|体验/, price: /价格|费用|成本|订阅|预算/, trend: /市场|需求|增长|下降|趋势|预测|研究|统计|生产/, newsSignal: /市场|需求|生产|发布|增长|价格|行业|销售/,
  },
  hi: {
    subjects: { software: 'व्यावसायिक सॉफ्टवेयर और क्लाउड प्लेटफ़ॉर्म', food: 'रेस्तरां और खाद्य डिलीवरी सेवाएँ', logistics: 'व्यावसायिक लॉजिस्टिक्स और डिलीवरी', retail: 'ऑनलाइन खुदरा उत्पाद', manufacturing: 'निर्मित उत्पाद', distribution: 'उपकरण वितरण', construction: 'निर्माण और इंजीनियरिंग सेवाएँ', healthcare: 'स्वास्थ्य सेवाएँ', education: 'व्यावसायिक शिक्षा', finance: 'वित्तीय सेवाएँ', cybersecurity: 'साइबर सुरक्षा समाधान', government: 'डिजिटल सार्वजनिक सेवाएँ', professional: 'व्यावसायिक सेवाएँ' },
    queries: { software: ['व्यावसायिक सॉफ्टवेयर क्लाउड कीमत प्रदाता', 'एंटरप्राइज सॉफ्टवेयर उत्पाद'], food: ['रेस्तरां खाद्य डिलीवरी मेनू कंपनी', 'फास्ट फूड रेस्तरां मेनू ऑर्डर'], logistics: ['व्यापार लॉजिस्टिक्स डिलीवरी कंपनी कीमत', 'माल ढुलाई सेवा प्रदाता'], retail: ['ऑनलाइन स्टोर उत्पाद कीमत', 'खुदरा उत्पाद सूची कंपनी'], manufacturing: ['निर्माता उत्पाद सूची कीमत', 'औद्योगिक उत्पाद निर्माता आपूर्तिकर्ता'], distribution: ['उपकरण वितरक सूची कंपनी', 'व्यापार उपकरण आपूर्तिकर्ता कीमत'], construction: ['निर्माण इंजीनियरिंग सेवा कंपनी', 'निर्माण सामग्री आपूर्तिकर्ता'], healthcare: ['क्लिनिक स्वास्थ्य सेवा कीमत', 'चिकित्सा सेवा प्रदाता'], education: ['व्यावसायिक शिक्षा पाठ्यक्रम प्रदाता', 'व्यावसायिक प्रशिक्षण कीमत'], finance: ['व्यापार वित्तीय सेवा प्रदाता', 'व्यावसायिक बैंकिंग कीमत'], cybersecurity: ['व्यापार साइबर सुरक्षा समाधान प्रदाता', 'एंटरप्राइज सूचना सुरक्षा उत्पाद'], government: ['डिजिटल सार्वजनिक सेवा मंच', 'सरकारी सेवा डिजिटल मंच'], professional: ['व्यावसायिक व्यापार सेवा कंपनी', 'परामर्श व्यावसायिक सेवा कीमत'] },
    market: 'बाजार मांग रुझान', customers: 'कैसे चुनें ग्राहक समीक्षा शिकायत', prices: 'कीमत मूल्य तुलना', news: 'बाजार OR मांग OR कीमत OR उत्पादन', commercial: /कीमत|मूल्य|उत्पाद|सेवा|समाधान|मंच|सॉफ्टवेयर|सूची|ऑर्डर|डिलीवरी|खरीद|परामर्श/,
    customer: /चुनें|ग्राहक|समीक्षा|शिकायत|गुणवत्ता|सेवा|अनुभव/, price: /कीमत|मूल्य|लागत|बजट/, trend: /बाजार|मांग|वृद्धि|गिरावट|रुझान|पूर्वानुमान|शोध|आँकड़े|उत्पादन/, newsSignal: /बाजार|मांग|उत्पादन|लॉन्च|वृद्धि|कीमत|उद्योग|बिक्री/,
  },
  ar: {
    subjects: { software: 'برمجيات الأعمال والمنصات السحابية', food: 'المطاعم وخدمات توصيل الطعام', logistics: 'الخدمات اللوجستية والتوصيل للأعمال', retail: 'منتجات التجزئة الإلكترونية', manufacturing: 'المنتجات الصناعية', distribution: 'توزيع المعدات', construction: 'خدمات البناء والهندسة', healthcare: 'خدمات الرعاية الصحية', education: 'التعليم المهني', finance: 'الخدمات المالية', cybersecurity: 'حلول الأمن السيبراني', government: 'الخدمات الحكومية الرقمية', professional: 'الخدمات المهنية للأعمال' },
    queries: { software: ['برمجيات أعمال منصة سحابية أسعار مزود', 'برمجيات للشركات منتجات'], food: ['مطعم توصيل طعام قائمة شركة', 'وجبات سريعة مطعم قائمة طلب'], logistics: ['خدمات لوجستية توصيل للشركات أسعار', 'شحن وتوصيل بضائع شركة'], retail: ['متجر إلكتروني منتجات أسعار', 'منتجات تجزئة كتالوج شركة'], manufacturing: ['شركة تصنيع منتجات كتالوج أسعار', 'منتجات صناعية مصنع مورد'], distribution: ['موزع معدات كتالوج شركة', 'مورد معدات للشركات أسعار'], construction: ['شركة خدمات بناء وهندسة', 'مورد مواد بناء مقاول'], healthcare: ['عيادة خدمات طبية أسعار', 'مزود خدمات رعاية صحية'], education: ['دورات تعليم مهني مزود', 'تدريب للشركات أسعار'], finance: ['خدمات مالية للشركات مزود', 'خدمات مصرفية للأعمال أسعار'], cybersecurity: ['حلول أمن سيبراني للشركات مزود', 'منتجات أمن المعلومات للشركات'], government: ['منصة خدمات حكومية رقمية', 'التحول الرقمي للخدمات الحكومية'], professional: ['شركة خدمات مهنية للأعمال', 'خدمات استشارية مهنية أسعار'] },
    market: 'السوق الطلب الاتجاهات', customers: 'كيفية الاختيار آراء العملاء شكاوى', prices: 'الأسعار التعرفة مقارنة', news: 'السوق OR الطلب OR الأسعار OR الإنتاج', commercial: /سعر|أسعار|منتج|خدمات|حلول|منصة|برمجيات|كتالوج|طلب|توصيل|اشتراك|شراء|استشارات/,
    customer: /اختيار|عميل|عملاء|آراء|شكاوى|جودة|خدمة|تجربة/, price: /سعر|أسعار|تكلفة|اشتراك|ميزانية/, trend: /سوق|طلب|نمو|انخفاض|اتجاه|توقعات|بحث|إحصاءات|إنتاج/, newsSignal: /سوق|طلب|إنتاج|إطلاق|نمو|سعر|صناعة|مبيعات/,
  },
};

const INDUSTRY_SIGNALS = {
  en: { software: /software|cloud|developer platform/i, food: /restaurant|food|menu|chicken|burger|pizza|delivery/i, logistics: /logistics|freight|shipping|courier|delivery/i, retail: /retail|online store|shop|products/i, manufacturing: /manufactur|factory|industrial products/i, distribution: /distributor|wholesale|equipment/i, construction: /construction|building|engineering/i, healthcare: /healthcare|medical|clinic|patient/i, education: /education|training|courses/i, finance: /financial|banking|insurance|payments/i, cybersecurity: /cybersecurity|information security/i, government: /government|public services/i, professional: /consulting|professional services|legal|accounting/i },
  es: { software: /software|nube/i, food: /restaurante|comida|menú|entrega/i, logistics: /logística|transporte|entrega/i, retail: /tienda|productos|minorista/i, manufacturing: /fabricante|manufactura|industrial/i, distribution: /distribuidor|equipos/i, construction: /construcción|ingeniería/i, healthcare: /salud|médic|clínica/i, education: /educación|formación|cursos/i, finance: /financier|banca|seguros/i, cybersecurity: /ciberseguridad|seguridad de la información/i, government: /gobierno|servicios públicos/i, professional: /consultoría|servicios profesionales/i },
  zh: { software: /软件|云/, food: /餐|食品|菜单|配送/, logistics: /物流|配送|货运/, retail: /零售|商店|商品/, manufacturing: /制造|工厂|工业/, distribution: /经销|设备|批发/, construction: /建筑|工程/, healthcare: /医疗|诊所|健康/, education: /教育|培训|课程/, finance: /金融|银行|保险/, cybersecurity: /网络安全|信息安全/, government: /政务|政府/, professional: /咨询|专业服务/ },
  hi: { software: /सॉफ्टवेयर|क्लाउड/, food: /रेस्तरां|खाद्य|मेनू|डिलीवरी/, logistics: /लॉजिस्टिक्स|डिलीवरी|ढुलाई/, retail: /खुदरा|स्टोर|उत्पाद/, manufacturing: /निर्माता|उत्पादन|औद्योगिक/, distribution: /वितरक|उपकरण/, construction: /निर्माण|इंजीनियरिंग/, healthcare: /स्वास्थ्य|चिकित्सा|क्लिनिक/, education: /शिक्षा|प्रशिक्षण|पाठ्यक्रम/, finance: /वित्त|बैंक|बीमा/, cybersecurity: /साइबर सुरक्षा|सूचना सुरक्षा/, government: /सरकारी|सार्वजनिक/, professional: /परामर्श|व्यावसायिक सेवा/ },
  ar: { software: /برمجيات|سحابية/, food: /مطعم|طعام|وجبات|توصيل/, logistics: /لوجست|توصيل|شحن/, retail: /تجزئة|متجر|منتجات/, manufacturing: /تصنيع|مصنع|صناعية/, distribution: /موزع|معدات/, construction: /بناء|هندسة/, healthcare: /صحية|طبية|عيادة/, education: /تعليم|تدريب|دورات/, finance: /مالية|مصرفية|تأمين/, cybersecurity: /أمن سيبراني|أمن المعلومات/, government: /حكومية|حكومة/, professional: /استشارات|خدمات مهنية/ },
};

function internationalProfile(research, profile) {
  const language = researchLanguage(research);
  if (language === 'ru') return null;
  const copy = COPY[normalizeLanguage(language)];
  const industry = profile.industry?.id || 'professional';
  return { language, industry, copy, subject: copy.subjects[industry] || copy.subjects.professional };
}

export function createInternationalMarketSearchPlan(research = {}, profile = {}) {
  const context = internationalProfile(research, profile);
  if (!context) return null;
  const { language, industry, copy, subject } = context;
  const regex = value => value instanceof RegExp ? value : new RegExp(value, 'iu');
  const ownText = `${(research.sources || []).filter(source => source.kind === 'company-site').map(source => `${source.title || ''} ${source.text || ''}`).join(' ')} ${(research.offerings || []).map(item => `${item.name || ''} ${item.displayName || ''}`).join(' ')}`;
  const softwareFamily = industry === 'software' && /jira|confluence|team collaboration|project management|work management|управлени[а-яё]* проект/i.test(ownText) ? 'collaboration' : '';
  const productFamily = ['manufacturing', 'retail', 'distribution'].includes(industry) && /home appliances?|smart home|electrical equipment|ceiling fans|consumer electronics|бытов[а-яё]* техник|家电|智能家居|घरेलू उपकरण|أجهزة منزلية/i.test(ownText) ? 'home-appliances' : '';
  const family = {
    en: { subject: 'home appliances and smart home products', queries: ['home appliances smart home manufacturer products', 'major home appliances manufacturer catalogue'], pattern: /home appliances?|smart home|refrigerators?|washing machines?|air conditioners?|ceiling fans|kitchen appliances?|electrical equipment|lighting|switches|cables/i },
    es: { subject: 'electrodomésticos y productos para el hogar inteligente', queries: ['fabricante electrodomésticos hogar inteligente productos', 'fabricante grandes electrodomésticos catálogo'], pattern: /electrodomésticos|hogar inteligente|frigoríficos?|lavadoras?|aire acondicionado|ventiladores|equipos eléctricos|iluminación/i },
    zh: { subject: '家电与智能家居产品', queries: ['home appliances smart home manufacturer products', '家电 智能家居 制造商 产品'], pattern: /家电|智能家居|冰箱|洗衣机|空调|风扇|厨房电器|电气设备|照明|电线电缆|home appliances?|smart home|refrigerators?|washing machines?|air conditioners?|ceiling fans/i },
    hi: { subject: 'घरेलू उपकरण और स्मार्ट होम उत्पाद', queries: ['home appliances smart home manufacturer products India', 'electrical equipment home appliances manufacturer catalogue India'], pattern: /home appliances?|smart home|refrigerators?|washing machines?|air conditioners?|ceiling fans|kitchen appliances?|electrical equipment|lighting|switches|cables|घरेलू उपकरण|स्मार्ट होम|रेफ्रिजरेटर|वॉशिंग मशीन|एयर कंडीशनर|पंखे|बिजली उपकरण/i },
    ar: { subject: 'الأجهزة المنزلية ومنتجات المنزل الذكي', queries: ['home appliances smart home manufacturer products Middle East', 'major home appliances manufacturer catalogue'], pattern: /أجهزة منزلية|منزل ذكي|ثلاجات|غسالات|مكيفات|مراوح|معدات كهربائية|إضاءة|home appliances?|smart home|refrigerators?|washing machines?|air conditioners?|ceiling fans/i },
  }[language];
  const resolvedSubject = productFamily ? family.subject : subject;
  const signals = Object.values(INDUSTRY_SIGNALS).map(signalsByIndustry => signalsByIndustry[industry]?.source).filter(Boolean);
  if (softwareFamily === 'collaboration') signals.push('team collaboration|project management|work management|task management|jira|asana|trello|monday\\.com');
  if (productFamily) signals.push(family.pattern.source);
  const relevance = regex(signals.join('|') || copy.commercial.source);
  const commercialSignals = Object.values(COPY).map(item => item.commercial.source);
  const competitorQueries = softwareFamily === 'collaboration' ? ['team collaboration software for business', 'project management software for teams'] : productFamily ? family.queries : copy.queries[industry] || copy.queries.professional;
  return {
    language, industry, subject: resolvedSubject, genericSubject: !productFamily,
    companyName: research.companyName || research.sources?.[0]?.companyName || '',
    ownAliases: [], ownOfferingNames: [...(research.offerings || []), ...(research.sources || []).filter(source => source.kind === 'company-site').flatMap(source => source.offerings || [])].map(item => item.displayName || item.name).filter(Boolean), serviceMarketplace: false, softwareFamily, productFamily, productFamilyPattern: productFamily ? family.pattern : null,
    competitorQueries,
    evidenceQueries: [
      { kind: 'industry-snippet', query: `${resolvedSubject} ${copy.market} ${new Date().getFullYear()}`, message: `${resolvedSubject} · ${copy.market}` },
      { kind: 'customer-snippet', query: `${resolvedSubject} ${copy.customers}`, message: `${resolvedSubject} · ${copy.customers}` },
      { kind: 'market-price-snippet', query: `${resolvedSubject} ${copy.prices}`, message: `${resolvedSubject} · ${copy.prices}` },
    ],
    relevance, subjectPattern: relevance,
    commercialPattern: regex(commercialSignals.join('|')),
    customerPattern: regex(Object.values(COPY).map(item => item.customer.source).join('|')),
    pricePattern: regex(Object.values(COPY).map(item => item.price.source).join('|')),
    trendPattern: regex(Object.values(COPY).map(item => item.trend.source).join('|')),
    newsSignal: regex(Object.values(COPY).map(item => item.newsSignal.source).join('|')),
    newsQuery: `${resolvedSubject} ${copy.news}`,
  };
}

export function isInternationalCompetitorContent(text, plan) {
  const value = String(text || '');
  const softwareMatch = plan?.softwareFamily !== 'collaboration' || /team collaboration|project management|work management|task management|\bjira\b|\basana\b|\btrello\b|monday\.com/i.test(value);
  const productMatches = plan?.productFamilyPattern ? value.match(new RegExp(plan.productFamilyPattern.source, 'giu')) || [] : [];
  const productMatch = !plan?.productFamilyPattern || productMatches.length >= 2;
  return Boolean(value && plan?.language && plan.language !== 'ru' && softwareMatch && productMatch && plan.relevance?.test(value) && plan.commercialPattern?.test(value));
}

const INTERNATIONAL_NON_COMPETITOR_HOSTS = /(?:^|\.)(?:wikipedia\.org|crunchbase\.com|pr\.com|pinterest\.[a-z.]+|pikbest\.com|dreamstime\.com|depositphotos\.com|vecteezy\.com|europages\.[a-z.]+|fastercapital\.com|daypo\.com|talabat\.com|snoonu\.com|unstore\.io|daleeeel\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|reddit\.com|quora\.com|medium\.com|g2\.com|capterra\.com|getapp\.com|softwareadvice\.com|made-in-china\.com|alibaba\.com|aliexpress\.com|aeroexpo\.[a-z.]+|directindustry\.[a-z.]+|wearesellers\.com|dealmoon\.com)$/i;
export function isInternationalCompetitorPage(item = {}) {
  let url;
  try { url = new URL(item.url); } catch { return false; }
  if (INTERNATIONAL_NON_COMPETITOR_HOSTS.test(url.hostname) || /^(?:news|blog|press|media)\./i.test(url.hostname) || /\.pdf(?:\.html)?$/i.test(url.pathname)) return false;
  if (/\/(?:news|articles?|blog|posts?|contenido|content|guides?|resources?|wiki|directory|locations|marketplace|categories|category|question|questions|suppliers|producers)(?:\/|$)/i.test(url.pathname)) return false;
  const title = String(item.title || '');
  const evidence = `${title} ${String(item.text || '')}`;
  if (/(?:best|top|mejores)\s+\d+|\d+\s+(?:best|top|mejores)\b|customer reviews|what is|how to choose|market report|price list template|manufacturers?,?\s+suppliers?|all products? (?:catalog|catalogue)|\btest\b|\bquiz\b|examen|[?？]|推荐|怎么|如何|新闻|产品大全|资讯|攻略/i.test(evidence)) return false;
  return true;
}

export function isInternationalReviewMaterial(item = {}) {
  if (['article', 'search'].includes(item.pageType) || /(?:^|\/)search(?:\/|$)/i.test(item.url || '') || /(?:^|\.)(?:ambitionbox\.com|reverso\.net|dictionary\.cambridge\.org|collinsdictionary\.com|wordreference\.com|bab\.la|linguee\.com)(?:\/|$)/i.test(String(item.url || '').replace(/^https?:\/\/(?:www\.)?/i, ''))) return false;
  const text = `${item.title || ''} ${item.text || ''} ${item.url || ''}`;
  if (/employee reviews?|employees?\s+(?:rate|review)|working at|workplace|job security|work-life balance|career growth|salary|buz[oó]n(?:es)?\s+de\s+correos|buzon-de-correos|mailbox|letterbox|отзыв[а-яё]* сотрудник|условия труда|зарплат/iu.test(text)) return false;
  const marker = /reviews?|rating|opiniones|reseñas|valoración|评价|评分|समीक्षा|रेटिंग|مراجعات|تقييم|آراء|отзыв|рейтинг|оценк/iu;
  const detail = /\d+\s*(?:reviews?|opiniones|reseñas|条评价|समीक्षाएँ|مراجعة|отзыв)|\d[.,]\d\s*(?:out of\s*5|de\s*5|से\s*5|من\s*5|из\s*5)|\b(?:i|we|my|our)\b|recommend|quality|service|delivery|recomiendo|no recomiendo|calidad|servicio|推荐|好评|差评|की सिफारिश|गुणवत्ता|أنصح|لا أنصح|جودة|рекоменд|качество/iu;
  return marker.test(text) && detail.test(text);
}

function normalizedReviewText(value = '') {
  return String(value || '').toLowerCase().replace(/[«»"“”'’®™]/g, '').replace(/\s+/g, ' ').trim();
}

function reviewCompanyAliases(context, sources) {
  const research = context.research || context;
  const home = sources.find(source => source.kind === 'company-site') || sources[0];
  const rawNames = [context.companyName || research.companyName, home?.companyName, home?.organizationName, home?.siteName, ...(context.ownAliases || research.ownAliases || [])];
  const aliases = new Set();
  for (const rawName of rawNames) {
    const value = String(rawName || '').replace(/^(?:ООО|АО|ПАО|ЗАО|ИП)\s+/i, '');
    for (const part of [value, ...value.split(/\s+(?:-|—|–|\|)\s+/)]) {
      const alias = normalizedReviewText(part);
      if (alias.length >= 3 && alias.length <= 70 && !/^(?:home|official website|company|главная|официальный сайт|компания)$/i.test(alias)) aliases.add(alias);
    }
  }
  try {
    const ownBrand = new URL(context.siteUrl || research.requestedUrl || home?.url).hostname.replace(/^www\./, '').split('.')[0];
    if (ownBrand.length >= 3) aliases.add(normalizedReviewText(ownBrand));
  } catch { /* Company names above remain available for a malformed saved URL. */ }
  return [...aliases];
}

function reviewOfferingAliases(context, sources) {
  const research = context.research || context;
  const offerings = [...(context.offerings || research.offerings || []), ...sources.filter(source => source.kind === 'company-site').flatMap(source => source.offerings || [])];
  return [...new Set(offerings.flatMap(item => [item?.name, item?.displayName]).map(normalizedReviewText).filter(name => name.length >= 4 && name.length <= 100 && !/^(?:продукция|продукты|товары|услуги|сервисы|доставка|products?|services?|software|platform)$/i.test(name)))];
}

function hasPurposefulMention(text, aliases) {
  return aliases.some(alias => {
    const index = text.indexOf(alias);
    if (index < 0) return false;
    const before = text.slice(Math.max(0, index - 56), index);
    return !/(?:shipping|delivery|carrier|compatible\s+(?:with|for))(?:\s+[\w-]+){0,3}\s*$/i.test(before);
  });
}

export function isRelevantInternationalReview(item, context, sources) {
  if (!isInternationalReviewMaterial(item)) return false;
  const title = normalizedReviewText(item.title);
  const body = normalizedReviewText(item.text);
  const text = `${title} ${body}`;
  const companyAliases = reviewCompanyAliases(context, sources);
  const offeringAliases = reviewOfferingAliases(context, sources);
  const companyMatch = hasPurposefulMention(title, companyAliases) || hasPurposefulMention(body, companyAliases);
  const offeringMatch = offeringAliases.some(alias => text.includes(alias));
  if (!companyMatch && !offeringMatch) return false;
  if (/0\s+(?:reviews?|opiniones|reseñas|条评价|समीक्षाएँ|مراجعة)|no reviews yet|sin opiniones|لا توجد مراجعات/iu.test(body)) return false;
  const experience = /\b(?:i|we|my|our)\b|recommend|quality|service|delivery|recomiendo|no recomiendo|calidad|servicio|推荐|好评|差评|की सिफारिश|गुणवत्ता|أنصح|لا أنصح|جودة|рекоменд|качество/iu;
  const rating = /\d+\s*(?:reviews?|opiniones|reseñas|条评价|समीक्षाएँ|مراجعة|отзыв)|\d[.,]\d\s*(?:out of\s*5|de\s*5|से\s*5|من\s*5|из\s*5)/iu;
  return experience.test(text) || rating.test(text);
}

export function isInternationalIndustryEvidence(item, plan, kind) {
  const text = `${item?.title || ''} ${item?.text || ''}`;
  if (!plan?.language || plan.language === 'ru' || text.length < 40 || !plan.relevance?.test(text)) return false;
  if (plan.productFamilyPattern && !plan.productFamilyPattern.test(text)) return false;
  if (kind === 'search-snippet') {
    const aliases = [plan.companyName, ...(plan.ownAliases || [])].map(value => String(value || '').trim().toLowerCase()).filter(value => value.length >= 3);
    return aliases.some(alias => text.toLowerCase().includes(alias));
  }
  if (kind === 'customer-snippet') return plan.customerPattern.test(text);
  if (kind === 'market-price-snippet') return plan.pricePattern.test(text);
  return plan.trendPattern.test(text);
}
