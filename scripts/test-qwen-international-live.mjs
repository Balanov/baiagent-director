import fs from 'node:fs/promises';
import path from 'node:path';
import { analyzeWithQwen, chatWithQwen } from '../electron/qwen.mjs';
import { verifyFinalAnalysis } from '../shared/verification.js';
import { buildPilotBlueprint } from '../shared/pilot.js';

const [file, language = 'en'] = process.argv.slice(2);
if (!file) throw new Error('Specify a saved research JSON');
const research = JSON.parse(await fs.readFile(file, 'utf8'));
const analysis = await analyzeWithQwen(research, { userDataPath: path.resolve('artifacts', 'model-test'), onProgress: null });
const verified = verifyFinalAnalysis(analysis, research.sources);
const opportunity = verified.opportunities[0];
const questions = { en: 'What competitors did you find and what evidence supports them?', es: '¿Qué competidores encontraste y qué pruebas los respaldan?', zh: '你找到了哪些竞争对手？有什么证据？', hi: 'आपको कौन से प्रतियोगी मिले और क्या प्रमाण है?', ar: 'ما المنافسون الذين وجدتهم وما الأدلة؟' };
const advisor = await chatWithQwen({ question: questions[language] || questions.en, history: [], research, analysis, opportunity, userDataPath: path.resolve('artifacts', 'model-test') });
const report = {
  company: research.companyName, requestedLanguage: language, analysisLanguage: analysis.language,
  mode: analysis.mode || null, warning: analysis.warning || null,
  opportunities: verified.opportunities.length, verifiedCitations: verified.opportunities.every(item => item.evidence?.length),
  pilotLanguage: opportunity ? buildPilotBlueprint(opportunity, language).language : null,
  advisorMode: advisor.mode, advisorLanguage: advisor.language || language, advisor: advisor.answer,
};
const output = path.resolve('artifacts', 'international-live', `qwen-${path.basename(file, '.json')}.json`);
await fs.writeFile(output, JSON.stringify({ report, analysis }, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!String(analysis.mode).startsWith('qwen-') || !verified.opportunities.length) process.exitCode = 2;
