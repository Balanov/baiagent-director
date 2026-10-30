import { describe, expect, it } from 'vitest';
import { verifyAnalysis, verifyFinalAnalysis } from '../shared/verification.js';
import { enrichAnalysisWithAudit } from '../shared/fallback.js';

function opportunity(extra = {}) {
  return {
    category: 'cost',
    title: 'Сократить ручное согласование договоров',
    why: 'Гипотеза о внутреннем процессе требует проверки.',
    action: 'Проверить маршрут согласования на реальных документах.',
    metric: 'Время согласования и число исправлений.',
    confidence: 'high',
    unknowns: [],
    ...extra,
  };
}

const consultantSources = [
  {
    id: 'consultant-site', kind: 'company-site', companyName: 'КонсультантПлюс', url: 'https://consultant.example/', title: 'КонсультантПлюс',
    text: 'КонсультантПлюс — справочная правовая система. Регламент согласования: юрист проверяет договор и передаёт замечания ответственному.',
  },
  {
    id: 'legal-industry', kind: 'industry-snippet', url: 'https://industry.example/legal', title: 'Работа юридических отделов',
    text: 'Юридические отделы работают с договорами и сопроводительными документами.',
  },
  {
    id: 'legal-customer', kind: 'customer-snippet', url: 'https://customer.example/legal', title: 'Выбор юридических сервисов',
    text: 'Покупатели сравнивают сервисы для работы с договорами и документами.',
  },
  {
    id: 'legal-review', kind: 'review-snippet', url: 'https://reviews.example/legal', title: 'Отзыв о работе с договорами',
    text: 'Клиенты описывают свой опыт согласования договоров и подготовки документов.',
  },
  {
    id: 'legal-local', kind: 'local-document', url: 'https://internal.example/regulation', title: 'Внутренний регламент',
    text: 'Внутренний регламент: юрист согласует договор и фиксирует версию документа.',
  },
];

const directContractQuote = 'Регламент согласования: юрист проверяет договор и передаёт замечания ответственному.';

describe('deterministic evidence roles and claim relevance', () => {
  it('does not inflate confidence with multiple relevant but indirect legal snippets', () => {
    const result = verifyAnalysis({
      companyName: 'КонсультантПлюс',
      opportunities: [opportunity({
        evidence: [
          { sourceId: 'legal-industry', quote: consultantSources[1].text },
          { sourceId: 'legal-customer', quote: consultantSources[2].text },
          { sourceId: 'legal-review', quote: consultantSources[3].text },
        ],
      })],
    }, consultantSources);

    expect(result.opportunities).toHaveLength(1);
    const [item] = result.opportunities;
    expect(item.confidence).toBe('low');
    expect(item.evidence).toHaveLength(3);
    expect(item.evidence.every(proof => proof.directness === 'contextual')).toBe(true);
    expect(item.evidenceQuality.directProcessEvidenceCount).toBe(0);
    expect(item.evidenceQuality.hypothesisKind).toBe('discovery-industry-hypothesis');
    expect(item.why).toContain('не подтверждают внутреннюю проблему');
    expect(item.unknowns.join(' ')).toContain('внутренний регламент');
  });

  it('allows medium for a relevant published process and high only for independent direct sources', () => {
    const published = opportunity({ evidence: [{ sourceId: 'consultant-site', quote: directContractQuote }] });
    const medium = verifyAnalysis({ opportunities: [published] }, consultantSources).opportunities[0];
    expect(medium.confidence).toBe('medium');
    expect(medium.evidence[0]).toMatchObject({ evidenceRole: 'published-process', directness: 'direct', relevance: 'relevant' });

    const withInternal = opportunity({
      evidence: [
        { sourceId: 'consultant-site', quote: directContractQuote },
        { sourceId: 'legal-local', quote: consultantSources[4].text },
      ],
    });
    const high = verifyAnalysis({ opportunities: [withInternal] }, consultantSources).opportunities[0];
    expect(high.confidence).toBe('high');
    expect(high.evidenceQuality.directSourceCount).toBe(2);
    expect(high.evidence.map(proof => proof.evidenceRole)).toEqual(['published-process', 'internal-document']);
    const final = verifyFinalAnalysis({ opportunities: [high] }, consultantSources).opportunities[0];
    expect(final.processEvidence.status).toBe('published-process');
    expect(final.processEvidence.note).toContain('Внутренний документ');
  });

  it('does not treat a topically related internal file as a described process by itself', () => {
    const localOnly = [{
      id: 'local-file', kind: 'local-document', url: 'https://internal.example/contract', title: 'Договор',
      text: 'Договор обслуживания хранится в папке юридического отдела.',
    }];
    const [item] = verifyAnalysis({
      opportunities: [opportunity({ evidence: [{ sourceId: 'local-file', quote: localOnly[0].text }] })],
    }, localOnly).opportunities;
    expect(item.confidence).toBe('low');
    expect(item.evidence[0]).toMatchObject({ evidenceRole: 'internal-document', directness: 'contextual' });
    expect(item.evidenceQuality.hypothesisKind).toBe('discovery-industry-hypothesis');
  });

  it('preserves direct recognition of an explicit published manufacturing process document', () => {
    const manufacturing = [{
      id: 'factory', kind: 'company-site', url: 'https://factory.example/process', title: 'Технологическая карта',
      text: 'Технологическая карта процесса содержит версии спецификации и маршрут согласования.',
    }];
    const claim = opportunity({
      title: 'Проверить передачу требований из продаж в производство',
      action: 'Сверить спецификацию и маршрут согласования.', confidence: 'medium',
      evidence: [{ sourceId: 'factory', quote: manufacturing[0].text }],
    });
    const [item] = verifyAnalysis({ opportunities: [claim] }, manufacturing).opportunities;
    expect(item.confidence).toBe('medium');
    expect(item.evidence[0]).toMatchObject({ evidenceRole: 'published-process', directness: 'direct' });
  });

  it('keeps customer feedback direct only for customer experience, never as internal-process confidence', () => {
    const reviewSource = [{
      id: 'review', kind: 'review-snippet', url: 'https://reviews.example/clinic', title: 'Отзыв пациента',
      text: 'Пациент сообщает, что после отзыва клиника не ответила на его вопрос.',
    }];
    const internalClaim = opportunity({
      title: 'Автоматизировать внутреннюю обработку договоров',
      evidence: [{ sourceId: 'review', quote: reviewSource[0].text }],
    });
    expect(verifyAnalysis({ opportunities: [internalClaim] }, reviewSource).opportunities).toHaveLength(0);

    const feedbackClaim = opportunity({
      title: 'Превратить темы отзывов в управляемый цикл улучшений',
      action: 'Классифицировать отзывы и назначить владельца реакции.',
      evidence: [{ sourceId: 'review', quote: reviewSource[0].text }],
    });
    const feedback = verifyAnalysis({ opportunities: [feedbackClaim] }, reviewSource).opportunities[0];
    expect(feedback.evidence[0]).toMatchObject({ evidenceRole: 'customer-experience', directness: 'direct' });
    expect(feedback.confidence).toBe('low');
    expect(verifyFinalAnalysis({ opportunities: [feedback] }, reviewSource).opportunities[0].processEvidence.status).toBe('customer-experience');
  });
});

