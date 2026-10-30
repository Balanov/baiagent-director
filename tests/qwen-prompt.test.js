import { describe, expect, it } from 'vitest';
import { evidencePrompt, groundedEvidenceAnchor } from '../electron/qwen.mjs';
import { verifyAnalysis } from '../shared/verification.js';

const research = {
  companyName: 'Теремок',
  sources: [{ id: 'site-1', kind: 'company-site', url: 'https://teremok.ru/', title: 'Теремок', text: 'Завтрак Богатырский со свежими сырниками. Блин Алёша Попович.' }],
  offerings: [{ name: 'Завтрак Богатырский', displayName: 'Завтрак Богатырский', sourceId: 'site-1', quote: 'Завтрак Богатырский со свежими сырниками.' }],
};

describe('Qwen evidence recovery', () => {
  it('anchors a retry in an exact quote from the researched source', () => {
    const anchor = groundedEvidenceAnchor(research);
    expect(anchor.sourceId).toBe('site-1');
    const prompt = evidencePrompt(research, true);
    expect(prompt).toContain(JSON.stringify({ sourceId: anchor.sourceId, quote: anchor.quote }));
    expect(prompt).toContain('без каких-либо изменений, сокращений и многоточий');
    expect(prompt).toContain(JSON.stringify(anchor.displayName));
    const verified = verifyAnalysis({ opportunities: [{ title: `Проверить представление «${anchor.displayName}»`, category: 'offering', why: `Проверяемая гипотеза о «${anchor.displayName}»`, action: `Сверить представление «${anchor.displayName}» с гостями`, metric: 'Принятые замечания о представлении', confidence: 'low', unknowns: [], evidence: [{ sourceId: anchor.sourceId, quote: anchor.quote }] }] }, research.sources);
    expect(verified.opportunities).toHaveLength(1);
    expect(verified.opportunities[0].evidence[0].quote).toBe(anchor.quote);
  });

  it('does not anchor a retry in an unverified or too-short quote', () => {
    const invalid = { ...research, offerings: [{ sourceId: 'unknown', quote: 'Выдуманная услуга с подробным описанием.' }] };
    expect(groundedEvidenceAnchor(invalid)).toBeNull();
    expect(groundedEvidenceAnchor({ ...research, offerings: [{ sourceId: 'site-1', quote: 'Блин' }] })).toBeNull();
  });
});
