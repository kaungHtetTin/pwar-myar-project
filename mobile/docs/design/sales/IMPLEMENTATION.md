# Sales references 024-027, 114 and 135

Implemented against the current reference directory: history, detail, edit Cart, edit Checkout, right filter drawer, and saved-receipt print failure. The separate customer/supplier payment module retains its existing layout and contracts. No production build was run.

## Revised UI/UX acceptance update

The current revision follows the updated repository rule: references guide layout and hierarchy, while shared MKPOS consistency, readable content and natural scrolling take priority over fitting every control into one frame. The original comparison record below remains historical context; the linked captures are regenerated for this revision.

- History keeps the reference hierarchy, with full wrapping customer/receipt text, a separate action control, right-aligned amounts/status and distinct Paid, Part paid and Unpaid tones. Long summary values can wrap instead of overflowing.
- Detail keeps paid and balance values in consistent cards. Payment badges participate in layout rather than overlapping labels; settled balances use the positive tint. Item quantities, prices, FOC and totals remain historical saved values.
- Cart and Checkout now share the same progress layout, typography and field spacing. Cart controls use readable labels and consistent entry/stepper sizes. At narrow widths, quantity controls stack naturally; extra products/price types scroll instead of being compressed to fit the reference frame. Validation messages scroll into view, including item errors returned during Checkout.
- Fixed detail/editor actions are constrained to the same 720px app width, with reserved scroll space. The last cart line, subtotal and checkout fields remain reachable above the action bar and shared bottom navigation. The compact theme remains in force; this is not an app-wide density change.
- Sales filters use the common right drawer's width, header, close control and footer. Draft edits are discarded on close/reopen; badges count applied filters. Reset clears the filter draft while retaining the independent search query, and Apply commits it. Reversed date ranges stay in the drawer with an inline error and send no request. Customer/supplier payment filters retain their existing behavior.
- Walk-in labels remain translatable while saved customer names remain unchanged. Myanmar line height and narrow-screen wrapping preserve readability. The receipt error sheet keeps actual receipt data and print-only retry, with a consistently sized close control.

Current verification: 175 focused sales/CSV, App navigation, shared drawer/AppShell and radius tests passed. Chromium and Firefox dev-server runs capture all six references at 393px plus 320/768px, check retained search/drafts, filter cancellation/validation/Reset/Apply, item controls, Pay full, save failure/retry, print retry, delete cancellation and reachable cart end. Targeted ESLint and handoff validation are run for this revision. No production build or live business mutations are required.

Current browser results: [Chromium](../../../artifacts/sales-reference/checks-chromium.json), [Firefox](../../../artifacts/sales-reference/checks-firefox.json). [Cart end](../../../artifacts/sales-reference/cart-end.png) provides additional scroll-reachability evidence. Previous-period/reference example values, fictitious payment notes and contradictory status labels are not copied.

## Original visual acceptance record

Each final comparison was inspected with the reference left and the dev-server rendering right, at the same 393 x 817 viewport. Original screenshots are normalized from 853 x 1844 to 393 x 850, with 33px of native status chrome excluded. The app retains shared navigation and actual safe areas rather than drawing device chrome. All six comparisons were checked for labels, font hierarchy/weight, line wrapping, spacing, borders, status alignment and action placement. Focus and narrow/wide screenshots were inspected separately. This is not a pixel-identical claim; supported-data and shared-theme differences are listed below.

| Reference | Existing route/state | Final comparison |
| --- | --- | --- |
| [024](024-sales-sales-history-default.png) | Sales history (`/sales`) | [Reference / rendered](../../../artifacts/sales-reference/comparison-024.png) |
| [025](025-sales-id-sale-detail-default.png) | Sale detail (`/sales/:id`) | [Reference / rendered](../../../artifacts/sales-reference/comparison-025.png) |
| [026](026-sales-id-edit-edit-sale-default.png) | Edit sale cart (`/sales/:id/edit`, Cart) | [Reference / rendered](../../../artifacts/sales-reference/comparison-026.png) |
| [027](027-sales-id-edit-checkout-edit-step-checkout-edit-step.png) | Edit sale checkout (`/sales/:id/edit`, Checkout) | [Reference / rendered](../../../artifacts/sales-reference/comparison-027.png) |
| [114](114-sales-right-filter-drawer-right-filter-drawer.png) | Sales right filter drawer (`/sales`, Filters) | [Reference / rendered](../../../artifacts/sales-reference/comparison-114.png) |
| [135](135-sales-id-receipt-and-print-failure-receipt-and-print-failure.png) | Saved receipt print failure (`/sales/:id`, Print receipt error) | [Reference / rendered](../../../artifacts/sales-reference/comparison-135.png) |

