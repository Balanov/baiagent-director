<?php
declare(strict_types=1);
require_once __DIR__ . '/market.php';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
ini_set('display_errors', '0');
set_time_limit(150);
const MAX_BYTES = 3000000;
const MAX_PAGES = 24;
const MAX_EXTERNAL = 18;

function encode_json(mixed $value): string {
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
}
function fail(string $message, int $status = 400): void { http_response_code($status); echo encode_json(['error' => $message]); exit; }
function rate_limit(): void {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = sys_get_temp_dir() . '/baiagent-research-' . hash('sha256', $ip) . '.json';
    $handle = @fopen($file, 'c+'); if (!$handle) return;
    if (!@flock($handle, LOCK_EX)) { fclose($handle); return; }
    $now = time(); $raw = stream_get_contents($handle); $state = $raw ? json_decode($raw, true) : null;
    if (!is_array($state) || ($state['start'] ?? 0) <= $now - 600) $state = ['start' => $now, 'count' => 0];
    if (($state['count'] ?? 0) >= 30) { flock($handle, LOCK_UN); fclose($handle); header('Retry-After: 600'); fail('Слишком много запросов. Попробуйте через несколько минут.', 429); }
    $state['count']++;
    rewind($handle); ftruncate($handle, 0); fwrite($handle, json_encode($state)); fflush($handle);
    flock($handle, LOCK_UN); fclose($handle);
    header('X-RateLimit-Limit: 30'); header('X-RateLimit-Remaining: ' . max(0, 30 - $state['count']));
}
function normalize_url(string $input): string {
    $input = trim($input);
    if ($input === '') fail('Укажите сайт компании');
    if (!preg_match('~^https?://~i', $input)) $input = 'https://' . $input;
    $parts = parse_url($input);
    if (!$parts || empty($parts['host']) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass'])) fail('Нужен обычный публичный адрес сайта');
    if (!in_array((string)($parts['port'] ?? ''), ['', '80', '443'], true)) fail('Нестандартные порты не используются');
    return $input;
}
function public_host(string $host): bool {
    if (filter_var($host, FILTER_VALIDATE_IP)) return (bool)filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    $records = @dns_get_record($host, DNS_A + DNS_AAAA) ?: [];
    if (!$records) return false;
    foreach ($records as $record) {
        $ip = $record['ip'] ?? $record['ipv6'] ?? '';
        if ($ip && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
    }
    return true;
}
function research_time_remaining(): float {
    if (!isset($GLOBALS['research_deadline'])) $GLOBALS['research_deadline'] = microtime(true) + 110.0;
    return $GLOBALS['research_deadline'] - microtime(true);
}
function research_budget(int $reserve = 0): bool { return research_time_remaining() <= $reserve; }
function fetch_public(string $url, int $redirects = 0): array {
    if ($redirects > 5) throw new RuntimeException('Слишком много перенаправлений');
    if (research_budget(1)) throw new RuntimeException('Источник пропущен: достигнут общий лимит времени исследования');
    $parts = parse_url($url);
    if (!$parts || empty($parts['host']) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass']) || !in_array((string)($parts['port'] ?? ''), ['', '80', '443'], true) || !public_host($parts['host'])) throw new RuntimeException('Источник не относится к публичной сети');
    $timeout = max(1, min(12, (int)ceil(research_time_remaining() - 1)));
    $body = ''; $tooLarge = false; $location = '';
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => false, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => min(6, $timeout), CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,application/rss+xml,application/xml,text/xml;q=0.9', 'Accept-Language: ru-RU,ru;q=0.9,en;q=0.7'],
        CURLOPT_HEADERFUNCTION => function($ch, $header) use (&$location) { if (stripos($header, 'Location:') === 0) $location = trim(substr($header, 9)); return strlen($header); },
        CURLOPT_WRITEFUNCTION => function($ch, $chunk) use (&$body, &$tooLarge) { if (strlen($body) + strlen($chunk) > MAX_BYTES) { $tooLarge = true; return 0; } $body .= $chunk; return strlen($chunk); },
    ]);
    $ok = curl_exec($curl);
    if ($tooLarge) { curl_close($curl); throw new RuntimeException('Источник слишком большой'); }
    if ($ok === false) { $message = curl_error($curl); curl_close($curl); throw new RuntimeException($message ?: 'Не удалось открыть источник'); }
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE); $type = curl_getinfo($curl, CURLINFO_CONTENT_TYPE) ?: ''; curl_close($curl);
    if (in_array($status, [301,302,303,307,308], true)) {
        if (!$location) throw new RuntimeException('Перенаправление без адреса');
        $target = absolute_url($location, $url); if (!$target) throw new RuntimeException('Недопустимое перенаправление');
        return fetch_public($target, $redirects + 1);
    }
    if ($status < 200 || $status >= 300) throw new RuntimeException('HTTP ' . $status);
    $charset = preg_match('/charset\s*=\s*["\']?([\w-]+)/i', $type, $match) ? $match[1] : (preg_match('/<meta[^>]+charset\s*=\s*["\']?([\w-]+)/i', substr($body, 0, 8192), $match) ? $match[1] : 'UTF-8');
    if (!preg_match('/^utf-?8$/i', $charset)) $body = function_exists('mb_convert_encoding') ? mb_convert_encoding($body, 'UTF-8', $charset) : iconv($charset, 'UTF-8//IGNORE', $body);
    return ['url' => $url, 'type' => $type, 'body' => $body];
}
function clean_text(string $value): string { return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? ''); }
function element_text(DOMXPath $xpath, DOMElement $element): string {
    $copy = $element->cloneNode(true);
    foreach ($xpath->query('.//br', $copy) as $break) $break->parentNode?->replaceChild($copy->ownerDocument->createTextNode(' '), $break);
    foreach ($xpath->query('.//*', $copy) as $node) {
        $node->insertBefore($copy->ownerDocument->createTextNode(' '), $node->firstChild);
        $node->appendChild($copy->ownerDocument->createTextNode(' '));
    }
    return clean_text($copy->textContent);
}
function limit_text(string $value, int $length): string { return function_exists('mb_substr') ? mb_substr($value, 0, $length) : substr($value, 0, $length); }
function lower_text(string $value): string { return function_exists('mb_strtolower') ? mb_strtolower($value) : strtolower($value); }
function price_pattern(): string {
    return '/(?:от\s+)?\d{1,3}(?:[ \x{00A0}]\d{3})+(?:[.,]\d{1,2})?\s*(?:\x{20BD}|руб(?:\.|лей|ля)?|RUB|\$|€|USD|EUR)|(?:от\s+)?\d+(?:[.,]\d{1,2})?\s*(?:\x{20BD}|руб(?:\.|лей|ля)?|RUB|\$|€|USD|EUR)/iu';
}
function extract_price(string $value): ?string {
    return preg_match(price_pattern(), $value, $match) ? limit_text(trim($match[0]), 60) : null;
}
function price_near_name(string $text, string $name): ?string {
    if (!preg_match_all(price_pattern(), $text, $matches, PREG_OFFSET_CAPTURE)) return null;
    $names = []; $offset = 0;
    while (($at = strpos($text, $name, $offset)) !== false && count($names) < 80) { $names[] = $at; $offset = $at + strlen($name); }
    $best = null; $span = 1801;
    foreach ($matches[0] as $match) {
        $price = trim($match[0]); $priceAt = $match[1];
        foreach ($names as $nameAt) {
            $candidateSpan = max($nameAt + strlen($name), $priceAt + strlen($price)) - min($nameAt, $priceAt);
            if ($candidateSpan < $span) { $best = $price; $span = $candidateSpan; }
        }
    }
    return $best;
}
function offering_name(string $value): string {
    $value = trim(preg_replace('/^[-–—|:]+\s*/u', '', clean_text($value)) ?? '');
    if (preg_match('/^(.{3,100}?)\1$/u', $value, $match)) $value = $match[1];
    return limit_text($value, 180);
}
function useful_offering(string $name): bool {
    return strlen($name) >= 2 && !in_array(lower_text($name), ['подробнее','узнать больше','купить','заказать','каталог','продукты','услуги','товары','цены','главная','читать далее','перейти','открыть','все услуги','все товары','выбор клиентов','выбор покупателей','акция','хит','скидка','бесплатно'], true) && !preg_match('/^(?:от\s+)?\d+(?:[.,]\d+)?\s*(?:\x{20BD}|руб\.?|RUB|\$|€)$/iu', $name);
}
function covering_quote(string $text, string $name, ?string $price): ?string {
    $nameAt = strpos($text, $name); if ($nameAt === false) return null;
    if (!$price) return limit_text(substr($text, $nameAt, max(strlen($name), 180)), 500);
    $names = []; $prices = []; $offset = 0;
    while (($at = strpos($text, $name, $offset)) !== false && count($names) < 80) { $names[] = $at; $offset = $at + strlen($name); }
    $offset = 0;
    while (($at = strpos($text, $price, $offset)) !== false && count($prices) < 80) { $prices[] = $at; $offset = $at + strlen($price); }
    $start = 0; $end = 0; $span = 1801;
    foreach ($names as $nameOffset) foreach ($prices as $priceOffset) {
        $candidateStart = min($nameOffset, $priceOffset);
        $candidateEnd = max($nameOffset + strlen($name), $priceOffset + strlen($price));
        if ($candidateEnd - $candidateStart < $span) { $start = $candidateStart; $end = $candidateEnd; $span = $candidateEnd - $candidateStart; }
    }
    if ($span > 1800) return null;
    return clean_text(substr($text, $start, $end - $start));
}
function variant_from(string $text): string {
    return preg_match('/(?:вес|объ[её]м|объем)\s*:?[ ]*(\d+(?:[.,]\d+)?\s*(?:кг|мл|kg|ml|г|л|g|l))(?![\p{L}])/iu', $text, $match) ? clean_text($match[1]) : '';
}
function display_name(string $name, string $pageTitle, string $text): string {
    $variant = variant_from($text); $cleanTitle = offering_name(preg_split('/[|—–]/u', $pageTitle)[0]);
    $weak = preg_match('/^\d+(?:[.,]\d+)?\s*%$/u', $name) || strlen($name) < 4 || preg_match('/^(?:мыло|товар|продукт|услуга)$/iu', $name);
    $base = $weak && useful_offering($cleanTitle) ? $cleanTitle : $name;
    if ($weak && $base !== $name && !str_contains(lower_text($base), lower_text($name))) $base .= ' ' . $name;
    if ($variant && !str_contains(lower_text($base), lower_text($variant))) $base .= ' · ' . $variant;
    return offering_name($base);
}
function usable_image_value(string $value): ?string {
    $candidate = trim($value);
    if ($candidate === '' || preg_match('~^(data:|blob:)~i', $candidate) || preg_match('~(?:^|[/_-])(?:placeholder|no-image|noimage|1x1|spacer|pixel|transparent)(?:[/_.-]|$)~i', $candidate)) return null;
    return $candidate;
}
function image_url(DOMXPath $xpath, DOMElement $card, string $base): ?string {
    foreach ($xpath->query('.//img', $card) as $image) {
        foreach (['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-image', 'data-srcset', 'srcset', 'src'] as $attribute) {
            $value = trim($image->getAttribute($attribute)); if ($value === '') continue;
            $candidates = str_contains($attribute, 'srcset') ? array_reverse(preg_split('/\s*,\s*/', $value)) : [$value];
            foreach ($candidates as $candidate) {
                if (str_contains($attribute, 'srcset')) $candidate = trim(preg_split('/\s+/', trim($candidate))[0] ?? '');
                $usable = usable_image_value($candidate); if (!$usable) continue;
                $resolved = absolute_url($usable, $base); if ($resolved) return $resolved;
            }
        }
    }
    return null;
}
function page_image_url(DOMXPath $xpath, string $base): ?string {
    foreach ($xpath->query('//meta[@property="og:image:secure_url"]|//meta[@property="og:image"]|//meta[@name="twitter:image"]') as $meta) {
        $usable = usable_image_value($meta->getAttribute('content')); if (!$usable) continue;
        $resolved = absolute_url($usable, $base); if ($resolved) return $resolved;
    }
    return null;
}
function offering_url(DOMXPath $xpath, DOMElement $card, string $base, string $name): ?string {
    $expected = lower_text(clean_text($name)); $candidates = []; $anchors = [];
    $parent = $xpath->query('ancestor-or-self::a[@href][1]', $card)->item(0); if ($parent) $anchors[] = $parent;
    foreach ($xpath->query('.//a[@href]', $card) as $anchor) $anchors[] = $anchor;
    foreach ($anchors as $anchor) {
        $linked = absolute_url($anchor->getAttribute('href'), $base); if (!$linked || parse_url($linked, PHP_URL_HOST) !== parse_url($base, PHP_URL_HOST)) continue;
        $text = offering_name(element_text($xpath, $anchor) ?: ($xpath->query('.//img', $anchor)->item(0)?->getAttribute('alt') ?? ''));
        if (!useful_offering($text)) continue;
        $normalized = lower_text($text); $exact = $normalized === $expected; $contains = strlen($expected) >= 4 && str_contains($normalized, $expected);
        $shorter = strlen($normalized) >= 4 && str_contains($expected, $normalized) && (strlen($normalized) >= strlen($expected) * .5 || count(preg_split('/\s+/u', $normalized)) >= 2);
        if ($exact || $contains || $shorter) $candidates[] = ['url' => $linked, 'score' => $exact ? 0 : abs(strlen($normalized) - strlen($expected)) + 1];
    }
    usort($candidates, fn($a, $b) => $a['score'] <=> $b['score']); return $candidates[0]['url'] ?? null;
}
function marketplace_categories(DOMXPath $xpath, string $id, string $url, string $title): array {
    $items = [];
    foreach ($xpath->query('//*[@data-shmid="category_name"]|//*[@data-category-name]|//*[@itemprop="category"]') as $node) {
        $name = offering_name(element_text($xpath, $node)); $container = $node->parentNode; if (!$container instanceof DOMElement) continue;
        $quote = element_text($xpath, $container);
        if (!useful_offering($name) || strlen($name) > 140 || !$quote || strlen($quote) > 640) continue;
        $linked = $url; $anchor = $xpath->query('ancestor::a[@href][1]', $node)->item(0);
        if ($anchor) { $candidate = absolute_url($anchor->getAttribute('href'), $url); if ($candidate && parse_url($candidate, PHP_URL_HOST) === parse_url($url, PHP_URL_HOST)) $linked = $candidate; }
        $key = lower_text($name); $items[$key] = ['name' => $name, 'displayName' => $name, 'variant' => '', 'kind' => 'service', 'price' => null, 'image' => image_url($xpath, $container, $url), 'quote' => $quote, 'sourceId' => $id, 'sourceTitle' => $title, 'url' => $linked];
    }
    return count($items) >= 2 ? array_values($items) : [];
}
function confirmed_name(string $text, string $hint): ?string {
    if (!$hint) return null;
    $pattern = '~(?:^|[^\p{L}\p{N}])(' . str_replace(' ', '[ -]+', preg_quote($hint, '~')) . ')(?=$|[^\p{L}\p{N}])~iu';
    return preg_match($pattern, clean_text($text), $match) ? offering_name($match[1]) : null;
}
function path_product_hints(string $url): array {
    $generic = ['software','product','products','service','services','solution','solutions','platform','ecosystem','enterprise','b2b','b2c','menu','catalog','catalogue','category','categories','store','collection','collections','dev','business','academic','resources','resource','library','learning','curriculum'];
    $segments = preg_split('~/+~', rawurldecode((string)(parse_url($url, PHP_URL_PATH) ?: '')), -1, PREG_SPLIT_NO_EMPTY) ?: []; $hints = [];
    foreach (array_reverse($segments) as $segment) {
        $hint = offering_name(str_replace(['-','_','+'], ' ', $segment));
        if (strlen($hint) >= 2 && !in_array(lower_text($hint), $generic, true) && !preg_match('~^[a-z]{2}(?:-[a-z]{2})?$~i', $hint)) $hints[] = $hint;
    }
    return $hints;
}
function extract_offerings(DOMXPath $xpath, string $body, string $id, string $url, string $title, ?string $pageImage = null, string $pageType = 'webpage', bool $explicitStructured = false): array {
    if (preg_match('~(?:^|/)(?:reviews?|otzyvy|отзывы)(?:/|$)~i', rawurldecode((string)(parse_url($url, PHP_URL_PATH) ?: '')))) return [];
    $categories = marketplace_categories($xpath, $id, $url, $title);
    if (preg_match_all('~детали\s+задачи|task details~iu', $body) >= 2) return $categories;
    $path = rawurldecode((string)(parse_url($url, PHP_URL_PATH) ?: ''));
    if (!$explicitStructured && preg_match('~(?:^|/)(?:ecosystem|partners?|stores?|locations?|pickup-points?|academic|resources?|library|asset-library|learning|curriculum|collections?|enterprise)(?:/|$)~i', $path)) return [];
    $condition = 'self::article or contains(@itemtype,"Product") or contains(@itemtype,"Service") or contains(@class,"product-card") or contains(@class,"product-item") or contains(@class,"product__item") or contains(@class,"category__item") or contains(@class,"catalog-item") or contains(@class,"catalog__item") or contains(@class,"service-card") or contains(@class,"service-item") or contains(@class,"goods-item") or contains(@class,"price-item") or contains(@class,"card-content") or contains(@class,"main-card")';
    $selector = '//*[' . $condition . ']'; $items = []; $seen = [];
    $commercialPath = (bool)preg_match('~catalog|shop|store|product|goods|service|solution|software|platform|system|price|pricing|каталог|товар|продукт|услуг|сервис|программ|систем|цен|прайс|стоимост~iu', $path);
    $hasCommercialCards = (bool)$xpath->query('//*[contains(@itemtype,"Product") or contains(@itemtype,"Service") or contains(@class,"product-card") or contains(@class,"product-item") or contains(@class,"product__item") or contains(@class,"category__item") or contains(@class,"catalog-item") or contains(@class,"catalog__item") or contains(@class,"service-card") or contains(@class,"service-item") or contains(@class,"goods-item") or contains(@class,"price-item") or contains(@class,"card-content") or contains(@class,"main-card")]')->length;
    if ($pageType === 'article' && !$explicitStructured && !($commercialPath && $hasCommercialCards)) return [];
    foreach ($xpath->query($selector) as $card) {
        if ($xpath->query('.' . $selector, $card)->length > 0) continue;
        if ($xpath->query('ancestor::*[contains(translate(@class,"PARTNER","partner"),"partner") or contains(translate(@class,"ECOSYSTEM","ecosystem"),"ecosystem")]', $card)->length) continue;
        $text = element_text($xpath, $card);
        $commercialArticle = (bool)($xpath->query('ancestor-or-self::*[contains(@class,"product-card") or contains(@class,"product-item") or contains(@class,"catalog-item") or contains(@class,"service-card")]', $card)->length || preg_match('~catalog|shop|product|service|каталог|товар|услуг~iu', $xpath->query('ancestor-or-self::a[@href][1]', $card)->item(0)?->getAttribute('href') ?? ''));
        if (strlen($text) < 3 || strlen($text) > 4800 || ($card->tagName === 'article' && !extract_price($text) && !$commercialArticle)) continue;
        $name = '';
        foreach (['.//*[@itemprop="name"]', './/h1|.//h2|.//h3|.//h4', './/*[contains(@class,"title")]|.//*[contains(@class,"name")]'] as $query) {
            foreach ($xpath->query($query, $card) as $node) { $candidate = offering_name(element_text($xpath, $node)); if (useful_offering($candidate)) { $name = $candidate; break 2; } }
        }
        if (!$name) foreach ($xpath->query('.//*[not(*)]', $card) as $leaf) { $candidate = offering_name($leaf->textContent); if (useful_offering($candidate)) { $name = $candidate; break; } }
        if (!useful_offering($name)) continue;
        $linked = offering_url($xpath, $card, $url, $name);
        $priceNode = $xpath->query('.//*[@itemprop="price"]|.//*[contains(@class,"price-current")]|.//*[contains(@class,"price-new")]|.//*[contains(@class,"actual-price")]|.//*[contains(@class,"price")]|.//*[contains(@class,"cost")]', $card)->item(0);
        $price = extract_price($priceNode ? element_text($xpath, $priceNode) . ' ' . $priceNode->getAttribute('content') : '') ?: extract_price($text); $quote = covering_quote($text, $name, $price);
        if ($price && !$quote) { $price = null; $quote = covering_quote($text, $name, null); }
        if (!$quote || (!$price && (strlen($name) > 320 || (count(preg_split('/\s+/u', $name)) >= 10 && preg_match('/[.!?]$/u', $name))))) continue;
        $variant = variant_from($text); $normalizedPrice = preg_replace('/\s+/u', '', strtolower((string)$price));
        $key = lower_text($name) . '|' . lower_text($variant) . '|' . $normalizedPrice; if (isset($seen[$key])) continue; $seen[$key] = true;
        $items[] = ['name' => $name, 'displayName' => display_name($name, $title, $text), 'variant' => $variant, 'kind' => preg_match('~услуг|service~i', $url) ? 'service' : 'product', 'price' => $price, 'image' => image_url($xpath, $card, $url), 'quote' => $quote, 'sourceId' => $id, 'sourceTitle' => $title, 'url' => $linked ?: $url];
    }
    if (!$items && $pageType !== 'article') $items = $categories;
    if (!$items && $pageType !== 'article') {
        foreach ($xpath->query('//tr') as $row) {
            $imageLink = $xpath->query('.//a[@href][.//img]', $row)->item(0); if (!$imageLink) continue;
            $href = $imageLink->getAttribute('href'); $linked = absolute_url($href, $url);
            if (!$linked || parse_url($linked, PHP_URL_HOST) !== parse_url($url, PHP_URL_HOST)) continue;
            $name = '';
            foreach ($xpath->query('.//a[@href]', $row) as $anchor) {
                if ($anchor->getAttribute('href') !== $href) continue;
                $candidate = offering_name($anchor->textContent); if (useful_offering($candidate)) { $name = $candidate; break; }
            }
            if (!useful_offering($name)) continue;
            $cells = []; foreach ($xpath->query('.//td', $row) as $cell) { $value = clean_text($cell->textContent); if ($value !== '') $cells[] = $value; }
            $text = clean_text(implode(' · ', $cells) ?: $row->textContent); $price = extract_price($text); $quote = covering_quote($text, $name, $price);
            if ($price && !$quote) { $price = null; $quote = covering_quote($text, $name, null); }
            if (!$quote) continue;
            $items[] = ['name' => $name, 'displayName' => $name, 'variant' => variant_from($text), 'kind' => preg_match('~услуг|service~i', $linked) ? 'service' : 'product', 'price' => $price, 'image' => image_url($xpath, $row, $url), 'quote' => $quote, 'sourceId' => $id, 'sourceTitle' => $title, 'url' => $linked];
        }
    }
    if (count($items) === 1 && empty($items[0]['image'])) $items[0]['image'] = $pageImage;
    if (!$items && $pageType !== 'article') {
        $name = offering_name($xpath->query('//h1')->item(0)?->textContent ?? '');
        $categoryHeading = preg_match('~^(?:продукция|товары|услуги|сервисы|каталог|новинки|заявка на продукцию|конфигуратор|серийные автомобили|самосвалы|седельные тягачи|бортовые автомобили|автомобили с кму|шасси|газобаллонная техника|спецавтотехника|пассажирский транспорт)$~iu', $name);
        if (!$categoryHeading && useful_offering($name) && strpos($body, $name) !== false && $commercialPath) {
            $detailPage = preg_match('~/(?:product|goods|item|service|usluga)[/_-]~iu', $url) && !preg_match('~/(?:otzyvy|reviews?)(?:/|$)~iu', $url);
            $price = $detailPage ? price_near_name($body, $name) : null;
            $quote = $price ? covering_quote($body, $name, $price) : null;
            if ($price && !$quote) $price = null;
            if ($price) $price = preg_replace('/[ \x{00A0}]+(?=\x{20BD})/u', '', $price);
            $items[] = ['name' => $name, 'displayName' => $name, 'variant' => '', 'kind' => preg_match('~услуг|service~i', $url) ? 'service' : 'product', 'price' => $price, 'image' => $pageImage, 'quote' => $quote ?: covering_quote($body, $name, null) ?: $name, 'sourceId' => $id, 'sourceTitle' => $title, 'url' => $url];
        }
    }
    if (count($items) === 1 && empty($items[0]['price']) && $commercialPath) {
        $canonical = null; $metadata = $title . ' ' . $body;
        foreach (path_product_hints($url) as $hint) { $candidate = confirmed_name($metadata, $hint); if ($candidate && useful_offering($candidate)) { $canonical = $candidate; break; } }
        if ($canonical) {
            $quote = covering_quote($body, $canonical, null);
            if ($quote) { $items[0]['name'] = $canonical; $items[0]['displayName'] = $canonical; $items[0]['quote'] = $quote; }
        }
    }
    return array_slice($items, 0, 60);
}
function structured_type(array $item): string { $type = $item['@type'] ?? ''; return is_array($type) ? implode(' ', $type) : (string)$type; }
function structured_items(DOMXPath $xpath): array {
    $items = [];
    foreach ($xpath->query('//script[@type="application/ld+json"]') as $script) {
        try {
            $data = json_decode($script->textContent, true, 512, JSON_THROW_ON_ERROR); $queue = is_array($data) && array_is_list($data) ? $data : [$data];
            while ($queue) {
                $item = array_shift($queue); if (!is_array($item)) continue;
                $items[] = $item;
                if (isset($item['@graph']) && is_array($item['@graph'])) foreach ($item['@graph'] as $child) $queue[] = $child;
            }
        } catch (Throwable $error) { /* Invalid structured metadata must not break parsing. */ }
    }
    return $items;
}
function structured_organization_name(mixed $data): string {
    if (!is_array($data)) return '';
    $type = $data['@type'] ?? ''; $type = is_array($type) ? implode(' ', $type) : (string)$type;
    if (preg_match('~Organization|Corporation|LocalBusiness~i', $type) && is_string($data['name'] ?? null)) return clean_text($data['name']);
    foreach ($data as $value) { $found = structured_organization_name($value); if ($found) return $found; }
    return '';
}
function structured_logo_value(mixed $value): ?string {
    if (is_string($value)) return $value;
    if (is_array($value)) {
        if (array_is_list($value)) { foreach ($value as $item) { $found = structured_logo_value($item); if ($found) return $found; } return null; }
        return structured_logo_value($value['url'] ?? $value['contentUrl'] ?? null);
    }
    return null;
}
function parse_page(string $html, string $url, string $id): array {
    $previous = libxml_use_internal_errors(true);
    $dom = new DOMDocument(); $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($dom); $structured = structured_items($xpath);
    $title = clean_text($xpath->query('//title')->item(0)?->textContent ?? ''); $siteName = '';
    $ogTitle = clean_text($xpath->query('//meta[@property="og:title"]')->item(0)?->getAttribute('content') ?? ''); if ($ogTitle) $title = $ogTitle;
    $siteName = clean_text($xpath->query('//meta[@property="og:site_name"]')->item(0)?->getAttribute('content') ?? '');
    $ogType = clean_text($xpath->query('//meta[@property="og:type"]')->item(0)?->getAttribute('content') ?? '');
    $organizationName = ''; $structuredLogo = null; $schemaTypes = [];
    foreach ($structured as $item) {
        $type = structured_type($item); if ($type) $schemaTypes[] = $type;
        if (!preg_match('~Organization|Corporation|LocalBusiness~i', $type)) continue;
        if (!$organizationName && is_string($item['name'] ?? null)) $organizationName = clean_text($item['name']);
        if (!$structuredLogo) $structuredLogo = structured_logo_value($item['logo'] ?? null);
    }
    $path = rawurldecode((string)(parse_url($url, PHP_URL_PATH) ?: ''));
    $editorial = (bool)(preg_match('~^article$~i', $ogType) || preg_match('~(?:^|/)(?:blogs?|news|articles?|insights|press-?center|статьи|новости)(?:/|$)~i', $path));
    foreach ($structured as $item) if (preg_match('~(?:^|\s)(?:Article|BlogPosting|NewsArticle)(?:\s|$)~i', structured_type($item))) $editorial = true;
    $search = (bool)(preg_match('~^(?:search|searchresults)$~i', $ogType) || preg_match('~(?:^|/)search(?:/|$)~i', $path));
    foreach ($structured as $item) if (preg_match('~SearchResultsPage~i', structured_type($item))) $search = true;
    $pageType = $search ? 'search' : ($editorial ? 'article' : 'webpage');
    $description = clean_text($xpath->query('//meta[@name="description"]')->item(0)?->getAttribute('content') ?? '') ?: clean_text($xpath->query('//meta[@property="og:description"]')->item(0)?->getAttribute('content') ?? '');
    $warnings = []; $logo = null; $logoConfidence = null;
    $structuredLogoUrl = $structuredLogo ? absolute_url($structuredLogo, $url) : null;
    if ($structuredLogoUrl && !preg_match('~hero|banner|slider|promo|cover~i', $structuredLogoUrl)) { $logo = $structuredLogoUrl; $logoConfidence = 'structured'; }
    if (!$logo) {
        $logoQueries = ['//a[contains(translate(@class,"LOGO","logo"),"logo")]//img|//*[contains(translate(@class,"LOGO","logo"),"logo")]//img', '//*[contains(translate(@class,"HEADER","header"),"header")]//img|//img[contains(translate(@class,"LOGO","logo"),"logo") or contains(translate(@id,"LOGO","logo"),"logo")]'];
        foreach ($logoQueries as $logoQuery) foreach ($xpath->query($logoQuery) as $image) {
            $marker = $image->getAttribute('class') . ' ' . $image->getAttribute('id') . ' ' . $image->getAttribute('alt');
            if (!preg_match('~logo|brand~i', $marker) || preg_match('~partner|client|sponsor~i', $marker)) continue;
            if ($xpath->query('ancestor::*[contains(translate(@class,"PARTNER","partner"),"partner") or contains(translate(@class,"CLIENT","client"),"client") or contains(translate(@class,"PRODUCT","product"),"product") or contains(translate(@class,"CATALOG","catalog"),"catalog")]', $image)->length) continue;
            $candidate = $image->getAttribute('data-src') ?: $image->getAttribute('src'); $resolved = $candidate ? absolute_url($candidate, $url) : null;
            if ($resolved && !preg_match('~analytics|metric|tracking|promo|banner|slider~i', $resolved)) { $logo = $resolved; $logoConfidence = 'markup'; break 2; }
        }
    }
    if (!$logo) foreach ($xpath->query('//link[contains(translate(@rel,"ICON","icon"),"icon")]') as $link) {
        if ($link->getAttribute('href')) { $logo = absolute_url($link->getAttribute('href'), $url); $logoConfidence = $logo ? 'favicon' : null; break; }
    }
    if ($logoConfidence === 'favicon') $warnings[] = 'Логотип определён только по favicon; визуальное соответствие бренду не подтверждено.';
    if (!$logo && $xpath->query('//img')->length) $warnings[] = 'Логотип не определён: изображения без явных признаков бренда не используются.';
    $headings = []; foreach ($xpath->query('//h1|//h2|//h3') as $heading) { $value = clean_text($heading->textContent); if ($value) $headings[] = $value; if (count($headings) >= 60) break; }
    $links = []; foreach ($xpath->query('//a[@href]') as $anchor) $links[] = ['href' => $anchor->getAttribute('href'), 'text' => clean_text($anchor->textContent)];
    $structuredOffering = (bool)$xpath->query('//*[contains(@itemtype,"Product") or contains(@itemtype,"Service")]')->length;
    foreach ($structured as $item) if (preg_match('~Product|Service|SoftwareApplication~i', structured_type($item))) $structuredOffering = true;
    $challenge = (bool)preg_match('~servicepipe\.tech|<js-challenge-loader|js[-_ ]challenge|checking your browser|проверка браузера|cf-chl|__cf_chl|ddos-?guard|enable javascript|включите javascript~i', $html);
    foreach ($xpath->query('//script|//style|//noscript|//svg|//canvas|//iframe|//nav|//footer|//form|//s|//*[@aria-hidden="true"]') as $node) $node->parentNode?->removeChild($node);
    $bodyNode = $dom->getElementsByTagName('body')->item(0); $body = $bodyNode ? element_text($xpath, $bodyNode) : clean_text($dom->textContent);
    $accessIssue = $challenge && strlen($body) < 400 ? 'javascript-challenge' : (strlen($body) < 20 ? 'empty-shell' : null);
    if ($accessIssue === 'javascript-challenge') $warnings[] = 'Сайт вернул JavaScript-challenge: содержимое страницы недоступно без браузерной проверки.';
    elseif ($accessIssue === 'empty-shell') $warnings[] = 'Страница не содержит доступного текста: содержимое сайта не было получено.';
    $pageImage = page_image_url($xpath, $url);
    $offerings = $accessIssue === 'javascript-challenge' ? [] : extract_offerings($xpath, $body, $id, $url, $title, $pageImage, $pageType, $structuredOffering);
    libxml_clear_errors(); libxml_use_internal_errors($previous);
    return ['id' => $id, 'kind' => 'company-site', 'url' => $url, 'title' => limit_text($title ?: parse_url($url, PHP_URL_HOST), 200), 'siteName' => $siteName, 'organizationName' => $organizationName, 'logo' => $logo, 'logoConfidence' => $logoConfidence, 'logoUncertainty' => $logoConfidence === 'favicon', 'pageType' => $pageType, 'ogType' => $ogType ?: null, 'schemaTypes' => array_values(array_unique($schemaTypes)), 'pageImage' => $pageImage, 'contentOrigin' => 'full-page', 'text' => limit_text(implode('. ', array_filter([$description, implode('. ', $headings), $body])), 32000), 'offerings' => $offerings, 'links' => $links, 'warnings' => array_values(array_unique($warnings)), 'accessIssue' => $accessIssue, 'retrievedAt' => gmdate('c')];
}
function absolute_url(string $href, string $base): ?string {
    if ($href === '' || str_starts_with($href, '#') || preg_match('~^(mailto|tel|javascript):~i', $href)) return null;
    $parts = parse_url($base); if (!$parts) return null;
    if (preg_match('~^https?://~i', $href)) return $href;
    $origin = $parts['scheme'] . '://' . $parts['host'] . (!empty($parts['port']) ? ':' . $parts['port'] : '');
    if (str_starts_with($href, '//')) return $parts['scheme'] . ':' . $href;
    if (str_starts_with($href, '/')) return $origin . $href;
    $path = $parts['path'] ?? '/'; $directory = preg_replace('~/[^/]*$~', '/', $path);
    return $origin . $directory . $href;
}
function site_identity(string $site): array {
    $host = strtolower(preg_replace('~^www\.~', '', parse_url($site, PHP_URL_HOST) ?: ''));
    $parts = explode('.', $host); $base = count($parts) > 2 ? implode('.', array_slice($parts, -2)) : $host;
    return ['host' => $host, 'base' => $base, 'brand' => explode('.', $base)[0] ?: $base];
}
function generic_company_name(string $value): bool {
    $name = preg_replace('/[«»"\'“”]/u', '', lower_text(clean_text($value)));
    $generic = ['ai','a.i.','ии','home','homepage','website','главная','официальный сайт','официальный'];
    return in_array($name, $generic, true) || (bool)preg_match('/^(?:(?:официальн[а-яё]*\s+)?сайт(?:\s+(?:компании|организации))?\s+)?(?:ооо|ао|пао|зао|ип|оао)$/iu', $name);
}
function romanize_brand(string $value): string {
    $converted = strtr(lower_text(clean_text($value)), ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'c','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya']);
    return preg_replace('/[^a-z0-9]+/', '', $converted);
}
function hostname_confirmed_brand(string $value, string $brand): ?string {
    $candidate = trim(preg_replace('/^[«“”"\']|[»“”"\']$/u', '', preg_replace('~^(?:ООО|АО|ПАО|ЗАО|ИП|ОАО)\s+~iu', '', clean_text($value))) ?? '');
    $hostnameBrand = romanize_brand($brand); $candidateBrand = romanize_brand($candidate);
    if (text_length($candidate) < 3 || text_length($candidate) > 70 || count(preg_split('/\s+/u', $candidate)) > 5 || generic_company_name($candidate)
        || preg_match('/^(?:www\.)?[\w.-]+\.[a-z]{2,}$/i', $candidate)
        || preg_match('~^(?:официальн|главная|контакты|о\s+компании|новости|каталог|выбирайте|добро\s+пожаловать)~iu', $candidate)) return null;
    if (strlen($candidateBrand) < 3 || strlen($hostnameBrand) < 3) return null;
    return $candidateBrand === $hostnameBrand || str_contains($candidateBrand, $hostnameBrand) || (strlen($candidateBrand) >= 4 && str_contains($hostnameBrand, $candidateBrand)) ? $candidate : null;
}
function quoted_brand(array $source, string $brand): ?string {
    $hostnameBrand = romanize_brand($brand); if (strlen($hostnameBrand) < 3) return null;
    $confirms = fn(string $candidate): bool => !str_starts_with(lower_text(clean_text($candidate)), lower_text($brand) . '.') && str_contains(romanize_brand($candidate), $hostnameBrand);
    foreach ([$source['organizationName'] ?? '', $source['siteName'] ?? '', $source['title'] ?? ''] as $value) {
        if (preg_match('/[«"\'“]([^»"\'”]{2,80})[»"\'”]/u', clean_text((string)$value), $match) && $confirms($match[1])) return clean_text($match[1]);
    }
    $lead = limit_text(clean_text((string)($source['text'] ?? '')), 600);
    if (preg_match('~(?:^|[.!?]\s*)([\p{L}\p{N}][\p{L}\p{N} .-]{1,58}?)\s+[—–-]\s+(?:сервис|платформа|маркетплейс|компания|разработчик|производитель|official|company)(?=$|[^\p{L}\p{N}])~iu', $lead, $match) && $confirms($match[1])) return clean_text($match[1]);
    return null;
}
function title_brand(array $source, string $brand): ?string {
    foreach (preg_split('/[|—–·:]|\s+-\s+/u', clean_text((string)($source['title'] ?? ''))) ?: [] as $part) {
        $candidate = hostname_confirmed_brand($part, $brand); if ($candidate) return $candidate;
    }
    return null;
}
function company_name_from(array $first, string $requested): string {
    $identity = site_identity($requested);
    $brand = $identity['brand']; $brandName = strlen($brand) <= 5 && preg_match('/^[a-z0-9-]+$/i', $brand) ? strtoupper($brand) : $brand;
    if (isset($first['kind']) && !in_array($first['kind'], ['company-site', 'local-document'], true)) return $brandName;
    $confirmedBrand = quoted_brand($first, $brand)
        ?: hostname_confirmed_brand(preg_split('/[|—–·:]/u', clean_text((string)($first['organizationName'] ?? '')))[0], $brand)
        ?: title_brand($first, $brand);
    if ($confirmedBrand) return $confirmedBrand;
    $structured = clean_text((string)($first['organizationName'] ?? '') ?: (string)($first['siteName'] ?? ''));
    $structured = trim(preg_split('/[|—–·:]/u', $structured)[0]);
    if (strlen($structured) >= 3 && !generic_company_name($structured)) return $structured;
    $cleaned = trim(preg_split('/[|—–·:]/u', (string)($first['title'] ?? ''))[0]);
    $hostnameTitle = preg_match('/^(?:www\.)?[\w.-]+\.[a-z]{2,}$/i', $cleaned) || lower_text($cleaned) === $identity['host'];
    $slogan = preg_match('/^(?:защитные решения|решения для|продукты для|услуги для|все для|всё для|техника для|товары для|мир |будущее |лидер |выбирайте )/iu', $cleaned);
    $parts = explode('|', (string)($first['title'] ?? '')); $suffix = count($parts) > 1 ? clean_text(end($parts)) : '';
    if ($slogan && strlen($suffix) >= 3 && strlen($suffix) <= 80 && !generic_company_name($suffix)) return $suffix;
    if (!$cleaned || strlen($cleaned) < 3 || generic_company_name($cleaned) || $hostnameTitle || $slogan) return $brandName;
    return $cleaned;
}
function company_name_from_pages(array $sources, string $requested): string {
    $brand = site_identity($requested)['brand'];
    $own = array_values(array_filter($sources, fn($source) => empty($source['kind']) || $source['kind'] === 'company-site'));
    foreach ($own as $source) { $confirmed = quoted_brand($source, $brand); if ($confirmed) return $confirmed; }
    foreach ($own as $source) {
        $structured = trim(preg_split('/[|—–·:]/u', clean_text((string)($source['organizationName'] ?? '')))[0]);
        $confirmed = hostname_confirmed_brand($structured, $brand); if ($confirmed) return $confirmed;
        if (strlen($structured) >= 3 && !generic_company_name($structured)) return $structured;
    }
    foreach ($own as $source) { $confirmed = title_brand($source, $brand); if ($confirmed) return $confirmed; }
    return company_name_from($own[0] ?? [], $requested);
}
function company_search_name(string $company): string {
    $alias = trim(preg_replace('/^[«“”"\']|[»“”"\']$/u', '', preg_replace('/^(?:ООО|АО|ПАО|ЗАО|ИП|ОАО)\s+/iu', '', clean_text($company))));
    return $alias !== '' ? $alias : clean_text($company);
}
function company_tokens(string $company): array {
    $parts = preg_split('/[^\p{L}\p{N}]+/u', lower_text($company), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    return array_values(array_filter($parts, fn($token) => strlen($token) >= 10 && !in_array($token, ['компания','общество','официальный','группа','россия'], true)));
}
function relevant_search_result(string $title, string $link, string $description, string $site, string $company = ''): bool {
    $identity = site_identity($site); $candidate = parse_url($link);
    if (!$candidate || !in_array($candidate['scheme'] ?? '', ['http', 'https'], true)) return false;
    $candidateHost = strtolower(preg_replace('~^www\.~', '', $candidate['host'] ?? ''));
    foreach ([$identity['host'], $identity['base']] as $host) if ($candidateHost === $host || str_ends_with($candidateHost, '.' . $host)) return true;
    $haystack = lower_text($title . ' ' . $description . ' ' . $link);
    if (str_contains($haystack, $identity['host']) || str_contains($haystack, $identity['base'])) return true;
    $names = array_unique([lower_text(clean_text($company)), lower_text(company_search_name($company))]);
    foreach ($names as $name) if (strlen($name) >= 4 && !in_array($name, ['ai','a.i.','ии','home','homepage','website','главная','официальный сайт','официальный'], true) && str_contains($haystack, $name)) return true;
    $tokens = company_tokens($company);
    if (count($tokens) >= 2) { $matches = 0; foreach ($tokens as $token) if (str_contains($haystack, $token)) $matches++; return $matches >= min(2, count($tokens)); }
    return false;
}
function offering_mentioned(string $name, string $title, string $description): bool {
    $needle = lower_text($name); $haystack = lower_text($title . ' ' . $description);
    if (strlen($needle) < 4) return false;
    if (str_contains($haystack, $needle)) return true;
    $tokens = company_tokens($name); if (count($tokens) < 2) return false;
    foreach (array_slice($tokens, 0, 3) as $token) if (!str_contains($haystack, $token)) return false;
    return true;
}
function search_provider(string $query): array {
    $cache = sys_get_temp_dir() . '/baiagent-search-v3-' . hash('sha256', $query) . '.json';
    if (is_file($cache) && time() - filemtime($cache) < 900) { $cached = json_decode((string)file_get_contents($cache), true); if (is_array($cached)) return $cached; }
    if (research_budget(12)) return [];
    $items = [];
    try {
        $result = fetch_public('https://search.lumy.live/search?q=' . rawurlencode($query) . '&format=json&language=ru-RU&categories=general');
        $data = json_decode($result['body'], true, 512, JSON_THROW_ON_ERROR);
        foreach ($data['results'] ?? [] as $item) {
            $title = clean_text((string)($item['title'] ?? '')); $link = clean_text((string)($item['url'] ?? '')); $description = clean_text((string)($item['content'] ?? ''));
            if ($title && $link && $description) $items[] = ['title' => limit_text($title, 200), 'url' => $link, 'text' => limit_text($description, 3000)];
        }
    } catch (Throwable $error) { /* Use the second provider when metasearch is unavailable. */ }
    if (!$items) {
        $result = fetch_public('https://www.bing.com/search?format=rss&mkt=ru-RU&cc=ru&setlang=ru&q=' . rawurlencode($query)); $xml = @simplexml_load_string($result['body']);
        if ($xml) foreach ($xml->channel->item as $item) $items[] = ['title' => limit_text(clean_text((string)$item->title), 200), 'url' => clean_text((string)$item->link), 'text' => limit_text(clean_text((string)$item->description), 3000)];
    }
    if ($items) @file_put_contents($cache, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    return $items;
}
function search_reference_web(string $company): array {
    $items = [];
    try {
        $result = fetch_public('https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=' . rawurlencode($company) . '&format=json&utf8=1&srlimit=3');
        $data = json_decode($result['body'], true); $search = $data['query']['search'] ?? [];
        foreach ($search as $index => $entry) {
            $title = clean_text((string)($entry['title'] ?? '')); $text = clean_text((string)($entry['snippet'] ?? ''));
            $direct = strlen($company) >= 4 && str_contains(lower_text($title), lower_text($company));
            $latinAlias = $index === 0 && preg_match('/^[A-Z0-9-]{4,}$/', $company);
            if (($direct || $latinAlias) && $text) $items[] = ['title' => $title . ' — Википедия', 'url' => 'https://ru.wikipedia.org/wiki/' . rawurlencode(str_replace(' ', '_', $title)), 'text' => $text];
        }
    } catch (Throwable $error) { /* Reference search is optional. */ }
    try {
        usleep(900000);
        $result = fetch_public('https://news.google.com/rss/search?q=' . rawurlencode('"' . $company . '"') . '&hl=ru&gl=RU&ceid=RU:ru');
        $xml = @simplexml_load_string($result['body']);
        if ($xml) foreach ($xml->channel->item as $entry) {
            $title = clean_text((string)$entry->title); $url = clean_text((string)$entry->link); $text = clean_text((string)$entry->description) ?: $title;
            if ($title && $url) $items[] = ['title' => $title, 'url' => $url, 'text' => $text];
        }
    } catch (Throwable $error) { /* News mentions are a fallback. */ }
    return $items;
}
function company_owned_url(string $url, array $identity): bool {
    $host = strtolower(preg_replace('~^www\.~', '', parse_url($url, PHP_URL_HOST) ?: ''));
    foreach ([$identity['host'], $identity['base']] as $owned) if ($host === $owned || str_ends_with($host, '.' . $owned)) return true;
    return false;
}
function search_web(string $company, string $site, array $offerings, array $companySources): array {
    $identity = site_identity($site); $items = []; $seen = []; $warnings = []; $searchName = company_search_name($company);
    $reviewContext = ['companyName' => $company, 'siteUrl' => $site, 'sources' => $companySources, 'offerings' => $offerings];
    $reviewRelevant = fn(array $item): bool => is_review_material($item) && is_relevant_company_review($item, $reviewContext);
    $add = function(array $item, string $kind, string $offeringName = '') use (&$items, &$seen): void {
        if (empty($item['url']) || isset($seen[$item['url']]) || excluded_web_source_url((string)$item['url'])) return;
        $seen[$item['url']] = true;
        $items[] = ['id' => 'web-pending', 'kind' => $kind, 'offeringName' => $offeringName ?: null, 'url' => $item['url'], 'title' => $item['title'], 'text' => $item['text'], 'publishedAt' => $item['publishedAt'] ?? null, 'contentOrigin' => 'search-snippet', 'retrievedAt' => gmdate('c')];
    };
    $searches = 0;
    foreach (['"' . $searchName . '" отзывы рейтинг', '"' . $searchName . '" отзывы Яндекс Карты', '"' . $searchName . '"', '"' . $searchName . '" клиенты партнеры новости'] as $query) {
        try {
            if ($searches++) usleep(900000);
            foreach (search_provider($query) as $item) {
                if (empty($item['title']) || empty($item['text']) || company_owned_url($item['url'], $identity) || !relevant_search_result($item['title'], $item['url'], $item['text'], $site, $company)) continue;
                $add($item, $reviewRelevant($item) ? 'review-snippet' : 'search-snippet');
            }
        } catch (Throwable $error) { $warnings[] = $error->getMessage(); }
    }
    if (count($items) < 4) foreach (search_reference_web($searchName) as $item) {
        if (company_owned_url($item['url'], $identity) || !relevant_search_result($item['title'], $item['url'], $item['text'], $site, $company)) continue;
        $add($item, 'search-snippet');
    }
    if (!array_filter($items, fn($item) => $item['kind'] === 'review-snippet')) {
        try {
            if ($searches++) usleep(900000);
            foreach (search_provider('"' . $searchName . '" отзывы клиентов Яндекс 2ГИС') as $item) {
                if (empty($item['title']) || empty($item['text']) || company_owned_url($item['url'], $identity) || !relevant_search_result($item['title'], $item['url'], $item['text'], $site, $company) || !$reviewRelevant($item)) continue;
                $add($item, 'review-snippet');
            }
        } catch (Throwable $error) { $warnings[] = $error->getMessage(); }
    }
    $hasOwnText = (bool)array_filter($companySources, fn($source) => strlen(trim((string)($source['text'] ?? ''))) >= 40);
    if (!$hasOwnText) {
        $warnings[] = 'Текст собственного сайта недоступен или слишком мал: профиль и предложения построены по независимым источникам и требуют проверки.';
        $recognitionCount = 0;
        foreach ($items as &$source) {
            if (!in_array($source['kind'], ['search-snippet', 'review-snippet'], true) || $recognitionCount++ >= 2) continue;
            try {
                $page = fetch_public($source['url']);
                if (preg_match('~html|xhtml|text/plain~i', $page['type'])) {
                    $parsed = parse_page($page['body'], $page['url'], $source['id']);
                    $source['text'] = $parsed['text']; $source['pageType'] = $parsed['pageType']; $source['ogType'] = $parsed['ogType']; $source['schemaTypes'] = $parsed['schemaTypes'];
                    $source['contentOrigin'] = 'full-page'; $source['retrievedAt'] = gmdate('c');
                }
            } catch (Throwable $error) { /* Keep the independent snippet when full text is unavailable. */ }
        }
        unset($source);
    }
    $independent = array_values(array_filter($items, fn($source) => in_array($source['kind'], ['search-snippet', 'review-snippet'], true)));
    $recognitionSources = $hasOwnText ? $companySources : array_merge($companySources, $independent);
    $plan = market_plan($recognitionSources); $plan['companyName'] = $company;
    foreach ($plan['competitorQueries'] as $query) {
        try {
            if ($searches++) usleep(900000); $accepted = 0;
            foreach (search_provider($query) as $item) {
                if (company_owned_url($item['url'], $identity) || !market_candidate($item, $plan, $site)) continue;
                $add($item, 'competitor-candidate'); $accepted++; if ($accepted >= 6) break;
            }
        } catch (Throwable $error) { $warnings[] = $error->getMessage(); }
    }
    foreach ($plan['evidenceQueries'] ?? [] as $evidenceQuery) {
        try {
            if ($searches++) usleep(900000); $accepted = 0;
            foreach (search_provider($evidenceQuery['query']) as $item) {
                if (company_owned_url($item['url'], $identity) || !market_evidence($item, $plan, $evidenceQuery['kind'])) continue;
                $add($item, $evidenceQuery['kind']); $accepted++; if ($accepted >= 5) break;
            }
        } catch (Throwable $error) { $warnings[] = $error->getMessage(); }
    }
    try {
        if ($searches++) usleep(900000);
        foreach (market_news_search($plan['newsQuery']) as $item) if (market_news($item, $plan)) $add($item, 'news-snippet');
    } catch (Throwable $error) { $warnings[] = $error->getMessage(); }
    $hasReviews = (bool)array_filter($items, fn($item) => $item['kind'] === 'review-snippet');
    $specific = array_values(array_filter($offerings, fn($item) => count(preg_split('/\s+/u', preg_replace('/[^\p{L}\p{N}]+/u', ' ', $item['displayName'] ?? $item['name']) ?? '', -1, PREG_SPLIT_NO_EMPTY)) >= 2));
    foreach (array_slice($specific, 0, 2) as $offering) {
        $name = $offering['displayName'] ?? $offering['name'];
        foreach ($hasReviews ? ['alternatives'] : ['reviews', 'alternatives'] as $mode) {
            try {
                if ($searches++) usleep(900000);
                $query = $mode === 'reviews' ? '"' . $name . '" отзывы цена' : '"' . $name . '" купить цена аналог';
                foreach (search_provider($query) as $item) {
                    if (empty($item['title']) || empty($item['text']) || company_owned_url($item['url'], $identity) || !offering_mentioned($name, $item['title'], $item['text'])) continue;
                    if ($mode === 'reviews' && !$reviewRelevant($item)) continue;
                    $add($item, $mode === 'reviews' ? 'review-snippet' : 'alternative-snippet', $name);
                }
            } catch (Throwable $error) { $warnings[] = $error->getMessage(); }
        }
    }
    if (research_budget(12)) $warnings[] = 'Не все внешние источники изучены: достигнут общий лимит времени исследования.';
    $items = array_slice($items, 0, 40); foreach ($items as $index => &$item) $item['id'] = 'web-' . ($index + 1); unset($item);
    return [$items, array_values(array_unique($warnings)), $plan];
}
function enrich_external(array &$web, string $site, array $plan, array &$warnings, array $reviewContext = []): array {
    $alternatives = []; $identity = site_identity($site);
    if (!$reviewContext) $reviewContext = ['companyName' => $plan['companyName'] ?? '', 'siteUrl' => $site, 'sources' => [], 'offerings' => [], 'marketContext' => $plan];
    $priority = ['competitor-candidate' => 0, 'review-snippet' => 1, 'search-snippet' => 2, 'industry-snippet' => 3, 'customer-snippet' => 4, 'alternative-snippet' => 5, 'market-price-snippet' => 6, 'news-snippet' => 9];
    $quotas = ['competitor-candidate' => 4, 'review-snippet' => 3, 'alternative-snippet' => 2, 'industry-snippet' => 3, 'customer-snippet' => 2, 'market-price-snippet' => 1, 'search-snippet' => 3];
    $selected = []; $chosen = [];
    foreach ($quotas as $kind => $limit) {
        $accepted = 0;
        foreach ($web as $index => $source) if ($source['kind'] === $kind && $accepted++ < $limit) { $chosen[$index] = true; $selected[] = $source; }
    }
    $remaining = $web;
    usort($remaining, fn($a, $b) => ($priority[$a['kind']] ?? 5) <=> ($priority[$b['kind']] ?? 5));
    foreach ($remaining as $source) {
        if (count($selected) >= MAX_EXTERNAL) break;
        $index = array_search($source['id'], array_column($web, 'id'), true);
        if ($source['kind'] !== 'news-snippet' && !isset($chosen[$index])) { $chosen[$index] = true; $selected[] = $source; }
    }
    foreach ($selected as &$source) {
        if (research_budget(3)) { $warnings[] = 'Внешние страницы загружены частично: сохранены только полученные данные и поисковые цитаты.'; break; }
        try {
            $page = fetch_public($source['url']);
            if (!preg_match('~html|xhtml|text/plain~i', $page['type'])) continue;
            if (company_owned_url($page['url'], $identity)) { $source['discard'] = true; continue; }
            $parsed = parse_page($page['body'], $page['url'], $source['id']);
            $source['url'] = $page['url']; $source['title'] = $source['title'] ?: $parsed['title'];
            $source['pageType'] = $parsed['pageType']; $source['ogType'] = $parsed['ogType']; $source['schemaTypes'] = $parsed['schemaTypes'];
            $readable = strlen($parsed['text']) >= 40 && !str_contains($parsed['text'], '�') && !preg_match('~ничего не найдено|проверьте адрес страницы|доступ запрещ[её]н~iu', limit_text($parsed['text'], 1000));
            if ($readable) {
                $sourceHost = strtolower(preg_replace('~^www\.~', '', parse_url($source['url'], PHP_URL_HOST) ?: ''));
                $sourcePath = (string)(parse_url($source['url'], PHP_URL_PATH) ?: '');
                $mapProfile = (preg_match('~(?:^|\.)yandex\.[a-z.]+$~i', $sourceHost) && preg_match('~/maps/org/~i', $sourcePath)) || (preg_match('~(?:^|\.)2gis\.[a-z.]+$~i', $sourceHost) && preg_match('~/firm/~i', $sourcePath));
                $mixedEmploymentReviews = preg_match('~отзыв[а-яё]* сотрудник|отзыв[а-яё]* о работодател|условия труда|зарплат|карьерных возможност~iu', $parsed['text']);
                // Keep only the verified company rating, not an employee's review presented as customer experience.
                if ($source['kind'] === 'review-snippet' && $mapProfile && $mixedEmploymentReviews && preg_match('~\d+\s*(?:отзыв|reviews?)~iu', $source['text'])) continue;
                $source['text'] = $parsed['text']; $source['contentOrigin'] = 'full-page'; $source['retrievedAt'] = gmdate('c');
                if ($source['kind'] === 'review-snippet' && (!is_review_material($source) || !is_relevant_company_review($source, $reviewContext))) { $source['discard'] = true; continue; }
                if ($source['kind'] === 'competitor-candidate') {
                    if (!market_candidate($source, $plan, $site) || !market_competitor_content($source['text'], $plan)) { $source['discard'] = true; continue; }
                    $source['competitorName'] = competitor_name($parsed); $source['marketQuote'] = relevant_market_quote($source, $plan);
                    if (!$source['marketQuote']) { $source['discard'] = true; continue; }
                }
                if ($source['kind'] === 'alternative-snippet') foreach ($parsed['offerings'] as $offering) {
                    $offering['sourceTitle'] = $source['title']; $offering['offeringName'] = $source['offeringName'] ?? null; $alternatives[] = $offering;
                }
            }
        } catch (Throwable $error) { /* Keep the search snippet when the page cannot be opened. */ }
    }
    unset($source);
    foreach ($web as &$source) foreach ($selected as $enriched) if ($source['id'] === $enriched['id']) { $source = $enriched; break; }
    unset($source);
    return $alternatives;
}
function resolved_research_warnings(array $warnings, ?string $logoConfidence): array {
    $unique = array_values(array_unique($warnings));
    return in_array($logoConfidence, ['markup', 'structured'], true) ? array_values(array_filter($unique, fn($warning) => !preg_match('~favicon~i', $warning))) : $unique;
}

try {
    rate_limit();
    $GLOBALS['research_deadline'] = microtime(true) + 110.0;
    $researchWarnings = [];
    $requested = normalize_url((string)($_GET['url'] ?? ''));
    $home = fetch_public($requested);
    if (!preg_match('~html|xhtml|text/plain~i', $home['type'])) fail('По адресу нет читаемой веб-страницы');
    $first = parse_page($home['body'], $home['url'], 'site-1');
    $company = company_name_from($first, $requested);
    $logoRank = fn(?string $confidence): int => ['favicon' => 1, 'markup' => 2, 'structured' => 3][$confidence] ?? 0;
    $companyLogo = $first['logo']; $companyLogoConfidence = $first['logoConfidence']; $companyLogoRank = $logoRank($companyLogoConfidence);
    $siteWarnings = $first['warnings'] ?? [];
    $sources = []; $links = $first['links']; unset($first['links']); $first['companyName'] = $company; $sources[] = $first;
    $queued = [$home['url'] => true]; $queue = []; $deepened = false;
    $enqueue = function(array $pageLinks, string $base, int $depth) use (&$queue, &$queued): void {
        foreach ($pageLinks as $link) {
            $absolute = absolute_url((string)($link['href'] ?? ''), $base); if (!$absolute) continue;
            $parts = parse_url($absolute); if (!$parts || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)) continue;
            $absolute = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '') . (!empty($parts['port']) ? ':' . $parts['port'] : '') . ($parts['path'] ?? '/') . (!empty($parts['query']) ? '?' . $parts['query'] : '');
            if (isset($queued[$absolute]) || ($parts['host'] ?? '') !== parse_url($base, PHP_URL_HOST)) continue;
            if (preg_match('~\.(?:xlsx?|docx?|pdf|zip|exe|apk|png|jpe?g|svg|webp|mp4)(?:$|\?)~i', $absolute) || preg_match('~login|signin|cart|checkout|личный|войти|корзин~iu', $absolute)) continue;
            $label = $absolute . ' ' . ($link['text'] ?? '');
            $commercial = preg_match('~catalog|shop|store|product|goods|service|solution|software|platform|system|price|pricing|каталог|товар|продукт|услуг|сервис|программ|систем|цен|прайс|стоимост~iu', $label);
            $secondary = preg_match('~about|company|contact|о-нас|компан|контакт~iu', $label);
            $process = preg_match('~appointment|schedule|prepare|regulation|protocol|запис|расписан|подготовк|напоминан|спецификац|регламент|инструкц|при[её]м~iu', $label);
            if (!$commercial && !$secondary && !$process) continue;
            $queued[$absolute] = true;
            $score = $process ? 18 : (str_contains(strtolower((string)($parts['path'] ?? '')), '/about/') ? 3 : ($commercial ? 10 : 3));
            $queue[] = ['url' => $absolute, 'text' => clean_text((string)($link['text'] ?? '')), 'depth' => $depth, 'score' => $score];
        }
        usort($queue, fn($a, $b) => ($a['depth'] <=> $b['depth']) ?: ($b['score'] <=> $a['score']));
    };
    $enqueue($links, $home['url'], 1);
    while ($queue && count($sources) < MAX_PAGES && !research_budget(45)) {
        $currentOfferings = [];
        foreach ($sources as $source) foreach (($source['offerings'] ?? []) as $offering) $currentOfferings[lower_text($offering['name'] . '|' . ($offering['variant'] ?? ''))] = true;
        if (count($currentOfferings) >= 24 && count($sources) >= 12) break;
        $candidate = array_shift($queue);
        if (($candidate['depth'] > 1 && count($currentOfferings) >= 8) || $candidate['depth'] > 2) continue;
        try {
            $page = fetch_public($candidate['url']); if (!preg_match('~html|xhtml|text/plain~i', $page['type'])) continue;
            $parsed = parse_page($page['body'], $page['url'], 'site-' . (count($sources) + 1));
            $siteWarnings = array_merge($siteWarnings, $parsed['warnings'] ?? []);
            if (strlen($parsed['text']) > 100) { $parsed['companyName'] = $company; $sources[] = $parsed; }
            $parsedLogoRank = $logoRank($parsed['logoConfidence']);
            if ($parsed['logo'] && $parsedLogoRank > $companyLogoRank) { $companyLogo = $parsed['logo']; $companyLogoConfidence = $parsed['logoConfidence']; $companyLogoRank = $parsedLogoRank; }
            if ($candidate['depth'] > 1) $deepened = true;
            if (count($currentOfferings) < 8 && $candidate['depth'] < 2) $enqueue($parsed['links'], $page['url'], $candidate['depth'] + 1);
            foreach ($sources as &$source) if ($source['id'] === $parsed['id']) unset($source['links']);
            unset($source);
        } catch (Throwable $error) { /* Secondary pages do not fail the research. */ }
    }
    if ($queue && research_budget(45)) $researchWarnings[] = 'Собственные страницы изучены частично: достигнут общий лимит времени исследования.';
    $company = company_name_from_pages($sources, $home['url']);
    foreach ($sources as &$source) if ($source['kind'] === 'company-site') $source['companyName'] = $company;
    unset($source);
    $offerings = []; $offeringSeen = [];
    foreach ($sources as $source) foreach (($source['offerings'] ?? []) as $offering) {
        $key = lower_text($offering['name']) . '|' . lower_text((string)($offering['variant'] ?? '')) . '|' . lower_text((string)($offering['price'] ?? ''));
        if (!isset($offeringSeen[$key])) { $offeringSeen[$key] = true; $offerings[] = $offering; }
    }
    $pricedNames = [];
    foreach ($offerings as $offering) if (!empty($offering['price'])) $pricedNames[lower_text($offering['name'] . '|' . ($offering['variant'] ?? ''))] = true;
    $offerings = array_values(array_filter($offerings, fn($offering) => !empty($offering['price']) || !isset($pricedNames[lower_text($offering['name'] . '|' . ($offering['variant'] ?? ''))])));
    $offerings = array_slice($offerings, 0, 40);
    [$web, $warnings, $plan] = search_web($company, $home['url'], $offerings, $sources);
    $reviewContext = ['companyName' => $company, 'siteUrl' => $home['url'], 'sources' => $sources, 'offerings' => $offerings, 'marketContext' => $plan];
    $alternatives = enrich_external($web, $home['url'], $plan, $warnings, $reviewContext); $identity = site_identity($home['url']);
    $web = array_values(array_filter($web, fn($source) => empty($source['discard']) && !company_owned_url($source['url'], $identity) && !str_contains(lower_text($source['title']), $identity['base']) && ($source['kind'] !== 'review-snippet' || (is_review_material($source) && is_relevant_company_review($source, $reviewContext)))));
    if ($first['accessIssue'] || text_length(clean_text($first['text'])) < 40) $siteWarnings[] = 'Содержимое главной страницы недоступно; профиль компании опирается на внешние источники, а не на успешный аудит сайта.';
    $warnings = resolved_research_warnings(array_merge($researchWarnings, $siteWarnings, $warnings), $companyLogoConfidence);
    $sources = array_merge($sources, $web); $reviews = []; $competitors = []; $competitorHosts = []; $news = [];
    foreach ($web as $source) {
        if ($source['kind'] === 'review-snippet') $reviews[] = ['sourceId' => $source['id'], 'sourceTitle' => $source['title'], 'url' => $source['url'], 'quote' => limit_text($source['text'], 900), 'offeringName' => $source['offeringName'] ?? null];
        if ($source['kind'] === 'alternative-snippet') $alternatives[] = ['name' => offering_name(preg_split('/[|—–]/u', $source['title'])[0]), 'displayName' => offering_name(preg_split('/[|—–]/u', $source['title'])[0]), 'sourceId' => $source['id'], 'sourceTitle' => $source['title'], 'url' => $source['url'], 'quote' => limit_text($source['text'], 900), 'price' => extract_price($source['text']), 'offeringName' => $source['offeringName'] ?? null];
        if ($source['kind'] === 'competitor-candidate') {
            $host = site_identity($source['url'])['base']; $quote = $source['marketQuote'] ?? relevant_market_quote($source, $plan);
            if ($quote && empty($competitorHosts[$host])) { $competitorHosts[$host] = true; $competitors[] = ['name' => $source['competitorName'] ?? competitor_name($source), 'url' => $source['url'], 'sourceId' => $source['id'], 'sourceTitle' => $source['title'], 'quote' => $quote, 'subject' => $plan['subject']]; }
        }
        if ($source['kind'] === 'news-snippet') $news[] = ['title' => $source['title'], 'url' => $source['url'], 'sourceId' => $source['id'], 'sourceTitle' => $source['title'], 'quote' => limit_text($source['text'], 500), 'publishedAt' => $source['publishedAt'] ?? null];
    }
    $competitors = array_slice($competitors, 0, 12); $news = array_slice($news, 0, 8);
    if (!array_filter($sources, fn($source) => strlen($source['text']) >= 20)) fail('Не удалось получить текст открытых источников', 422);
    echo encode_json(['requestedUrl' => $home['url'], 'companyName' => $company, 'companyLogo' => $companyLogo, 'sources' => $sources, 'offerings' => $offerings, 'reviews' => $reviews, 'competitors' => $competitors, 'news' => $news, 'alternatives' => array_slice($alternatives, 0, 30), 'marketContext' => ['industry' => $plan['industry'], 'subject' => $plan['subject']], 'coverage' => ['pages' => count($sources) - count($web), 'deepened' => $deepened, 'external' => count($web)], 'warnings' => $warnings, 'createdAt' => gmdate('c')]);
} catch (Throwable $error) { fail($error->getMessage(), 422); }
