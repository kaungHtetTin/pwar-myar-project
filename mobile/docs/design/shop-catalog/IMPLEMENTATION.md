# Shop Catalog implementation

## Reference mapping

| Reference | Screen or state |
| --- | --- |
| 077 | `/shop/catalog`: search, list, published count and bulk actions |
| 078 | `/shop/catalog/:id/edit`: publication editor and online preview |
| 121 | Shared right-side filter drawer |
| 139 | Bulk publication/unpublication confirmation |
| 150 | Expired subscription gate, including editor deep links |

The compact MKPOS theme and shared typography, radii, Lucide icons and drawer/sheet primitives take precedence over compressed screenshot measurements. A task header replaces the shell header on catalog routes. Natural scrolling and reserved footer space keep final rows, form fields and preview accessible.

## Intentional differences

- Product checkboxes select an explicit set, independently of the edit button. Select loaded products adds the loaded rows; Clear selection clears the set. Selection remains across pagination, searches, filters and editor Back, up to 1,000 products. Selected rows use the shared mint surface without an outline.
- With a selection, the footer offers **Publish selected / Unpublish selected** and explicitly includes selections hidden by other filters. Without a selection, it retains **all filtered products**, including unloaded pages. Confirmation snapshots the IDs or the search/filter query; cancellation never writes. Publishing uses neutral confirmation styling.
- The Laravel bulk endpoint now accepts optional distinct `product_ids`. Selected requests omit list filters and update only those tenant-scoped IDs atomically. Missing/inaccessible products and invalid publication prices reject the entire batch. Failure retains selection for retry; success clears the affected selection and reconciles the loaded list. Deploy the Laravel endpoint together with the mobile change.
- Each row contains a separate accessible edit button with photo/fallback, identity, stock, actual unit price and status. A pencil replaces a one-action menu. Counts come from the filtered response. Fixture photos may be absent; production photos retain the authenticated ProductPhoto loader.
- Identity, stock and prices remain read-only here. The editor saves the supported selling unit, online description and publication state. Prices derive from the shop price type and unit. No unsupported editable name or price field is fabricated. The preview follows the draft unit, description and status.
- Filters retain supported category, stock, publication, price-presence and sorting values. Unsupported numeric price ranges are omitted. Reset edits the draft; Apply commits it; closing discards uncommitted changes. Search remains independent and debounced.
- Narrow cards wrap. Long forms and preview scroll rather than shrinking into one frame. Save validation scrolls into view and preserves entered values.
- The expired view opens Billing or My Shop without loading protected catalog data or fake inactive inventory. Backend entitlements and the owner-location gate remain authoritative.

## Controls and verification

| Controls | Observed behavior |
| --- | --- |
| Search / empty-state Clear | Debounced matching results; clear restores search and filters |
| Filters, Apply, Reset, close/Escape | Shared drawer; no draft-only request; reopen retains applied values |
| Checkboxes / Select loaded / Clear | Explicit selection retained across searches and editor Back; no accidental navigation |
| Bulk Publish / Unpublish | Selected-ID or all-matching scope; cancellation without mutation; failure/retry |
| Product row / Back | Correct editor; retained list, query and loaded rows; no Back-only request |
| Browser Forward | Retained editor description and selling unit |
| Unit / description / publication | Supported payload and preview; existing unit-save test passes |
| Save | Field validation preserves draft; retry saves and returns to retained search |
| Gate Billing / My Shop | Correct navigation without protected list requests |
| More / language | Existing navigation and Myanmar layout |

`node scripts/check-shop-catalog-reference.cjs` uses the dev server with intercepted APIs. Set `CATALOG_BROWSER=firefox` for Firefox. It checks all five states at 320, 393 and 768px, overflow, drafts, bulk cancellation/retry, save validation/retry, retained source, empty state, Myanmar and the subscription gate. It never changes live records. Artifacts are in `artifacts/shop-catalog-reference`.

The focused Shop, navigation and radius suites passed 78 tests; scoped lint passed. Legacy `check-shop-mobile.cjs` was attempted but stops before Catalog on an ambiguous order-payment selector. It is not counted as passing verification. The dedicated catalog checks cover this update. Production build was skipped as requested.

### Selected publication update, 18 October 2026

The user requested selection in addition to the existing all-filtered flow. Focused catalog/configuration tests pass (9 tests); Laravel selected publication and existing bulk/filter tests pass (3 tests, 89 assertions); lint passes. `scripts/check-catalog-selection.cjs` verifies exact selected-ID requests, cancellation, retry, hidden selections and editor Back using intercepted APIs. Chromium and Firefox pass. Existing catalog reference checks also pass in both browsers. Final screenshots at 375 and 320px and Myanmar were inspected in `artifacts/catalog-selection`: narrow cards stack price below identity to keep text readable, and the pinned actions reserve scroll space. These are intentional local adaptations, not an app-wide density change. No live publications were modified.
