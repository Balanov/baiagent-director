import fs from 'node:fs/promises';
import path from 'node:path';
import { researchCompany } from '../electron/research.mjs';
import { analyzeWithQwen } from '../electron/qwen.mjs';

const target = process.argv[2] || 'https://baiagent.ru/';
const progress = [];
const research = await researchCompany(target, event => { progress.push(event); console.log(event.stage, event.message); });
console.log(`Sources: ${research.sources.length}; warnings: ${research.warnings.length}`);
await fs.mkdir('artifacts', { recursive: true });
await fs.writeFile('artifacts/live-research-input.json', JSON.stringify(research));
let lastDraft = 0;
const analysis = await analyzeWithQwen(research, {
  userDataPath: path.resolve('artifacts/test-user-data'),
  onProgress: event => {
    progress.push(event);
    if (!event.draftChars || event.draftChars - lastDraft >= 2000) {
      console.log(event.stage, event.message, event.progress || '', event.draftChars ? `draft=${event.draftChars}` : '');
      lastDraft = event.draftChars || 0;
    }
  },
});
const output = { research, analysis, progress };
await fs.writeFile('artifacts/live-research-result.json', JSON.stringify(output));
console.log(JSON.stringify({ company: analysis.companyName, mode: analysis.mode, warning: analysis.warning, opportunities: analysis.opportunities.map(item => ({ title: item.title, evidence: item.evidence.length })) }, null, 2));
