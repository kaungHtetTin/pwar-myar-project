param(
    [string]$ApiUrl = $env:VITE_API_URL,
    [ValidateSet('Aab', 'Both')][string]$Target = 'Aab'
)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidRoot = Join-Path $mobileRoot 'android'
$propertiesPath = Join-Path $androidRoot 'upload-key.properties'
$keystorePath = Join-Path $androidRoot 'mkpos-upload-key.jks'

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = 'https://www.pwarmyar.com/public/api'
}

$localJdk = Get-ChildItem -LiteralPath (Join-Path $mobileRoot '.jdk') -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-21*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

if ($localJdk) { $env:JAVA_HOME = $localJdk.FullName }
if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
    throw 'Java 21 is required. Set JAVA_HOME or place JDK 21 under mobile/.jdk/.'
}

$javaExecutable = Join-Path $env:JAVA_HOME 'bin\java.exe'
$keytoolExecutable = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path -LiteralPath $javaExecutable) -or -not (Test-Path -LiteralPath $keytoolExecutable)) {
    throw "JAVA_HOME is not a complete JDK: $env:JAVA_HOME"
}
if ((& $javaExecutable --version | Select-Object -First 1) -notmatch '(?<!\d)21(?:\.|\s)') {
    throw 'Capacitor Android requires Java 21.'
}

if (-not (Test-Path -LiteralPath $propertiesPath)) {
    $randomBytes = New-Object byte[] 36
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
    $password = [Convert]::ToBase64String($randomBytes).Replace('+', 'A').Replace('/', 'B').TrimEnd('=')
    & $keytoolExecutable -genkeypair -v -keystore $keystorePath -alias mkpos-upload -keyalg RSA -keysize 4096 -validity 10000 -storepass $password -keypass $password -dname 'CN=PwarMyar, OU=Mobile, O=PwarMyar, L=Yangon, ST=Yangon, C=MM'
    if ($LASTEXITCODE -ne 0) { throw 'Upload keystore generation failed.' }
    @(
        'storeFile=mkpos-upload-key.jks'
        "storePassword=$password"
        'keyAlias=mkpos-upload'
        "keyPassword=$password"
    ) | Set-Content -LiteralPath $propertiesPath -Encoding ascii
}

$env:VITE_API_URL = $ApiUrl.TrimEnd('/')
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$windowsTrustOption = '-Djavax.net.ssl.trustStoreType=Windows-ROOT'
if ($env:GRADLE_OPTS -notlike "*$windowsTrustOption*") {
    $env:GRADLE_OPTS = "$($env:GRADLE_OPTS) $windowsTrustOption".Trim()
}

Push-Location $mobileRoot
try {
    $nativePreference = $ErrorActionPreference
    try {
        # Native tools use stderr for build warnings; use their exit status.
        $ErrorActionPreference = 'Continue'
        npm.cmd run android:sync
        $syncExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $nativePreference }
    if ($syncExitCode -ne 0) { throw 'Capacitor sync failed.' }
    Push-Location $androidRoot
    try {
        try {
            $ErrorActionPreference = 'Continue'
            if ($Target -eq 'Both') { .\gradlew.bat assembleRelease bundleRelease }
            else { .\gradlew.bat bundleRelease }
            $gradleExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $nativePreference }
        if ($gradleExitCode -ne 0) { throw 'Android release bundle build failed.' }
    } finally { Pop-Location }

    $package = Get-Content -LiteralPath (Join-Path $mobileRoot 'package.json') -Raw | ConvertFrom-Json
    $sourceBundle = Join-Path $androidRoot 'app\build\outputs\bundle\release\app-release.aab'
    $releaseDir = Join-Path $mobileRoot 'releases'
    $releaseBundle = Join-Path $releaseDir "PwarMyar-mobile-production-$($package.version).aab"
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    Copy-Item -LiteralPath $sourceBundle -Destination $releaseBundle -Force
    Write-Output "AAB: $releaseBundle"
    if ($Target -eq 'Both') {
        $releaseApk = Join-Path $releaseDir "PwarMyar-mobile-production-release-$($package.version).apk"
        Copy-Item -LiteralPath (Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk') -Destination $releaseApk -Force
        Write-Output "APK: $releaseApk"
    }
    Write-Output "UPLOAD KEY: $keystorePath"
    Write-Output "KEY CREDENTIALS: $propertiesPath"
} finally { Pop-Location }

