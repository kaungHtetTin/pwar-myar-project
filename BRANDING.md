# PwarMyar branding and deployment configuration

This change updates branding and deployment settings only. Existing features,
API routes, permissions, and business workflows are preserved. Versions remain
at 3.0.4.

## Production addresses

| Application | Address |
| --- | --- |
| Landing website | https://www.pwarmyar.com |
| Laravel base | https://www.pwarmyar.com/public |
| Laravel API | https://www.pwarmyar.com/public/api |
| Office | https://office.pwarmyar.com |
| Customer shop | https://shop.pwarmyar.com |
| Mobile POS | https://mobilepos.pwarmyar.com |
| Desktop browser POS | https://pos.pwarmyar.com |
| Socket server | https://socket.pwarmyar.com |

The production and Laravel Vite environment files use the central Laravel API.
The local Laravel `.env` retains `http://127.0.0.1:8000` for development.
Laravel CORS and Sanctum configuration includes the new domains; local
development origins and native Capacitor origins remain supported. Socket
allowlists and the nginx example use the new domains. Apache legacy owner-app
links redirect to `pos`, `mobilepos`, and `office` respectively.

`LANDING_URL` configures the website address. Existing `MKPOS_WEB_URL`,
`MKPOS_MOBILE_URL`, `MKPOS_OFFICE_URL`, and `MKPOS_SHOP_URL` environment keys
remain supported, with PwarMyar values. Their internal names are retained for
deployment compatibility.

## Logo assets

Original artwork is retained in `logo/`:

- `main_logo.jpg`: main artwork, included as `pwarmyar-main.jpg` and used in
  landing-page sharing metadata.
- `transparent_logo_with_label.png`: cropped to its visible artwork as
  `pwarmyar-logo.png`, used in the landing footer.
- `transparent_logo_without_label.png`: used as `pwarmyar-mark.png` for app
  branding, authentication/welcome screens, and the Windows splash screen.

Square `pwarmyar-icon.png` assets, a multi-size ICO, Android launcher icons,
adaptive foregrounds, and splash images are derived from the supplied artwork.
Assets live in the web apps' public branding folders, Laravel's independent
`public/branding` folder, and `desktop/branding`. Office shares the frontend
public assets. Existing legacy logo filenames serve the new artwork too.
Office's existing custom-branding controls still override bundled defaults.

## Native applications

- Android application ID and namespace: `com.pwarmyar.mobile`.
- Android Java packages and native tests have moved to `com/pwarmyar/mobile`.
- Android label, URL scheme, Capacitor metadata, launcher icons and splash
  resources use PwarMyar. The new ID installs separately from the old MKPOS app.
- Windows AppUserModelID and builder app ID: `com.pwarmyar.desktop`.
- Windows executable/product/shortcuts: `PwarMyar`.
- Portable artifacts: `PwarMyar-${version}-Portable-${arch}.exe`.
- Installer artifacts: `PwarMyar-${version}-Setup-${arch}.exe`.
- Existing Windows `mkpos-desktop` user data is reused when present to preserve
  offline sales and printer settings. Internal database filenames, bridge/plugin
  identifiers, HTTP headers and browser storage keys remain compatible.
- Existing Android signing credentials are retained. Renaming a brand does not
  replace its signing key.

## Verification and deployment

`scripts/check-pwarmyar-branding.cjs` renders all four production web builds at
390px and 1440px, checks their new titles/icons/logos and central API requests,
and saves screenshots under `artifacts/pwarmyar-branding`. API requests are
intercepted, so this check does not use production accounts. Set
`PWARMYAR_LANDING_URL` to an existing local Laravel server to include the landing
page.

The web builds, Android debug APK and unpacked Windows x64 app are generated
locally. Signing/publishing production releases, DNS records, certificates and
server deployment still require the hosting/release process. Existing SMTP
accounts and Telegram bot addresses are retained because new service credentials
and bot handles have not been supplied.

Original changed source files were backed up before the migration outside the
repository at
`C:\Users\Hp\AppData\Local\Temp\pwarmyar-branding-backup-b2m4jx3q`.

### Validation results

- All four Laravel web builds and the desktop renderer build passed.
- Mobile, frontend, and Office lint passed.
- Focused tests passed: mobile 24, frontend 27, Office 2, Electron 42,
  realtime server 22, Laravel 15, and Android native unit tests 12.
- Apache routing passed with both project-root and public-root hosting layouts.
- Browser branding checks passed in 10 application/viewport combinations,
  including the landing page. Final screenshots were visually inspected.
- Android debug assembly passed; APK metadata confirms `com.pwarmyar.mobile`,
  label `PwarMyar`, and activity `com.pwarmyar.mobile.MainActivity`.
- Windows x64 unpacked packaging passed; executable metadata reports PwarMyar.
- The broader UI suite runs produced failures/timeouts across modules and were
  stopped. Those full suites are not reported as passing; the focused passing
  checks above cover the branding and changed application configuration.
