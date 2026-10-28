import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { cleanOfferingName, dedupeOfferings, extractPrice, isUsefulOfferingName, normalizeMarketText, offeringMentioned, verifyMarketItems } from '../shared/market.js';
import { createBusinessProfile } from '../shared/business.js';
import { competitorNameFrom, createMarketSearchPlan, isCompetitorCandidate, isCompetitorContent, isRelevantIndustryEvidence, isRelevantMarketNews, relevantMarketQuote } from '../shared/market-plan.js';
import { researchErrorMessage } from '../shared/research-error.js';

const MAX_HTML_BYTES = 3_000_000;
const MAX_PAGES = 24;
const MAX_EXTERNAL = 18;
const USER_AGENT = 'BAIagentDirector/0.8 (public evidence research; +https://baiagent.ru/)';
const COMMERCIAL_LINK = /catalog|shop|store|product|goods|service|solution|price|pricing|каталог|товар|продукт|услуг|сервис|цен|прайс|стоимост/i;
const SECONDARY_LINK = /about|company|contact|о-нас|компан|контакт/i;
const PROCESS_LINK = /appointment|schedule|prepare|regulation|protocol|запис|расписан|подготовк|напоминан|спецификац|регламент|инструкц|при[её]м/i;

export function normalizeCompanyUrl(input) {
  let value = String(input || '').trim();
  if (!value) throw new Error('Укажите сайт компании');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) throw new Error('Нужен обычный публичный адрес сайта');
  url.hash = '';
  return url.toString();
}

function isPrivateAddress(address) {
  if (address.includes(':')) {
    const ip = address.toLowerCase();
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') || ip.startsWith('::ffff:192.168.');
  }
  const parts = address.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

async function assertPublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Недопустимый URL источника');
  if (!['80', '443', ''].includes(url.port)) throw new Error('Нестандартные порты не используются');
  if (net.isIP(url.hostname)) { if (isPrivateAddress(url.hostname)) throw new Error('Локальные адреса не сканируются'); return; }
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('Адрес не относится к публичной сети');
}

async function fetchPublic(url, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('Слишком много перенаправлений');
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Перенаправление без адреса');
      return fetchPublic(new URL(location, url).toString(), redirectCount + 1);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_HTML_BYTES) throw new Error('Источник слишком большой');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) throw new Error('Источник слишком большой');
    const contentType = response.headers.get('content-type') || '';
    const head = new TextDecoder('ascii').decode(buffer.slice(0, 8192));
    const charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
    let text;
    try { text = new TextDecoder(charset, { fatal: true }).decode(buffer); } catch { text = new TextDecoder('windows-1251').decode(buffer); }
    return { url: response.url || url, contentType, text };
  } finally { clearTimeout(timer); }
}

