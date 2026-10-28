import { describe, expect, it } from 'vitest';
import { VENDOR_CASES, VENDOR_SERVICES, enterpriseRecommendations } from '../shared/enterprise.js';

const SOURCE = 'Прайс и кейсы Balanov.PRO';
const serviceById = id => VENDOR_SERVICES.find(service => service.id === id);
const caseById = id => VENDOR_CASES.find(item => item.id === id);

function recommend(title, action = '', extra = {}) {
  return enterpriseRecommendations({ opportunity: { title, action }, ...extra });
}

describe('vendor price and case catalogue', () => {
  it('contains every real price position without inventing a billing unit', () => {
    expect(VENDOR_SERVICES).toHaveLength(24);
    expect(new Set(VENDOR_SERVICES.map(service => service.id)).size).toBe(24);
    expect(serviceById('frontend-react')).toMatchObject({
      name: 'Frontend-разработчик (React/Vue)',
      currency: 'RUB',
      unit: null,
      prices: { junior: 110000, middle: 200000, senior: 320000, seniorWithAiAgent24x7: 0, integrationOneTime: 990000 },
    });
    expect(serviceById('backend-go').prices).toEqual({ junior: null, middle: 250000, senior: 400000, seniorWithAiAgent24x7: 0, integrationOneTime: 1490000 });
    expect(serviceById('data-scientist').prices.middle).toBe(180000);
    expect(serviceById('mlops').prices.senior).toBe(420000);
    expect(serviceById('nlp').prices.senior).toBe(400000);

    for (const service of VENDOR_SERVICES) {
      expect(service.unit).toBeNull();
      expect(service).not.toHaveProperty('monthly');
      expect(service).not.toHaveProperty('setup');
      expect(service).not.toHaveProperty('launchDays');
      expect(service.evidence).toEqual({ source: SOURCE, kind: 'vendor-price' });
      for (const value of Object.values(service.prices)) {
        expect(value === null || (Number.isFinite(value) && value >= 0)).toBe(true);
      }
    }
  });

  it('keeps unavailable price cells empty instead of substituting zero or another grade', () => {
    expect(serviceById('fullstack-node').prices).toMatchObject({ junior: null, middle: null, senior: 400000 });
    expect(serviceById('genai').prices).toMatchObject({ junior: null, middle: null, senior: 430000, integrationOneTime: null });
    expect(serviceById('ai-architect').prices).toMatchObject({ junior: null, middle: null, senior: 490000 });
    expect(serviceById('mlops').prices).toMatchObject({ seniorWithAiAgent24x7: null, integrationOneTime: null });
    expect(serviceById('roadmap').prices).toMatchObject({ junior: null, middle: 1200000, senior: 1590000 });
  });

  it('preserves the exact free audit and NDA condition from the price sheet', () => {
    const audit = serviceById('audit');
    expect(audit.offer).toBe('БЕСПЛАТНО + согласие на NDA');
    expect(audit.prices.middle).toBeNull();
    expect(audit.unit).toBeNull();

    const result = enterpriseRecommendations();
    expect(result.nextStep).toMatchObject({
      service: 'Аудит процессов и инфраструктуры',
      offer: 'БЕСПЛАТНО + согласие на NDA',
      price: 0,
      unit: null,
      condition: 'согласие на NDA',
      email: 'office@balanov.pro',
    });
    expect(result.contact.email).toBe('office@balanov.pro');
  });

  it('contains all 35 cases, including five unsuccessful or stopped projects', () => {
    expect(VENDOR_CASES).toHaveLength(35);
    expect(new Set(VENDOR_CASES.map(item => item.id)).size).toBe(35);
    expect(VENDOR_CASES.filter(item => item.isUnsuccessful)).toHaveLength(5);
    expect(VENDOR_CASES.filter(item => item.isUnsuccessful).map(item => item.id).sort()).toEqual([
      'optimization-insurance-stopped',
      'optimization-logistics-paused',
      'product-fitness-failed',
      'security-dlp-rejected',
      'transform-erp-stopped',
    ]);

    for (const item of VENDOR_CASES) {
      expect(item.outcome).toBeTruthy();
      expect(item.result).toBeTruthy();
      expect(item.evidence).toEqual({ source: SOURCE, kind: 'vendor-case' });
      expect(item).not.toHaveProperty('sourceId');
      if (item.isUnsuccessful) expect(item.risk).toBe(item.comment);
      else expect(item.risk).toBeNull();
    }
    expect(JSON.stringify(VENDOR_CASES)).not.toContain('sourceId');
  });
});

