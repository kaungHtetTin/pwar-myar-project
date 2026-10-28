# Product module implementation

Compact reference layouts cover inventory, the three-step new/edit wizard, stock adjustment, filter drawer, delete confirmation, photo crop, CSV review, barcode picker and loading/empty/no-match/failure states. The green theme, shared radii and existing product API contracts remain in use.

## Reference evidence

Side-by-side comparisons place the normalized reference on the left and the rendered application on the right. Captures use 393px width and the reference's content height, excluding painted phone status chrome. Responsive captures at 320 and 768px are in the same artifact directory.

| References | Screens | Evidence |
| --- | --- | --- |
| 006 | Inventory | [Comparison](../../../artifacts/products-reference/comparison-006.png) |
| 007–009 | New product Basic, Inventory, Prices | [Basic](../../../artifacts/products-reference/comparison-007.png), [Inventory](../../../artifacts/products-reference/comparison-008.png), [Prices](../../../artifacts/products-reference/comparison-009.png) |
| 010–012 | Edit product Basic, Inventory, Prices | [Basic](../../../artifacts/products-reference/comparison-010.png), [Inventory](../../../artifacts/products-reference/comparison-011.png), [Prices](../../../artifacts/products-reference/comparison-012.png) |
| 013 | Stock adjustment | [Comparison](../../../artifacts/products-reference/comparison-013.png) |
| 112 | Right filter drawer | [Comparison](../../../artifacts/products-reference/comparison-112.png) |
| 129 | Delete confirmation | [Comparison](../../../artifacts/products-reference/comparison-129.png) |
| 130 | Full-page photo crop | [Comparison](../../../artifacts/products-reference/comparison-130.png) |
| 131 | CSV review | [Comparison](../../../artifacts/products-reference/comparison-131.png) |
| 132 | Barcode side panel | [Comparison](../../../artifacts/products-reference/comparison-132.png) |
| 145–148 | Loading, empty inventory, no matches, load failure | [Loading](../../../artifacts/products-reference/comparison-145.png), [Empty](../../../artifacts/products-reference/comparison-146.png), [No matches](../../../artifacts/products-reference/comparison-147.png), [Failure](../../../artifacts/products-reference/comparison-148.png) |

## Updated behavior

- Filter categories and stock states use compact radio rows. Selections remain drafts until Apply; dismissing the drawer makes no filter request. Reset clears applied filters.
- CSV selection opens a review sheet before any product is created. Missing names and invalid/negative costs block import; zero costs remain valid under the existing contract. Valid files require confirmation. The existing importer continues to report added/skipped/failed results and is not transactional.
- Barcode selection retains saved paper formats, search, categories and selection, with generated CODE128 previews of the actual barcode values. Disabled printing is visibly disabled.
- Barcode printing and CSV import review now use the same native-dialog drawer as filters: shared right-side width, icon/title/description header, square close control, unblurred backdrop, scrollable content and separate pinned action footer. The shared Firefox overflow-clipping fix and keyboard/focus handling apply to both flows.
- Photo cropping uses the full viewport, a square grid, zoom, reset and Use photo. Existing square JPEG compression to at most 50KB remains unchanged.
- Loading uses themed skeletons and status feedback. Empty inventory offers Add/Import. No matches offers Clear search/Reset filters. Failure offers Retry and secondary Export/Import/Scan options. Failure/loading no longer imply an authoritative zero product count.
- Existing create/edit fields, price-rule initialization, automatic pricing, source-state retention, stock direction/validation/history and permission-aware navigation remain intact.

## Verification

Run `node scripts/check-products-reference.cjs` against `http://127.0.0.1:5176`. Requests are intercepted with fixtures and storage is isolated; no live records are mutated. Seventeen screen/state captures include responsive overflow checks, create/edit payloads, crop use, stock validation/failure/retry, retained Back/Forward without unchanged-source refetch, filter draft dismissal, invalid CSV review, barcode preview, and load retry. Existing wizard/index/stock Myanmar captures and keyboard focus evidence are retained. See [results](../../../artifacts/products-reference/checks.json).

