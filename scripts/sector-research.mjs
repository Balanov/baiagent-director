import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { enterpriseRecommendations } from '../shared/enterprise.js';

const [url, slug, expectedIndustry] = process.argv.slice(2);
if (!url || !slug) throw new Error('Usage: node scripts/sector-research.mjs <url> <slug> [expected-industry]');
await fs.mkdir('validation/sectors', { recursive: true });
const endpoint = `https://baiagent.ru/xray/api/research.php?url=${encodeURIComponent(url)}`;
const response = await fetch(endpoint, { signal: AbortSignal.timeout(210000) });
const body = await response.text();
if (!response.ok) throw new Error(`Research HTTP ${response.status}: ${body.slice(0, 1000)}`);
const research = JSON.parse(body);
await fs.writeFile(`validation/sectors/${slug}-research.json`, JSON.stringify(research, null, 2));
const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
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
  industryLabel: analysis.profile?.industry?.label || null,
  ownPages: analysis.profile?.ownPagesReadable || 0,
  offerings: research.offerings?.length || 0,
  offeringsWithImages: (research.offerings || []).filter(item => item.image).length,
  competitors: research.competitors?.length || 0,
  reviews: research.reviews?.length || 0,
  news: research.news?.length || 0,
  warnings: research.warnings || [],
  opportunities: analysis.opportunities.map(item => ({
    rank: item.priority.rank,
    category: item.category,
    processName: item.processName,
    solutionId: item.solutionId,
    implementationMode: item.implementationMode,
    input: item.input,
    output: item.output,
    owner: item.owner,
    simpleAlternative: item.simpleAlternative,
    risks: item.riskControls,
    evidence: item.evidence.map(proof => ({ sourceId: proof.sourceId, url: proof.url, quote: proof.quote })),
  })),
  vendor: { cases: vendor.cases.map(item => item.id), services: vendor.services.map(item => item.id), summary: vendor.summary },
};
await fs.writeFile(`validation/sectors/${slug}-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
