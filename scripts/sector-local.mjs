import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { researchCompany } from '../electron/research.mjs';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { enterpriseRecommendations } from '../shared/enterprise.js';

const [url, slug, expectedIndustry] = process.argv.slice(2);
if (!url || !slug) throw new Error('Usage: node scripts/sector-local.mjs <url> <slug> [expected-industry]');
await fs.mkdir('validation/sectors', { recursive: true });
const research = await researchCompany(url, progress => console.log(progress.stage, progress.message));
const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
await fs.writeFile(`validation/sectors/${slug}-local-research.json`, JSON.stringify(research, null, 2));
assert.ok(analysis.companyName && !/^(?:официальн[а-яё]*\s+сайт|ооо|ао|пао|зао|ип|главная|home|website)\b/i.test(analysis.companyName), `Generic company name: ${analysis.companyName}`);
if (expectedIndustry) assert.equal(analysis.profile?.industry?.id, expectedIndustry, `Unexpected industry for ${url}`);
assert.ok(analysis.opportunities.length >= 1 && analysis.opportunities.length <= 3);
assert.ok(analysis.opportunities.every(item => item.processName && item.input && item.output && item.owner && item.acceptance?.cases?.length === 6));
assert.ok(analysis.opportunities.every(item => item.evidence.length > 0));
assert.ok(analysis.opportunities.every(item => item.acceptance.metrics.every(metric => metric.target === null)));
const vendor = enterpriseRecommendations({ research, profile: analysis.profile, opportunity: analysis.opportunities[0], limit: 3 });
const report = {
  url,
  company: analysis.companyName,
  industry: analysis.profile?.industry?.id || null,
  subject: research.marketContext?.subject || null,
  coverage: research.coverage,
  offerings: research.offerings?.length || 0,
  offeringsWithImages: (research.offerings || []).filter(item => item.image).length,
  offeringExamples: (research.offerings || []).slice(0, 6).map(item => ({ name: item.name, image: item.image, url: item.url })),
  competitors: (research.competitors || []).map(item => ({ name: item.name, url: item.url, quote: item.quote })),
  reviews: research.reviews?.length || 0,
  news: research.news?.length || 0,
  warnings: research.warnings || [],
  opportunities: analysis.opportunities.map(item => ({ rank: item.priority.rank, processName: item.processName, solutionId: item.solutionId, input: item.input, output: item.output, owner: item.owner, processEvidence: item.processEvidence || null, evidence: item.evidence.map(proof => ({ sourceId: proof.sourceId, kind: proof.kind, url: proof.url, quote: proof.quote })) })),
  vendor: { cases: vendor.cases.map(item => item.id), services: vendor.services.map(item => item.id), risks: vendor.risks.map(item => item.id) },
};
await fs.writeFile(`validation/sectors/${slug}-local-report.json`, JSON.stringify(report, null, 2));
console.log('LOCAL_SECTOR_REPORT', JSON.stringify(report, null, 2));
