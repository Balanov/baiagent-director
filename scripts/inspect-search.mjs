import * as cheerio from 'cheerio';
const query = process.argv.slice(2).join(' ') || 'beeline.ru отзывы';
const response = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'BAIagentDirector/0.6 (public evidence research; +https://baiagent.ru/)', Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1' } });
const xml = await response.text();
const $ = cheerio.load(xml, { xmlMode: true });
console.log('HTTP', response.status, 'items', $('item').length);
$('item').each((_, item) => console.log(JSON.stringify({ title: $(item).find('title').text(), url: $(item).find('link').text(), text: $(item).find('description').text() }, null, 2)));
