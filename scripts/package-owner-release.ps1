param([string]$Version = '2.0.0')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Use a semantic version.' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = Join-Path $repoRoot "release\owner-apps-$Version"
if (Test-Path -LiteralPath $destination) { throw "Release already exists: $destination" }
foreach ($app in @('frontend', 'mobile', 'desktop')) {
    $package = Get-Content -LiteralPath (Join-Path $repoRoot "$app/package.json") -Raw | ConvertFrom-Json
    if ($package.version -ne $Version) { throw "$app version mismatch." }
}
$artifacts = @(
    "release/electron/PwarMyar-$Version-Portable-x64.exe",
    "release/electron/PwarMyar-$Version-Portable-ia32.exe",
    "mobile/releases/PwarMyar-mobile-production-release-$Version.apk",
    "mobile/releases/PwarMyar-mobile-production-$Version.aab"
)
foreach ($relative in $artifacts) { if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relative))) { throw "Missing artifact: $relative" } }
New-Item -ItemType Directory -Path $destination | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
function Write-WebZip([string]$Name, [string[]]$Folders, [bool]$KeepFolder) {
    $archive = [IO.Compression.ZipFile]::Open((Join-Path $destination $Name), [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($folder in $Folders) {
            $base = (Resolve-Path -LiteralPath (Join-Path $repoRoot "laravel/public/$folder")).Path
            if (-not (Test-Path -LiteralPath (Join-Path $base 'index.html'))) { throw "Missing web entry for $folder" }
            foreach ($file in Get-ChildItem -LiteralPath $base -Recurse -File -Force) {
                $relative = $file.FullName.Substring($base.Length + 1).Replace('\', '/')
                if ($relative -match '(^|/)(\.env|node_modules|\.git)|\.(jks|keystore|log|sqlite)$') { throw 'Private file found in web output.' }
                $entry = if ($KeepFolder) { "$folder/$relative" } else { $relative }
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        }
    } finally { $archive.Dispose() }
}
Write-WebZip "PwarMyar-Business-Web-$Version.zip" @('app') $false
Write-WebZip "PwarMyar-Mobile-Web-$Version.zip" @('mobile') $false
Write-WebZip "PwarMyar-Laravel-Owner-Web-$Version.zip" @('app', 'mobile') $true
foreach ($relative in $artifacts) { Copy-Item -LiteralPath (Join-Path $repoRoot $relative) -Destination $destination }
$manifest = foreach ($file in Get-ChildItem -LiteralPath $destination -File | Sort-Object Name) {
    [ordered]@{ file = $file.Name; version = $Version; bytes = $file.Length; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
$manifest | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ASCII
@"
PwarMyar owner apps $Version

PwarMyar-Laravel-Owner-Web-$Version.zip: extract into laravel/public (contains app/ and mobile/).
The individual Business-Web and Mobile-Web ZIPs contain files for public/app and public/mobile respectively.
Android: signed release APK for direct installation; AAB for the existing Play Console app. Build code 20000.
Windows: portable x64 and ia32 applications.

API: https://www.pwarmyar.com/public/api
Customer storefront links: https://shop.pwarmyar.com
Socket configuration comes from Laravel at runtime: https://socket.pwarmyar.com:443.
Deploy the current Laravel/backend and Node code for new realtime features; preserve their existing secrets and update allowed origins.
These files are prepared for publication; no hosted releases were replaced by this build.
"@ | Set-Content -LiteralPath (Join-Path $destination 'README.txt') -Encoding UTF8
Write-Output "Owner release ready: $destination"