Additional evidence: [search focus](../../../artifacts/sales-reference/search-focus.png), [payment focus](../../../artifacts/sales-reference/payment-focus.png), [Myanmar history](../../../artifacts/sales-reference/myanmar-history.png), and 320px/768px captures for all six states in `artifacts/sales-reference`.

## Preserved behavior and explicit differences

- History keeps the existing All dates default. Summary values and transaction counts come from loaded real rows; paginated amounts explicitly say Loaded. The fixture has five sales totaling 284,500 MMK, paid 245,500 and credit 39,000, rather than fabricating the reference's 42 sales and larger totals. Paid counts include records with any paid amount, including partial payments.
- Receipts, sale dates and customer data remain actual saved values. The references use different creation dates/receipt formats for the same sale across screens; the app uses one consistent saved record. History item counts are real line counts, and reference-only REF codes are omitted where the API has none. Summary/item labels use consistent line counts; the checkout reference's four units are not relabeled as four product lines.
- Partial payment is labeled Part paid, including detail, rather than copying reference 025's contradictory Unpaid badge for a sale with 30,000 already paid. Credit, paid amount, change, FOC-only sales and customer requirements retain their existing calculations and API payloads.
- Unit price, each line's price type, checkout discount and Pay full stay editable. Extra configured price tiers create additional controls and may require scrolling. Numeric inputs keep native entry/validation instead of inserting commas into a numeric input.
- The sale API has no payment-note field. The reference's unsavable payment note is omitted. Its space is not filled with a fake value. Admin PIN authorization remains visible when configured, even though the reference omits it.
- Saved item names/prices/quantities remain historical values; SKU, photo and base-unit labels come from the existing product join. Archived products remain editable as before. Missing photos use the theme fallback. Fixture photos are cropped only for isolated QA; no synthetic product photos are deployed.
- Sale detail retains the real receipt title, shared green theme, Lucide icons and compact radius tokens. Detail/edit actions are pinned above shared navigation. Native insets/font rendering can differ from the reference's baked-in device chrome. More on detail opens sale actions; edit-header More opens the existing permission-aware module drawer. The history chevron retains the existing Actions menu while its main row opens detail.
- Reference 114 uses the right drawer with calendar presets and a real customer picker. This month selects the full calendar month shown in the reference. Custom dates and the existing week/year/all periods are available through the date disclosure. Sale channel remains available under More filters. The customer picker searches/paginates existing accounts in a nested right drawer; it does not limit choices to loaded history customers. Existing Paid/Credit API semantics are retained under Payment status.
- Reference 135 appears only after an actual receipt fetch/print error. A historical sale does not receive a fabricated Sale saved banner. The paper preview uses actual saved names, quantities, receipt and total rather than placeholder bars or a fake scannable barcode. Error text is the actual failure; Printer not connected is used only for a matching error. Popup/network errors get a general print-failure heading. Paper uses the configured receipt size, with the existing 80mm default; the native printer profile remains authoritative for actual output. Shared sheet backdrop styling and device safe areas remain in use.
- Retry fetches/prints the existing receipt and never resubmits the sale. Failure stays visible with disabled busy controls during retry; a successful print submission clears it. A software print submission does not prove physical paper output.

## API support

`SaleController::index` adds a correlated real item count to the existing sales query. `show` adds customer phone and product SKU/photo URL using its existing joins; storage paths are removed from the response. No new mutation fields, route, schema or stock/accounting calculation was added. Deploy this controller change with the mobile source so photos, counts and SKU metadata are available.

## Button and navigation verification

