[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$salesRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../laravel')).Path
$salesPhp = (Get-Command php -ErrorAction Stop).Source
Push-Location -LiteralPath $salesRoot
try {
    # Dedicated connection: never execute paid provider work in the web request.
    & $salesPhp artisan queue:work sales-ai --queue=sales-ai --sleep=2 --timeout=360 --tries=60 --no-interaction
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
