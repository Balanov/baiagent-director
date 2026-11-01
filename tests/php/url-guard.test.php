<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/public/api/url-guard.php';

$assertions = 0;
function check_guard(bool $condition, string $message): void {
    global $assertions;
    $assertions++;
    if (!$condition) throw new RuntimeException('FAIL: ' . $message);
}
function reject_guard(callable $callback, string $message): void {
    try {
        $callback();
    } catch (InvalidArgumentException $error) {
        check_guard(true, $message);
        return;
    }
    check_guard(false, $message);
}
function dns_result(array $records): callable {
    return static fn(string $host): array => $records;
}

$publicDns = dns_result([['ip' => '93.184.216.34']]);
$normalized = url_guard_resolve('example.com', $publicDns);
check_guard($normalized['url'] === 'https://example.com', 'scheme-less domain remains supported');
check_guard($normalized['resolve'] === ['example.com:443:93.184.216.34'], 'default HTTPS port and checked IP are pinned');
check_guard(url_guard_resolve('https://example.com/path?q=1', $publicDns)['url'] === 'https://example.com/path?q=1', 'path and query survive normalization');
check_guard(url_guard_resolve('HTTP://EXAMPLE.COM./Path', $publicDns)['url'] === 'http://example.com/Path', 'scheme and host are canonicalized without changing path case');
check_guard(url_guard_resolve('http://example.com:80', $publicDns)['resolve'] === ['example.com:80:93.184.216.34'], 'explicit HTTP port is pinned');
check_guard(url_guard_resolve('https://example.com:443', $publicDns)['port'] === 443, 'explicit HTTPS port is accepted');

$dnsCalls = 0;
$multi = url_guard_resolve('example.com', static function(string $host) use (&$dnsCalls): array {
    $dnsCalls++;
    return [['ipv6' => '2606:2800:220:1:248:1893:25c8:1946'], ['ip' => '93.184.216.34']];
});
check_guard($dnsCalls === 1, 'DNS resolver is called once');
check_guard(count($multi['addresses']) === 2, 'all validated addresses are returned');
check_guard($multi['resolve'] === ['example.com:443:[2606:2800:220:1:248:1893:25c8:1946]'], 'IPv6 pin is bracketed for cURL');

foreach ([
    'file:///etc/passwd', 'gopher://example.com', 'ftp://example.com',
    'https:example.com', 'https://user@example.com', 'https://user:pass@example.com',
    'https://example.com:8080', "https://example.com/\r\nHost: internal",
    'https://example.com\\@127.0.0.1', 'http://2130706433', 'http://127.1',
    'http://0x7f000001', 'http://0177.0.0.1', 'https://[::1%25eth0]',
] as $url) reject_guard(static fn() => url_guard_resolve($url, $publicDns), 'unsafe or ambiguous URL rejected: ' . $url);
reject_guard(static fn() => url_guard_normalize(''), 'empty URL is rejected');

$blockedIpv4 = [
    '0.0.0.0', '0.1.2.3', '10.0.0.1', '10.255.255.255',
    '100.64.0.1', '100.127.255.254', '127.0.0.1', '127.255.255.255',
    '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.1', '192.0.2.10', '192.88.99.1', '192.168.1.1',
    '198.18.0.1', '198.19.255.255', '198.51.100.2', '203.0.113.8',
    '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255',
];
foreach ($blockedIpv4 as $ip) {
    check_guard(!url_guard_public_ip($ip), 'non-public IPv4 rejected: ' . $ip);
    reject_guard(static fn() => url_guard_resolve('http://' . $ip), 'IPv4 URL rejected: ' . $ip);
}

$blockedIpv6 = [
    '::', '::1', '::127.0.0.1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
    '::ffff:169.254.169.254', '64:ff9b::7f00:1', '64:ff9b:1::ffff',
    '100::1', 'fc00::1', 'fd12:3456:789a::1', 'fe80::1', 'fec0::1',
    'ff02::1', '2001::1', '2001:2::1', '2001:db8::1',
    '2002:7f00:1::1', '3fff::1',
];
foreach ($blockedIpv6 as $ip) {
    check_guard(!url_guard_public_ip($ip), 'non-public IPv6 rejected: ' . $ip);
    reject_guard(static fn() => url_guard_resolve('http://[' . $ip . ']'), 'IPv6 URL rejected: ' . $ip);
}

foreach (['8.8.8.8', '1.1.1.1', '93.184.216.34', '100.128.0.1', '172.32.0.1'] as $ip) {
    check_guard(url_guard_public_ip($ip), 'public IPv4 accepted: ' . $ip);
}
foreach (['2001:4860:4860::8888', '2606:4700:4700::1111', '::ffff:93.184.216.34'] as $ip) {
    check_guard(url_guard_public_ip($ip), 'public IPv6 or mapped public IPv4 accepted: ' . $ip);
}

reject_guard(static fn() => url_guard_resolve('localhost', dns_result([['ip' => '127.0.0.1']])), 'localhost resolving to loopback is rejected');
reject_guard(static fn() => url_guard_resolve('example.com', dns_result([['ip' => '93.184.216.34'], ['ip' => '10.0.0.1']])), 'mixed public/private DNS answers reject the whole host');
reject_guard(static fn() => url_guard_resolve('example.com', dns_result([['ipv6' => '2606:4700:4700::1111'], ['ipv6' => '::1']])), 'mixed public/loopback IPv6 answers reject the whole host');
reject_guard(static fn() => url_guard_resolve('example.com', dns_result([])), 'empty DNS answer is rejected');
reject_guard(static fn() => url_guard_resolve('example.com', static fn(): bool => false), 'DNS failure is rejected');

$direct = url_guard_resolve('https://[2001:4860:4860::8888]/');
check_guard($direct['resolve'] === [], 'IP literal needs no DNS pin');
check_guard($direct['url'] === 'https://[2001:4860:4860::8888]/', 'public IPv6 literal remains valid');

if (in_array('--live', $argv ?? [], true)) {
    foreach (['example.com', 'baiagent.ru'] as $host) {
        $live = url_guard_resolve($host);
        check_guard($live['addresses'] !== [] && $live['resolve'] !== [], 'real public DNS is resolved and pinned: ' . $host);
        $curl = curl_init($live['url']);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_RESOLVE => $live['resolve'],
            CURLOPT_PROXY => '',
            CURLOPT_USERAGENT => 'BAIagent-URL-Guard-Test/1.0',
        ]);
        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        check_guard($response !== false && $status >= 200 && $status < 400, 'pinned public connection works: ' . $host . ' (' . $error . ')');
        fwrite(STDOUT, 'LIVE: ' . $host . ' -> ' . $live['resolve'][0] . ' HTTP ' . $status . "\n");
    }
}

fwrite(STDOUT, "OK: {$assertions} URL guard assertions\n");
