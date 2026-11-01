import fs from 'node:fs/promises';
import path from 'node:path';
import { researchCompany } from '../electron/research.mjs';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { verifyFinalAnalysis } from '../shared/verification.js';
import { buildPilotBlueprint } from '../shared/pilot.js';
import { answerInternationalAdvisor } from '../shared/advisor-prompts.js';

const [target = 'https://www.atlassian.com/', language = 'en'] = process.argv.slice(2);
const started = Date.now();
const research = await researchCompany(target, null, language);
const analysis = createEvidenceBasedFallback(research.sources, research.requestedUrl, research);
const verified = verifyFinalAnalysis(analysis, research.sources);
const opportunity = verified.opportunities[0];
const pilot = opportunity ? buildPilotBlueprint(opportunity, language) : null;
const advisor = opportunity && language !== 'ru' ? answerInternationalAdvisor({ question: 'What competitors did you find?', research, analysis, opportunity }) : null;
const report = {
  target, language, company: research.companyName, seconds: Math.round((Date.now() - started) / 1000),
  counts: { pages: research.coverage?.pages, offerings: research.offerings.length, competitors: research.competitors.length, reviews: research.reviews.length, news: research.news.length, sources: research.sources.length },
  subject: research.marketContext?.subject, warnings: research.warnings,
  sourceWarnings: research.sources.flatMap(source => source.warnings || []),
  offeringNames: research.offerings.slice(0, 12).map(item => item.displayName || item.name),
  competitors: research.competitors.map(item => ({ name: item.name, url: item.url })),
  reviewUrls: research.reviews.map(item => item.url), newsUrls: research.news.map(item => item.url),
  languageChecks: { analysis: analysis.language, final: verified.language, pilot: pilot?.language || language, advisor: advisor?.language || null },
  verifiedOpportunities: verified.opportunities.length,
};
const directory = path.resolve('artifacts', 'international-live');
await fs.mkdir(directory, { recursive: true });
const slug = new URL(target).hostname.replace(/[^a-z0-9]+/gi, '-');
await fs.writeFile(path.join(directory, `${language}-${slug}-research.json`), JSON.stringify(research, null, 2));
await fs.writeFile(path.join(directory, `${language}-${slug}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
