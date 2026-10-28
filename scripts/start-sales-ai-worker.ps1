[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$salesWorkerRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$salesWorkerBackend = (Resolve-Path -LiteralPath (Join-Path $salesWorkerRoot 'laravel')).Path
$salesWorkerArtisan = Join-Path $salesWorkerBackend 'artisan'
$salesWorkerPhp = (Get-Command php -ErrorAction Stop).Source
$salesWorkerLog = Join-Path $salesWorkerRoot 'artifacts/sales-ai-worker-service.log'
$salesWorkerErrorLog = Join-Path $salesWorkerRoot 'artifacts/sales-ai-worker-service-error.log'

if (-not (Test-Path -LiteralPath (Join-Path $salesWorkerBackend 'vendor/autoload.php'))) {
    throw 'Install Laravel dependencies before starting the Sales AI worker.'
}

# Serialize simultaneous launcher clicks without trusting a stale process ID file.
$salesWorkerLockPath = Join-Path $salesWorkerBackend 'storage/framework/sales-ai-worker-launch.lock'
$salesWorkerLaunchLock = [System.IO.File]::Open($salesWorkerLockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
    $salesWorkerNormalizedArtisan = $salesWorkerArtisan.Replace('\', '/').ToLowerInvariant()
    $salesWorkerExisting = Get-CimInstance Win32_Process -Filter "Name = 'php.exe'" |
        Where-Object {
            $salesWorkerCommand = ([string]$_.CommandLine).Replace('\', '/').ToLowerInvariant()
            $salesWorkerCommand.Contains($salesWorkerNormalizedArtisan) -and $salesWorkerCommand -match 'queue:work\s+sales-ai(?:\s|$)'
        } | Select-Object -First 1
    if ($salesWorkerExisting) {
        Write-Host "Sales AI worker is already running (PID $($salesWorkerExisting.ProcessId))."
        exit 0
    }
    if ($CheckOnly) {
        Write-Host 'Sales AI worker is stopped. Customer replies will wait in the sales-ai queue.'
        exit 1
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $salesWorkerLog) -Force | Out-Null

    $salesWorkerArguments = @(('"' + $salesWorkerArtisan + '"'), 'queue:work', 'sales-ai', '--queue=sales-ai', '--sleep=2', '--timeout=360', '--tries=60', '--no-interaction')
    $salesWorkerProcess = Start-Process -FilePath $salesWorkerPhp -ArgumentList $salesWorkerArguments -WorkingDirectory $salesWorkerBackend -WindowStyle Hidden -RedirectStandardOutput $salesWorkerLog -RedirectStandardError $salesWorkerErrorLog -PassThru
    Write-Host "Sales AI worker started in the background (PID $($salesWorkerProcess.Id))."
    Write-Host "Worker output: $salesWorkerLog"
    Write-Host "Worker errors: $salesWorkerErrorLog"
} finally {
    $salesWorkerLaunchLock.Dispose()
}
