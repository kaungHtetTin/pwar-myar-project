[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseBackup,
    [switch]$SyncAndroid
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backup = (Resolve-Path -LiteralPath $DatabaseBackup).Path
if ((Get-Item -LiteralPath $backup).Length -le 0) { throw 'The database backup is empty.' }

function Invoke-Stage([string]$Name, [string]$Directory, [scriptblock]$Action) {
    Write-Host "[$Name]"
    Push-Location $Directory
    try {
        & $Action
        if ($LASTEXITCODE -ne 0) { throw "Stage [$Name] failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
}

Invoke-Stage 'Backend migration and entitlement contract' (Join-Path $workspace 'laravel') {
    php artisan migrate --force --no-interaction
    if ($LASTEXITCODE -ne 0) { throw 'Backend migration failed.' }
    php artisan trial:rollout-check
}
Invoke-Stage 'Office client' (Join-Path $workspace 'office') { npm run build:laravel }
Invoke-Stage 'Web and Windows renderer' (Join-Path $workspace 'frontend') {
    npm run build:laravel
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    npm run build:desktop
}
Invoke-Stage 'Mobile client' (Join-Path $workspace 'mobile') { npm run build }
if ($SyncAndroid) {
    Invoke-Stage 'Android native synchronization' (Join-Path $workspace 'mobile') { npx cap sync android }
}

Write-Host 'Staged artifacts are ready. Set TRIAL_ENABLED=true only after these client artifacts are deployed, then run:'
Write-Host '  php artisan config:cache'
Write-Host '  php artisan trial:rollout-check'
Write-Host 'Complete the two-auth-mode registration and controlled-date conversion smoke checks from PHASE-9-ROLLOUT.md.'
