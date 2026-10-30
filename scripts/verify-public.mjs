import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directorManifest = JSON.parse(await fs.readFile(new URL('../public/downloads/current.json', import.meta.url), 'utf8'));
const enterpriseManifest = JSON.parse(await fs.readFile(new URL('../public/downloads/enterprise.json', import.meta.url), 'utf8'));
const products = [
  {
    ...directorManifest,
    id: 'director',
    base: 'https://baiagent.ru',
    path: '/xray',
    title: 'BAIagent — ИИ-советник для бизнеса',
    manifest: 'current.json',
    apiPlatform: 'windows',
  },
  {
    ...enterpriseManifest,
    id: 'enterprise',
    base: 'https://balanov.pro',
    path: '/ai-audit',
    title: 'Balanov.PRO — ИИ-советник для бизнеса',
    manifest: 'enterprise.json',
    apiPlatform: 'enterprise',
  },
];

const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../artifacts/public-${products[0].version.replace(/\./g, '')}`);
await fs.mkdir(output, { recursive: true });
const report = { version: products[0].version, checkedAt: new Date().toISOString(), products: {} };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function fetchChecked(url, options = {}) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store', ...options });
  assert(response.ok, `${url}: HTTP ${response.status}`);
  return response;
}

async function verifyPage(product) {
  const url = `${product.base}${product.path}/?release=${product.version}`;
  const html = await fetchChecked(url).then(response => response.text());
  assert(html.includes('<div id="root"></div>'), `${product.id}: missing app root`);
  assert(html.includes(product.title), `${product.id}: wrong product title`);
  assert(!html.includes('0.8.1'), `${product.id}: stale release reference`);
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1]);
  assert(assetPaths.some(asset => asset.endsWith('.js')), `${product.id}: no JS asset`);
  for (const asset of assetPaths) {
    const content = await fetchChecked(new URL(asset, url)).then(response => response.text());
    if (asset.endsWith('.js')) {
      const expectedName = product.id === 'enterprise' ? 'Balanov-PRO-Enterprise-Setup-Windows-' : 'BAIagent-Director-Setup-Windows-';
      assert(content.includes(expectedName), `${product.id}: wrong installer product in JS`);
      assert(content.includes(product.version), `${product.id}: stale JS release`);
    }
  }
  const manifestUrl = `${product.base}${product.path}/downloads/${product.manifest}?release=${product.version}`;
  const manifest = await fetchChecked(manifestUrl).then(response => response.json());
  for (const field of ['version', 'file', 'sizeBytes', 'sha256']) {
    assert(manifest[field] === product[field], `${product.id}: manifest ${field} mismatch`);
  }
  return { page: url, assets: assetPaths, manifest };
}

async function downloadAndHash(product) {
  const url = `${product.base}${product.path}/downloads/${product.file}?release=${product.version}`;
  const response = await fetchChecked(url, { signal: AbortSignal.timeout(240000) });
  assert(Number(response.headers.get('content-length')) === product.sizeBytes, `${product.id}: HTTP size mismatch`);
  const filePath = path.join(output, product.file);
  const handle = await fs.open(filePath, 'w');
  const hash = createHash('sha256');
  let sizeBytes = 0;
  let first;
  try {
    for await (const chunk of response.body) {
      if (!first) first = Buffer.from(chunk);
      sizeBytes += chunk.length;
      hash.update(chunk);
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }
  assert(first?.[0] === 0x4d && first?.[1] === 0x5a, `${product.id}: not a Windows executable`);
  assert(sizeBytes === product.sizeBytes, `${product.id}: downloaded size ${sizeBytes}`);
  const sha256 = hash.digest('hex');
  assert(sha256 === product.sha256, `${product.id}: downloaded SHA-256 ${sha256}`);
  return { url, filePath, sizeBytes, sha256 };
}

async function verifyApiDownload(product) {
  const url = `${product.base}${product.path}/api/download.php?platform=${product.apiPlatform}`;
  const response = await fetchChecked(url, { headers: { Range: 'bytes=0-1023' } });
  const contentRange = response.headers.get('content-range');
  const total = response.status === 206
    ? Number(contentRange?.match(/\/(\d+)$/)?.[1])
    : Number(response.headers.get('content-length'));
  assert(total === product.sizeBytes, `${product.id}: API download size mismatch`);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert(!first.done && first.value[0] === 0x4d && first.value[1] === 0x5a, `${product.id}: API returned non-executable content`);
  await reader.cancel();
  return { url, status: response.status, sizeBytes: total };
}

async function verifyResearch(product) {
  const url = `${product.base}${product.path}/api/research.php?url=${encodeURIComponent('https://firestarters.ru/')}`;
  const research = await fetchChecked(url, { signal: AbortSignal.timeout(240000) }).then(response => response.json());
  assert(!research.error, `${product.id}: research error ${research.error}`);
  await fs.writeFile(path.join(output, `research-${product.id}.json`), JSON.stringify(research, null, 2));
  assert(research.companyName && research.sources?.length > 0, `${product.id}: empty research`);
  assert(research.offerings?.length > 0, `${product.id}: offerings missing`);
  assert(research.offerings.every(item => item.image), `${product.id}: offering images missing`);
  assert(research.reviews?.length > 0, `${product.id}: reviews missing`);
  assert(research.reviews.every(item => /имидж/i.test(`${item.sourceTitle || ''} ${item.quote || ''}`)), `${product.id}: review is not attributable to the researched company`);
  return {
    company: research.companyName,
    pages: research.coverage?.pages,
    sources: research.sources.length,
    offerings: research.offerings.length,
    offeringsWithImages: research.offerings.filter(item => item.image).length,
    reviews: research.reviews.length,
  };
}

const only = process.argv.find(argument => argument.startsWith('--product='))?.split('=')[1];
const selectedProducts = only ? products.filter(product => product.id === only) : products;
assert(selectedProducts.length > 0, `Unknown product: ${only}`);
const reportFile = path.join(output, `verification${only ? `-${only}` : ''}.json`);
try {
  for (const product of selectedProducts) {
    console.log(`Checking ${product.id}...`);
    report.products[product.id] = {};
    report.products[product.id].page = await verifyPage(product);
    report.products[product.id].api = await verifyApiDownload(product);
    report.products[product.id].download = await downloadAndHash(product);
    if (process.argv.includes('--research')) report.products[product.id].research = await verifyResearch(product);
  }
  const free = await fetchChecked(`https://baiagent.ru/free/?release=${products[0].version}`).then(response => response.text());
  assert(free.includes(products[0].file), 'Free page has a stale advisor download');
  assert(free.includes(`Версия ${products[0].version}`), 'Free page does not show the advisor version');
  assert(!free.includes('0.8.1'), 'Free page still contains 0.8.1');
  const host = await fetchChecked(`https://balanov.pro/?release=${products[0].version}`).then(response => response.text());
  assert((host.match(/href="\/ai-audit\/"/g) || []).length === 3, 'Balanov.PRO must have three audit links');
  report.landingPages = { free: products[0].version, balanovAuditLinks: 3 };
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = [error.message, error.cause?.message].filter(Boolean).join(': ');
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}
