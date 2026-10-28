[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]] $Path,

    [string] $ExpectedSubject,

    [string] $ExpectedThumbprint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$failures = @()

foreach ($candidate in $Path) {
    $resolved = Resolve-Path -LiteralPath $candidate
    if (-not (Test-Path -LiteralPath $resolved.Path -PathType Leaf)) {
        throw "Not a file: $($resolved.Path)"
    }

    $signature = Get-AuthenticodeSignature -LiteralPath $resolved.Path
    $issues = @()

    if ($signature.Status -ne 'Valid') {
        $issues += "Authenticode status is $($signature.Status), expected Valid"
    }
    if ($signature.SignatureType -ne 'Authenticode') {
        $issues += "Signature type is $($signature.SignatureType), expected Authenticode"
    }
    if ($null -eq $signature.SignerCertificate) {
        $issues += 'Signer certificate is missing'
    }
    if ($null -eq $signature.TimeStamperCertificate) {
        $issues += 'RFC 3161 timestamp is missing'
    }
    if ($ExpectedSubject -and $null -ne $signature.SignerCertificate -and
        $signature.SignerCertificate.Subject -cne $ExpectedSubject) {
        $issues += "Signer Subject does not exactly match ExpectedSubject"
    }
    if ($ExpectedThumbprint -and $null -ne $signature.SignerCertificate -and
        $signature.SignerCertificate.Thumbprint -ine ($ExpectedThumbprint -replace '\s', '')) {
        $issues += "Signer thumbprint does not match ExpectedThumbprint"
    }

    $hash = Get-FileHash -LiteralPath $resolved.Path -Algorithm SHA256
    [pscustomobject] @{
        Path             = $resolved.Path
        Valid            = ($issues.Count -eq 0)
        Status           = $signature.Status.ToString()
        SignatureType    = $signature.SignatureType.ToString()
        Subject          = if ($null -ne $signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
        Thumbprint       = if ($null -ne $signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null }
        TimestampSubject = if ($null -ne $signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Subject } else { $null }
        SHA256           = $hash.Hash.ToLowerInvariant()
        Issues           = ($issues -join '; ')
    }

    if ($issues.Count -gt 0) {
        $failures += $resolved.Path
    }
}

if ($failures.Count -gt 0) {
    throw "Windows signature verification failed for $($failures.Count) file(s)."
}

Write-Host "Verified Authenticode signatures and timestamps for $($Path.Count) file(s)."