function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function elementText(node, $) {
  const copy = node.clone();
  copy.find('br').replaceWith(' ');
  copy.find('*').each((_, child) => { $(child).prepend(' ').append(' '); });
  return clean(copy.text());
}
function host(value = '') { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function variantFrom(text = '') { return clean(text.match(/(?:вес|объ[её]м|объем)\s*:?[ ]*(\d+(?:[.,]\d+)?\s*(?:кг|мл|kg|ml|г|л|g|l))(?![\p{L}])/iu)?.[1] || ''); }
function displayName(name, pageTitle, text) {
  const variant = variantFrom(text);
  const cleanTitle = cleanOfferingName(pageTitle.split(/[|—–]/)[0]);
  const weak = /^\d+(?:[.,]\d+)?\s*%$/.test(name) || name.length < 4 || /^(?:мыло|товар|продукт|услуга)$/i.test(name);
  let base = weak && isUsefulOfferingName(cleanTitle) ? cleanTitle : name;
  if (weak && base !== name && !base.toLowerCase().includes(name.toLowerCase())) base += ` ${name}`;
  if (variant && !base.toLowerCase().includes(variant.toLowerCase())) base += ` · ${variant}`;
  return cleanOfferingName(base);
}
function usableImageValue(value) {
  const candidate = clean(value);
  return candidate && !/^(?:data|blob):/i.test(candidate) && !/(?:^|[\/_-])(?:placeholder|no-image|noimage|1x1|spacer|pixel|transparent)(?:[\/_.-]|$)/i.test(candidate) ? candidate : null;
}
function absoluteImageUrl(value, base) {
  const candidate = usableImageValue(value);
  if (!candidate) return null;
  try { return new URL(candidate, base).href; } catch { return null; }
}
function imageUrl(node, base, $) {
  const images = node.find('img').get();
  for (const image of images) {
    const element = $(image);
    for (const attribute of ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-image', 'data-srcset', 'srcset', 'src']) {
      const value = element.attr(attribute);
      if (!value) continue;
      const candidates = attribute.includes('srcset') ? value.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean) : [value];
      for (const candidate of candidates.reverse()) {
        const resolved = absoluteImageUrl(candidate, base);
        if (resolved) return resolved;
      }
    }
  }
  return null;
}
function pageImageUrl($, base) {
  for (const selector of ['meta[property="og:image:secure_url"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const resolved = absoluteImageUrl($(selector).first().attr('content'), base);
    if (resolved) return resolved;
  }
  return null;
}
function coveringQuote(text, name, price) {
  const normalized = normalizeMarketText(text); const nameIndex = normalized.indexOf(normalizeMarketText(name));
  if (nameIndex < 0) return null;
  if (!price) return clean(text).slice(nameIndex, nameIndex + Math.max(name.length, 180)).slice(0, 500) || cleanOfferingName(name);
  const priceIndex = normalized.indexOf(normalizeMarketText(price)); if (priceIndex < 0) return null;
  const start = Math.min(nameIndex, priceIndex); const end = Math.max(nameIndex + name.length, priceIndex + price.length);
  if (end - start > 1200) return null;
  return clean(text).slice(start, end);
}

export function extractOfferings($, source, bodyText) {
  const found = [];
  const selector = '[itemtype*="Product"],[itemtype*="Service"],[class*="product-card"],[class*="product-item"],[class*="product__item"],[class*="category__item"],[class*="catalog-item"],[class*="catalog__item"],[class*="service-card"],[class*="service-item"],[class*="goods-item"],[class*="price-item"],[class*="card-content"],[class*="main-card"],article';
  $(selector).each((_, element) => {
    if ($(element).find(selector).length) return;
    const node = $(element); const text = elementText(node, $);
    if (text.length < 3 || text.length > 2400 || (node.is('article') && !extractPrice(text))) return;
    let name = '';
    for (const selectorPart of ['[itemprop="name"]', 'h1,h2,h3,h4', '[class*="title"],[class*="name"]']) {
      const candidates = node.find(selectorPart).get().map(child => cleanOfferingName(elementText($(child), $))).filter(isUsefulOfferingName);
      if (candidates.length) { name = candidates[0]; break; }
    }
    if (!name) name = node.find('*').filter((__, child) => $(child).children().length === 0).get().map(child => cleanOfferingName($(child).text())).find(isUsefulOfferingName) || '';
    if (!isUsefulOfferingName(name)) return;
    const priceNode = node.find('[itemprop="price"],[class*="price-current"],[class*="price-new"],[class*="actual-price"],[class*="price"],[class*="cost"]').first();
    let price = extractPrice(priceNode.text()) || extractPrice(text); let quote = coveringQuote(text, name, price);
    if (price && !quote) { price = null; quote = coveringQuote(text, name, null); }
    if (!quote) return;
    const type = clean(node.attr('itemtype')); const variant = variantFrom(text);
    found.push({ name, displayName: displayName(name, source.title, text), variant, kind: /Service/i.test(type) || /услуг|service/i.test(source.url) ? 'service' : 'product', price, image: imageUrl(node, source.url, $), quote, sourceId: source.id, sourceTitle: source.title, url: source.url });
  });
  if (!found.length) {
    $('tr').each((_, element) => {
      const node = $(element);
      const imageLink = node.find('a[href]').filter((__, anchor) => $(anchor).find('img').length > 0).first();
      if (!imageLink.length) return;
      const href = imageLink.attr('href');
      const nameLink = node.find('a[href]').filter((__, anchor) => $(anchor).attr('href') === href && isUsefulOfferingName(cleanOfferingName($(anchor).text()))).first();
      if (!nameLink.length) return;
      let url = null;
      try { const linked = new URL(href, source.url); if (linked.hostname === new URL(source.url).hostname) url = linked.href; } catch { return; }
      if (!url) return;
      const name = cleanOfferingName(nameLink.text()); const text = clean(node.find('td').map((__, cell) => clean($(cell).text())).get().filter(Boolean).join(' · ') || node.text());
      const price = extractPrice(text); const quote = coveringQuote(text, name, price) || coveringQuote(text, name, null);
      if (!quote) return;
      found.push({ name, displayName: name, variant: variantFrom(text), kind: /услуг|service/i.test(url) ? 'service' : 'product', price: quote === coveringQuote(text, name, price) ? price : null, image: imageUrl(node, source.url, $), quote, sourceId: source.id, sourceTitle: source.title, url });
    });
  }
  if (found.length === 1 && !found[0].image) found[0].image = source.pageImage || null;
  if (!found.length) {
    const name = cleanOfferingName($('h1').first().text());
    const categoryHeading = /^(?:продукция|товары|услуги|сервисы|каталог|новинки|заявка на продукцию|конфигуратор|серийные автомобили|самосвалы|седельные тягачи|бортовые автомобили|автомобили с кму|шасси|газобаллонная техника|спецавтотехника|пассажирский транспорт)$/i.test(name);
    if (!categoryHeading && isUsefulOfferingName(name) && COMMERCIAL_LINK.test(source.url)) {
      const quote = coveringQuote(bodyText, name, null);
      if (quote) found.push({ name, displayName: name, variant: '', kind: /услуг|service/i.test(source.url) ? 'service' : 'product', price: null, image: source.pageImage || null, quote, sourceId: source.id, sourceTitle: source.title, url: source.url });
    }
  }
  return dedupeOfferings(found, 60);
}

export function parsePage(html, url, id) {
  const $ = cheerio.load(html);
  const title = $('meta[property="og:site_name"]').attr('content') || $('meta[property="og:title"]').attr('content') || $('title').first().text().trim() || new URL(url).hostname;
  const siteName = clean($('meta[property="og:site_name"]').attr('content') || '');
  let organizationName = '';
  $('script[type="application/ld+json"]').each((_, element) => {
    if (organizationName) return;
    try {
      const data = JSON.parse($(element).text());
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length && !organizationName) {
        const item = stack.shift();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item['@graph'])) stack.push(...item['@graph']);
        const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : item['@type'];
        if (/Organization|Corporation|LocalBusiness/i.test(type || '') && typeof item.name === 'string') organizationName = clean(item.name);
      }
    } catch { /* Invalid structured metadata must not break page parsing. */ }
  });
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  const notPartner = (_, element) => !$(element).closest('[class*="partner" i],[id*="partner" i]').length;
  const logoNode = $('a[class*="logo" i] img,.logo img').filter(notPartner).first();
  const headerImage = $('[class*="header"] img,img[class*="logo" i],img[id*="logo" i]').filter(notPartner).first();
  const iconNode = $('link[rel*="icon" i]').first();
  const logoHref = logoNode.attr('src') || logoNode.attr('data-src') || headerImage.attr('src') || headerImage.attr('data-src') || iconNode.attr('href');
  let logo = null; try { if (logoHref) logo = new URL(logoHref, url).href; } catch { logo = null; }
  const headings = $('h1,h2,h3').map((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean).slice(0, 60);
  const links = $('a[href]').map((_, element) => ({ href: $(element).attr('href'), text: clean($(element).text()) })).get();
  $('script,style,noscript,svg,canvas,iframe,nav,footer,form,s,[aria-hidden="true"]').remove();
  const bodyText = clean($('body').text());
  const source = { id, kind: 'company-site', url, title: clean(title).slice(0, 200), siteName, organizationName, logo, pageImage: pageImageUrl($, url), contentOrigin: 'full-page', text: [description, headings.join('. '), bodyText].filter(Boolean).join('. ').replace(/\s+/g, ' ').slice(0, 32000), links, retrievedAt: new Date().toISOString() };
  source.offerings = extractOfferings($, source, bodyText);
  return source;
}

