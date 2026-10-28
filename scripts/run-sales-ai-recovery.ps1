[CmdletBinding()]
param(
    [ValidateRange(10, 3600)][int]$IntervalSeconds = 60,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$salesRecoveryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../laravel')).Path
$salesRecoveryPhp = (Get-Command php -ErrorAction Stop).Source
Push-Location -LiteralPath $salesRecoveryRoot
try {
    do {
        & $salesRecoveryPhp artisan sales-ai:process --limit=10 --no-interaction
        if ($Once) { exit $LASTEXITCODE }
        Start-Sleep -Seconds $IntervalSeconds
    } while ($true)
} finally {
    Pop-Location
}
