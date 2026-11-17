# Settings implementation

Settings uses the compact MKPOS theme, shared radii and Lucide icons. References guide hierarchy; the revised acceptance rule in `AGENTS.md` takes precedence over compressed or inconsistent screenshot details.

## Screen mapping

| Reference | Route or state |
| --- | --- |
| 055 | `/settings`: grouped Identity & Business, Output & Device, Administration and Help |
| 056, 152 | `/settings/account`: profile, password, saving and server validation |
| 057 | `/settings/shop`: logo upload/remove and business identity |
| 058, 163 | `/settings/receipt`: printer shortcut, content, layout and isolated print preview |
| 059 | `/settings/barcode`: stock format, custom dimensions and live barcode preview |
| 060, 170 | `/settings/printer`: Android system, TCP and paired Bluetooth configuration |
| 171 | `/settings/printer`: browser fallback and test print |
| 061 | `/settings/payments`: add, edit and remove methods |
| 062–064 | `/settings/prices`, `/settings/prices/new`, `/settings/prices/:name/edit` |
| 065 | `/settings/security`: actual PIN state and PIN update |
| 066–068, 142 | `/settings/data`, `/settings/data/restore`, `/settings/data/reset`, final confirmation |
| 069 | `/settings/language`: existing English/Myanmar preference |
| 070 | `/settings/about`: actual application version, mode and configured support contacts |
| 167 | Shared permission-aware module navigation, opened through the final app-bar menu action |

## Intentional differences

- Long forms scroll instead of squeezing every field into one frame. Receipt controls and preview stack on mobile. Existing supported numeric receipt controls remain available; unsupported screenshot-only layout modes and content toggles are not fabricated.
- One task header replaces the old shell header on Settings routes. Equivalent fields, rows, warning cards and action bars share compact spacing. Fixed actions reserve bottom space above navigation; narrow grids stack.
- Browser printer selection, copies and color belong to the browser print dialog. The page offers receipt configuration and a working test print, without fake native device selectors or a nonfunctional Save action. Android connection/device flows remain real.
- Barcode options reflect supported stock formats and name/number settings. Pricing retains supported manual/automatic rules and product usage restrictions.
- Account password requirements, existing security API, owner/staff access and paid-plan restrictions remain unchanged. About uses real configured contacts and version rather than reference placeholders.
- Restore and reset keep operational warnings, exact typed confirmation, PIN handling and final reset confirmation. QA never invokes a live destructive action.

## Verification

`node scripts/check-settings-reference.cjs` runs against the dev server with intercepted APIs. Set `SETTINGS_BROWSER=firefox` for Firefox. Screenshots are stored in `artifacts/settings-reference`. It covers all 16 routes at 320, 362, 393 and 768px, label/control overlap, final-content clearance above fixed actions, reset cancellation, retained account draft/DOM through Back/Forward without refetch, rejected save retention, receipt continuation, navigation and all 16 Myanmar destinations. `--localized-only` repeats only the Myanmar capture/check pass.

Settings unit tests cover native printer validation, Bluetooth pagination/retry, browser popup failure/retry, receipt preview isolation, trial restrictions, language, logo uploads and data reset. Android hardware connectivity and physical printed output require a device; desktop browser screenshots do not prove these.

## Account deletion request (2026-10-17)

Account settings now expose a shared scrollable sheet to prepare an account and
associated-personal-data deletion request. The existing configured support
contacts are used; no email address or automatic deletion endpoint is invented.
Copying explicitly does not submit the request. The public `/account-deletion`
resource mounts without authentication and uses the same reusable component.
Support ownership checks and retention details remain part of manual processing.
Deploy the public web assets and verify the live resource before listing it in
Play Console. No real support message was sent during verification.

This is an intentional addition to reference 056 for release readiness. Existing
profile/password controls, compact density and source drafts remain intact.
English and Myanmar public pages at 320/375px and the in-app sheet are captured
under `artifacts/account-deletion`. The request template stays in English for
support processing; instructions and controls follow the selected language.

## Shared design correction (2026-10-16)

All mapped destinations now use the shared field, control, typography and radius system with consistent 12px supporting text, 14px field/body text, compact card padding and scrollable continuation. Password fields have accessible show/hide actions. Receipt and barcode options use switches; receipt paper/alignment use selected buttons. Pricing and language use radio cards. The new SettingsParts components keep these patterns reusable.

The overview retains the four mapped navigation groups. Account keeps separate Profile/Change password cards; Business keeps the real logo and identity editor. Receipt preserves supported content/layout controls and its isolated preview. Barcode separates format, content and preview. Payment methods use editable icon rows. Price types restore the app-bar add action and retain protected record menus; new/edit forms separate identity, mode, automatic calculation, usage and existing-product application. Security separates actual PIN state from PIN update. Backup/restore/reset use task cards and distinct removed/preserved information. About uses actual version/configuration and clickable configured support rows. Printer uses actual platform context, native connection radio cards, print options, a separate Check/Test section and a pinned Save action.

### Intentional usability/API differences

- The common app bar and Reports bottom tab follow the user's newer navigation requests. The app menu is the final app-bar action. No module-root Back or More bottom tab is restored from old screenshots.
- Sections scroll naturally; no fields, warnings or last records are hidden to fit a reference frame. Price mode cards stack at 320px; pricing fields use compact inline labels when space permits. Shared fields retain usable heights even where references show smaller controls.
- Receipt title stays in Receipt settings, preserving the existing tested separation from Business. The actual logo API remains immediate upload/remove. Unsupported image/account-avatar actions are not fabricated.
- Security displays the real configured-PIN state. The current API does not support the reference's PIN-disable toggle or separate current/confirm PIN fields; no cosmetic controls are added for them.
- Price previews use the real pricing helper, including minimum profit. The screenshot's example total can differ from the correct calculated total. Product usage restrictions and explicit apply-to-existing scope remain intact.
- Browser printer copies, orientation and device choice stay in the real browser print dialog; the page provides receipt configuration and Test print. Native and browser modes are actual environment context, not a fake platform selector. Paired-device refresh remains a specific device discovery action.
- Real business data, supported barcode stock formats, backup status, version and configured support contacts replace reference placeholders. Empty restore selection remains a real file chooser; no reference backup file is fabricated.

### Final evidence

30 focused Settings/shared-control tests passed, including native validation/discovery/retry, receipt options saved through the new switches/segments, automatic pricing saved through radio selection, language activation, receipt-title scope, logo changes and reset protection. Lint and production build passed.

Chromium and Firefox fixture checks passed for all 16 routes at four widths. They also exercise password visibility, retained account draft/DOM without Back-triggered reads, reset cancellation without a destructive request, and simulated Android system/network/Bluetooth configuration and Save. Native bridge methods are fixtures: this does not prove physical printer connectivity/output or Android keyboard behavior.

Rendered reference comparisons (`comparison-055.png` through `comparison-070.png`), full-page captures, narrow/bottom captures, all Myanmar pages and native printer captures in `artifacts/settings-reference` were inspected. Supporting results: [Chromium](../../../artifacts/settings-reference/checks-chromium.json), [Firefox](../../../artifacts/settings-reference/checks-firefox.json). Final Myanmar checks were repeated after translating the updated labels.