describe('Citilink, ConsultantPlus and Gemotest adversarial patterns', () => {
  const citilinkSource = [{
    id: 'citilink-site', kind: 'company-site', companyName: 'Ситилинк', url: 'https://citilink.example/', title: 'Ситилинк',
    text: 'Подарочные сертификаты. Заказать прайс-лист. Смартфон Aurora X5 с гарантией и доставкой.',
  }];

  it('rejects a gift-certificate label as proof of an internal retail handoff', () => {
    const handoff = opportunity({
      title: 'Автоматизировать передачу заказов между продажами и складом',
      why: 'Потери при передаче заказов требуют проверки.',
      evidence: [{ sourceId: 'citilink-site', quote: 'Подарочные сертификаты.' }],
    });
    const validRecommendation = opportunity({
      category: 'revenue', title: 'Ускорить выбор смартфона Aurora X5',
      action: 'Проверить сценарий выбора смартфона на реальных вопросах.',
      evidence: [{ sourceId: 'citilink-site', quote: 'Смартфон Aurora X5 с гарантией и доставкой.' }],
    });
    const result = verifyAnalysis({ companyName: 'Ситилинк', opportunities: [handoff, validRecommendation] }, citilinkSource);
    expect(result.companyName).toBe('Ситилинк');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].title).toContain('Aurora X5');
    expect(result.evidenceValidation.rejectedOpportunityCount).toBe(1);
  });

  it('downgrades a generic price-list label instead of presenting it as a process diagnosis', () => {
    const handoff = opportunity({
      title: 'Автоматизировать передачу заказов между продажами и складом',
      why: 'Передача заказов организована плохо.',
      evidence: [{ sourceId: 'citilink-site', quote: 'Заказать прайс-лист.' }],
    });
    const [item] = verifyAnalysis({ opportunities: [handoff] }, citilinkSource).opportunities;
    expect(item.confidence).toBe('low');
    expect(item.evidence[0]).toMatchObject({ relevance: 'weak', directness: 'contextual' });
    expect(item.evidenceQuality.hypothesisKind).toBe('discovery-industry-hypothesis');
    expect(item.why).toMatch(/^Публичные материалы не подтверждают внутреннюю проблему/);
  });

  const gemotestSource = [{
    id: 'gemotest-site', kind: 'company-site', companyName: 'Гемотест', url: 'https://gemotest.example/', title: 'Гемотест',
    text: 'Анализ крови — от 350 ₽. Онлайн-запись на приём доступна по расписанию врача.',
  }];

  it('never treats a medical service price as direct proof of an appointment process', () => {
    const appointment = opportunity({
      category: 'revenue', title: 'Сократить потери при записи пациентов на приём',
      action: 'Проверить запись пациентов и исходные метрики.',
      evidence: [{ sourceId: 'gemotest-site', quote: 'Анализ крови — от 350 ₽.' }],
    });
    const [item] = verifyAnalysis({ opportunities: [appointment] }, gemotestSource).opportunities;
    expect(item.confidence).toBe('low');
    expect(item.evidence[0]).toMatchObject({ evidenceRole: 'company-offering', directness: 'contextual' });
    expect(item.evidenceQuality.directProcessEvidenceCount).toBe(0);
  });

  it('recognises a directly published appointment process without inventing a current problem', () => {
    const appointment = opportunity({
      category: 'revenue', title: 'Проверить запись пациентов на приём',
      action: 'Измерить путь записи и подтвердить владельца процесса.',
      confidence: 'medium',
      evidence: [{ sourceId: 'gemotest-site', quote: 'Онлайн-запись на приём доступна по расписанию врача.' }],
    });
    const verified = verifyAnalysis({ companyName: 'Гемотест', summary: 'Гемотест: медицинские услуги.', opportunities: [appointment] }, gemotestSource);
    expect(verified.companyName).toBe('Гемотест');
    expect(verified.opportunities[0].confidence).toBe('medium');

    const enriched = enrichAnalysisWithAudit(verified, { companyName: 'Гемотест', requestedUrl: gemotestSource[0].url, sources: gemotestSource });
    expect(enriched.evidenceValidation.finalObjectChecked).toBe(true);
    expect(enriched.opportunities[0].processEvidence.status).toBe('published-process');
    expect(enriched.opportunities[0].acceptance).toBeDefined();
    expect(enriched.opportunities[0].why).toContain('текущие показатели и недостатки');
  });
});

