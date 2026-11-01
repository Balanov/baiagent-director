<?php
declare(strict_types=1);

/**
 * Normalize user-supplied URLs at the server boundary. Scheme-less company
 * domains remain supported, while parser-ambiguous and non-HTTP URLs do not.
 */
function url_guard_normalize(string $input): string {
    $input = trim($input);
    if ($input === '') throw new InvalidArgumentException('Укажите сайт компании');
    if (strlen($input) > 4096 || preg_match('/[\x00-\x1F\x7F\\\\]/', $input)) {
        throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
    }
    if (!preg_match('~^https?://~i', $input)) {
        if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $input)) {
            throw new InvalidArgumentException('Разрешены только адреса HTTP и HTTPS');
        }
        $input = 'https://' . $input;
    }

    $parts = parse_url($input);
    if (!is_array($parts) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
        throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
    }
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    if (!in_array($scheme, ['http', 'https'], true)) {
        throw new InvalidArgumentException('Разрешены только адреса HTTP и HTTPS');
    }
    $port = isset($parts['port']) ? (int)$parts['port'] : null;
    if ($port !== null && !in_array($port, [80, 443], true)) {
        throw new InvalidArgumentException('Нестандартные порты не используются');
    }

    $host = (string)$parts['host'];
    $bracketed = str_starts_with($host, '[') && str_ends_with($host, ']');
    if ($bracketed) $host = substr($host, 1, -1);
    if ($host === '' || (!$bracketed && (str_contains($host, '[') || str_contains($host, ']')))) {
        throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
    }

    $packed = @inet_pton($host);
    if ($packed !== false) {
        $host = inet_ntop($packed);
    } else {
        // Do not let cURL reinterpret decimal, octal, or hexadecimal IPv4 forms.
        if (preg_match('~^(?:[0-9.]+|0x[0-9a-f]+)$~i', $host)) {
            throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
        }
        if (function_exists('idn_to_ascii')) {
            $ascii = @idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
            if ($ascii === false) throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
            $host = $ascii;
        }
        $host = strtolower(rtrim($host, '.'));
        if ($host === '' || strlen($host) > 253 || !filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
            throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
        }
    }

    $isIpv6 = filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;
    $authority = ($isIpv6 ? '[' . $host . ']' : $host) . ($port !== null ? ':' . $port : '');
    return $scheme . '://' . $authority . ($parts['path'] ?? '')
        . (isset($parts['query']) ? '?' . $parts['query'] : '')
        . (isset($parts['fragment']) ? '#' . $parts['fragment'] : '');
}

function url_guard_in_range(string $packedIp, string $network, int $prefix): bool {
    $packedNetwork = @inet_pton($network);
    if ($packedNetwork === false || strlen($packedNetwork) !== strlen($packedIp)) return false;
    $wholeBytes = intdiv($prefix, 8);
    $remainingBits = $prefix % 8;
    if ($wholeBytes > 0 && substr($packedIp, 0, $wholeBytes) !== substr($packedNetwork, 0, $wholeBytes)) return false;
    if ($remainingBits === 0) return true;
    $mask = (0xFF << (8 - $remainingBits)) & 0xFF;
    return (ord($packedIp[$wholeBytes]) & $mask) === (ord($packedNetwork[$wholeBytes]) & $mask);
}

/**
 * Allow public global unicast only. The explicit ranges also cover addresses
 * that PHP's FILTER_FLAG_NO_PRIV_RANGE / NO_RES_RANGE has historically missed.
 */
