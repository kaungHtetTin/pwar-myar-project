[CmdletBinding()]
param(
    [string]$ApiUrl,
    [string]$ShopUrl,
    [string]$DefaultStore = '',
    [string]$EnvFile,
    [switch]$Local,
    [switch]$SkipStaff
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'shop-environment.ps1')
$settings = Read-ShopEnvironment -Workspace $workspace -EnvFile $EnvFile
if (-not $ApiUrl) { $ApiUrl = $settings['VITE_API_URL'] }
if (-not $ShopUrl) { $ShopUrl = $settings['VITE_SHOP_URL'] }
if (-not $PSBoundParameters.ContainsKey('DefaultStore')) { $DefaultStore = $settings['VITE_DEFAULT_STORE'] }
if (-not $ApiUrl -or -not $ShopUrl) { throw 'Set VITE_API_URL and VITE_SHOP_URL in shop/.env.local or supply -ApiUrl and -ShopUrl.' }

function Get-WebUri([string]$Value) {
    $uri = $null
    if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -notin @('http', 'https') -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) {
        throw "Use an absolute HTTP(S) URL without credentials, query or fragment: $Value"
    }
    if (-not $Local -and $uri.Scheme -ne 'https') { throw 'Production URLs must use HTTPS. Use -Local for local builds.' }
    return $uri
}

$api = Get-WebUri $ApiUrl
$shop = Get-WebUri $ShopUrl
if ($api.AbsolutePath.TrimEnd('/') -notmatch '/api$') { throw 'ApiUrl must include the /api path.' }
if ($DefaultStore -and $DefaultStore -notmatch '^[a-z0-9-]+$') { throw 'DefaultStore must be a shop slug.' }
$shopBase = $shop.AbsolutePath.TrimEnd('/') + '/'

function Invoke-Build([string]$Directory, [string]$Script, [hashtable]$Variables) {
    $previous = @{}
    foreach ($name in $Variables.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $Variables[$name], 'Process')
    }
    Push-Location (Join-Path $workspace $Directory)
    try {
        if (-not (Test-Path -LiteralPath 'node_modules')) { throw "Run npm ci --legacy-peer-deps in $Directory first." }
        & npm.cmd run $Script
        if ($LASTEXITCODE -ne 0) { throw "$Directory build failed ($LASTEXITCODE)." }
    } finally {
        Pop-Location
        foreach ($name in $Variables.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    }
}

Invoke-Build 'shop' 'build' @{
    VITE_API_URL = $api.AbsoluteUri.TrimEnd('/')
    VITE_BASE_PATH = $shopBase
    VITE_DEFAULT_STORE = $DefaultStore
}
if (-not $SkipStaff) {
    Invoke-Build 'frontend' 'build:laravel' @{
        VITE_SHOP_URL = $shop.AbsoluteUri.TrimEnd('/')
        VITE_API_URL = $api.AbsoluteUri.TrimEnd('/')
    }
}

$releaseDirectory = Join-Path $workspace ('release\shop-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $releaseDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $workspace 'shop\dist') -Destination (Join-Path $releaseDirectory 'shop') -Recurse
if (-not $SkipStaff) {
    Copy-Item -LiteralPath (Join-Path $workspace 'laravel\public\app') -Destination (Join-Path $releaseDirectory 'staff') -Recurse
}
[ordered]@{
    built_at = (Get-Date).ToString('o')
    mode = $(if ($Local) { 'local' } else { 'production' })
    api_url = $api.AbsoluteUri.TrimEnd('/')
    shop_url = $shop.AbsoluteUri.TrimEnd('/')
    base_path = $shopBase
    default_store = $DefaultStore
    staff_included = (-not $SkipStaff)
    customer_cors_origin = $shop.GetLeftPart([UriPartial]::Authority)
    migration_applied = $false
    scheduler_verified = $false
    note = 'Assets only. Run deployment preflight against the target backend; database migration and scheduler setup are separate.'
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseDirectory 'manifest.json') -Encoding UTF8
Write-Host "Shop release prepared: $releaseDirectory"
