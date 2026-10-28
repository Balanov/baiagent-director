import fs from 'node:fs/promises';
import { researchCompany } from '../electron/research.mjs';
import { createEvidenceBasedFallback } from '../shared/fallback.js';

const url = process.argv[2];
if (!url) throw new Error('Usage: node scripts/audit-company.mjs <url> [name]');
const name = process.argv[3] || new URL(url).hostname.replace(/\W+/g, '-');
const research = await researchCompany(url, progress => console.log(progress.stage, progress.message));
const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl || url, research);
const artifact = { research, analysis };
await fs.writeFile(new URL(`../artifacts/audit-${name}.json`, import.meta.url), JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({
  company: research.companyName,
  coverage: research.coverage,
  warnings: research.warnings,
  industry: analysis.profile.industry && { id: analysis.profile.industry.id, label: analysis.profile.industry.label, evidence: analysis.profile.industry.evidence },
  segments: analysis.profile.segments.map(item => ({ label: item.label, evidence: item.evidence })),
  summary: analysis.summary,
  offerings: research.offerings.slice(0, 8).map(item => ({ name: item.displayName || item.name, price: item.price, url: item.url })),
  risks: analysis.profile.risks,
  opportunities: analysis.opportunities.map(item => ({ title: item.title, action: item.action, evidence: item.evidence })),
  swot: analysis.swot,
  external: research.sources.filter(source => source.kind !== 'company-site').slice(0, 4).map(source => ({ title: source.title, url: source.url, text: source.text.slice(0, 240) })),
}, null, 2));