describe('enterprise relevance matching', () => {
  it('matches banking fraud to fraud cases and MLOps using task signals', () => {
    const result = recommend(
      'ML-скоринг транзакций для снижения фрод-потерь в банке',
      'Нужны Kafka Streams, MLflow и мониторинг модели без роста ложных блокировок.',
    );
    const caseIds = result.cases.map(item => item.id);
    expect(caseIds).toContain('security-bank-fraud');
    expect(caseIds).toContain('ai-payment-fraud');
    expect(result.services.map(service => service.id)).toContain('mlops');
    expect(result.services.find(service => service.id === 'mlops').prices.senior).toBe(420000);
    expect(result.architecture.security).toContain('RBAC');
    expect(result.architecture.security).toContain('PII');
  });

  it('uses the actual offering and industry when an opportunity is not supplied', () => {
    const result = enterpriseRecommendations({
      research: { offerings: [{ name: 'Персонализация карточек интернет-магазина с CatBoost' }] },
      profile: { industry: { label: 'Розничный e-commerce' }, topOfferings: ['Рекомендательная система'] },
    });
    expect(result.cases.map(item => item.id)).toContain('ai-ecommerce-personalization');
    expect(result.services.map(service => service.id)).toContain('data-scientist');
    expect(result.cases[0].relevance.type).toBe('hypothesis');
  });

  it('matches a passed solution by its real technical meaning', () => {
    const result = enterpriseRecommendations({
      solution: { name: 'Интеллектуальный поиск и RAG', outcome: 'Ответы по документам с источниками на основе языковой модели.' },
    });
    expect(result.services.map(service => service.id)).toContain('nlp');
    expect(result.services.find(service => service.id === 'nlp').prices).toMatchObject({ middle: 250000, senior: 400000 });
    expect(result.cases.length).toBeLessThanOrEqual(1);
  });

  it('selects the real government design-system cases and appropriate roles', () => {
    const result = recommend(
      'Единая дизайн-система для регионального государственного портала',
      'Нужны Vue, UI-kit, документация и регламенты для восьми команд.',
    );
    const caseIds = result.cases.map(item => item.id);
    expect(caseIds).toContain('optimization-gov-design');
    expect(caseIds).toContain('transform-gov-design');
    const serviceIds = result.services.map(service => service.id);
    expect(serviceIds).toContain('ux-ui');
    expect(serviceIds).toContain('frontend-react');
    expect(result.architecture.data).toContain('PII');
    expect(result.architecture.security).toContain('RBAC');
    expect(result.architecture.operations).toContain('журналирование');
    expect(result.architecture.operations).toContain('границы автономности');
  });

  it('distinguishes mobile FoodTech delivery from generic development', () => {
    const result = recommend(
      'MVP мобильного приложения FoodTech для доставки наборов с рецептами',
      'Flutter и Python/FastAPI, запуск ограниченного пилота.',
    );
    expect(result.cases.map(item => item.id)).toContain('product-foodtech-mvp');
    const serviceIds = result.services.map(service => service.id);
    expect(serviceIds).toContain('frontend-cross');
    expect(serviceIds).toContain('backend-python');
    expect(serviceById('backend-python').prices.senior).toBe(300000);
  });

  it('does not recommend the whole catalogue for the generic word “услуги”', () => {
    const result = recommend('Нужны услуги', 'Хотим обсудить возможные услуги компании.');
    expect(result.cases).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.roadmapPriceRange).toBeNull();
    expect(result.summary).toContain('недостаточно');
    expect(result.nextStep.offer).toContain('БЕСПЛАТНО');
  });

  it('returns fewer or no items for unrelated and ambiguous input', () => {
    const unrelated = recommend('Нужен новый логотип для керамической плитки');
    expect(unrelated.cases).toEqual([]);
    expect(unrelated.services).toEqual([]);

    const onlyRag = enterpriseRecommendations({ solution: { name: 'RAG', outcome: 'Поиск по внутренней базе знаний.' } });
    expect(onlyRag.services).toHaveLength(1);
    expect(onlyRag.services[0].id).toBe('nlp');
    expect(onlyRag.cases).toEqual([]);
  });

  it('does not treat market diagnostics as the selected process', () => {
    const result = enterpriseRecommendations({
      profile: { industry: { label: 'Медицинские услуги' }, topOfferings: ['Лабораторные анализы'] },
      opportunity: {
        processName: 'Запись пациента и напоминания о приёме',
        processAction: 'Уточнить параметры и подготовить запись для администратора.',
        readiness: { known: ['Независимый контекст: конкуренты, отзывы, критерии выбора клиентов.'] },
        priority: { reason: 'Есть доказательства исходной возможности и открытые отзывы.' },
        acceptance: { controls: { trace: ['Хранить модель, prompt и источники.'] } },
      },
      solution: { name: 'ИИ-помощник для клиник', outcome: 'Записывает пациентов и напоминает о приёме.' },
    });
    expect(result.cases.map(item => item.id)).not.toContain('ai-review-nlp');
    expect(result.cases).toEqual([]);
    expect(result.services.map(service => service.id)).not.toContain('backend-python');
  });

  it('requires a task match for a case when a concrete process is selected', () => {
    const result = enterpriseRecommendations({
      profile: { industry: { label: 'Банк' }, topOfferings: ['Персонализация банковских предложений'] },
      opportunity: { processName: 'Онбординг новых сотрудников', processAction: 'Выдать согласованный список документов и задач.' },
    });
    expect(result.cases).toEqual([]);
  });

  it('does not attach the failed route-planning pilot to every logistics process', () => {
    const result = recommend(
      'Квалификация заявки на перевозку',
      'Собрать адреса, вес, габариты и подготовить обращение для оператора доставки.',
      { profile: { industry: { label: 'Логистика' } } },
    );
    expect(result.risks.map(item => item.id)).not.toContain('optimization-logistics-paused');
    expect(result.services.map(service => service.id)).not.toContain('mlops');
  });

  it('honours limit independently for cases and services', () => {
    const limited = recommend('Персонализация банка и анализ отзывов с NLP', 'A/B-тесты, Python, BERT и мониторинг модели.', { limit: 1 });
    expect(limited.cases).toHaveLength(1);
    expect(limited.services).toHaveLength(1);

    const zero = recommend('Анализ отзывов с NLP', '', { limit: 0 });
    expect(zero.cases).toEqual([]);
    expect(zero.services).toEqual([]);
  });
});

