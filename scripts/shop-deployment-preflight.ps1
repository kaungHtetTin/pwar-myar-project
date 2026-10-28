[CmdletBinding()]
param(
    [string]$ApiUrl,
    [string]$ShopUrl,
    [string]$EnvFile,
    [switch]$Local,
    [ValidateRange(1, 60)][int]$TimeoutSeconds = 15
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'shop-environment.ps1')
$settings = Read-ShopEnvironment -Workspace $workspace -EnvFile $EnvFile
if (-not $ApiUrl) { $ApiUrl = $settings['VITE_API_URL'] }
if (-not $ShopUrl) { $ShopUrl = $settings['VITE_SHOP_URL'] }
if (-not $ApiUrl -or -not $ShopUrl) { throw 'Set VITE_API_URL and VITE_SHOP_URL in shop/.env.local or supply -ApiUrl and -ShopUrl.' }
$api = $null
$shop = $null
foreach ($entry in @(@{ Value = $ApiUrl; Name = 'api' }, @{ Value = $ShopUrl; Name = 'shop' })) {
    $parsed = $null
    if (-not [Uri]::TryCreate($entry.Value, [UriKind]::Absolute, [ref]$parsed) -or
        $parsed.Scheme -notin @('http', 'https') -or $parsed.UserInfo -or $parsed.Query -or $parsed.Fragment) {
        throw 'API and shop URLs must be absolute HTTP(S) URLs without credentials, queries or fragments.'
    }
    if (-not $Local -and $parsed.Scheme -ne 'https') { throw 'Production preflight requires HTTPS. Use -Local for local checks.' }
    if ($entry.Name -eq 'api') { $api = $parsed } else { $shop = $parsed }
}
$base = $api.AbsoluteUri.TrimEnd('/')
if ($api.AbsolutePath.TrimEnd('/') -notmatch '/api$') { throw 'ApiUrl must include /api.' }
$origin = $shop.GetLeftPart([UriPartial]::Authority)

$health = Invoke-RestMethod -Uri "$base/health" -TimeoutSec $TimeoutSeconds
if (-not $health.ok -or $health.backend -ne 'laravel' -or $health.database -ne 'mysql') {
    throw 'The target Laravel/MySQL health check failed.'
}
$cors = Invoke-WebRequest -UseBasicParsing -Method Options -Uri "$base/ecommerce/tracking" -Headers @{
    Origin = $origin
    'Access-Control-Request-Method' = 'POST'
    'Access-Control-Request-Headers' = 'content-type'
} -TimeoutSec $TimeoutSeconds
$allowedOrigin = [string]$cors.Headers['Access-Control-Allow-Origin']
if ($allowedOrigin -ne $origin -and -not ($Local -and $allowedOrigin -eq '*')) {
    throw "CORS must allow the exact customer origin: $origin"
}
if (([string]$cors.Headers['Access-Control-Allow-Methods']) -notmatch 'POST|\*') { throw 'CORS did not allow POST.' }
if (([string]$cors.Headers['Access-Control-Allow-Headers']) -notmatch '(?i)content-type|\*') { throw 'CORS did not allow the content-type header.' }

$catalog = Invoke-WebRequest -UseBasicParsing -Uri "$base/ecommerce/marketplace/shops?limit=1" -Headers @{ Origin = $origin; Accept = 'application/json' } -TimeoutSec $TimeoutSeconds
$data = $catalog.Content | ConvertFrom-Json
if (-not ($data.PSObject.Properties.Name -contains 'items') -or
    -not ($data.PSObject.Properties.Name -contains 'has_more')) { throw 'Public catalog response is invalid.' }
if (([string]$catalog.Headers['Cache-Control']) -notmatch 'no-store') { throw 'Public ecommerce responses must disable caching.' }
if ($catalog.Headers['Set-Cookie']) { throw 'Public ecommerce API unexpectedly created a session cookie.' }
$catalogOrigin = [string]$catalog.Headers['Access-Control-Allow-Origin']
if ($catalogOrigin -ne $origin -and -not ($Local -and $catalogOrigin -eq '*')) { throw 'Catalog response did not allow the customer origin.' }

$shopPage = Invoke-WebRequest -UseBasicParsing -Uri $shop.AbsoluteUri -TimeoutSec $TimeoutSeconds
if ($shopPage.Content -notmatch 'id=["'']root["'']') { throw 'Customer URL did not serve the React application.' }
Write-Host 'Read-only shop deployment preflight passed: database health, public catalog, stateless response, CORS and customer HTML.'
Write-Host 'Check scheduler execution and complete a controlled order in the target environment before opening sales.'
