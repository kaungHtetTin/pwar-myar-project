param([Parameter(Mandatory = $true)][string]$Version)
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Use a semantic version.' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = Join-Path $repoRoot "release\PwarMyar-$Version"
if (Test-Path -LiteralPath $destination) { throw "Release already exists: $destination" }
foreach ($app in @('frontend', 'mobile', 'office', 'shop', 'desktop', 'realtime-server')) {
    $package = Get-Content -LiteralPath (Join-Path $repoRoot "$app/package.json") -Raw | ConvertFrom-Json
    if ($package.version -ne $Version) { throw "$app version mismatch." }
    # Windows PowerShell cannot decode the lockfile's empty root-package key.
    & node -e 'const p=require(process.argv[1]); if(p.version!==process.argv[2] || p.packages[String()].version!==process.argv[2]) process.exit(1)' (Join-Path $repoRoot "$app/package-lock.json") $Version
    if ($LASTEXITCODE -ne 0) { throw "$app lockfile version mismatch." }
}
$gradle = Get-Content -LiteralPath (Join-Path $repoRoot 'mobile/android/app/build.gradle') -Raw
if ($gradle -notmatch ('versionName\s+"' + [regex]::Escape($Version) + '"')) { throw 'Android version mismatch.' }
$androidCode = [regex]::Match($gradle, 'versionCode\s+(\d+)').Groups[1].Value
$nativeArtifacts = @(
    "release/electron/PwarMyar-$Version-Portable-x64.exe",
    "release/electron/PwarMyar-$Version-Portable-ia32.exe",
    "mobile/releases/PwarMyar-mobile-production-release-$Version.apk",
    "mobile/releases/PwarMyar-mobile-production-$Version.aab"
)
foreach ($relative in $nativeArtifacts) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relative))) { throw "Missing artifact: $relative" }
}
New-Item -ItemType Directory -Path $destination | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
function Write-Package([string]$Name, [string]$Base, [string[]]$Include) {
    $basePath = (Resolve-Path -LiteralPath $Base).Path.TrimEnd('\')
    $archive = [IO.Compression.ZipFile]::Open((Join-Path $destination $Name), [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($relative in $Include) {
            $source = Get-Item -LiteralPath (Join-Path $basePath $relative) -Force
            $files = if ($source.PSIsContainer) { Get-ChildItem -LiteralPath $source.FullName -Recurse -File -Force } else { @($source) }
            foreach ($file in $files) {
                if (-not $file.FullName.StartsWith($basePath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'File outside package root.' }
                $entry = $file.FullName.Substring($basePath.Length + 1).Replace('\', '/')
                if ($entry -match '(^|/)(\.git|node_modules|vendor|storage)(/|$)|\.(jks|keystore|sqlite|log)$|upload-key\.properties' -or
                    ($entry -match '(^|/)\.env($|\.)' -and $entry -ne '.env.production.example')) { throw "Private file rejected: $entry" }
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        }
    } finally { $archive.Dispose() }
    $check = [IO.Compression.ZipFile]::OpenRead((Join-Path $destination $Name))
    try {
        if (-not $check.Entries.Count) { throw "Empty package: $Name" }
        Write-Output "$Name : $($check.Entries.Count) files"
    } finally { $check.Dispose() }
}
$webApps = @(
    @{ Folder = 'app'; Name = 'Business'; Package = 'frontend' },
    @{ Folder = 'mobile'; Name = 'Mobile'; Package = 'mobile' },
    @{ Folder = 'office'; Name = 'Office'; Package = 'office' },
    @{ Folder = 'shop'; Name = 'Shop'; Package = 'shop' }
)
foreach ($app in $webApps) {
    $base = Join-Path $repoRoot "laravel/public/$($app.Folder)"
    if (-not (Test-Path -LiteralPath (Join-Path $base 'index.html')) -or -not (Test-Path -LiteralPath (Join-Path $base '.htaccess'))) { throw "Incomplete build: $base" }
    [ordered]@{ version = $Version; application = $app.Package; built_at_utc = [DateTimeOffset]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $base 'release.json') -Encoding UTF8
    Write-Package "PwarMyar-$($app.Name)-Web-$Version.zip" $base @('.')
}
Write-Package "PwarMyar-Web-Apps-$Version.zip" (Join-Path $repoRoot 'laravel/public') @('app', 'mobile', 'office', 'shop')
Write-Package "PwarMyar-Laravel-Update-$Version.zip" (Join-Path $repoRoot 'laravel') @(
    'app', 'bootstrap/app.php', 'config', 'database/migrations', 'database/seed-data', 'lang', 'resources', 'routes',
    '.htaccess', 'shop', 'public', 'artisan', 'composer.json', 'composer.lock', 'server.php', '.env.production.example', 'deploy',
    'docs/product-imports.md', 'docs/worker-health.md', 'docs/server-health.md',
    'docs/telegram-customer-service.md', 'docs/ai-assistant.md'
)
Write-Package "PwarMyar-Realtime-Server-$Version.zip" (Join-Path $repoRoot 'realtime-server') @(
    'index.js', 'server.js', 'ai-jobs.js', 'package.json', 'package-lock.json', '.env.production.example', '.htaccess',
    'README.md', 'deploy/MKPOS-PRODUCTION.md', 'deploy/AI-JOBS.md', 'deploy/nginx.conf.example'
)
foreach ($relative in $nativeArtifacts) { Copy-Item -LiteralPath (Join-Path $repoRoot $relative) -Destination $destination }
$installer = Join-Path $repoRoot "release/electron/PwarMyar-$Version-Setup-x64.exe"
if (Test-Path -LiteralPath $installer) { Copy-Item -LiteralPath $installer -Destination $destination }
$manifest = foreach ($file in Get-ChildItem -LiteralPath $destination -File | Sort-Object Name) {
    [ordered]@{ file = $file.Name; version = $Version; bytes = $file.Length; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
$manifest | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ASCII
@"
PwarMyar $Version

WEB
Business, Mobile, Office and Shop ZIPs each contain a complete web root including SPA routing rules.
PwarMyar-Web-Apps-$Version.zip contains app/, mobile/, office/ and shop/ for laravel/public.
Production API: https://www.pwarmyar.com/public/api
Customer storefront: https://shop.pwarmyar.com

WINDOWS
Portable-x64 is for 64-bit Windows. Portable-ia32 is for 32-bit Windows.
Setup-x64, when included, is the optional 64-bit installer.
The portable applications are unsigned; no Windows Authenticode certificate is configured.

ANDROID
The APK is a signed release for direct installation; the AAB is for Play Console.
Version: $Version. Android versionCode: $androidCode. The existing upload key is reused.

BACKEND
Deploy PwarMyar-Laravel-Update-$Version.zip to the existing Laravel application.
Preserve its .env, APP_KEY, storage and vendor directories. Install locked Composer dependencies with composer install --no-dev --optimize-autoloader.
Run php artisan migrate --force and php artisan optimize:clear after deployment.
Includes current AI/MCP, privacy, queue, worker-health and Telegram settings migrations.
Supervise wyne-wyne, sales-ai and customer-service workers, or run their cron:work commands every minute. Keep the minute scheduler running; Node can wake these queues immediately.
See the included deploy examples and worker-health, server-health, AI and Telegram documentation.
The Realtime-Server ZIP contains allowlisted Node source and its lockfile; preserve server secrets.
Deploy built artifacts separately using the normal hosting process.

VERIFICATION
manifest.json and SHA256SUMS.txt record all deliverable sizes and SHA-256 hashes.
Package verification covers archive integrity, versions and bundled assets.
This build does not publish files, run production migrations or upload to Play Console.
"@ | Set-Content -LiteralPath (Join-Path $destination 'README.txt') -Encoding UTF8
Write-Output "Release ready: $destination"
