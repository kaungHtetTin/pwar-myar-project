[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$wyneWorkerRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$wyneWorkerBackend = (Resolve-Path -LiteralPath (Join-Path $wyneWorkerRoot 'laravel')).Path
$wyneWorkerArtisan = Join-Path $wyneWorkerBackend 'artisan'
$wyneWorkerPhp = (Get-Command php -ErrorAction Stop).Source
$wyneWorkerLog = Join-Path $wyneWorkerRoot 'artifacts/wyne-wyne-worker-service.log'
$wyneWorkerErrorLog = Join-Path $wyneWorkerRoot 'artifacts/wyne-wyne-worker-service-error.log'

if (-not (Test-Path -LiteralPath (Join-Path $wyneWorkerBackend 'vendor/autoload.php'))) {
    throw 'Install Laravel dependencies before starting the Wyne Wyne worker.'
}

# Serialize simultaneous launcher clicks without trusting a stale process ID file.
$wyneWorkerLockPath = Join-Path $wyneWorkerBackend 'storage/framework/wyne-wyne-worker-launch.lock'
$wyneWorkerLaunchLock = [System.IO.File]::Open($wyneWorkerLockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
    $wyneWorkerNormalizedArtisan = $wyneWorkerArtisan.Replace('\', '/').ToLowerInvariant()
    $wyneWorkerExisting = Get-CimInstance Win32_Process -Filter "Name = 'php.exe'" |
        Where-Object {
            $wyneWorkerCommand = ([string]$_.CommandLine).Replace('\', '/').ToLowerInvariant()
            $wyneWorkerCommand.Contains($wyneWorkerNormalizedArtisan) -and $wyneWorkerCommand -match 'queue:work\s+wyne-wyne(?:\s|$)'
        } | Select-Object -First 1
    if ($wyneWorkerExisting) {
        Write-Host "Wyne Wyne worker is already running (PID $($wyneWorkerExisting.ProcessId))."
        exit 0
    }
    if ($CheckOnly) {
        Write-Host 'Wyne Wyne worker is stopped. Customer replies will wait in the wyne-wyne queue.'
        exit 1
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $wyneWorkerLog) -Force | Out-Null

    $wyneWorkerArguments = @(('"' + $wyneWorkerArtisan + '"'), 'queue:work', 'wyne-wyne', '--queue=wyne-wyne', '--sleep=2', '--timeout=360', '--tries=60', '--no-interaction')
    $wyneWorkerProcess = Start-Process -FilePath $wyneWorkerPhp -ArgumentList $wyneWorkerArguments -WorkingDirectory $wyneWorkerBackend -WindowStyle Hidden -RedirectStandardOutput $wyneWorkerLog -RedirectStandardError $wyneWorkerErrorLog -PassThru
    Write-Host "Wyne Wyne worker started in the background (PID $($wyneWorkerProcess.Id))."
    Write-Host "Worker output: $wyneWorkerLog"
    Write-Host "Worker errors: $wyneWorkerErrorLog"
} finally {
    $wyneWorkerLaunchLock.Dispose()
}
