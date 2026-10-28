param([Parameter(Mandatory = $true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destinationPath = (Resolve-Path -LiteralPath $Destination).Path
if (-not $destinationPath.StartsWith((Join-Path $workspace 'release') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination must be an existing release subdirectory.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$webVersion = (Get-Content -LiteralPath (Join-Path $workspace 'frontend/package.json') -Raw | ConvertFrom-Json).version
$mobileVersion = (Get-Content -LiteralPath (Join-Path $workspace 'mobile/package.json') -Raw | ConvertFrom-Json).version
$officeVersion = (Get-Content -LiteralPath (Join-Path $workspace 'office/package.json') -Raw | ConvertFrom-Json).version
$socketVersion = (Get-Content -LiteralPath (Join-Path $workspace 'realtime-server/package.json') -Raw | ConvertFrom-Json).version

foreach ($app in @(
    @{ Name = "PwarMyar-Web-App-$webVersion.zip"; Directory = 'laravel/public/app' },
    @{ Name = "PwarMyar-Mobile-Web-$mobileVersion.zip"; Directory = 'laravel/public/mobile' },
    @{ Name = "PwarMyar-Office-Web-$officeVersion.zip"; Directory = 'laravel/public/office' }
)) {
    $source = (Resolve-Path -LiteralPath (Join-Path $workspace $app.Directory)).Path
    if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html')) -or -not (Test-Path -LiteralPath (Join-Path $source '.htaccess'))) { throw "Incomplete web build: $source" }
    $zipPath = Join-Path $destinationPath $app.Name
    [IO.Compression.ZipFile]::CreateFromDirectory($source, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        if (-not $zip.GetEntry('index.html') -or -not $zip.GetEntry('.htaccess')) { throw "Incomplete package: $zipPath" }
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match '(^|/)\.env($|\.)|\.(jks|keystore)$|upload-key\.properties') { throw 'Private configuration found in a web package.' }
        }
        Write-Output "$($app.Name): $($zip.Entries.Count) entries, includes SPA routing rules."
    } finally { $zip.Dispose() }
}

$socketRoot = Join-Path $workspace 'realtime-server'
$socketName = "PwarMyar-Realtime-Server-$socketVersion.zip"
$socketZip = [IO.Compression.ZipFile]::Open((Join-Path $destinationPath $socketName), [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relative in @('index.js', 'server.js', 'ai-jobs.js', 'package.json', 'package-lock.json', '.env.production.example', '.htaccess', 'README.md', 'deploy/MKPOS-PRODUCTION.md', 'deploy/AI-JOBS.md', 'deploy/nginx.conf.example')) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($socketZip, (Join-Path $socketRoot $relative), $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $socketZip.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead((Join-Path $destinationPath $socketName))
try {
    if ($check.GetEntry('.env') -or -not $check.GetEntry('ai-jobs.js') -or $check.Entries.Count -ne 11) { throw 'Unexpected realtime package contents.' }
    Write-Output "${socketName}: $($check.Entries.Count) allowlisted entries; private .env and node_modules excluded."
} finally { $check.Dispose() }
