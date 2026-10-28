import * as cheerio from 'cheerio';
const url = process.argv[2] || 'https://baiagent.ru/';
const html = await (await fetch(url)).text();
const $ = cheerio.load(html);
$('h1,h2,h3,h4').each((_, element) => {
  const node = $(element);
  const parent = node.parent();
  console.log(`\nHEAD ${node.text().replace(/\s+/g, ' ').trim()}\nPARENT ${parent.prop('tagName')} ${parent.attr('class') || ''}\nTEXT ${parent.text().replace(/\s+/g, ' ').trim().slice(0, 350)}`);
});
