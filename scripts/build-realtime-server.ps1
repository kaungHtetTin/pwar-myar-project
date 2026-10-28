param([string]$ReleaseName = ("realtime-server-" + (Get-Date -Format 'yyyyMMdd-HHmmss')))
$ErrorActionPreference = 'Stop'
if ($ReleaseName -notmatch '^[a-zA-Z0-9.-]+$') { throw 'Use a simple release name.' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceRoot = Join-Path $repoRoot 'realtime-server'
$outputRoot = Join-Path $repoRoot 'release\realtime-server'
$archivePath = Join-Path $outputRoot "$ReleaseName.zip"
if (Test-Path -LiteralPath $archivePath) { throw "Release already exists: $archivePath" }
Push-Location $sourceRoot
try {
    & node --check index.js
    if ($LASTEXITCODE -ne 0) { throw 'Entry point syntax check failed.' }
    & node --check server.js
    if ($LASTEXITCODE -ne 0) { throw 'Server syntax check failed.' }
    & node --check ai-jobs.js
    if ($LASTEXITCODE -ne 0) { throw 'AI dispatcher syntax check failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Realtime tests failed; package was not created.' }
} finally { Pop-Location }
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$files = @('index.js', 'server.js', 'ai-jobs.js', 'package.json', 'package-lock.json', 'README.md', '.env.example', '.env.production.example', '.htaccess', 'deploy/MKPOS-PRODUCTION.md', 'deploy/AI-JOBS.md', 'deploy/nginx.conf.example')
$archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relative in $files) {
        $file = Get-Item -LiteralPath (Join-Path $sourceRoot $relative) -Force
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($check.Entries.Count -ne $files.Count) { throw 'Release file count mismatch.' }
    foreach ($entry in $check.Entries) {
        if ($entry.FullName -notin $files) { throw "Unexpected release file: $($entry.FullName)" }
        if ($entry.FullName -eq '.env' -or $entry.FullName -match '(^|/)(node_modules|\.git)/') { throw 'Private or local files found in package.' }
    }
} finally { $check.Dispose() }
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $ReleaseName.zip" | Set-Content -LiteralPath (Join-Path $outputRoot "$ReleaseName.sha256") -Encoding ASCII
Write-Output "Ready: $archivePath"
Write-Output "SHA256: $hash"
