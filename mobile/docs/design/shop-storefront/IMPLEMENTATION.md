# Storefront implementation

Route: `/shop/storefront`.
References: `101-shop-storefront-storefront-default.png` and `166-opening-hours-continuation.png`.

The page follows the reference section order: identity, public URL and slug, online price, description, availability switches, announcement, expandable weekly hours, temporary closure and independent-settings notice. It uses shared MKPOS theme tokens and compact typography. Save and Cancel remain reachable above bottom navigation; content scrolls naturally.

## Intentional differences

- Shared business details remain available in an expandable identity section. Only owners can edit them; staff can edit permitted storefront settings.
- Actual saved public URLs and server-provided slug locking replace illustrative reference data. Slugs become read only once the business has orders; the API still rejects concurrent slug changes.
- Description and announcement retain the supported 4000/1000 character limits rather than the reference's illustrative 250.
- Expanded hours use editable native opening/closing fields and per-day Closed controls. Weekly drafts survive toggling the schedule off and on. Invalid days open the disclosure and display field errors.
- Temporary closure pauses checkout until a required business-local date/time. It does not hide the shop. Visibility, accepting orders and marketplace switches remain independent.
- Cancel is retained for existing history behavior. Native browser time/date presentation varies by browser and OS. No operating-system status bar is fabricated.
- Shared field heights and natural scrolling replace compressed reference frames. There is no global density change.

## Verification

- `npx vitest run src/shop/ShopStorefront.test.jsx`: 5 passed, covering fresh independent settings, staff restrictions, hours validation/draft retention, failed saves, Cancel and closure drafts.
- Laravel `php artisan test --filter=EcommerceApiTest`: 80 passed, including slug lock metadata and 409 rejection after an order.
- `scripts/check-shop-storefront-reference.cjs`: passed Chromium and Firefox against the development server, with all API calls intercepted. Covers 320/393/768 widths, hours/closure controls, failed-save recovery, single save payload, owner navigation and Myanmar at 320.
- Inspected rendered screenshots against both references at 393x817, plus expanded narrow and Myanmar content. Evidence is in `artifacts/shop-storefront-reference/{chromium,firefox}`. Sticky controls in full-page captures appear at the capture's current scroll position; viewport captures show the actual action placement.
- Scoped ESLint passes. No production build was run.

## Controls and return behavior

Back and Cancel use existing history with `/shop` fallback. The browser check opens the form from Manage storefront, returns to My Shop, and resumes the retained form through Forward. The public shop anchor uses the saved slug and opens a separate tab; it does not mutate settings. Shared details and hours expand locally. Switches stage draft changes; Save performs one fresh settings read and one PUT, preserving independently managed delivery settings and leaving payment methods untouched. Errors retain the draft. Busy state disables form controls and Back. Loading/error states use shared ShopLoadState and Retry.

Backend changes only add tenant-scoped `slug_locked` read metadata; no schema migration is needed.
