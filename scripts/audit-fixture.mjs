import fs from 'node:fs/promises';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { recommendSolution } from '../shared/solutions.js';

for (const file of process.argv.slice(2)) {
  const artifact = JSON.parse(await fs.readFile(file, 'utf8'));
  const research = artifact.research || artifact;
  const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
  const kinds = Object.fromEntries([...new Set(research.sources.map(source => source.kind))].map(kind => [kind, research.sources.filter(source => source.kind === kind).length]));
  console.log(JSON.stringify({
    file,
    company: analysis.companyName,
    industry: analysis.profile?.industry?.id || research.marketContext?.industry,
    subject: research.marketContext?.subject,
    kinds,
    competitors: research.competitors?.map(item => item.name) || [],
    reviews: research.reviews?.length || 0,
    offerings: research.offerings?.length || 0,
    opportunities: analysis.opportunities.map(item => ({ category: item.category, title: item.title, solution: recommendSolution(item)?.id || null, evidence: item.evidence.map(evidence => evidence.sourceId) })),
    swot: analysis.swot.map(item => ({ category: item.category, title: item.title, evidence: item.evidence.map(evidence => evidence.sourceId) })),
  }, null, 2));
}