describe('failed cases, evidence and commercial boundaries', () => {
  it('surfaces insurance non-adoption as a change-management risk', () => {
    const result = recommend(
      'Автоматизация ручного андеррайтинга в страховой компании',
      'ML-классификация рисков и сокращение времени обработки заявок.',
    );
    const failed = result.risks.find(item => item.id === 'optimization-insurance-stopped');
    expect(failed).toBeDefined();
    expect(failed.isUnsuccessful).toBe(true);
    expect(failed.outcome).toContain('не перешёл в эксплуатацию');
    expect(failed.relevance.text).toContain('предупреждение о риске');
    expect(result.cases.map(item => item.id)).not.toContain(failed.id);
    expect(result.risks).toContainEqual(expect.objectContaining({ caseId: failed.id, risk: failed.comment }));
    expect(result.summary).toContain('как риски реализации');
    expect(result.summary).not.toContain('повторим результат');
  });

  it('keeps the failed logistics pilot visible instead of advertising its time saving', () => {
    const result = recommend(
      'Оптимизация планирования маршрутов логистической B2B-платформы',
      'OR-Tools, данные о пробках, адреса и временные окна.',
    );
    const paused = result.risks.find(item => item.id === 'optimization-logistics-paused');
    expect(paused).toBeDefined();
    expect(paused.outcome).toContain('точность упала');
    expect(paused.result).toContain('Бизнес не принял результат');
    expect(paused.risk).toContain('низкое качество адресов');
    expect(paused.applicability).toContain('не обещание результата');
    expect(result.cases.map(item => item.id)).not.toContain(paused.id);
  });

  it('treats the stopped ERP migration as a delivery risk and offers a real roadmap range', () => {
    const result = recommend(
      'Миграция монолитной ERP машиностроительного завода',
      'Полная остановка производства недопустима; нужна техническая декомпозиция.',
    );
    const stopped = result.risks.find(item => item.id === 'transform-erp-stopped');
    expect(stopped).toBeDefined();
    expect(stopped.status).toBe('pilot-stopped');
    expect(stopped.result).toContain('3+ дня');
    expect(stopped.caseId).toBe(stopped.id);
    expect(result.cases.map(item => item.id)).not.toContain(stopped.id);
    expect(result.roadmapPriceRange).toEqual({
      service: 'Дорожная карта + тех.декомпозиция',
      min: 1200000,
      max: 1590000,
      currency: 'RUB',
      unit: null,
      evidence: { source: SOURCE, kind: 'vendor-price' },
      note: 'Диапазон Middle–Senior из прайса; период или единица измерения в источнике не указаны.',
    });
  });

  it('shows the DLP rejection and fitness market failure with their original outcomes', () => {
    const dlp = recommend('DLP для детекции внутренних угроз', 'Снизить ложные срабатывания и проверить классификацию данных.');
    expect(dlp.risks.map(item => item.id)).toContain('security-dlp-rejected');
    expect(dlp.risks.find(item => item.id === 'security-dlp-rejected').outcome).toContain('>40%');
    expect(dlp.cases.map(item => item.id)).not.toContain('security-dlp-rejected');

    const fitness = recommend('Мобильное приложение для фитнес-тренировок', 'Сначала проверить валидацию спроса, затем Flutter MVP.');
    expect(fitness.risks.map(item => item.id)).toContain('product-fitness-failed');
    expect(fitness.risks.find(item => item.id === 'product-fitness-failed').result).toContain('800 установок');
    expect(fitness.cases.map(item => item.id)).not.toContain('product-fitness-failed');
  });

  it('does not attach a roadmap price to a simple or weakly matched task', () => {
    expect(recommend('Анализ отзывов с NLP').roadmapPriceRange).toBeNull();
    expect(recommend('Нужны услуги').roadmapPriceRange).toBeNull();
    expect(enterpriseRecommendations().roadmapPriceRange).toBeNull();
  });

  it('returns only prices present in the catalogue and marks applicability as hypothetical', () => {
    const result = recommend('NLP-анализ отзывов и Backend Python', 'BERT, FastAPI и потоковая обработка.', { limit: 3 });
    expect(result.services.length).toBeGreaterThan(0);
    for (const recommended of result.services) {
      const original = serviceById(recommended.id);
      expect(recommended.prices).toEqual(original.prices);
      expect(recommended.unit).toBeNull();
      expect(recommended.evidence.source).toBe(SOURCE);
      expect(recommended.relevance.type).toBe('hypothesis');
    }
    for (const item of result.cases) {
      expect(item.evidence.source).toBe(SOURCE);
      expect(item).not.toHaveProperty('sourceId');
      expect(item.applicability).toContain('не обещается');
    }
  });

  it('does not claim an existing integration, certification or repeatable business result', () => {
    const result = recommend('Микросервисная архитектура крупного банка', 'Нужна интеграция с внутренним контуром и RBAC.');
    const serialized = JSON.stringify(result);
    expect(result.architecture.integrations).toContain('не утверждение о готовой интеграции');
    expect(result.architecture.security).toContain('не утверждение о сертификации');
    expect(result.architecture.quality).toContain('не переносится');
    expect(result.summary).toContain('гипотезы');
    expect(serialized).not.toMatch(/уже сертифицирован|имеет сертификат|гарантируем (?:рост|эффект|результат)/i);
  });
});
