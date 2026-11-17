# Shop location

`/shop/location` follows 072 (saved location) and 154 (permission denied).

The normal screen keeps the reference's saved-location card, Coordinates and Last updated rows, public-location card with disclosure and Update location, then Need help rows. Help rows are native expandable disclosures with keyboard support. Permission denial uses the separate icon/title/explanation/disclosure/Try again/Back layout from 154. Timeout, unavailable-device and save failures remain recoverable without discarding the last saved coordinates.

Shared compact PwarMyar typography, green theme, radius tokens, bottom navigation and natural scrolling are retained. Native OS status chrome is omitted. The reference's word verified is replaced with saved: recording owner GPS coordinates does not independently verify an address. Coordinates display four decimal places; the original device precision and accuracy are sent unchanged to the API. Dates use the shared formatter and business timezone.

`GET /shop-admin/owner-location` and a successful POST now return the current tenant's actual latitude, longitude, accuracy and capture time alongside the existing submitted flag. No schema changes were required. POST retains the existing owner restriction and validation. The dedicated location route reads its own status; setup gates reuse their status payload rather than issuing a duplicate request. Missing-location gates still block protected content. On denial inside the required setup gate, Back returns to the setup explanation; it does not bypass setup. On the dedicated screen, Back resumes the actual source with the existing My Shop fallback.

Controls: Update location requests fresh high-accuracy GPS once, saves once, and refreshes the saved summary from the response. Try again repeats the permission request without inventing coordinates. No request is sent when device acquisition fails. Help rows expand/collapse. Staff can read the saved location but cannot update it. Required staff setup explains that the owner must act. HTTP-insecure environments receive the existing HTTPS/localhost explanation.

Verification: `node scripts/check-shop-identity-reference.cjs` runs fixture-only browser checks at 320/393/768 widths, 072/154 layouts, disclosures/keyboard focus, denied/unavailable/timeout states, save failure/retry, source retention, staff restrictions and successful required setup. Set `IDENTITY_BROWSER=firefox` for Firefox. No live GPS or live location mutation is used. Actual mobile OS permission dialogs and physical GPS accuracy require device testing; the browser checks exercise the same callbacks using deterministic fixtures.

Screenshots and verification records: `artifacts/shop-identity-reference`. React tests cover duplicate-request protection, denied recovery, required gate behavior and preserving saved data after failure. The Laravel transaction test verifies actual response fields, public storefront/discovery values, input validation, owner-only writes and tenant isolation. No production build was run.

Completed verification: Chromium and Firefox fixture checks passed; 92 scoped frontend tests passed, along with the expanded Laravel location feature test. Scoped ESLint and handoff validation passed. Same-viewport comparisons: `artifacts/shop-identity-reference/compare-072.png`, `compare-154.png`, and `compare-104.png`. Final screenshots were inspected, including 320px width, Myanmar text and scrollable content.

## Simplified layout, 2026-11-04

The user requested a simpler mobile location page, superseding the earlier multi-card reference layout. There is now one compact card containing the location heading, brief GPS guidance, an explicit public-coordinate/owner-only notice and the primary location action. Saved coordinates and capture time remain available. Repeated introductory/public-location sections and the large colored disclosure were removed. Help is one collapsed disclosure; errors expand help and the matching topic. The denied state uses the same compact card with Try again and the existing Back behavior.

Permission, GPS, save, duplicate-submit, staff access, source Back and setup handoff behavior are preserved. New concise text is localized to Myanmar. Page spacing and changes are scoped to location, using shared controls and tokens with 44px targets.

Verification: location/setup/radius regression checks passed (24 tests), lint passed, normal and Laravel builds passed. Fixture browser checks passed at 390px English/light, 320px Myanmar/light and 768px English/dark, including help expand/collapse and successful GPS-to-setup navigation. Screenshots were inspected at `artifacts/mobile-shop-setup/*-location.png` and `*-location-help.png`. Native GPS permission dialogs remain a device-testing gap.
