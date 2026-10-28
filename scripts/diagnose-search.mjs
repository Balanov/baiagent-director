import * as cheerio from 'cheerio';

const query = process.argv[2] || 'ПОЗИТРОНИКА';
const endpoints = [
  `https://html.duckduckgo.com/html/?kl=ru-ru&q=${encodeURIComponent(query)}`,
  `https://www.bing.com/search?format=rss&mkt=ru-RU&setlang=ru&q=${encodeURIComponent(query)}`,
  `https://www.bing.com/search?mkt=ru-RU&setlang=ru&q=${encodeURIComponent(query)}`,
  `https://www.google.com/search?hl=ru&gbv=1&q=${encodeURIComponent(query)}`,
  `https://yandex.ru/search/?text=${encodeURIComponent(query)}`,
  `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`,
];
for (const url of endpoints) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' } });
    const text = await response.text();
    const $ = cheerio.load(text, /rss/.test(url) ? { xmlMode: true } : {});
    const titles = $('item title,.result__title,h3,.snippet-title').map((_, element) => $(element).text().trim()).get().filter(Boolean).slice(0, 5);
    console.log(JSON.stringify({ host: new URL(url).hostname, status: response.status, bytes: text.length, titles }));
  } catch (error) { console.log(JSON.stringify({ url, error: error.message })); }
}
