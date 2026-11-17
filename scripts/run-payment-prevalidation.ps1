param(
    [ValidateRange(5, 3600)][int]$IntervalSeconds = 60,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$validatorRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../laravel')).Path
$validatorPhp = (Get-Command php -ErrorAction Stop).Source
Set-Location -LiteralPath $validatorRoot

do {
    # Run only this agent; production can use the existing Laravel minute scheduler instead.
    & $validatorPhp artisan system-agent:validate-payments --limit=5 --no-interaction
    if ($Once) { exit $LASTEXITCODE }
    Start-Sleep -Seconds $IntervalSeconds
} while ($true)