function url_guard_public_ip(string $ip): bool {
    $packed = @inet_pton($ip);
    if ($packed === false) return false;

    if (strlen($packed) === 4) {
        $blocked = [
            ['0.0.0.0', 8],       // "This network" and unspecified addresses
            ['10.0.0.0', 8],      // RFC 1918
            ['100.64.0.0', 10],   // Carrier-grade NAT
            ['127.0.0.0', 8],     // Loopback
            ['169.254.0.0', 16],  // Link-local
            ['172.16.0.0', 12],   // RFC 1918
            ['192.0.0.0', 24],    // IETF protocol assignments
            ['192.0.2.0', 24],    // Documentation
            ['192.88.99.0', 24],  // Deprecated 6to4 relay
            ['192.168.0.0', 16],  // RFC 1918
            ['198.18.0.0', 15],   // Benchmarking
            ['198.51.100.0', 24], // Documentation
            ['203.0.113.0', 24],  // Documentation
            ['224.0.0.0', 4],     // Multicast
            ['240.0.0.0', 4],     // Reserved and limited broadcast
        ];
        foreach ($blocked as [$network, $prefix]) if (url_guard_in_range($packed, $network, $prefix)) return false;
        return true;
    }

    if (strlen($packed) !== 16) return false;
    // Validate the embedded IPv4 address instead of treating mapped addresses
    // as ordinary public IPv6. This blocks ::ffff:127.0.0.1 and similar forms.
    if (substr($packed, 0, 12) === str_repeat("\0", 10) . "\xff\xff") {
        return url_guard_public_ip(inet_ntop(substr($packed, 12)));
    }
    // Public IPv6 global unicast currently lives in 2000::/3. Rejecting other
    // ranges also covers link-local, ULA, multicast, NAT64, and IPv4-compatible.
    if (!url_guard_in_range($packed, '2000::', 3)) return false;
    foreach ([['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as [$network, $prefix]) {
        if (url_guard_in_range($packed, $network, $prefix)) return false;
    }
    return true;
}

/**
 * Resolve and validate every A/AAAA answer, then pin cURL to one of those
 * already-approved addresses. Pinning prevents a second DNS lookup from
 * returning a different, internal address (DNS rebinding / TOCTOU).
 *
 * The optional resolver is for deterministic tests only; production calls use
 * dns_get_record(). Returned resolve entries use cURL's HOST:PORT:ADDRESS form.
 */
function url_guard_resolve(string $input, ?callable $resolver = null): array {
    $url = url_guard_normalize($input);
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['host'])) throw new InvalidArgumentException('Нужен обычный публичный адрес сайта');
    $host = trim((string)$parts['host'], '[]');
    $port = isset($parts['port']) ? (int)$parts['port'] : ($parts['scheme'] === 'https' ? 443 : 80);
    $isLiteral = filter_var($host, FILTER_VALIDATE_IP) !== false;

    if ($isLiteral) {
        if (!url_guard_public_ip($host)) throw new InvalidArgumentException('Источник не относится к публичной сети');
        return ['url' => $url, 'host' => $host, 'port' => $port, 'addresses' => [$host], 'resolve' => []];
    }

    $records = $resolver !== null ? $resolver($host) : @dns_get_record($host, DNS_A + DNS_AAAA);
    if (!is_array($records)) throw new InvalidArgumentException('Не удалось проверить адрес сайта');
    $addresses = [];
    foreach ($records as $record) {
        $ip = is_string($record) ? $record : (string)($record['ip'] ?? $record['ipv6'] ?? '');
        if ($ip === '') continue;
        $packed = @inet_pton($ip);
        if ($packed === false || !url_guard_public_ip($ip)) {
            // Fail the whole target if even one answer is non-public. Selecting
            // only the safe-looking answer would leave resolver behaviour ambiguous.
            throw new InvalidArgumentException('Источник не относится к публичной сети');
        }
        $addresses[inet_ntop($packed)] = true;
    }
    $addresses = array_keys($addresses);
    if (!$addresses) throw new InvalidArgumentException('Не удалось проверить адрес сайта');

    $address = $addresses[0];
    $resolveAddress = filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) ? '[' . $address . ']' : $address;
    return [
        'url' => $url,
        'host' => $host,
        'port' => $port,
        'addresses' => $addresses,
        'resolve' => [$host . ':' . $port . ':' . $resolveAddress],
    ];
}