describe('final enriched-object validation', () => {
  const source = [{
    id: 'clinic', kind: 'company-site', companyName: 'Гемотест', url: 'https://clinic.example/', title: 'Клиника',
    text: 'Онлайн-запись на приём доступна по расписанию врача.',
  }];

  function validEnriched() {
    const raw = opportunity({
      category: 'revenue', title: 'Проверить запись пациентов на приём',
      action: 'Измерить запись и подтвердить владельца.', confidence: 'medium',
      evidence: [{ sourceId: 'clinic', quote: source[0].text }],
    });
    const verified = verifyAnalysis({ companyName: 'Гемотест', summary: 'Гемотест: медицинские услуги.', opportunities: [raw] }, source);
    return {
      ...verified,
      opportunities: [{
        ...verified.opportunities[0],
        processName: 'Запись пациента на приём',
        priority: { reason: 'Сначала проверить полноту исходных данных.' },
        acceptance: { cases: [{ id: 'offline-fixture' }] },
      }],
    };
  }

  it('rechecks the final object while preserving valid enriched fields', () => {
    const result = verifyFinalAnalysis(validEnriched(), source);
    expect(result.summary).toBe('Гемотест: медицинские услуги.');
    expect(result.opportunities[0].acceptance.cases[0].id).toBe('offline-fixture');
    expect(result.opportunities[0].processEvidence.status).toBe('published-process');
    expect(result.evidenceValidation.finalObjectChecked).toBe(true);
  });

  it('removes unsupported numeric summary claims without discarding valid recommendations', () => {
    const candidate = { ...validEnriched(), summary: 'Компания теряет 40% пациентов.' };
    const result = verifyFinalAnalysis(candidate, source);
    expect(result.summary).toBe('');
    expect(result.opportunities).toHaveLength(1);
    expect(result.evidenceValidation.removedUnsupportedSummaryClaims).toBe(1);
  });

  it('rejects unsupported numbers injected into an enriched explanation', () => {
    const candidate = validEnriched();
    candidate.opportunities[0].priority.reason = 'Приоритет подтверждает потери 30% обращений.';
    const result = verifyFinalAnalysis(candidate, source);
    expect(result.opportunities).toHaveLength(0);
  });

  it('rejects fabricated evidence injected after initial verification', () => {
    const candidate = validEnriched();
    candidate.opportunities[0].evidence = [{ sourceId: 'clinic', quote: 'Все пациенты записываются без ошибок.' }];
    const result = verifyFinalAnalysis(candidate, source);
    expect(result.opportunities).toHaveLength(0);
    expect(result.evidenceValidation.rejectedOpportunityCount).toBe(1);
  });
});
