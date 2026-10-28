import fs from 'node:fs/promises';

const base = (process.argv[2] || 'https://baiagent.ru').replace(/\/$/, '');
const expected = {
  version: '0.8.1',
  file: 'BAIagent-Director-Setup-Windows-0.8.1-x64.exe',
  sizeBytes: 442004410,
  sha256: 'd45c528e34f8b9d6f8a7ae034e5ba71f8e99cb41e23e793ea97b4754633d91dd',
};
const report = { base, checks: {} };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function fetchChecked(url, options = {}) {
  const response = await fetch(url, { redirect: 'follow', ...options });
  assert(response.ok, `${url}: HTTP ${response.status}`);
  return response;
}
async function checkDownload(url) {
  const response = await fetchChecked(url, { headers: { Range: 'bytes=0-1023' } });
  assert([200, 206].includes(response.status), `${url}: неожиданный HTTP ${response.status}`);
  const total = response.status === 206
    ? Number(response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1])
    : Number(response.headers.get('content-length'));
  assert(total === expected.sizeBytes, `${url}: размер ${total}, ожидался ${expected.sizeBytes}`);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert(!first.done && first.value.length > 0, `${url}: пустой ответ`);
  if (url.endsWith('.exe')) assert(first.value[0] === 0x4d && first.value[1] === 0x5a, `${url}: файл не является Windows-установщиком`);
  await reader.cancel();
  return { status: response.status, sizeBytes: total, firstBytes: first.value.length };
}

try {
  const xray = await fetchChecked(`${base}/xray/`).then(response => response.text());
  assert(xray.includes('<div id="root"></div>'), 'Xray: не найден корень приложения');
  report.checks.xray = { status: 200, bytes: xray.length };

  const free = await fetchChecked(`${base}/free/`).then(response => response.text());
  assert(free.includes(expected.file), 'Free: ссылка не ведёт на Windows 0.8.1');
  assert(free.includes('Ваш бизнес.'), 'Free: не найден основной оффер');
  report.checks.free = { status: 200, bytes: free.length, windows: expected.version };

  const currentResponse = await fetchChecked(`${base}/xray/downloads/current.json`, { cache: 'no-store' });
  const current = await currentResponse.json();
  for (const [key, value] of Object.entries(expected)) assert(current[key] === value, `current.json: неверное поле ${key}`);
  report.checks.current = current;

  report.checks.directDownload = await checkDownload(`${base}/xray/downloads/${expected.file}`);
  report.checks.apiDownload = await checkDownload(`${base}/xray/api/download.php?platform=windows`);

  const researchUrl = `${base}/xray/api/research.php?url=${encodeURIComponent('https://www.citilink.ru')}`;
  const researchResponse = await fetchChecked(researchUrl, { signal: AbortSignal.timeout(170000) });
  const research = await researchResponse.json();
  assert(!research.error, `Research: ${research.error}`);
  assert(research.companyName && Array.isArray(research.sources) && research.sources.length > 0, 'Research: пустой результат');
  assert(research.coverage?.pages > 0, 'Research: собственные страницы не прочитаны');
  assert(research.marketContext?.subject, 'Research: не определён предмет рынка');
  report.checks.research = {
    company: research.companyName,
    subject: research.marketContext.subject,
    pages: research.coverage.pages,
    external: research.coverage.external,
    sources: research.sources.length,
    competitors: research.competitors?.length || 0,
    reviews: research.reviews?.length || 0,
  };
  await fs.writeFile(new URL('../artifacts/public-research-check.json', import.meta.url), JSON.stringify(research, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ...report, error: error.message }, null, 2));
  process.exitCode = 1;
}
