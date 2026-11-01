<?php
declare(strict_types=1);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    exit;
}
$windowsInstaller = 'BAIagent-Director-Setup-Windows-1.3.0-x64.exe';
$manifestPath = __DIR__ . '/../downloads/current.json';
if (is_file($manifestPath)) {
    $manifest = json_decode((string)file_get_contents($manifestPath), true);
    $manifestFile = is_array($manifest) ? ($manifest['file'] ?? null) : null;
    if (is_string($manifestFile) && preg_match('/^BAIagent-Director-Setup-Windows-\d+\.\d+\.\d+-x64\.exe$/D', $manifestFile)) {
        $windowsInstaller = $manifestFile;
    }
}
$downloads = [
    'android' => ['BAIagent-Director-Android-0.6.0.apk', 'application/vnd.android.package-archive'],
    'windows' => [$windowsInstaller, 'application/vnd.microsoft.portable-executable'],
    'enterprise' => ['Balanov-PRO-Enterprise-Setup-Windows-1.1.1-x64.exe', 'application/vnd.microsoft.portable-executable'],
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
