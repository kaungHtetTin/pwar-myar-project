param([string]$ReleaseName = 'production-2026-09-05')
$ErrorActionPreference = 'Stop'
if ($ReleaseName -notmatch '^[a-zA-Z0-9.-]+$') { throw 'Use a simple release folder name.' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = Join-Path $repoRoot "release\$ReleaseName"
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
function Write-Package([string]$name, [string]$base, [string[]]$include, [string]$version = '', [switch]$AllowEnvironmentExample) {
    $base = (Resolve-Path -LiteralPath $base).Path.TrimEnd('\')
    $archivePath = Join-Path $destination $name
    if (Test-Path -LiteralPath $archivePath) { throw "Package already exists: $archivePath" }
    $archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($relative in $include) {
            $source = Get-Item -LiteralPath (Join-Path $base $relative) -Force
            $files = if ($source.PSIsContainer) { Get-ChildItem -LiteralPath $source.FullName -Recurse -File -Force } else { @($source) }
            foreach ($file in $files) {
                if (-not $file.FullName.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'File outside package root.' }
                $entry = $file.FullName.Substring($base.Length + 1).Replace('\', '/')
                if ($version -and $entry -eq 'release.json') { continue }
                if ($entry -match '(^|/)(\.env($|\.)|\.git/|storage/|vendor/|node_modules/)|\.(jks|keystore|sqlite|log)$|upload-key\.properties') {
                    if (-not ($AllowEnvironmentExample -and $entry -eq '.env.production.example')) { throw "Private/generated file rejected: $entry" }
                }
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        }
        if ($version) {
            $metadata = $archive.CreateEntry('release.json')
            $writer = New-Object IO.StreamWriter($metadata.Open())
            try { $writer.Write(([ordered]@{ version = $version; packaged_at_utc = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress)) }
            finally { $writer.Dispose() }
        }
    } finally { $archive.Dispose() }
    $check = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        if (-not $check.Entries.Count) { throw "Empty archive: $name" }
        Write-Output "$name : $($check.Entries.Count) files"
    } finally { $check.Dispose() }
}
$webVersion = (Get-Content (Join-Path $repoRoot 'frontend/package.json') -Raw | ConvertFrom-Json).version
$officeVersion = (Get-Content (Join-Path $repoRoot 'office/package.json') -Raw | ConvertFrom-Json).version
$mobileVersion = (Get-Content (Join-Path $repoRoot 'mobile/package.json') -Raw | ConvertFrom-Json).version
$shopVersion = (Get-Content (Join-Path $repoRoot 'shop/package.json') -Raw | ConvertFrom-Json).version
$desktopVersion = (Get-Content (Join-Path $repoRoot 'desktop/package.json') -Raw | ConvertFrom-Json).version
Write-Package "PwarMyar-Business-Web-$webVersion.zip" (Join-Path $repoRoot 'frontend/dist') @('.') $webVersion
Write-Package "PwarMyar-Office-Web-$officeVersion.zip" (Join-Path $repoRoot 'office/dist') @('.') $officeVersion
Write-Package "PwarMyar-Mobile-Web-$mobileVersion.zip" (Join-Path $repoRoot 'laravel/public/mobile') @('.') $mobileVersion
Write-Package "PwarMyar-Shop-Web-$shopVersion.zip" (Join-Path $repoRoot 'laravel/shop') @('.') $shopVersion
# Explicit source allowlist: never include live .env, vendor, storage, caches or credentials.
Write-Package 'PwarMyar-Laravel-Portfolio-Update.zip' (Join-Path $repoRoot 'laravel') @('.htaccess', 'app', 'bootstrap/app.php', 'config', 'database/migrations', 'database/seed-data/ai-skills-v1.json', 'lang', 'resources', 'routes', 'public', 'shop', 'artisan', 'composer.json', 'composer.lock', 'server.php')
$socketVersion = (Get-Content (Join-Path $repoRoot 'realtime-server/package.json') -Raw | ConvertFrom-Json).version
Write-Package "PwarMyar-Realtime-Server-$socketVersion.zip" (Join-Path $repoRoot 'realtime-server') @('index.js', 'server.js', 'ai-jobs.js', 'package.json', 'package-lock.json', '.env.production.example', '.htaccess', 'README.md', 'deploy/MKPOS-PRODUCTION.md', 'deploy/AI-JOBS.md', 'deploy/nginx.conf.example') -AllowEnvironmentExample
foreach ($relative in @(
    "release/electron/PwarMyar-$desktopVersion-Portable-x64.exe",
    "release/electron/PwarMyar-$desktopVersion-Portable-ia32.exe",
    "mobile/releases/PwarMyar-mobile-production-release-$mobileVersion.apk",
    "mobile/releases/PwarMyar-mobile-production-$mobileVersion.aab"
)) {
    $source = Get-Item -LiteralPath (Join-Path $repoRoot $relative)
    $target = Join-Path $destination $source.Name
    if (Test-Path -LiteralPath $target) { throw "Artifact already exists: $target" }
    Copy-Item -LiteralPath $source.FullName -Destination $target
}
$artifacts = Get-ChildItem -LiteralPath $destination -File | Where-Object { $_.Extension -in '.zip', '.exe', '.apk', '.aab' } | Sort-Object Name
$manifest = foreach ($artifact in $artifacts) {
    [PSCustomObject]@{ file = $artifact.Name; bytes = $artifact.Length; sha256 = (Get-FileHash -LiteralPath $artifact.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
$manifest | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ascii
Write-Output "Release folder: $destination"
