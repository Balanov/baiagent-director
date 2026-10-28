import * as cheerio from 'cheerio';

for (const query of ['"Московский Мыловаренный Комбинат"', '"Хозяйственное 72%" купить цена аналог']) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' } });
  const html = await response.text();
  const $ = cheerio.load(html);
  console.log(JSON.stringify({
    query,
    status: response.status,
    results: $('.result').map((_, element) => ({
      title: $(element).find('.result__title').text().trim(),
      href: $(element).find('.result__a').attr('href'),
      snippet: $(element).find('.result__snippet').text().trim(),
    })).get().slice(0, 8),
  }, null, 2));
}
