import fs from 'node:fs/promises';
import path from 'node:path';
import { createEvidenceBasedFallback } from '../shared/fallback.js';

for (const file of process.argv.slice(2)) {
  const research = JSON.parse(await fs.readFile(file, 'utf8'));
  const result = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
  const output = {
    company: research.companyName,
    summary: result.summary,
    coverage: research.coverage,
    opportunities: result.opportunities.map(item => ({
      category: item.category,
      title: item.title,
      confidence: item.confidence,
      evidence: item.evidence.map(evidence => ({ sourceId: evidence.sourceId, quote: evidence.quote })),
      steps: item.steps,
      metric: item.metric,
      unknowns: item.unknowns,
    })),
    swot: result.swot,
    warning: result.warning,
  };
  const destination = file.replace(/\.json$/i, '-analysis.json');
  await fs.writeFile(destination, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ file: path.basename(file), company: output.company, categories: output.opportunities.map(item => item.category), titles: output.opportunities.map(item => item.title), evidence: output.opportunities.map(item => item.evidence.length), warning: output.warning || '' }));
}
