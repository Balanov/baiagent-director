export function normalizeMarketText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

const PRICE_PATTERN = /(?:от\s+)?(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:₽|руб(?:\.|лей|ля)?|RUB|\$|€|USD|EUR)/gi;

function priceCandidates(value = '') {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return [...text.matchAll(PRICE_PATTERN)].map(match => match[0].trim().slice(0, 60));
}

export function extractPrice(value = '') {
  const text = String(value).replace(/\s+/g, ' ').trim();
  const candidates = priceCandidates(text);
  if (!candidates.length) return null;
  return (candidates.length > 1 && /\d+(?:[.,]\d+)?\s*%/.test(text) ? candidates.at(-1) : candidates[0]) || null;
}

function priceSignature(value = '') {
  const price = extractPrice(value);
  if (!price) return null;
  const currency = /₽|руб|RUB/i.test(price) ? 'RUB' : /\$|USD/i.test(price) ? 'USD' : /€|EUR/i.test(price) ? 'EUR' : '';
  const amount = price.replace(/^от\s+/i, '').replace(/(?:₽|руб(?:\.|лей|ля)?|RUB|\$|€|USD|EUR)\s*$/i, '').replace(/\s/g, '').replace(',', '.');
  return amount && currency ? `${amount}|${currency}` : null;
}

export function cleanOfferingName(value = '') {
  let name = String(value).replace(/\s+/g, ' ').replace(/^[-–—|:]+\s*/, '').trim();
  name = name.replace(/(?:\s*(?:доступны\s+)?опции\s+под\s+заказ)+$/gi, '').trim();
  name = name.replace(/\bpart\s+of\s+[\p{L}\p{N}-]+\s+collection\b/giu, ' ').replace(/\s+/g, ' ').replace(/^[-–—|:]+\s*|[-–—|:]+\s*$/g, '').trim();
  const repeatedWithSpace = name.match(/^(.{2,}?)\s+\1$/i);
  if (repeatedWithSpace) name = repeatedWithSpace[1].trim();
  if (name.length >= 4 && name.length % 2 === 0) {
    const half = name.length / 2;
    if (name.slice(0, half).toLowerCase() === name.slice(half).toLowerCase()) name = name.slice(0, half).trim();
  }
  return name.slice(0, 180);
}

const GENERIC_NAMES = new Set([
  'подробнее', 'узнать больше', 'купить', 'заказать', 'каталог', 'продукты', 'услуги',
  'товары', 'цены', 'главная', 'читать далее', 'перейти', 'открыть', 'все услуги', 'все товары',
  'выбор клиентов', 'выбор покупателей', 'акция', 'хит', 'скидка', 'бесплатно',
  'как сдать анализы', 'доступные анализы', 'больше об омс', 'правовая информация',
  'лицензии рф и еаэс', 'собственные научные базы', 'как мы работаем', 'отправить заявку',
  'заказать прайс-лист', 'о компании', 'контакты', 'новости', 'вакансии', 'доставка и оплата',
  'learn more', 'read more', 'get started', 'contact us', 'sign up', 'log in', 'request a demo', 'products', 'services',
  'shop now', 'buy now', 'advanced search', 'product registration', 'add to wish list', 'add to wishlist', 'register product', 'service request', 'find a store', 'new products', 'best sellers',
  'english', '中文', 'español', 'हिन्दी', 'العربية', 'en', 'es', 'zh', 'hi', 'ar',
  '了解更多', '更多', '报装报修', '售后服务', '在线客服', '美的业务', 'our businesses',
]);

const NON_OFFERING_NAME = /^(?:(?:заказать|отправить|оставить|получить|оформить|записаться|подписаться|скачать|перейти|узнать)(?=\s|$)|(?:правовая|юридическая)\s+информация(?=\s|$)|лицензи[ияи](?=\s|$)|политика\s+конфиденциальности(?=\s|$)|условия\s+(?:использования|работы)(?=\s|$)|как\s+(?:мы\s+работаем|сдать|подготовиться|оформить)(?=\s|$)|больше\s+об\s+омс(?=\s|$)|отзывы(?=\s|$)|reviews?\b|报装|报修|售后|预约|在线客服|[^\n]{0,40}查询$)/i;
const ADDRESS_NAME = /(?:^|[\s,])(?:г\.\s*[«\p{L}]|(?:(?:ул|наб)\.?\s+|улица\s+|проспект\s+|пр-т\s+|шоссе\s+|переулок\s+)[«\p{L}\d-]|д\.\s*\d)/iu;

export function isUsefulOfferingName(value = '') {
  const name = cleanOfferingName(value);
  return name.length >= 2 && !GENERIC_NAMES.has(name.toLowerCase()) && !NON_OFFERING_NAME.test(name) && !ADDRESS_NAME.test(name) && !/^https?:/i.test(name) && !/^(?:от\s+)?\d+(?:[.,]\d+)?\s*(?:₽|руб\.?|RUB|\$|€)$/i.test(name);
}

function directOfferingUrl(item) {
  try {
    const url = new URL(item?.url);
    if (!/^https?:$/.test(url.protocol)) return '';
    url.hash = '';
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    if (!path || /\/(?:catalog|catalogue|shop|store|каталог)(?:\/[^/]+)?$/i.test(path) || /\/(?:software|products?|services?|solutions?|platform|menu)$/i.test(path)) return '';
    return url.href;
  } catch { return ''; }
}

