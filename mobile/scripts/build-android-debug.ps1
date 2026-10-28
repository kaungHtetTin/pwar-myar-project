param(
    [string]$ApiUrl = $env:VITE_API_URL,
    [string]$ShopUrl = $env:VITE_SHOP_URL
)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = 'https://www.pwarmyar.com/public/api'
}

$localJdk = Get-ChildItem -LiteralPath (Join-Path $mobileRoot '.jdk') -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-21*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

if ($localJdk) {
    $env:JAVA_HOME = $localJdk.FullName
}

if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
    throw 'Java 21 is required. Set JAVA_HOME or place a JDK 21 distribution under mobile/.jdk/.'
}

$javaExecutable = Join-Path $env:JAVA_HOME 'bin\java.exe'
if (-not (Test-Path -LiteralPath $javaExecutable)) {
    throw "JAVA_HOME does not contain bin/java.exe: $env:JAVA_HOME"
}

$javaVersion = (& $javaExecutable --version | Select-Object -First 1)
if ($javaVersion -notmatch '(?<!\d)21(?:\.|\s)') {
    throw "Capacitor Android requires Java 21; found: $javaVersion"
}

$env:VITE_API_URL = $ApiUrl.TrimEnd('/')
if (-not [string]::IsNullOrWhiteSpace($ShopUrl)) { $env:VITE_SHOP_URL = $ShopUrl.TrimEnd('/') }
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

# This machine's Java CA bundle is older than the Windows trusted-root store.
# Keep certificate validation enabled while allowing Gradle to use Windows roots.
$windowsTrustOption = '-Djavax.net.ssl.trustStoreType=Windows-ROOT'
if ($env:GRADLE_OPTS -notlike "*$windowsTrustOption*") {
    $env:GRADLE_OPTS = "$($env:GRADLE_OPTS) $windowsTrustOption".Trim()
}

Push-Location $mobileRoot
try {
    npm run android:sync
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }

    Push-Location (Join-Path $mobileRoot 'android')
    try {
        .\gradlew.bat assembleDebug
        if ($LASTEXITCODE -ne 0) { throw 'Android debug build failed.' }

        $package = Get-Content -LiteralPath (Join-Path $mobileRoot 'package.json') -Raw | ConvertFrom-Json
        $sourceApk = Join-Path $mobileRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
        $releaseDir = Join-Path $mobileRoot 'releases'
        $releaseApk = Join-Path $releaseDir "PwarMyar-mobile-production-debug-$($package.version).apk"
        New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
        Copy-Item -LiteralPath $sourceApk -Destination $releaseApk -Force
        Write-Output "APK: $releaseApk"
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
