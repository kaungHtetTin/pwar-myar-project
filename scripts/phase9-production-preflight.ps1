[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://www.pwarmyar.com/public',
    [string]$BrowserOrigin = 'https://www.pwarmyar.com',
    [string]$EvidenceDirectory = (Join-Path $PSScriptRoot '..\laravel\storage\app\rollout-backups')
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
if (-not $base.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Production preflight requires an HTTPS base URL.'
}

$health = Invoke-RestMethod -Method Get -Uri "$base/api/health" -TimeoutSec 20
if (-not $health.ok -or $health.backend -ne 'laravel' -or $health.database -ne 'mysql') {
    throw 'Production health response does not match the expected Laravel/MySQL service.'
}

$cors = Invoke-WebRequest -UseBasicParsing -Method Options -Uri "$base/api/auth/register" -Headers @{
    Origin = $BrowserOrigin
    'Access-Control-Request-Method' = 'POST'
    'Access-Control-Request-Headers' = 'content-type'
} -TimeoutSec 20
$allowOrigin = [string]$cors.Headers['Access-Control-Allow-Origin']
if ($allowOrigin -ne $BrowserOrigin -and $allowOrigin -ne '*') {
    throw "Production CORS did not allow the expected browser origin [$BrowserOrigin]."
}

$unauthenticatedStatus = $null
try {
    $unexpected = Invoke-WebRequest -UseBasicParsing -Method Get -Uri "$base/api/subscription/plans" -Headers @{ Accept = 'application/json' } -TimeoutSec 20
    $unauthenticatedStatus = [int]$unexpected.StatusCode
} catch {
    if (-not $_.Exception.Response) { throw }
    $unauthenticatedStatus = [int]$_.Exception.Response.StatusCode
}
if ($unauthenticatedStatus -notin @(401, 419)) {
    throw "Protected subscription plans endpoint returned unexpected status [$unauthenticatedStatus]."
}

New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$evidencePath = Join-Path (Resolve-Path -LiteralPath $EvidenceDirectory).Path ("phase9-production-preflight-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
[ordered]@{
    checked_at = (Get-Date).ToString('o')
    base_url = $base
    health = 'passed'
    backend = $health.backend
    database = $health.database
    cors_origin = $allowOrigin
    protected_endpoint_status = $unauthenticatedStatus
} | ConvertTo-Json | Set-Content -LiteralPath $evidencePath -Encoding UTF8

Write-Host "Production read-only preflight passed. Evidence: $evidencePath"
