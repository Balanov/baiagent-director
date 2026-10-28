import * as cheerio from 'cheerio';
const url = process.argv[2];
const needle = process.argv[3] || 'Year';
const html = await (await fetch(url)).text();
const $ = cheerio.load(html);
$('*').filter((_, element) => $(element).children().length === 0 && $(element).text().trim() === needle).first().parents().slice(0, 6).each((index, element) => {
  const node = $(element);
  console.log(`\nLEVEL ${index + 1} ${node.prop('tagName')} ${node.attr('class') || ''}\n${node.text().replace(/\s+/g, ' ').trim().slice(0, 1200)}`);
  if (index === 0) console.log(`\nHTML\n${node.html()?.slice(0, 6000)}`);
});