const GENERIC_COMPANY_NAMES = new Set(['ai', 'a.i.', 'ии', 'home', 'homepage', 'website', 'главная', 'официальный сайт', 'официальный']);
function siteIdentity(siteUrl) { const hostname = new URL(siteUrl).hostname.replace(/^www\./, '').toLowerCase(); const parts = hostname.split('.'); const baseHostname = parts.length > 2 ? parts.slice(-2).join('.') : hostname; return { hostname, baseHostname, brand: baseHostname.split('.')[0] || baseHostname }; }
function genericCompanyName(value) {
  const name = clean(value).toLowerCase().replace(/[«»"'“”]/g, '');
  return GENERIC_COMPANY_NAMES.has(name) || /^(?:(?:официальн[а-яё]*\s+)?сайт(?:\s+(?:компании|организации))?\s+)?(?:ооо|ао|пао|зао|ип|оао)$/.test(name);
}
const BRAND_TRANSLITERATION = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
function romanizeBrand(value) { return clean(value).toLowerCase().replace(/[а-яё]/g, letter => BRAND_TRANSLITERATION[letter]).replace(/[^a-z0-9]+/g, ''); }
function quotedBrand(source, brand) {
  const hostnameBrand = romanizeBrand(brand);
  for (const value of [source?.organizationName, source?.siteName, source?.title]) {
    const match = clean(value).match(/[«"'“]([^»"'”]{2,80})[»"'”]/);
    if (match && hostnameBrand.length >= 3 && romanizeBrand(match[1]).includes(hostnameBrand)) return clean(match[1]);
  }
  return null;
}
export function companyNameFrom(source, requestedUrl) {
  const { hostname, brand } = siteIdentity(requestedUrl);
  const brandName = brand.length <= 5 && /^[a-z0-9-]+$/i.test(brand) ? brand.toUpperCase() : brand;
  const confirmedBrand = quotedBrand(source, brand);
  if (confirmedBrand) return confirmedBrand;
  const structured = clean(source?.organizationName || source?.siteName || '').split(/[|—–·:]/)[0].trim();
  if (structured.length >= 3 && !genericCompanyName(structured)) return structured;
  const cleaned = source?.title?.split(/[|—–·:]/)[0]?.trim();
  const hostnameTitle = /^(?:www\.)?[\w.-]+\.[a-z]{2,}$/i.test(cleaned || '') || cleaned?.toLowerCase() === hostname;
  const slogan = /^(?:защитные решения|решения для|продукты для|услуги для|все для|всё для|техника для|товары для|мир |будущее |лидер )/i.test(cleaned || '');
  const suffix = source?.title?.includes('|') ? clean(source.title.split('|').at(-1)) : '';
  if (slogan && suffix.length >= 3 && suffix.length <= 80 && !genericCompanyName(suffix)) return suffix;
  if (!cleaned || cleaned.length < 3 || genericCompanyName(cleaned) || hostnameTitle || slogan) return brandName;
  return cleaned;
}
export function companyNameFromPages(sources, requestedUrl) {
  const { brand } = siteIdentity(requestedUrl);
  for (const source of sources) {
    const confirmedBrand = quotedBrand(source, brand);
    if (confirmedBrand) return confirmedBrand;
  }
  return companyNameFrom(sources[0] || {}, requestedUrl);
}
function companyTokens(company) { return company.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 10 && !['компания', 'общество', 'официальный', 'группа', 'россия'].includes(token)); }
export function companySearchName(companyName = '') {
  return clean(companyName).replace(/^(?:ООО|АО|ПАО|ЗАО|ИП|ОАО)\s+/i, '').replace(/^[«“”"']|[»“”"']$/g, '').trim() || clean(companyName);
}
export function isRelevantSearchResult(item, siteUrl, companyName = '') {
  const { hostname, baseHostname } = siteIdentity(siteUrl);
  try {
    const candidate = new URL(item.url); if (!['http:', 'https:'].includes(candidate.protocol)) return false;
    const candidateHost = candidate.hostname.replace(/^www\./, '').toLowerCase();
    if (candidateHost === hostname || candidateHost.endsWith(`.${hostname}`) || candidateHost === baseHostname || candidateHost.endsWith(`.${baseHostname}`)) return true;
    const haystack = `${item.title || ''} ${item.text || ''} ${item.url || ''}`.toLowerCase();
    if (haystack.includes(hostname) || haystack.includes(baseHostname)) return true;
    const names = [...new Set([clean(companyName), companySearchName(companyName)].map(value => value.toLowerCase()))];
    if (names.some(name => name.length >= 4 && !GENERIC_COMPANY_NAMES.has(name) && haystack.includes(name))) return true;
    const tokens = companyTokens(companyName); return tokens.length >= 2 && tokens.filter(token => haystack.includes(token)).length >= 2;
  } catch { return false; }
}
function canonicalCandidate(href, base) { try { const url = new URL(href, base); url.hash = ''; for (const key of [...url.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(key)) url.searchParams.delete(key); return url.href; } catch { return null; } }
function queueLinks(links, base, depth) {
  return links.map(link => {
    const url = canonicalCandidate(link.href, base); if (!url) return null; const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || parsed.hostname !== new URL(base).hostname) return null;
    if (/\.(?:xlsx?|docx?|pdf|zip|exe|apk|png|jpe?g|svg|webp|mp4)(?:$|\?)/i.test(url) || /login|signin|cart|checkout|личный|войти|корзин/i.test(url)) return null;
    const commercial = COMMERCIAL_LINK.test(`${url} ${link.text}`); const secondary = SECONDARY_LINK.test(`${url} ${link.text}`); const process = PROCESS_LINK.test(`${url} ${link.text}`);
    if (!commercial && !secondary && !process) return null; return { url, text: clean(link.text), depth, score: process ? 18 : commercial ? 10 : 3 };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}
const SEARCH_CACHE = new Map();
const SEARCH_CACHE_TTL = 15 * 60 * 1000;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function searchWeb(query) {
  const cached = SEARCH_CACHE.get(query);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL) return cached.items;
  let items = [];
  try {
    const result = await fetchPublic(`https://search.lumy.live/search?q=${encodeURIComponent(query)}&format=json&language=ru-RU&categories=general`);
    const data = JSON.parse(result.text);
    items = (data.results || []).map(item => ({ url: clean(item.url), title: clean(item.title).slice(0, 200), text: clean(item.content).slice(0, 3000) })).filter(item => item.url && item.title && item.text);
  } catch { /* Use the second provider when metasearch is unavailable. */ }
  if (!items.length) {
    const result = await fetchPublic(`https://www.bing.com/search?format=rss&mkt=ru-RU&cc=ru&setlang=ru&q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(result.text, { xmlMode: true });
    items = $('item').map((_, item) => ({ url: $(item).find('link').first().text().trim(), title: clean($(item).find('title').first().text()).slice(0, 200), text: clean($(item).find('description').first().text().replace(/<[^>]+>/g, ' ')).slice(0, 3000) })).get().filter(item => item.url && item.title && item.text);
  }
  if (items.length) SEARCH_CACHE.set(query, { at: Date.now(), items });
  return items;
}
function specificOffering(item) { return item.displayName?.split(/\s+/).filter(token => token.length >= 3).length >= 2 || item.name.length >= 18; }

async function searchReferenceWeb(companyName) {
  const items = [];
  try {
    const result = await fetchPublic(`https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&format=json&utf8=1&srlimit=3`);
    const data = JSON.parse(result.text);
    for (const item of data?.query?.search || []) {
      const title = clean(item.title); const text = clean(String(item.snippet || '').replace(/<[^>]+>/g, ' '));
      const directMatch = clean(companyName).length >= 4 && title.toLowerCase().includes(clean(companyName).toLowerCase());
      const latinAlias = /^[A-Z0-9-]{4,}$/.test(clean(companyName)) && item === data.query.search[0];
      if ((directMatch || latinAlias) && text) items.push({ title: `${title} — Википедия`, url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, text });
    }
  } catch { /* Reference search is optional and never blocks the company-site analysis. */ }
  return items;
}

async function searchNewsWeb(query) {
  const result = await fetchPublic(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ru&gl=RU&ceid=RU:ru`);
  const $ = cheerio.load(result.text, { xmlMode: true });
  return $('item').map((_, element) => {
    const title = clean($(element).find('title').first().text());
    const text = clean($(element).find('description').first().text().replace(/<[^>]+>/g, ' '));
    const url = clean($(element).find('link').first().text());
    const publishedAt = clean($(element).find('pubDate').first().text());
    return title && url ? { title, url, text: text || title, publishedAt: publishedAt || null } : null;
  }).get().filter(Boolean).slice(0, 6);
}

export function isReviewMaterial(item) {
  const text = `${item.title || ''} ${item.text || ''}`;
  if (/отзыв[а-яё]* сотрудник|отзыв[а-яё]* о работодател|работа в |условия труда|зарплат|карьерных возможност/i.test(text)) return false;
  if (/аналитик[аи]|продажи бренда|объ[её]м продаж/i.test(text)) return false;
  const reviewHost = /(?:^|\.)(?:irecommend\.ru|otzovik\.com)$/i.test(host(item.url));
  return /отзыв|рейтинг|оценк|review|rating/i.test(text) && (reviewHost || /\d+\s*(?:отзыв|reviews?)|\d[.,]\d\s*(?:из\s*5|оценок|рейтинг|$)|рекоменд|не рекоменд|негативн|положительн|достоинств|недостатк|плюсы|минусы|впечатлен|качество|персонал|доставк|возврат/i.test(text));
}

export async function searchPublicWeb(companyName, siteUrl, offerings, onProgress, companySources = []) {
  const { hostname, baseHostname } = siteIdentity(siteUrl); const found = new Map(); const warnings = [];
  const searchName = companySearchName(companyName);
  const add = (item, kind, offeringName = '') => { if (!item.url || found.has(item.url)) return; found.set(item.url, { ...item, id: 'web-pending', kind, offeringName: offeringName || undefined, contentOrigin: 'search-snippet', retrievedAt: new Date().toISOString() }); };
  const companyOwned = url => { try { const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); return [hostname, baseHostname].some(owned => host === owned || host.endsWith(`.${owned}`)); } catch { return true; } };
  const companySearches = [
    { query: `"${searchName}" отзывы рейтинг`, message: 'Ищу реальные отзывы и оценки' },
    { query: `"${searchName}"`, message: 'Ищу независимые упоминания о компании' },
    { query: `"${searchName}" клиенты партнеры новости`, message: 'Проверяю клиентов, партнёрства и деловой след' },
  ];
  let searches = 0;
  for (const search of companySearches) {
    try {
      if (searches++) await pause(900);
      onProgress?.({ stage: 'external', message: search.message });
      for (const item of await searchWeb(search.query)) {
        if (companyOwned(item.url) || !isRelevantSearchResult(item, siteUrl, companyName)) continue;
        add(item, isReviewMaterial(item) ? 'review-snippet' : 'search-snippet');
      }
      onProgress?.({ stage: 'external', message: `Проверено внешних материалов: ${found.size}` });
    } catch (error) { warnings.push(error.message); }
  }
  if (found.size < 4) {
    onProgress?.({ stage: 'external', message: 'Проверяю энциклопедические упоминания' });
    for (const item of await searchReferenceWeb(searchName)) {
      if (companyOwned(item.url) || !isRelevantSearchResult(item, siteUrl, companyName)) continue;
      add(item, 'search-snippet');
    }
  }
  if (![...found.values()].some(source => source.kind === 'review-snippet')) {
    try {
      if (searches++) await pause(900);
      onProgress?.({ stage: 'external', message: 'Ищу клиентский опыт на картах и отзовиках' });
      for (const item of await searchWeb(`"${searchName}" отзывы клиентов Яндекс 2ГИС`)) {
        if (companyOwned(item.url) || !isRelevantSearchResult(item, siteUrl, companyName) || !isReviewMaterial(item)) continue;
        add(item, 'review-snippet');
      }
    } catch (error) { warnings.push(error.message); }
  }
  const hasOwnText = companySources.some(source => String(source.text || '').trim().length >= 40);
  if (!hasOwnText) {
    onProgress?.({ stage: 'external', message: 'Сайт отдал мало текста: уточняю профиль по независимым упоминаниям' });
    const recognitionPages = [...found.values()].filter(source => ['search-snippet', 'review-snippet'].includes(source.kind)).slice(0, 2);
    for (const source of recognitionPages) {
      try {
        const page = await fetchPublic(source.url);
        if (/html|xhtml|text\/plain/i.test(page.contentType)) {
          source.text = parsePage(page.text, page.url, source.id).text;
          source.contentOrigin = 'full-page';
          source.retrievedAt = new Date().toISOString();
        }
      } catch { /* Keep the independent snippet when full text is unavailable. */ }
    }
  }
  const independent = [...found.values()].filter(source => ['search-snippet', 'review-snippet'].includes(source.kind));
  const recognitionSources = hasOwnText ? companySources : [...companySources, ...independent];
  const profile = createBusinessProfile({ companyName, sources: recognitionSources, offerings });
  const plan = createMarketSearchPlan({ companyName, sources: recognitionSources, offerings }, profile);
  for (const query of plan.competitorQueries) {
    try {
      if (searches++) await pause(900);
      onProgress?.({ stage: 'external', message: `Ищу прямые сайты конкурентов: ${plan.subject}` });
      let accepted = 0;
      for (const item of await searchWeb(query)) {
        if (companyOwned(item.url) || !isCompetitorCandidate(item, plan, siteUrl)) continue;
        add(item, 'competitor-candidate'); accepted += 1;
        if (accepted >= 6) break;
      }
    } catch (error) { warnings.push(error.message); }
  }
  for (const evidenceQuery of plan.evidenceQueries || []) {
    try {
      if (searches++) await pause(900);
      onProgress?.({ stage: 'external', message: evidenceQuery.message });
      let accepted = 0;
      for (const item of await searchWeb(evidenceQuery.query)) {
        if (companyOwned(item.url) || !isRelevantIndustryEvidence(item, plan, evidenceQuery.kind)) continue;
        add(item, evidenceQuery.kind); accepted += 1;
        if (accepted >= 5) break;
      }
    } catch (error) { warnings.push(error.message); }
  }
  try {
    if (searches++) await pause(900);
    onProgress?.({ stage: 'external', message: `Проверяю отраслевые новости и динамику: ${plan.subject}` });
    for (const item of await searchNewsWeb(plan.newsQuery)) { if (isRelevantMarketNews(item, plan)) add(item, 'news-snippet'); }
  } catch (error) { warnings.push(error.message); }
  const hasReviews = [...found.values()].some(source => source.kind === 'review-snippet');
  for (const offering of offerings.filter(specificOffering).slice(0, 2)) {
    const modes = hasReviews ? ['alternatives'] : ['reviews', 'alternatives'];
    for (const mode of modes) {
      try {
        if (searches++) await pause(900);
        const name = offering.displayName || offering.name; onProgress?.({ stage: 'external', message: mode === 'reviews' ? `Ищу отзывы: ${name}` : `Сравниваю предложение: ${name}` });
        const query = mode === 'reviews' ? `"${name}" отзывы цена` : `"${name}" купить цена аналог`;
        for (const item of await searchWeb(query)) {
          if (companyOwned(item.url) || !offeringMentioned(name, item)) continue;
          if (mode === 'reviews') { if (isReviewMaterial(item)) add(item, 'review-snippet', name); }
          else add(item, 'alternative-snippet', name);
        }
      } catch (error) { warnings.push(error.message); }
    }
  }
  return { sources: [...found.values()].slice(0, 40), warnings: [...new Set(warnings)], plan };
}

async function enrichExternal(external, onProgress, siteUrl, plan) {
  const alternatives = []; const identity = siteIdentity(siteUrl);
  const companyOwned = url => { try { const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); return [identity.hostname, identity.baseHostname].some(owned => host === owned || host.endsWith(`.${owned}`)); } catch { return false; } };
  const priority = { 'competitor-candidate': 0, 'review-snippet': 1, 'search-snippet': 2, 'industry-snippet': 3, 'customer-snippet': 4, 'alternative-snippet': 5, 'market-price-snippet': 6, 'news-snippet': 9 };
  const quotas = { 'competitor-candidate': 4, 'review-snippet': 3, 'alternative-snippet': 2, 'industry-snippet': 3, 'customer-snippet': 2, 'market-price-snippet': 1, 'search-snippet': 3 };
  const chosen = new Set();
  const selected = Object.entries(quotas).flatMap(([kind, limit]) => external.sources.filter(source => source.kind === kind).slice(0, limit).map(source => { chosen.add(source); return source; }));
  for (const source of [...external.sources].sort((a, b) => (priority[a.kind] ?? 5) - (priority[b.kind] ?? 5))) {
    if (selected.length >= MAX_EXTERNAL) break;
    if (source.kind !== 'news-snippet' && !chosen.has(source)) { chosen.add(source); selected.push(source); }
  }
  let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const source = selected[cursor++];
      try {
        onProgress?.({ stage: 'external', message: `Читаю внешний источник: ${source.title}` });
        const page = await fetchPublic(source.url); if (!/html|xhtml|text\/plain/i.test(page.contentType)) continue;
        if (companyOwned(page.url)) { source.discard = true; continue; }
        const parsed = parsePage(page.text, page.url, source.id); source.url = page.url;
        const readable = parsed.text.length >= 40 && !parsed.text.includes('�') && !/ничего не найдено|проверьте адрес страницы|доступ запрещ[её]н/i.test(parsed.text.slice(0, 1000));
        if (readable) {
          source.text = parsed.text;
          source.contentOrigin = 'full-page';
          source.retrievedAt = new Date().toISOString();
          if (source.kind === 'competitor-candidate') {
            if (!isCompetitorCandidate(source, plan, siteUrl) || !isCompetitorContent(source.text, plan)) { source.discard = true; continue; }
            source.competitorName = competitorNameFrom(parsed);
            source.marketQuote = relevantMarketQuote(source, plan);
            if (!source.marketQuote) { source.discard = true; continue; }
          }
          if (source.kind === 'alternative-snippet') for (const offering of parsed.offerings) alternatives.push({ ...offering, sourceTitle: source.title, offeringName: source.offeringName || null });
        }
      } catch { /* Keep the search snippet if the full page is unavailable. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, worker));
  return alternatives;
}

export async function researchCompany(input, onProgress) {
  const requestedUrl = normalizeCompanyUrl(input); onProgress?.({ stage: 'site', message: 'Открываю сайт и ищу каталог компании' });
  let homepage;
  try { homepage = await fetchPublic(requestedUrl); } catch (error) { throw new Error(researchErrorMessage(error)); }
  if (!/html|xhtml|text\/plain/i.test(homepage.contentType)) throw new Error('По адресу нет читаемой веб-страницы');
  const first = parsePage(homepage.text, homepage.url, 'site-1'); const companyName = companyNameFrom(first, requestedUrl); let companyLogo = first.logo;
  const origin = new URL(homepage.url); const sources = [{ ...first, companyName }]; delete sources[0].links;
  const queued = new Set([origin.href]); const queue = [];
  const enqueue = (links, base, depth) => { for (const candidate of queueLinks(links, base, depth)) { if (queued.has(candidate.url)) continue; queued.add(candidate.url); queue.push(candidate); } queue.sort((a, b) => a.depth - b.depth || b.score - a.score); };
  enqueue(first.links, homepage.url, 1); let deepened = false;
  while (queue.length && sources.filter(source => source.kind === 'company-site').length < MAX_PAGES) {
    const currentOfferings = dedupeOfferings(sources.flatMap(source => source.offerings || []));
    if (currentOfferings.length >= 24 && sources.length >= 12) break;
    const candidate = queue.shift(); if (candidate.depth > 1 && currentOfferings.length >= 8) continue; if (candidate.depth > 2) continue;
    try {
      onProgress?.({ stage: 'pages', message: candidate.depth === 1 ? `Открываю: ${candidate.text || new URL(candidate.url).pathname}` : `Углубляю поиск по карточкам: ${candidate.text || new URL(candidate.url).pathname}`, url: candidate.url });
      const page = await fetchPublic(candidate.url); if (!/html|xhtml|text\/plain/i.test(page.contentType)) continue;
      const parsed = parsePage(page.text, page.url, `site-${sources.filter(source => source.kind === 'company-site').length + 1}`);
      if (parsed.text.length > 100) { sources.push({ ...parsed, companyName }); if (!companyLogo && parsed.logo) companyLogo = parsed.logo; }
      if (candidate.depth > 1) deepened = true; if (currentOfferings.length < 8 && candidate.depth < 2) enqueue(parsed.links, page.url, candidate.depth + 1);
      const stored = sources.find(source => source.id === parsed.id); if (stored) delete stored.links;
    } catch { /* A secondary page must not fail the whole research. */ }
  }
  const offerings = verifyMarketItems(sources.flatMap(source => source.offerings || []), sources, 40);
  const resolvedCompanyName = companyNameFromPages(sources, homepage.url);
  sources.forEach(source => { if (source.kind === 'company-site') source.companyName = resolvedCompanyName; });
  const external = await searchPublicWeb(resolvedCompanyName, homepage.url, offerings, onProgress, sources); external.sources.forEach((source, index) => { source.id = `web-${index + 1}`; });
  const alternativesFromPages = await enrichExternal(external, onProgress, homepage.url, external.plan);
  const companyHost = siteIdentity(homepage.url).baseHostname;
  external.sources = external.sources.filter(source => !source.discard && !source.title.toLowerCase().includes(companyHost)); sources.push(...external.sources);
  const reviews = sources.filter(source => source.kind === 'review-snippet').map(source => ({ sourceId: source.id, sourceTitle: source.title, url: source.url, quote: source.text.slice(0, 900), offeringName: source.offeringName || null }));
  const competitorHosts = new Set();
  const competitors = sources.filter(source => source.kind === 'competitor-candidate').flatMap(source => {
    const hostname = siteIdentity(source.url).baseHostname;
    if (competitorHosts.has(hostname)) return [];
    competitorHosts.add(hostname);
    const name = source.competitorName || competitorNameFrom(source);
    const quote = source.marketQuote || relevantMarketQuote(source, external.plan);
    return quote ? [{ name, url: source.url, sourceId: source.id, sourceTitle: source.title, quote, subject: external.plan.subject }] : [];
  }).slice(0, 12);
  const news = sources.filter(source => source.kind === 'news-snippet').map(source => ({ title: source.title, url: source.url, sourceId: source.id, sourceTitle: source.title, quote: source.text.slice(0, 500), publishedAt: source.publishedAt || null })).slice(0, 8);
  const alternatives = [...alternativesFromPages, ...sources.filter(source => source.kind === 'alternative-snippet').map(source => ({ name: cleanOfferingName(source.title.split(/[|—–]/)[0]), displayName: cleanOfferingName(source.title.split(/[|—–]/)[0]), sourceId: source.id, sourceTitle: source.title, url: source.url, quote: source.text.slice(0, 900), price: extractPrice(source.text), offeringName: source.offeringName || null }))].slice(0, 30);
  return { requestedUrl: homepage.url, companyName: resolvedCompanyName, companyLogo, sources, offerings, reviews, competitors, news, alternatives, marketContext: { industry: external.plan.industry, subject: external.plan.subject }, coverage: { pages: sources.filter(source => source.kind === 'company-site').length, deepened, external: external.sources.length, firstExternalId: sources.length - external.sources.length }, warnings: external.warnings, createdAt: new Date().toISOString() };
}