| Controls | Event / expected behavior | Observed evidence |
| --- | --- | --- |
| History main row / chevron / View details / Edit | Open existing detail or action sheet and edit route | Browser opens detail/edit; screen tests check menu handlers. |
| Search / Clear / two export shortcuts | Debounced scoped list search and existing line-item CSV export | Browser search and retained source; existing export tests and CSV utility tests. Downloaded file was not manually opened. |
| Filters / date presets / Custom / status / method / Sale channel / Reset / Apply | Right drawer with channel directly visible, draft fields, supported API query and reset defaults | Browser captures 114, applies month/method/channel, verifies channel query and reset. Customer filtering and the More filters disclosure are removed. Screen tests verify the channel is visible without expanding a disclosure. |
| Cart step / Checkout step / Previous / Continue / Cancel / Back | Preserve inputs and navigate to real source; validate items before Checkout | Browser retains paid value and FOC through steps and browser Forward. App tests check customer-history -> sale -> editor unwind with retained source DOM/search and no Back-only refetch. |
| Paid/FOC steppers / direct inputs / unit price / price tier / Remove | Keep fractional quantity rules, FOC and actual line totals | Browser increases/decreases FOC. Existing tests exercise quantity/FOC, price payload and PIN. Multiple price tiers remain controlled; tier selection not separately clicked in browser. |
| Add product / Product filters / category / Apply / choose / remove | Existing paginated picker, now with right-side category drawer | Browser chooses a category, adds a product and removes that line; screen tests verify category query. |
| Customer / walk-in / choose existing / discount / paid / Pay full | Existing credit validation and payment calculations | Browser clears customer, checks required-credit error, then reselects; tests verify discount/paid payload. Pay full handler retained and inspected, not separately clicked in browser. |
| Save changes / failure / retry | One existing PUT contract; draft survives failed save and reconciles on success | Browser observes failed/successful PUT with retained paid value; unit/App tests cover payload, PIN and source reconciliation. |
| Print header/footer / More print / error Close / Retry | Fetch existing receipt; independent print failure and busy/retry lifecycle | Browser footer print captures 135, observes two failed fetches followed by successful software submission, verifies three receipt calls and no additional sale PUT. Header/More print share the handler and were inspected, not separately clicked. Screen tests retain online-sale printing while hiding Edit. Physical printer not tested. |
| Delete / PIN / Cancel | Existing guarded reversal; cancellation makes no mutation | Browser cancellation sends no DELETE; screen tests cover protected delete and handlers. |
| Module drawer / bottom navigation | Shared permissions and active Sales state | Browser More/language switch, shared navigation tests. |
| Loading/error Back / Retry | A usable source-aware return control remains while the app header is hidden | Source inspected; App route tests passed. Standalone load errors were not separately simulated in browser. |

## Checks and limits

Dev server: `http://127.0.0.1:5176`; isolated Chromium with intercepted API responses, no live business mutations. Replay `node scripts/check-sales-reference.cjs`. All six captures and 320px/768px overflow checks passed, along with source/draft retention, filter application, validation, save failure/retry, delete cancellation, print failure/retry and Myanmar history. [Browser results](../../../artifacts/sales-reference/checks.json).

140 focused transaction utility/screen, CSV, App navigation and radius-token tests passed; [unit results](../../../artifacts/sales-reference/unit-results.json). ESLint passed. Two transactional Laravel feature tests passed: FOC-only sales (including SKU/photo-path/count assertions) and stock/credit recalculation on sale update. Documentation inventory validated. Build deliberately skipped. Android device gestures, real printer connection and physical output were not exercised.

Presentation owners: `SalesReferenceParts.jsx`, `SalesReferenceFilters.jsx`, `SalesPrintFailure.jsx`, `salesLocale.js`, and `src/styles/sales-reference.css`. Existing TransactionsScreen remains the state/API/mutation owner; shared App retention owns source-page preservation.

## Sales filter simplification

At the user's request, the Customer filter and its nested picker have been removed from sales history. Customer-name search through the main search field and customer selection in sale editing remain available. The sales filter query and active-filter count no longer include the removed customer criterion. Sale channel (All sales / Online sales / POS sales) is directly visible in the main drawer, after Payment method; there is no More filters disclosure. Date, payment and channel edits remain drafts until Apply, and Reset restores All sales. Reference 114's customer/disclosure presentation is intentionally superseded by this request. The updated browser script verifies direct channel visibility, API application and reset as well as the existing retained navigation and sale-edit checks.


Sale detail action refinement: removed the sale-specific More button from both the app bar and fixed bottom actions, along with its redundant action sheet. Print receipt and Edit sale remain direct actions; Sales history remains reachable through Back. The shared app navigation menu remains the final app-bar action. Bottom buttons now share available width equally. This intentionally departs from reference 025 per the user request. Sixteen transaction tests, lint and the intercepted Chromium Sales reference flow passed, including print failure/retry, Edit and retained Back. Final screen-025 screenshots at 320/393/768px were inspected.
