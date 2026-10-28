export function normalizeMarketText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

export function extractPrice(value = '') {
  const text = String(value).replace(/\s+/g, ' ').trim();
  const match = text.match(/(?:от\s+)?\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?\s*(?:₽|руб(?:\.|лей|ля)?|RUB|\$|€|USD|EUR)|(?:от\s+)?\d+(?:[.,]\d{1,2})?\s*(?:₽|руб(?:\.|лей|ля)?|RUB|\$|€|USD|EUR)/i);
  return match?.[0]?.trim().slice(0, 60) || null;
}

export function cleanOfferingName(value = '') {
  return String(value).replace(/\s+/g, ' ').replace(/^[-–—|:]+\s*/, '').trim().slice(0, 180);
}

const GENERIC_NAMES = new Set([
  'подробнее', 'узнать больше', 'купить', 'заказать', 'каталог', 'продукты', 'услуги',
  'товары', 'цены', 'главная', 'читать далее', 'перейти', 'открыть', 'все услуги', 'все товары',
  'выбор клиентов', 'выбор покупателей', 'акция', 'хит', 'скидка', 'бесплатно',
]);

export function isUsefulOfferingName(value = '') {
  const name = cleanOfferingName(value);
  return name.length >= 2 && !GENERIC_NAMES.has(name.toLowerCase()) && !/^https?:/i.test(name) && !/^(?:от\s+)?\d+(?:[.,]\d+)?\s*(?:₽|руб\.?|RUB|\$|€)$/i.test(name);
}

export function dedupeOfferings(items = [], limit = 40) {
  const byKey = new Map();
  for (const item of items) {
    const name = cleanOfferingName(item?.name);
    if (!isUsefulOfferingName(name)) continue;
    const normalizedPrice = normalizeMarketText(item.price || '').replace(/\s+/g, '');
    const variant = normalizeMarketText(item.variant || '');
    const key = `${normalizeMarketText(name)}|${variant}|${normalizedPrice}`;
    const candidate = { ...item, name, displayName: cleanOfferingName(item.displayName || name), price: item.price || null, kind: item.kind === 'service' ? 'service' : 'product' };
    const current = byKey.get(key);
    if (!current || String(candidate.quote || '').length < String(current.quote || '').length) byKey.set(key, candidate);
  }
  const values = [...byKey.values()];
  const pricedNames = new Set(values.filter(item => item.price).map(item => normalizeMarketText(`${item.name}|${item.variant || ''}`)));
  const quality = item => Number(Boolean(item.price)) * 4 + Number(Boolean(item.image)) + (/^(?:продукция|товары|продукты|услуги|сервисы|автомобиль с кму|бортовой автомобиль|самосвал|седельный тягач|серийные автомобили)$/i.test(item.displayName || item.name) ? -4 : 2);
  return values
    .filter(item => item.price || !pricedNames.has(normalizeMarketText(`${item.name}|${item.variant || ''}`)))
    .sort((a, b) => quality(b) - quality(a))
    .slice(0, limit);
}

export function verifyMarketItem(item, sources = []) {
  if (!item || !isUsefulOfferingName(item.name)) return null;
  const source = sources.find(candidate => candidate.id === item.sourceId);
  if (!source || !item.quote) return null;
  const compact = value => normalizeMarketText(value).replace(/[^\p{L}\p{N}]+/gu, '');
  const sourceText = compact(source.text);
  const quote = String(item.quote).replace(/\s+/g, ' ').trim();
  if (!sourceText.includes(compact(quote)) || !normalizeMarketText(quote).includes(normalizeMarketText(item.name))) return null;
  const price = item.price ? extractPrice(item.price) : null;
  if (item.price && (!price || !normalizeMarketText(quote).includes(normalizeMarketText(price)))) return null;
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
