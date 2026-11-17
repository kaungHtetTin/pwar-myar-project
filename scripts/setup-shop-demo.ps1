[CmdletBinding()]
param(
    [string]$ApiUrl = 'http://127.0.0.1:8000/api',
    [switch]$CreateDemo
)
$ErrorActionPreference = 'Stop'
if (-not $CreateDemo) { throw 'Use -CreateDemo to explicitly create the local demo business and sample products.' }
$uri = [Uri]$ApiUrl
if (-not $uri.IsLoopback -or $uri.Scheme -notin @('http', 'https') -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) {
    throw 'Demo setup is restricted to a local HTTP(S) backend.'
}
$base = $ApiUrl.TrimEnd('/')
$workspace = Split-Path -Parent $PSScriptRoot
$accessFile = Join-Path $workspace 'data\shop-demo-access.json'
$headers = @{ Accept = 'application/json'; 'X-MKPOS-Auth' = 'token' }
function Invoke-DemoApi([string]$Path, [string]$Method = 'GET', $Body = $null) {
    $arguments = @{ Uri = "$base$Path"; Method = $Method; Headers = $headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $arguments.ContentType = 'application/json'
        $arguments.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 15))
    }
    return Invoke-RestMethod @arguments
}
if (Test-Path -LiteralPath $accessFile) {
    $access = Get-Content -LiteralPath $accessFile -Raw | ConvertFrom-Json
    if ($access.api_url -ne $base) { throw 'Saved demo credentials belong to another API. Review the credentials file first.' }
    $session = Invoke-DemoApi '/auth/login' 'POST' @{ email = $access.email; password = $access.password }
} else {
    $password = 'Demo-' + [Guid]::NewGuid().ToString('N')
    $email = 'shop-demo-' + (Get-Date -Format 'yyyyMMddHHmmss') + '@example.test'
    $session = Invoke-DemoApi '/auth/register' 'POST' @{
        business_name = 'PwarMyar Demo Store'; owner_name = 'Demo Owner'; email = $email
        password = $password; password_confirmation = $password
    }
    $access = [ordered]@{ api_url = $base; email = $email; password = $password; created_at = (Get-Date).ToString('o') }
    $access | ConvertTo-Json | Set-Content -LiteralPath $accessFile -Encoding UTF8
}
if (-not $session.access_token) { throw 'The demo login did not return a token.' }
$headers.Authorization = 'Bearer ' + $session.access_token
$settings = Invoke-DemoApi '/shop-admin/settings'
$settings.storefront_enabled = $true
$settings.accepting_orders = $true
$settings.marketplace_enabled = $true
$settings.slug = 'mkpos-demo-shop'
$settings.description = 'Local demonstration store. Sample goods only; no real purchases or payments.'
$settings.phone = '000000'
$settings.pickup_instructions = 'Demo pickup counter. This is sample data for local testing.'
$settings.delivery_zones = @(@{ id = 'demo-area'; name = 'Demo delivery area'; fee = 500 })
$settings.payment_methods = @(@{ id = 'cash'; name = 'Demo cash'; type = 'cash'; instructions = 'Local demonstration only. Do not send money.' })
$settings = Invoke-DemoApi '/shop-admin/settings' 'PUT' $settings
$existing = Invoke-DemoApi '/products?limit=100&with_total=1'
$catalog = @($existing.items)
foreach ($item in @(
    @{ name = 'Demo rice'; category = 'Pantry'; price = 2500 },
    @{ name = 'Demo green tea'; category = 'Drinks'; price = 1500 },
    @{ name = 'Demo biscuits'; category = 'Snacks'; price = 1000 }
)) {
    $product = $catalog | Where-Object { $_.name -eq $item.name } | Select-Object -First 1
    if (-not $product) {
        $product = Invoke-DemoApi '/products' 'POST' @{
            name = $item.name; category = $item.category; price = $item.price; cost = 500
            base_unit = 'Pack'; stock = 20
            prices = @(@{ name = $settings.price_type; price = $item.price })
        }
    }
    Invoke-DemoApi "/shop-admin/publications/$($product.id)" 'PUT' @{
        published = $true; unit = 'base'; description = 'Sample product for local checkout testing.'
    } | Out-Null
    # Preserve any older demo rows and order history while keeping one public listing per sample.
    foreach ($duplicate in @($catalog | Where-Object { $_.name -eq $item.name -and $_.id -ne $product.id })) {
        Invoke-DemoApi "/shop-admin/publications/$($duplicate.id)" 'PUT' @{ published = $false; unit = 'base' } | Out-Null
    }
}
Write-Host 'Local demo shop configured with three published products.'
Write-Host "Credentials saved locally (ignored by Git): $accessFile"
Write-Host 'Storefront: http://127.0.0.1:5177/#/store/mkpos-demo-shop'