Product tests plus AppShell tests: 49 passed, including CSV confirmation/blocking and deferred filter application. Targeted ESLint passed. Production build skipped as requested. Physical Android Back, camera hardware and a physical printer were not exercised; existing scanner/camera/photo/barcode tests remain passing.

## Explicit differences

These are inspected comparisons, not pixel-identical claims. Actual categories, dates, stock totals, currency and API-supported fields take precedence over fictional reference data. Optional SKU/category remain optional; unsupported unit-size metadata is omitted. Existing wizard limits and configurable pricing modes remain available. The shared drawer/sheet headers, focus treatment, backdrop and typography preserve the application theme. The empty-state package is a Lucide icon rather than the reference illustration.

The current product DELETE request has no PIN-entry contract in this UI; the confirmation retains its real linked-history behavior instead of claiming permanent deletion or adding a cosmetic PIN field. Crop processing supports zoom/reset, not rotation; the Rotate button is not fabricated. The fixture crop source is a small image extracted from a reference, so its preview is visibly lower resolution. Barcode printing retains one label per selected product and existing paper settings rather than exposing unsupported copy-count controls. Additional search/category/settings controls remain available in the side panel. Shared sheet close controls and error details remain available even where absent in a reference. Native controls, fonts and device chrome vary by platform.
# Product app-bar actions (2026-10-16)

Import CSV and Select and print barcodes now use shared icon buttons in the Products app bar, alongside Export CSV. The app menu remains the final action. The page Tools toggle/panel and duplicate empty/error-state import actions are removed to give direct access without an extra click. The hidden file input, import review, barcode selection/printing and individual product actions retain their existing behavior.

Validation: 18 ProductsScreen tests, lint and production build passed. Isolated product-reference browser checks cover the file chooser/import review, barcode picker and retained search/source state on Back. App-bar checks at 320px and 362px confirm icon-only actions, the final menu position and no horizontal overflow. Final rendered mobile screenshots were inspected; this action placement intentionally differs from reference 006 at the user's request.

## Import page pinned actions (22 October 2026)

The full-page CSV importer uses the existing product fixed-action pattern above
the workspace navigation. One footer owns Change file / Upload CSV during
client review, Change file / Import or Resume after upload, a full-width Pause
while processing, and Change file / Done at completion. Buttons share equal
columns, a 44px minimum touch height, compact 13px text and wrapping labels.
The footer follows the page's 720px width cap and device side insets. Its
measured height reserves scroll space for the last row, including translated
labels. The duplicate bottom Back to products button is removed; the app-bar
Back arrow remains available.

Feature parity inventory: file limits and local validation, local filters and
endless preview, explicit upload and server confirmation, saved import history,
endless server rows, rejected-upload retry, pause/resume, completion and retained
source navigation remain supported. This request adjusts action placement and
button labels. The upload handler and server API contract are unchanged.

Interaction checks verify a single footer outside the scrolling review content,
one app-bar Back control, disabled invalid-file upload, upload/confirmation,
Change file reset, Pause/Resume and Done. Final screenshots, translated layout,
keyboard and physical device checks remain unverified: the in-app browser
connection failed before a browser session could start.

Verification: all 691 mobile tests across 115 files, full mobile lint, the
production build and the Laravel mobile build passed.

## Compact import review rows (22 October 2026)

Local valid rows and server ready/imported rows now show the shared Lucide green
check-circle beside their text status. Row number/status and product name share
one heading; names wrap naturally. Rows use 8px vertical padding and 3px internal
gaps, and cost/stock/prices share a wrapping metadata line. Grouping rows removes
the section's extra gap between entries. Codes, prices, quantities, error
messages, filters, endless pagination and pinned actions remain available.
Invalid/duplicate rows do not display the successful check; errors use the
existing danger color. This is a presentation change without API changes.

Live layout verification remains unavailable because the in-app browser
connection failed before startup.

Verification: all 691 mobile tests, full lint, production build and Laravel
mobile build passed after the compact row update.

