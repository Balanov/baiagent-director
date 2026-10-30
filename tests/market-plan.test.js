import { describe, expect, it } from 'vitest';
import {
  competitorNameFrom,
  createMarketSearchPlan,
  isCompetitorCandidate,
  isCompetitorContent,
  isRelevantCompanyReview,
  isRelevantIndustryEvidence,
  isRelevantMarketNews,
  marketSubject,
} from '../shared/market-plan.js';

const own = (text, offerings = []) => ({ id: 'site-1', kind: 'company-site', url: 'https://company.example/', title: 'Компания', text, offerings });
const softwareResearch = {
  companyName: 'КонсультантПлюс',
  requestedUrl: 'https://company.example/',
  sources: [
    own('Продукты для юристов и бухгалтеров. Компания — разработчик справочной правовой системы и информационных продуктов.'),
  ],
  offerings: [],
};
const softwareProfile = { industry: { id: 'software' } };

describe('software market and competitors', () => {
  it('uses legal information products rather than legal services as the market subject', () => {
    expect(marketSubject(softwareResearch, softwareProfile)).toEqual({
      industry: 'software',
      subject: 'программные и информационные продукты для юристов',
    });
    const plan = createMarketSearchPlan(softwareResearch, softwareProfile);
    expect(plan.competitorQueries[0]).toContain('разработчик');
    expect(plan.competitorQueries[0]).not.toContain('юридические услуги');
  });

  it('generalises specialist software subjects beyond the legal profession', () => {
    const research = { sources: [own('Разработчик программного обеспечения. Цифровые продукты для бухгалтеров и финансовых специалистов.')] };
    expect(marketSubject(research, softwareProfile).subject).toBe('программные и информационные продукты для бухгалтеров');
  });

  it('rejects law firms and legal-service marketplaces but accepts a software vendor without a published price', () => {
    const plan = createMarketSearchPlan(softwareResearch, softwareProfile);
    const lawFirm = {
      title: 'Юридические услуги и консультации юристов',
      url: 'https://law.example/',
      text: 'Юридические услуги для граждан и компаний. Адвокаты ведут споры, стоимость юридического сопровождения указана в прайсе.',
    };
    const serviceMarketplace = {
      title: 'Сервис Мой Юрист Онлайн — платформа для решения правовых задач',
      url: 'https://legal-market.example/',
      text: 'Юридические услуги оказывают независимые Исполнители — юристы, адвокаты и юридические компании, зарегистрированные на платформе. Цена услуги 80 000 рублей.',
    };
    const vendor = {
      title: 'Справочная правовая система для юристов',
      url: 'https://legal-software.example/',
      text: 'Разработчик информационной системы и программных продуктов для юристов. Пробный доступ и внедрение без публикации фиксированной цены.',
    };
    expect(isCompetitorCandidate(lawFirm, plan, softwareResearch.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate(serviceMarketplace, plan, softwareResearch.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate(vendor, plan, softwareResearch.requestedUrl)).toBe(true);
  });

  it('distinguishes ecommerce, engineering and specialist software competitors', () => {
    const ecommercePlan = createMarketSearchPlan({ sources: [own('Ecommerce software and a cloud commerce platform for online stores.')] }, softwareProfile);
    const engineeringPlan = createMarketSearchPlan({ sources: [own('Industrial software: CAD, CAM and PLM for engineering teams and the digital twin.')] }, softwareProfile);
    const unrelated = { title: 'СУБД для медицинских комплексов', url: 'https://database.example/', text: 'Разработчик программного обеспечения и цифровой платформы для медицины. Стоимость лицензии и внедрение.' };
    expect(ecommercePlan.softwareFamily).toBe('ecommerce');
    expect(engineeringPlan.softwareFamily).toBe('engineering');
    expect(isCompetitorCandidate(unrelated, ecommercePlan, 'https://company.example/')).toBe(false);
    expect(isCompetitorCandidate(unrelated, engineeringPlan, 'https://company.example/')).toBe(false);
    expect(isCompetitorCandidate(unrelated, createMarketSearchPlan(softwareResearch, softwareProfile), softwareResearch.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate({ title: 'Commerce cloud', url: 'https://commerce.example/', text: 'Ecommerce software, online store and checkout for enterprise commerce. Contact sales.' }, ecommercePlan, 'https://company.example/')).toBe(true);
    expect(isCompetitorCandidate({ title: 'Engineering suite', url: 'https://engineering.example/', text: 'CAD and PLM software for engineering and manufacturing. Book a demo.' }, engineeringPlan, 'https://company.example/')).toBe(true);
  });

  it('does not require manufacturing or price language for a SaaS competitor', () => {
    const research = { sources: [own("Team collaboration software and a cloud platform for digital work.")] };
    const plan = createMarketSearchPlan(research, softwareProfile);
    const text = 'SaaS software and a cloud platform for team collaboration. Try the product and contact sales.';
    expect(plan.subject).toBe('программные продукты');
    expect(isCompetitorContent(text, plan)).toBe(true);
    expect(isCompetitorCandidate({ title: 'Teamwork SaaS platform', text, url: 'https://saas.example/' }, plan, 'https://company.example/')).toBe(true);
  });
});

describe('logistics competitor relevance', () => {
  const plan = { industry: 'logistics', subject: 'доставка для бизнеса', companyName: 'CDEK', ownAliases: ['СДЭК'], relevance: /доставк|логистик|грузоперевоз/i };
  const furniture = {
    title: 'Оплата и доставка | Интернет-магазин FURNIMAX',
    url: 'https://furniture.example/delivery/',
    text: 'Доставка заказов от 2000 ₽. Отправка через транспортные компании и другие ТК. Условия доставки мебели и получения заказа в интернет-магазине.',
  };
  const calculator = {
    title: 'Рассчитать стоимость доставки для интернет-магазинов',
    url: 'https://calculator.example/delivery/',
    text: 'Посчитать доставку транспортной компанией для интернет-магазинов. Курьерская служба доставки «Контакт». Работаем по всей России.',
  };

  it('rejects merchant delivery pages and unidentified calculators, allowing an honest empty result', () => {
    expect([furniture, calculator].filter(item => isCompetitorCandidate(item, plan, 'https://cdek.example/'))).toEqual([]);
  });

  it('keeps direct providers and a calculator with a brand stated in its title', () => {
    const direct = { title: 'Услуги транспортной компании', url: 'https://logistics.example/services', text: 'Полный список услуг транспортной компании. Сроки и стоимость доставки грузов.' };
    const brandedCalculator = { title: 'Рассчитать стоимость доставки груза: онлайн калькулятор | DPD', url: 'https://carrier.example/calc', text: 'Рассчитайте стоимость доставки DPD онлайн. Укажите пункты отправления и назначения.' };
    expect(isCompetitorCandidate(direct, plan, 'https://cdek.example/')).toBe(true);
    expect(isCompetitorCandidate(brandedCalculator, plan, 'https://cdek.example/')).toBe(true);
  });
});

describe('company and offering review relevance', () => {
  const kamaz = {
    companyName: 'КАМАЗ', requestedUrl: 'https://kamaz.example/',
    sources: [own('Производство грузовых автомобилей.', [{ name: 'КАМАЗ 54901' }])],
    offerings: [{ name: 'КАМАЗ 54901' }],
  };
  const cdek = { companyName: 'CDEK', requestedUrl: 'https://cdek.example/', sources: [own('')], offerings: [] };
  const firestarters = {
    companyName: 'ООО «Имидж-Боровичи»', requestedUrl: 'https://firestarters.example/',
    sources: [own('Производство товаров для розжига.', [{ name: 'Древесные брикеты' }])],
    offerings: [{ name: 'Древесные брикеты' }],
  };

  it('rejects a same-name business from a different industry when market context is known', () => {
    const restaurant = { companyName: 'Дуб', requestedUrl: 'https://restaurant.example/', sources: [own('Сеть ресторанов. Меню, блины и завтраки.')], offerings: [{ name: 'Блин с ягодами' }], marketContext: { subject: 'ресторанный сервис' } };
    const bath = { title: 'Баня Дуб — отзывы', url: 'https://spa.example/bath-dub/', text: 'Я посетил баню Дуб. Русская парная, бассейн и спа. 40 отзывов, рекомендую.' };
    const cafe = { title: 'Ресторан Дуб — отзывы', url: 'https://reviews.example/restaurant-dub/', text: 'Я заказывал в ресторане Дуб блины и завтрак. 40 отзывов, рекомендую.' };
    expect(isRelevantCompanyReview(bath, restaurant)).toBe(false);
    expect(isRelevantCompanyReview(cafe, restaurant)).toBe(true);
  });

  it('rejects a third-party part reviewed as compatible with the company product', () => {
    const item = {
      title: 'Диск сцепления PRAMO для КАМАЗ — отзывы',
      url: 'https://reviews.example/product/pramo-clutch',
      text: '9 отзывов про товар PRAMO. Диск сцепления на автомобиль КАМАЗ. Установил без проблем, качество отличное. Товар — PRAMO 14-1601130.',
    };
    expect(isRelevantCompanyReview(item, kamaz)).toBe(false);
  });

  it('rejects a marketplace product where the company is only a delivery option', () => {
    const item = {
      title: 'Сапборд надувной Ocean SUP-board — реальные отзывы',
      url: 'https://market.example/product/sup-board-4345132989/',
      text: 'Реальные отзывы покупателей. Комплектация: доставка CDEK. Прекрасный сап. Съездили в поездку по озёрам.',
    };
    expect(isRelevantCompanyReview(item, cdek)).toBe(false);
  });

  it('rejects an unrelated product catalog even if it mentions the company', () => {
    const item = {
      title: 'Продукция России — 87000 товаров в каталоге',
      url: 'https://catalog.example/products/page-1349',
      text: 'Каталог товаров и производителей. КонсультантПлюс в общем списке поставщиков. 5 отзывов о разных товарах.',
    };
    expect(isRelevantCompanyReview(item, softwareResearch)).toBe(false);
  });

  it('rejects a marketplace product card without explicit review text', () => {
    const item = {
      title: 'Брикет для розжига Имидж-Боровичи 32 шт — купить',
      url: 'https://market.example/product/image-briquettes',
      text: '149,99 ₽. 4,6 оценки, 5 отзывов. Рекомендуем. Купить с доставкой. Подробнее о товаре и характеристиках.',
    };
    expect(isRelevantCompanyReview(item, firestarters)).toBe(false);
  });

  it('keeps explicit reviews of the company own product, including marketplace reviews', () => {
    const marketplace = {
      title: 'Брикет для розжига Имидж-Боровичи 32 шт — отзывы',
      url: 'https://market.example/product/image-briquettes',
      text: '5 отзывов. Наталья: отлично разжигаются, всем рекомендую. Юлия: очень мне понравился этот брикет.',
    };
    const cleanReview = {
      title: 'Отзыв о сухом горючем Имидж-Боровичи',
      url: 'https://reviews.example/review_17705363.html',
      text: 'Достоинства: работает. Я использую таблетки для розжига и рекомендую этот товар.',
    };
    expect(isRelevantCompanyReview(marketplace, firestarters)).toBe(true);
    expect(isRelevantCompanyReview(cleanReview, firestarters)).toBe(true);
  });

  it('keeps a substantive review of a named own software offering', () => {
    const research = { companyName: 'Atlassian', requestedUrl: 'https://atlassian.example/', sources: [own('Team collaboration software.')], offerings: [{ name: 'Confluence' }] };
    const item = { title: 'Confluence — обзор сервиса', pageType: 'article', url: 'https://software-reviews.example/application/confluence', text: 'Отзывы о Confluence. Мы используем этот сервис и рекомендуем его. 1 отзыв.' };
    expect(isRelevantCompanyReview(item, research)).toBe(true);
  });
  it('does not turn a menu without customer experience into a review', () => {
    const research = { companyName: 'Теремок', requestedUrl: 'https://teremok.example/', sources: [own('Сеть ресторанов русской кухни. Меню и блины.')], offerings: [{ name: 'Завтрак Богатырский' }] };
    const menu = { title: 'Актуальное меню ресторана Теремок. Отзывы о блюдах и их цены.', url: 'https://reviews.example/teremok/menu/', text: 'Меню от владельца. Блины сладкие. Доставка блюд. Завтрак Богатырский.' };
    const experience = { title: 'Теремок — меню и отзывы', url: 'https://reviews.example/teremok/menu/', text: 'Меню и 120 отзывов. Я заказывал блины, всё понравилось.' };
    expect(isRelevantCompanyReview(menu, research)).toBe(false);
    expect(isRelevantCompanyReview(experience, research)).toBe(true);
  });
});

describe('competitor display names', () => {
  it('prefers structured metadata and extracts a leading brand from a long title', () => {
    expect(competitorNameFrom({ siteName: 'Acme', title: 'Очень длинный заголовок о продукции и ценах', url: 'https://acme.example/' })).toBe('Acme');
    expect(competitorNameFrom({ title: 'RAUTAGRILL Древесный уголь и средства для розжига', url: 'https://rautagrill.example/' })).toBe('RAUTAGRILL');
  });

  it('decodes punycode only at the domain fallback and keeps a known title brand', () => {
    const decoded = competitorNameFrom({ title: 'Производитель оптом', url: 'https://xn--d1atcelt5b.xn--p1ai/' });
    expect(decoded).toBe('ПРОТДЫХ');
    expect(decoded).not.toContain('xn--');
    expect(competitorNameFrom({ siteName: 'Сварожич', title: 'Производитель оптом', url: 'https://xn--d1atcelt5b.xn--p1ai/' })).toBe('Сварожич');
  });

  it('uses a raw slug only when metadata and title contain no usable brand', () => {
    expect(competitorNameFrom({ title: 'Жидкость для розжига купить оптом по цене от производителя', url: 'https://www.svarozhich-tm.ru/catalog/' })).toBe('svarozhich-tm');
    expect(competitorNameFrom({ title: 'Логистика для бизнеса - аутсорсинг', url: 'https://www.dellin.ru/' })).toBe('DELLIN');
  });
});

describe('round2 saved-research regressions', () => {
  it('uses the restaurant menu rather than interior furniture as the main market', () => {
    const research = {
      companyName: 'Ресторанная сеть', requestedUrl: 'https://company.example/', offerings: [],
      sources: [
        own('Сеть ресторанов русской кухни. Наше меню: блины, супы, вторые блюда и десерты.'),
        { ...own('Современные интерьеры и мебель из натурального дерева в наших ресторанах.'), id: 'site-2' },
      ],
    };
    const plan = createMarketSearchPlan(research, { industry: { id: 'food' } });
    const furniture = { title: 'Мебельная фабрика', url: 'https://furniture.example/', text: 'Производим мебель для дома, кафе и ресторанов. Столы и стулья по доступным ценам.' };
    const restaurant = { title: 'Ресторан русской кухни', url: 'https://restaurant.example/', text: 'Сеть ресторанов. В меню блины, завтраки, супы и десерты. Заказать столик.' };
    expect(plan.subject).toBe('ресторанный сервис');
    expect(isCompetitorCandidate(furniture, plan, research.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate(restaurant, plan, research.requestedUrl)).toBe(true);
  });

  it('does not narrow a diverse software portfolio from one specialist offering', () => {
    const research = {
      sources: [
        own('Global industrial software and digital products for engineering, infrastructure and mobility.'),
        { ...own('Building management software for architects.'), id: 'site-2' },
      ],
      offerings: [{ name: 'Building tools for architects' }, { name: 'Industrial AI' }, { name: 'Design software' }, { name: 'Grid platform' }],
    };
    expect(marketSubject(research, softwareProfile).subject).toBe('программные продукты');
  });

  it('keeps a specialist marketplace broad and requires the same competitor model', () => {
    const research = {
      companyName: 'Сервис специалистов', requestedUrl: 'https://company.example/',
      sources: [own('Сервис поиска специалистов. Заказчики описывают задачи, а исполнители присылают предложения. В каталоге есть юристы, курьеры и репетиторы.')],
    };
    const plan = createMarketSearchPlan(research, { industry: { id: 'professional' } });
    const courier = { title: 'Курьерская служба', url: 'https://courier.example/', text: 'Курьерские услуги и доставка посылок. Тарифы и стоимость.' };
    const marketplace = { title: 'Платформа специалистов', url: 'https://marketplace.example/', text: 'Платформа поиска специалистов. Заказчики и исполнители обсуждают услуги и цены.' };
    expect(plan.subject).toBe('профессиональные услуги');
    expect(plan.competitorQueries[0]).toContain('поиска специалистов');
    expect(isCompetitorCandidate(courier, plan, research.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate(marketplace, plan, research.requestedUrl)).toBe(true);
    const agencyCase = { title: 'FindPRO — сервис поиска специалистов', url: 'https://agency.example/projects/findpro/', text: marketplace.text };
    expect(isCompetitorCandidate(agencyCase, plan, research.requestedUrl)).toBe(false);
    const offTopicNews = { title: 'Аудиторские организации на финансовом рынке', text: 'Аудиторские организации, оказывающие аудиторские услуги: спрос и требования к организациям.', publishedAt: new Date().toISOString() };
    const relevantNews = { title: 'Рынок сервисов поиска специалистов растёт', text: 'Платформа поиска специалистов: заказчики и исполнители, динамика спроса на услуги.', publishedAt: new Date().toISOString() };
    expect(isRelevantMarketNews(offTopicNews, plan)).toBe(false);
    expect(isRelevantMarketNews(relevantNews, plan)).toBe(true);
    expect(isRelevantIndustryEvidence(offTopicNews, plan, 'industry-snippet')).toBe(false);
  });

  it('rejects editorial and encyclopedia pages even when they mention relevant software', () => {
    const plan = createMarketSearchPlan(softwareResearch, softwareProfile);
    const text = 'Программные продукты и информационная система для юристов. Пробный доступ и внедрение.';
    expect(isCompetitorCandidate({ title: 'Программы для юристов: обзор лучших решений', url: 'https://editorial.example/article/software', text }, plan, softwareResearch.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate({ title: 'Информационные ресурсы — энциклопедия', url: 'https://encyclopedia.example/wiki/resources', text }, plan, softwareResearch.requestedUrl)).toBe(false);
  });

  it('rejects a conference announcement as a competitor even on a relevant library site', () => {
    const plan = createMarketSearchPlan(softwareResearch, softwareProfile);
    const event = {
      title: 'Двадцать первая Международная Конференция "Крым 2014".',
      url: 'https://library.example/events/conference-2014/',
      text: 'Конференция библиотек и информационных ресурсов. Программные продукты и информационные системы для юристов, регистрация участников.',
    };
    expect(isCompetitorCandidate(event, plan, softwareResearch.requestedUrl)).toBe(false);
  });

  it('requires collaboration overlap instead of accepting any software as a competitor', () => {
    const research = { companyName: 'Atlassian', requestedUrl: 'https://company.example/', sources: [own('Team collaboration software for shared work.')] };
    const plan = createMarketSearchPlan(research, softwareProfile);
    const mobileWorkplace = { title: 'Защищённое мобильное рабочее место', url: 'https://mobile.example/', text: 'Программное обеспечение и цифровая платформа для работы с документами на мобильном устройстве.' };
    const workspace = { title: 'Тарифы VK WorkSpace для бизнеса', url: 'https://workspace.example/tariffs/', text: 'SaaS и облачная платформа: корпоративный мессенджер, доски и видеозвонки для команд.' };
    expect(isCompetitorCandidate(mobileWorkplace, plan, research.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate(workspace, plan, research.requestedUrl)).toBe(true);
    expect(competitorNameFrom(workspace)).toBe('VK WorkSpace');
  });

  it('rejects restaurant suppliers and training providers instead of calling them restaurants', () => {
    const research = { requestedUrl: 'https://teremok.example/', sources: [own('Сеть ресторанов русской кухни. Меню: блины, завтраки, супы и десерты.')] };
    const plan = createMarketSearchPlan(research, { industry: { id: 'food' } });
    const suppliers = [
      { title: 'Ресторанный сервис', url: 'https://suppliers.example/restorannyy-servis/', text: 'Поставщики оборудования для ресторанов. Добавить компанию и выбрать подрядчика.' },
      { title: 'Профильные курсы обучения официантов', url: 'https://school.example/', text: 'Обучение официантов и другого персонала в кафе и ресторане. Система структурированного каталога меню и стандартов.' },
      { title: 'ООО «Ресторанный сервис»', url: 'https://checko.ru/company/restoranny-servis-1093336000768', text: 'Деятельность ресторанов и услуги по доставке продуктов питания.' },
    ];
    expect(suppliers.filter(item => isCompetitorCandidate(item, plan, research.requestedUrl))).toEqual([]);
    expect(isCompetitorCandidate({ title: 'Ресторан русской кухни', url: 'https://restaurant.example/', text: 'Сеть ресторанов. В меню блины, завтраки, супы и десерты. Заказать столик.' }, plan, research.requestedUrl)).toBe(true);
    expect(plan.competitorQueries.join(' ')).toContain('ресторан');
  });

  it('rejects portfolios, resource articles and mailing-list archives as software competitors', () => {
    const research = { companyName: 'Atlassian', requestedUrl: 'https://atlassian.example/', sources: [own('Team collaboration software and project management.')] };
    const plan = createMarketSearchPlan(research, softwareProfile);
    const irrelevant = [
      { title: 'TLM IT - Team Collaboration Platform', url: 'https://www.behance.net/gallery/216160115/TLM-IT-Team-Collaboration-Platform', text: 'Team collaboration platform UI/UX design. SaaS platform design inspiration.' },
      { title: 'What Is a Team Collaboration Tool?', url: 'https://www.dropbox.com/resources/team-collaboration-tool', text: 'Team collaboration software for shared work. Cloud platform and software for people.' },
      { title: 'Nmap Development: Project management software', url: 'https://seclists.org/nmap-dev/2009/q4/346', text: 'Project management software and a software platform. Mailing list archive.' },
    ];
    expect(irrelevant.filter(item => isCompetitorCandidate(item, plan, research.requestedUrl))).toEqual([]);
    expect(competitorNameFrom({ title: 'Collaboration Software - Online project management tool for teams', url: 'https://teambox.com/' })).toBe('TEAMBOX');
  });

  it('rejects wholesale-only sellers for a retail market but keeps a retailer', () => {
    const research = { requestedUrl: 'https://company.example/', sources: [own('Интернет-магазин электроники и бытовой техники. Каталог товаров и розничные продажи.')] };
    const plan = createMarketSearchPlan(research, { industry: { id: 'retail' } });
    const wholesale = { title: 'Электроника оптом', url: 'https://wholesale.example/', text: 'Оптовый магазин электроники. Продаем только оптом, минимальная сумма заказа 15 000 рублей.' };
    const retailer = { title: 'Интернет-магазин электроники', url: 'https://retailer.example/', text: 'Купить электронику в розницу. Каталог товаров, корзина и цены для покупателей.' };
    expect(isCompetitorCandidate(wholesale, plan, research.requestedUrl)).toBe(false);
    expect(isCompetitorCandidate(retailer, plan, research.requestedUrl)).toBe(true);
  });

  it('rejects how-to articles, search pages and distributor sites as company reviews', () => {
    const cdek = { companyName: 'CDEK', requestedUrl: 'https://cdek.example/', sources: [own('')], offerings: [] };
    const howTo = { title: 'Как покупать товары за границей: четыре способа', url: 'https://editorial.example/list/shopping/', text: 'CDEK Shopping: рейтинг и отзывы. Мы заказывали товар и рекомендуем несколько способов доставки.' };
    const search = { title: 'CDEK — отзывы и рейтинг', url: 'https://market.example/search?text=CDEK', text: '5 отзывов. Мы заказывали доставку CDEK и остались довольны.' };
    const siemens = { companyName: 'Siemens', requestedUrl: 'https://siemens.example/', sources: [own('Industrial software and digital products.')], offerings: [{ name: 'Building X' }] };
    const distributor = { title: 'Официальный дистрибьютор Siemens', url: 'https://distributor.example/', text: 'Дистрибьютор Siemens. Отзывы и рейтинг оборудования, 5 отзывов.' };
    expect(isRelevantCompanyReview(howTo, cdek)).toBe(false);
    expect(isRelevantCompanyReview(search, cdek)).toBe(false);
    expect(isRelevantCompanyReview(distributor, siemens)).toBe(false);
  });

  it('rejects unrelated products and stores while retaining a substantive SaaS review article', () => {
    const siemens = { companyName: 'Siemens', requestedUrl: 'https://siemens.example/', sources: [own('Industrial software and digital products.')], offerings: [{ name: 'Building X' }] };
    const appliance = { title: 'Стиральная машина Siemens — отзывы', url: 'https://reviews.example/catalog/washing-machine', text: 'Отзывы покупателей и пользователей. Я купил стиральную машину Siemens и рекомендую её. 5 отзывов.' };
    const store = { title: 'Siemens — отзывы', url: 'https://reviews.example/shop/siemens-centre.example', text: '91 отзыв про интернет-магазин Siemens. Я заказывал бытовую технику и доволен доставкой.' };
    const shopify = { companyName: 'Shopify', requestedUrl: 'https://shopify.example/', sources: [own('Ecommerce software and a cloud platform.')], offerings: [] };
    const saasReview = { title: 'Shopify — обзор и отзывы', pageType: 'article', url: 'https://software-reviews.example/shopify', text: 'Наша оценка: 4,0 из 5. Мы используем Shopify и рекомендуем сервис. Плюсы и минусы, 4 отзыва пользователей.' };
    expect(isRelevantCompanyReview(appliance, siemens)).toBe(false);
    expect(isRelevantCompanyReview(store, siemens)).toBe(false);
    expect(isRelevantCompanyReview(saasReview, shopify)).toBe(true);
  });

  it('uses bounded domain fallback instead of raw page titles or domain-like site names', () => {
    expect(competitorNameFrom({ title: 'Юристу, Бухгалтеру, HR-специалисту и специалисту по гос....', url: 'https://cntd.example/products/' })).toBe('CNTD');
    expect(competitorNameFrom({ siteName: 'GOMARKT.RU', title: 'Электроника оптом', url: 'https://gomarkt.example/' })).toBe('GOMARKT');
    expect(competitorNameFrom({ title: 'Document', url: 'https://brand.example/services/' })).not.toBe('Document');
  });
});