function offeringQuality(item) {
  return Number(Boolean(item.price)) * 4 + Number(Boolean(item.image)) + Number(Boolean(directOfferingUrl(item))) * 2 + (/^(?:продукция|товары|продукты|услуги|сервисы|автомобиль с кму|бортовой автомобиль|самосвал|седельный тягач|серийные автомобили)$/i.test(item.displayName || item.name) ? -4 : 2);
}

function mergeOfferings(current, candidate) {
  const best = offeringQuality(candidate) > offeringQuality(current) ? candidate : current;
  const other = best === current ? candidate : current;
  const merged = { ...other, ...best, image: best.image || other.image || null, price: best.price || other.price || null };
  if (!directOfferingUrl(merged) && directOfferingUrl(other)) merged.url = other.url;
  const quotes = [current.quote, candidate.quote].filter(Boolean).filter(quote => !merged.price || priceSignature(quote) === priceSignature(merged.price));
  if (quotes.length) merged.quote = quotes.sort((a, b) => String(a).length - String(b).length)[0];
  return merged;
}

export function dedupeOfferings(items = [], limit = 40) {
  const values = [];
  for (const item of items) {
    const name = cleanOfferingName(item?.name);
    if (!isUsefulOfferingName(name)) continue;
    const candidate = { ...item, name, displayName: cleanOfferingName(item.displayName || name), price: item.price || null, kind: item.kind === 'service' ? 'service' : 'product' };
    const duplicateIndex = values.findIndex(current => {
      const currentPrice = priceSignature(current.price || ''); const candidatePrice = priceSignature(candidate.price || '');
      if (currentPrice && candidatePrice && currentPrice !== candidatePrice) return false;
      const currentUrl = directOfferingUrl(current); const candidateUrl = directOfferingUrl(candidate);
      if (currentUrl && candidateUrl && currentUrl === candidateUrl) return true;
      return normalizeMarketText(current.name) === normalizeMarketText(candidate.name)
        && normalizeMarketText(current.variant || '') === normalizeMarketText(candidate.variant || '')
        && (currentPrice === candidatePrice || !currentPrice || !candidatePrice);
    });
    if (duplicateIndex < 0) values.push(candidate);
    else values[duplicateIndex] = mergeOfferings(values[duplicateIndex], candidate);
  }
  return values.sort((a, b) => offeringQuality(b) - offeringQuality(a)).slice(0, limit);
}

export function verifyMarketItem(item, sources = []) {
  if (!item || !isUsefulOfferingName(item.name)) return null;
  const source = sources.find(candidate => candidate.id === item.sourceId);
  if (!source || !item.quote) return null;
  const compact = value => normalizeMarketText(value).replace(/[^\p{L}\p{N}]+/gu, '');
  const sourceText = compact(source.text);
  const quote = String(item.quote).replace(/\s+/g, ' ').trim();
  if (!sourceText.includes(compact(quote)) || !normalizeMarketText(quote).includes(normalizeMarketText(item.name))) return null;
  const requestedPrice = item.price ? extractPrice(item.price) : null;
  const price = requestedPrice && priceSignature(quote) === priceSignature(requestedPrice) ? requestedPrice : null;
  const displayName = cleanOfferingName(item.displayName || item.name);
  const variant = cleanOfferingName(item.variant || '');
  for (const token of [displayName, variant]) {
    if (!token) continue;
    const factualTokens = token.replace(/[«»„“”"'()[\]{}.,:;!?·]/g, ' ').split(/\s+/).filter(part => part.length >= 2);
    if (!factualTokens.every(part => normalizeMarketText(`${quote} ${source.title}`).includes(normalizeMarketText(part)))) return null;
  }
  let url = source.url;
  try {
    const candidate = new URL(item.url || source.url, source.url);
    if (candidate.hostname === new URL(source.url).hostname && ['http:', 'https:'].includes(candidate.protocol)) url = candidate.href;
  } catch { /* The source page remains the verified fallback URL. */ }
  return {
    name: cleanOfferingName(item.name), displayName: displayName || cleanOfferingName(item.name), variant,
    kind: item.kind === 'service' ? 'service' : 'product', price,
    image: item.image && /^https:\/\//i.test(item.image) ? item.image : null,
    sourceId: source.id, sourceTitle: source.title, url, quote,
  };
}

export function verifyMarketItems(items = [], sources = [], limit = 40) {
  return dedupeOfferings(items.map(item => verifyMarketItem(item, sources)).filter(Boolean), limit);
}

export function offeringMentioned(offeringName, item) {
  const name = normalizeMarketText(offeringName);
  const haystack = normalizeMarketText(`${item?.title || ''} ${item?.text || ''}`);
  if (name.length < 5 || haystack.length < name.length) return false;
  if (haystack.includes(name)) return true;
  const tokens = name.replace(/[«»„“”"'()[\]{}.,:;!?]/g, ' ').split(/\s+/).filter(token => token.length >= 5);
  return tokens.length >= 2 && tokens.slice(0, 3).every(token => haystack.includes(token));
}