## Barcode drawer shared styles (2026-10-16)

Paper format and category now use shared Field/Select components with labels above each input. Legacy floating-label selectors and duplicate custom chevrons were removed; the shared select owns its border, height, arrow and focus state. Search retains the shared composite input. Product names use 14px text and wrap; barcode/SKU metadata uses 12px text and wraps instead of being clipped. Selection rows retain the existing barcode previews, real photos, checked state and keyboard focus. The shared drawer header, scrolling body and pinned Cancel/Print footer remain in use.

Verification: 22 product/barcode tests, lint and build passed. Isolated product browser checks verify format selection, select/deselect loaded products, individual selection, disabled/enabled Print, Cancel and retained Products search/source DOM. Final 320px/362px English and Myanmar screenshots were inspected. Existing print generation behavior is unchanged; no physical printer was exercised. This is a shared-style correction, preserving the supported one-label-per-product behavior documented below.


## Product action sheet consistency

The Product actions sheet now uses the compact shared 16px heading, 12px product identity and consistent gutters. Its rows use icon/copy/chevron columns, subtle bottom dividers and no outer frames. Stock, Edit, Print barcode and Delete keep identical left alignment; the destructive row uses the existing red palette and soft surface. Shared action-row composition overrides generic button flex/centering, which previously made the Delete row inconsistent. Captions wrap naturally instead of truncating and the sheet body remains scrollable. The separate delete confirmation and PIN requirements are unchanged.

Verification captures Product actions at 320/375/393/768px, including the supplied 375x667 viewport and Myanmar at 320/375px. Browser checks assert aligned icon/text columns, no side borders, readable row content and a reachable last action. They exercise close, device Back, Edit/Stock retained navigation, Print barcode opening its picker, and Delete opening confirmation with cancellation. All requests and mutations use fixtures. Products/shared primitive tests (31), lint and production build passed. Physical device keyboard behavior is unverified.

Final action-sheet screenshots were inspected in English and Myanmar, including 320px and 375x667px. Chromium and Firefox Products fixture runs passed.


## Optional global marketplace category (18 October 2026)

The Basic step of new/edit product forms now includes Marketplace category (optional), using the shared Select/Field controls and a reusable MarketplaceCategorySelect. Existing shop Category remains an independent editable field. Global options show full ancestor paths, use Myanmar paths when available, and include only effectively active categories (all ancestors active). No marketplace category is a valid choice. An inactive existing assignment remains visible as unavailable and can be kept unchanged or cleared. Failed option loads retain the draft and offer Retry without blocking unrelated product edits. Natural scrolling and the existing pinned wizard actions remain.

Product detail returns marketplace_category_id, marketplace_category_version and category metadata. POST/PUT accept an optional ID plus required version whenever that field is present, including an explicit null to clear it. Omitted fields preserve existing links. Changes share the product transaction, serialize taxonomy writes consistently with Office, validate active ancestors and reject stale link versions before commit. Merchant user IDs are audited separately from Office admin IDs. Office history identifies merchant changes as Shop user rather than Office staff; later Office changes clear the previous merchant actor on the current link. Category assignment does not publish products or replace the shop category.

Backend support requires migration 2026_10_18_000003_add_merchant_marketplace_category_actors.php; it has been applied to the local development database. Deploy that migration with the Laravel changes before the mobile update. No live product/category assignments were changed for verification; API tests are transactional and browser requests are intercepted.

Verification: 25 focused mobile product/selector/utility tests pass, including explicit create selection, edit clearing, retained local category, translated paths, unavailable selections and failed option-load retry. Eight Laravel tests pass (152 assertions) for merchant CRUD, optional omission, atomic rejection, active ancestry, stale versions, tenant isolation, merchant audit identity and existing Office marketplace/stock contracts. Four Office product tests and mobile lint pass. The product Chromium/Firefox reference flows pass, covering selected creation, clearing on edit, failed saves and retained wizard/source navigation. Final new/edit and Myanmar screenshots were inspected at 320px and 393px; fixture/live category names and hierarchy differ.
