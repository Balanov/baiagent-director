[CmdletBinding()]
param(
    [string] $Subject = $env:BAIAGENT_WIN_CERT_SUBJECT,
    [string] $Thumbprint = $env:BAIAGENT_WIN_CERT_SHA1,
    [string] $TimestampUrl = $(if ($env:BAIAGENT_WIN_TIMESTAMP_URL) { $env:BAIAGENT_WIN_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    throw 'Windows signed builds must run on Windows.'
}
if ([string]::IsNullOrWhiteSpace($Subject)) {
    throw 'Set BAIAGENT_WIN_CERT_SUBJECT to the exact certificate Subject before running the signed build.'
}

$timestamp = $null
if (-not [uri]::TryCreate($TimestampUrl, [System.UriKind]::Absolute, [ref] $timestamp) -or
    ($timestamp.Scheme -ne 'http' -and $timestamp.Scheme -ne 'https')) {
    throw 'BAIAGENT_WIN_TIMESTAMP_URL must be an absolute HTTP or HTTPS RFC 3161 endpoint.'
}

$now = Get-Date
$certificates = @(Get-ChildItem Cert: -Recurse -CodeSigningCert | Where-Object {
    $_.HasPrivateKey -and $_.NotBefore -le $now -and $_.NotAfter -gt $now -and $_.Subject -ceq $Subject
})

if (-not [string]::IsNullOrWhiteSpace($Thumbprint)) {
    $normalizedThumbprint = ($Thumbprint -replace '\s', '').ToUpperInvariant()
    if ($normalizedThumbprint -cnotmatch '^[A-F0-9]{40}$') {
        throw 'BAIAGENT_WIN_CERT_SHA1 must be a 40-character SHA-1 certificate thumbprint.'
    }
    $certificates = @($certificates | Where-Object { $_.Thumbprint -ceq $normalizedThumbprint })
}

if ($certificates.Count -eq 0) {
    throw 'No unexpired code-signing certificate with a private key matches the configured Subject and thumbprint. Connect the token or load the eSigner certificate, then retry.'
}
if ($certificates.Count -gt 1) {
    $certificates | Select-Object Subject, Thumbprint, NotAfter, PSParentPath
    throw 'Multiple certificates match. Set BAIAGENT_WIN_CERT_SHA1 to select exactly one certificate.'
}

foreach ($command in @('node', 'npm')) {
    if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command is not available: $command"
    }
}

$certificate = $certificates[0]
[pscustomobject] @{
    Ready        = $true
    Subject      = $certificate.Subject
    Thumbprint   = $certificate.Thumbprint
    NotAfter     = $certificate.NotAfter.ToString('yyyy-MM-dd HH:mm:ss')
    Store        = $certificate.PSParentPath
    TimestampUrl = $timestamp.AbsoluteUri
}
Write-Host 'Windows signing preflight passed.'
