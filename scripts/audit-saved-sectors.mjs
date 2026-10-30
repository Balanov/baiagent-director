import fs from 'node:fs/promises';
import path from 'node:path';
import { createEvidenceBasedFallback } from '../shared/fallback.js';

const input = path.resolve(process.env.SECTOR_FIXTURES || 'validation/swarm-2026-10-30/round2/raw');
const output = path.resolve(process.env.SECTOR_REPORTS || 'validation/swarm-2026-10-30/round3/saved-sectors');
const expected = {
  kamaz: ['manufacturing'], gemotest: ['healthcare'], cdek: ['logistics'], citilink: ['retail'],
  consultant: ['software'], firestarters: ['manufacturing'], gofromir: ['manufacturing'],
  atlassian: ['software'], shopify: ['software'], siemens: ['manufacturing', 'software'],
  profi: ['professional'], teremok: ['food'],
};
await fs.mkdir(output, { recursive: true });
const reports = [];
for (const [slug, expectedIndustries] of Object.entries(expected)) {
  const research = JSON.parse(await fs.readFile(path.join(input, `${slug}-research.json`), 'utf8'));
  const started = Date.now();
  try {
    const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
    const offerings = research.offerings || [];
    const canonicalNames = offerings.map(item => String(item.displayName || item.name || '').trim().toLowerCase());
    const duplicateNameIndexes = canonicalNames.flatMap((name, index) => canonicalNames.indexOf(name) === index ? [] : [index + 1]);
    const duplicateUrls = [...new Set(offerings.map(item => item.url).filter(url => url && offerings.filter(other => other.url === url).length > 1))];
    const report = {
      slug,
      requestedUrl: research.requestedUrl,
      status: 'completed',
      durationMs: Date.now() - started,
      company: analysis.companyName,
      expectedIndustries,
      industry: analysis.profile?.industry?.id || null,
      industryMatches: expectedIndustries.includes(analysis.profile?.industry?.id),
      businessModel: analysis.profile?.businessModel || null,
      subject: research.marketContext?.subject || null,
      companyLogo: research.companyLogo || null,
      warnings: research.warnings || [],
      offerings: offerings.map((item, index) => ({ index: index + 1, name: item.displayName || item.name, price: item.price, url: item.url, image: item.image || null, quote: item.quote })),
      duplicateNameIndexes,
      duplicateUrls,
      competitors: (research.competitors || []).map(item => ({ name: item.name, url: item.url, quote: item.quote })),
      reviews: (research.reviews || []).map(item => ({ title: item.sourceTitle || item.title, url: item.url, quote: item.quote })),
      opportunities: analysis.opportunities.map(item => ({
        id: item.id, category: item.category, processName: item.processName,
        processEvidence: item.processEvidence, evidence: item.evidence,
        input: item.input, output: item.output, owner: item.owner,
        solutionId: item.solutionId, acceptanceCases: item.acceptance?.cases?.length || 0,
        hasNullTargets: item.acceptance?.metrics?.every(metric => metric.target === null) || false,
      })),
      mechanicalChecks: {
        opportunityCountValid: analysis.opportunities.length >= 1 && analysis.opportunities.length <= 3,
        everyOpportunityHasEvidence: analysis.opportunities.every(item => item.evidence.length > 0),
        everyOpportunityHasSixAcceptanceCases: analysis.opportunities.every(item => item.acceptance?.cases?.length === 6),
        noInventedNumericTargets: analysis.opportunities.every(item => item.acceptance?.metrics?.every(metric => metric.target === null)),
      },
    };
    await fs.writeFile(path.join(output, `${slug}.json`), JSON.stringify(report, null, 2));
    reports.push(report);
    console.log(`${slug}: ${report.company}; ${report.industry}; ${offerings.length} offers; ${analysis.opportunities.length} hypotheses; ${report.mechanicalChecks.everyOpportunityHasEvidence ? 'evidence OK' : 'EVIDENCE FAIL'}`);
  } catch (error) {
    const report = { slug, status: 'failed', expectedIndustries, error: error.stack };
    await fs.writeFile(path.join(output, `${slug}.json`), JSON.stringify(report, null, 2));
    reports.push(report);
    console.error(`${slug}: ${error.message}`);
  }
}
const summary = {
  status: reports.every(item => item.status === 'completed' && item.industryMatches && Object.values(item.mechanicalChecks).every(Boolean)) ? 'mechanical-pass' : 'failed',
  fixtureDirectory: input,
  interpretation: 'Mechanical checks do not establish semantic correctness or complete catalog coverage. Review the detailed offerings, competitors, reviews and evidence.',
  companies: reports.map(item => ({ slug: item.slug, status: item.status, company: item.company, industry: item.industry, industryMatches: item.industryMatches, offerings: item.offerings?.length, opportunities: item.opportunities?.length, checks: item.mechanicalChecks, error: item.error })),
};
await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.status === 'failed') process.exitCode = 1;
