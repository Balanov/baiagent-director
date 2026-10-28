import fs from 'node:fs/promises';
import { researchCompany } from '../electron/research.mjs';
const url = process.argv[2];
if (!url) throw new Error('Usage: node scripts/test-research-only.mjs <url> [name]');
const name = process.argv[3] || new URL(url).hostname.replace(/\W+/g, '-');
const research = await researchCompany(url, progress => console.log(progress.stage, progress.message));
await fs.writeFile(new URL(`../artifacts/research-${name}.json`, import.meta.url), JSON.stringify({ research }, null, 2));
console.log(JSON.stringify({ company: research.companyName, coverage: research.coverage, offerings: research.offerings.map(item => ({ name: item.name, price: item.price, url: item.url })), reviews: research.reviews.length, alternatives: research.alternatives.map(item => ({ name: item.name, price: item.price })) }, null, 2));
