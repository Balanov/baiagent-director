import * as cheerio from 'cheerio';
import { SEARCH_MARKETS, normalizeLanguage } from '../shared/locale.js';

const [query = 'business software cloud platform pricing', language = 'en'] = process.argv.slice(2);
const market = SEARCH_MARKETS[normalizeLanguage(language)];
const endpoints = [
  `https://search.lumy.live/search?q=${encodeURIComponent(query)}&format=json&language=${market.tag}&categories=general`,
  `https://www.bing.com/search?format=rss&mkt=${market.tag}&cc=${market.country}&setlang=${language}&q=${encodeURIComponent(query)}`,
  `https://www.bing.com/search?mkt=${market.tag}&cc=${market.country}&setlang=${language}&q=${encodeURIComponent(query)}`,
  `https://html.duckduckgo.com/html/?kl=${market.tag.toLowerCase()}&q=${encodeURIComponent(query)}`,
  `https://www.google.com/search?hl=${language}&gl=${market.country}&gbv=1&q=${encodeURIComponent(query)}`,
];
for (const url of endpoints) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' } });
    const text = await response.text();
    let results;
    if (url.includes('format=json')) {
      const data = JSON.parse(text);
      results = (data.results || []).slice(0, 5).map(item => ({ title: item.title, url: item.url, text: item.content }));
    } else {
      const $ = cheerio.load(text, /format=rss/.test(url) ? { xmlMode: true } : {});
      results = $('item,.result,.MjjYud').slice(0, 5).map((_, element) => ({ title: $(element).find('title,.result__title,h3').first().text().trim(), url: $(element).find('link').first().text().trim() || $(element).find('a').first().attr('href'), text: $(element).find('description,.result__snippet').first().text().trim() })).get();
    }
    console.log(JSON.stringify({ host: new URL(url).hostname, status: response.status, bytes: text.length, results }, null, 2));
  } catch (error) { console.log(JSON.stringify({ url, error: error.message })); }
}
