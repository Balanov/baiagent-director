<?php
declare(strict_types=1);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    exit;
}
$downloads = [
    'android' => ['BAIagent-Director-Android-0.6.0.apk', 'application/vnd.android.package-archive'],
    'windows' => ['BAIagent-Director-Setup-Windows-0.8.1-x64.exe', 'application/vnd.microsoft.portable-executable'],
];
$platform = (string)($_GET['platform'] ?? '');
if (!isset($downloads[$platform])) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Сборка не найдена';
    exit;
}
[$filename, $mime] = $downloads[$platform];
$path = __DIR__ . '/../downloads/' . $filename;
if (!is_file($path)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Сборка временно недоступна';
    exit;
}
header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: public, max-age=3600');
header('X-Content-Type-Options: nosniff');
readfile($path);
