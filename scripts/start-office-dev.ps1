[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$officeDirectory = (Resolve-Path (Join-Path $workspace 'office')).Path
$port = 5175
$url = "http://127.0.0.1:$port/"

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($listener) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    $commandLine = [string]$owner.CommandLine
    $normalizedOffice = $officeDirectory.Replace('\', '/').ToLowerInvariant()
    $normalizedCommand = $commandLine.Replace('\', '/').ToLowerInvariant()

    if ($owner.Name -eq 'node.exe' -and $normalizedCommand.Contains($normalizedOffice) -and $normalizedCommand.Contains('vite')) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "PwarMyar Office is already running at $url" -ForegroundColor Green
                Write-Host "Process ID: $($listener.OwningProcess)"
                exit 0
            }
        } catch {
            throw "An PwarMyar Office process owns port $port but is not responding. Stop PID $($listener.OwningProcess), then run start-office.cmd again."
        }
    }

    throw "Port $port is used by $($owner.Name) (PID $($listener.OwningProcess)). Stop that application or change the Office Vite port. Command: $commandLine"
}

Write-Host "Starting PwarMyar Office at $url" -ForegroundColor Cyan
Push-Location $officeDirectory
try {
    & npm.cmd run dev -- --host 127.0.0.1 --port $port --strictPort
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
