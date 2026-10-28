# PwarMyar Android build

The Android app is a Capacitor wrapper around the existing Vite build. Production
Android builds use token authentication (`VITE_AUTH_MODE=token`) against the
Laravel API. The bundled app runs at `https://localhost`; the API remains the
configured remote HTTPS URL. Laravel-hosted web builds use session authentication.
Keep Capacitor Android, Core and CLI at the patched 8.5.1 release or newer.

## Build a local debug APK

The default build targets the live HTTPS backend. Override `VITE_API_URL` only
when intentionally building against another deployment.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
npm run android:apk:debug
```

Capacitor 8 requires Java 21. The build script uses a JDK 21 under `.jdk/`
when present; otherwise `JAVA_HOME` must point to JDK 21. It also keeps TLS
certificate validation enabled while using the Windows trusted-root store.

The generated file is:

`android/app/build/outputs/apk/debug/app-debug.apk`

Cleartext HTTP is disabled. Local development builds therefore need an HTTPS
Laravel endpoint or an explicitly maintained debug-only network policy.

## Payment screenshot permission policy

Payment screenshots are selected through the Android system picker opened by
the existing HTML file input. The app does not request `READ_MEDIA_IMAGES`,
`READ_EXTERNAL_STORAGE`, or `MANAGE_EXTERNAL_STORAGE`. Android grants access only
to the file the user selects. Camera permission is declared separately for the
barcode scanner and product camera; it is not a broad photo-library permission.

## Refresh native assets after web changes

```powershell
npm run android:sync
```

## Build a signed Play Store AAB

```powershell
npm run android:aab:release
```

On the first run this creates `android/mkpos-upload-key.jks` and its credentials
in `android/upload-key.properties`. Both files are ignored by Git. Back them up
securely and permanently; every future Play Store update must use the same
upload key. The signed bundle is copied to `releases/`.

For both a signed installable APK and the Play Store bundle:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-release.ps1 -Target Both
```

Increment `package.json`, the root package entries in `package-lock.json`, and
Android `versionName`/`versionCode` together before a new store release. Version
1.0.2 uses code 10002. Never regenerate the existing upload key for an update.

## Account deletion and release checks

Settings > Account > Request account deletion prepares a request using the
existing configured PwarMyar support contacts. Copying does not submit a request.
The public page is `/account-deletion` in development and
`https://www.pwarmyar.com/public/mobile/account-deletion` for the live build.
It works without signing in. Support must verify ownership and process requests;
there is no automatic account or business-record deletion endpoint in this app.

Run `npm run build:laravel` to prepare the local Laravel public/mobile web assets.
Deploy those assets to production before entering the deletion URL in Play
Console. A local build does not deploy them. Confirm the public URL, support
handling, privacy/data-retention disclosures and Play Console declarations on
the actual deployment before release.

Run lint, the full test suite, dependency audit and the native release build.
Install the signed APK on a real Android device and check sign-in/sign-out,
root Back/exit, keyboard/safe areas, camera and location permissions, photo
selection, offline sale/reconnect, receipts and Bluetooth printing. Browser
fixtures and native JVM tests do not prove device or authenticated production
behavior. Upload first to Play internal testing and review its pre-launch report.
