[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$supportWorkerRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$supportWorkerBackend = (Resolve-Path -LiteralPath (Join-Path $supportWorkerRoot 'laravel')).Path
$supportWorkerArtisan = Join-Path $supportWorkerBackend 'artisan'
$supportWorkerPhp = (Get-Command php -ErrorAction Stop).Source
$supportWorkerLog = Join-Path $supportWorkerRoot 'artifacts/customer-service-worker-service.log'
$supportWorkerErrorLog = Join-Path $supportWorkerRoot 'artifacts/customer-service-worker-service-error.log'

if (-not (Test-Path -LiteralPath (Join-Path $supportWorkerBackend 'vendor/autoload.php'))) {
    throw 'Install Laravel dependencies before starting the PwarMyar customer service worker.'
}

# Keep an idle worker available so enabling Telegram from Office needs no terminal.

# Serialize simultaneous launcher clicks without trusting a stale process ID file.
$supportWorkerLockPath = Join-Path $supportWorkerBackend 'storage/framework/customer-service-worker-launch.lock'
$supportWorkerLaunchLock = [System.IO.File]::Open($supportWorkerLockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
    $supportWorkerNormalizedArtisan = $supportWorkerArtisan.Replace('\', '/').ToLowerInvariant()
    $supportWorkerExisting = Get-CimInstance Win32_Process -Filter "Name = 'php.exe'" |
        Where-Object {
            $supportWorkerCommand = ([string]$_.CommandLine).Replace('\', '/').ToLowerInvariant()
            $supportWorkerCommand.Contains($supportWorkerNormalizedArtisan) -and $supportWorkerCommand -match 'queue:work\s+customer-service(?:\s|$)'
        } | Select-Object -First 1
    if ($supportWorkerExisting) {
        Write-Host "PwarMyar customer service worker is already running (PID $($supportWorkerExisting.ProcessId))."
        exit 0
    }
    if ($CheckOnly) {
        Write-Host 'PwarMyar customer service worker is stopped. Customer replies will wait in the customer-service queue.'
        exit 1
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $supportWorkerLog) -Force | Out-Null

    $supportWorkerArguments = @(('"' + $supportWorkerArtisan + '"'), 'queue:work', 'customer-service', '--queue=customer-service', '--sleep=2', '--timeout=360', '--tries=60', '--no-interaction')
    $supportWorkerProcess = Start-Process -FilePath $supportWorkerPhp -ArgumentList $supportWorkerArguments -WorkingDirectory $supportWorkerBackend -WindowStyle Hidden -RedirectStandardOutput $supportWorkerLog -RedirectStandardError $supportWorkerErrorLog -PassThru
    Write-Host "PwarMyar customer service worker started in the background (PID $($supportWorkerProcess.Id))."
    Write-Host "Worker output: $supportWorkerLog"
    Write-Host "Worker errors: $supportWorkerErrorLog"
} finally {
    $supportWorkerLaunchLock.Dispose()
}
