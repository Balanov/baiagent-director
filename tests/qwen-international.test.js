import { describe, expect, it } from 'vitest';
import { evidencePrompt, internationalAnalysisSystem, modelOutputMatchesLanguage } from '../electron/qwen.mjs';
import { createLocalizedModelAnalysis } from '../shared/localized-analysis.js';
import { verifyFinalAnalysis } from '../shared/verification.js';

const research = {
  requestedUrl: 'https://fresh.example/', language: 'en', companyName: 'Fresh Example',
  sources: [{ id: 'site-1', kind: 'company-site', url: 'https://fresh.example/', title: 'Fresh Example', language: 'en', text: 'Our company provides fresh breakfast and lunch for business customers. Our seasonal breakfast includes fruit and reliable delivery for your office.', offerings: [] }],
  offerings: [{ name: 'Seasonal breakfast', displayName: 'Seasonal breakfast', sourceId: 'site-1', sourceTitle: 'Fresh Example', url: 'https://fresh.example/', quote: 'Our seasonal breakfast includes fruit and reliable delivery for your office.' }],
};

function modelAnalysis(language = 'en') {
  const copy = language === 'en' ? {
    summary: 'The company publishes a seasonal breakfast with office delivery. The evidence supports a limited service test, but actual customer demand remains unknown.',
    title: 'Test a source-grounded breakfast consultation',
    why: 'The published breakfast and delivery provide a concrete basis for preparing consistent answers without inventing availability.',
    action: 'Prepare draft answers from the verified product description and require an employee to confirm each response.',
    metric: 'Measure response completeness and the share of drafts accepted without corrections.',
  } : {
    summary: 'Компания публикует описание завтрака и доставки. Спрос клиентов остаётся неизвестным.',
    title: 'Проверить консультацию по завтраку', why: 'Описание подтверждает продукт.', action: 'Подготовить ответы по источнику.', metric: 'Проверить полноту ответов.',
  };
  return {
    companyName: 'Fresh Example', language, summary: copy.summary,
    opportunities: [{ id: 'model-1', title: copy.title, why: copy.why, action: copy.action, metric: copy.metric, category: 'revenue', confidence: 'low', unknowns: ['Actual customer demand is unknown'], decision: 'Continue only after employee verification', steps: ['Record the current answer', 'Test the draft with an employee'], evidence: [{ sourceId: 'site-1', sourceTitle: 'Fresh Example', url: 'https://fresh.example/', quote: 'Our seasonal breakfast includes fruit and reliable delivery for your office.' }] }],
    swot: [],
  };
}

describe('Qwen international analysis contract', () => {
  it('requires the selected language and preserves a verifiable evidence prompt', () => {
    expect(internationalAnalysisSystem('es')).toContain('Spanish (español)');
    expect(internationalAnalysisSystem('ar')).toContain('Arabic');
    expect(evidencePrompt(research)).toContain('write narrative fields in English');
    expect(evidencePrompt(research)).toContain('Our seasonal breakfast includes fruit');
    expect(modelOutputMatchesLanguage(modelAnalysis(), 'en')).toBe(true);
    expect(modelOutputMatchesLanguage(modelAnalysis('ru'), 'en')).toBe(false);
  });

  it('keeps model reasoning and localised pilot fields under final evidence verification', () => {
    const analysis = createLocalizedModelAnalysis(modelAnalysis(), research);
    expect(analysis.mode).toBe('qwen-embedded');
    expect(analysis.opportunities[0].title).toBe('Test a source-grounded breakfast consultation');
    expect(analysis.opportunities[0].processAction).toBe(modelAnalysis().opportunities[0].action);
    expect(analysis.opportunities[0].owner).toBeTruthy();
    expect(analysis.opportunities.every(item => item.evidence.length > 0)).toBe(true);
    const final = verifyFinalAnalysis(analysis, research.sources);
    expect(final.language).toBe('en');
    expect(final.opportunities.length).toBeGreaterThan(0);
  });
});
