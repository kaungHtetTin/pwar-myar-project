# Purchase reference implementation and visual verification

Purchase references 014–023, 113, 133 and 134 map to the inventory-receiving workflow below. The compact measurements, field structure, labels, indicator states, cards and action positions are implemented in the purchase reference components and stylesheet.

## Comparison evidence

Each comparison places the proposed design on the left and the rendered page on the right at 393×817, excluding the painted phone status bar. The same states have captures at 320 and 768px. Inspect the individual images at full size when reviewing typography and borders.

| Reference | Screen/state | Comparison |
| --- | --- | --- |
| 014 | Purchase history | [History](../../../artifacts/purchases-reference/comparison-014.png) |
| 015 | New purchase Basic | [Basic](../../../artifacts/purchases-reference/comparison-015.png) |
| 016 | New purchase Products | [Products](../../../artifacts/purchases-reference/comparison-016.png) |
| 017 | New purchase Costs | [Costs](../../../artifacts/purchases-reference/comparison-017.png) |
| 018 | New purchase Review | [Review](../../../artifacts/purchases-reference/comparison-018.png) |
| 019 | Edit purchase Basic | [Edit Basic](../../../artifacts/purchases-reference/comparison-019.png) |
| 020 | Edit purchase Products | [Edit Products](../../../artifacts/purchases-reference/comparison-020.png) |
| 021 | Edit purchase Costs | [Edit Costs](../../../artifacts/purchases-reference/comparison-021.png) |
| 022 | Edit purchase Review | [Edit Review](../../../artifacts/purchases-reference/comparison-022.png) |
| 023 | Purchase detail | [Detail](../../../artifacts/purchases-reference/comparison-023.png) |
| 113 | Right filter drawer | [Filters](../../../artifacts/purchases-reference/comparison-113.png) |
| 133 | Supplier selection | [Supplier sheet](../../../artifacts/purchases-reference/comparison-133.png) |
| 134 | Below-cost confirmation | [Warning](../../../artifacts/purchases-reference/comparison-134.png) |

## Implemented contracts

- History retains supplier/internal purchase reference, date, total, paid/balance and right-aligned payment status. Summaries report actual loaded/full-list amounts rather than copying example financial values.
- The new/edit Basic forms expose reference number, purchase date and optional expected delivery on edit. The supplier's contact person, phone and address appear in the new form. Reference/date fields persist through create, update, reload and CSV export. Internal references display as `PUR` plus the padded numeric ID; the editable reference is the separate supplier document reference.
- Native date inputs remain keyboard/picker accessible behind the formatted date surface. The wrapper provides focus indication and whole-field activation.
- The Products step uses the proposed category controls and selection layouts. Costs show buying-unit conversion, paid quantity, FOC in base units, unit cost, total received and effective cost. FOC is converted back to the existing buying-unit API representation. Recalculation refreshes historical base quantity fields so review does not show stale stock values.
- Review and detail include supplier identity/reference/date, item totals, payment, balance, note and edit impact. Detail uses the proposed item icon cards, totals grouping and recorded-payment row. The payment row represents the purchase's recorded aggregate, not an invented payments API.
- Supplier choices remain pending until Use supplier. Cancel preserves the existing linked supplier. Search, pagination, errors and the permission-aware Add new supplier option use the existing supplier endpoints/navigation.
- Filters use the shared native-dialog drawer with the Firefox `overflow: clip` fix. Date and payment choices are drafts until Apply. Supplier options include the paginated saved supplier catalog. Search applies search text without silently applying unfinished filter drafts. Payment-state filtering happens on the server before pagination/counting.
- The warning state uses the proposed item/payment summary behind the overlay, with the full completed-step indicators. The below-cost sheet lists actual affected manual prices and effective costs. Go back and edit returns to Costs; Save anyway uses the guarded existing save path. Manual prices are not changed silently.

## Verification

### Product picker and wizard controls — 2026-10-18

The purchase picker now reuses Sell's search/scanner composition and icon-only filter trigger (with its accessible name and active count). The duplicate inline category selector and edit category tabs are removed; category filtering remains available in the shared drawer. Product totals and selected counts remain visible. The malformed right-edge CSS arrow is removed; selected cards use a Lucide check in the existing selection box. These intentionally depart from the earlier category controls in references 016/020 to provide one consistent filtering entry point.

Create/edit Basic, Products, Costs and Review use one footer layout: equal-width actions, shared 44px target, shared typography/radius, and consistent Previous/Continue chevrons. Removed step-specific sizing and hidden-arrow exceptions; the cost subtotal remains above the action row and forms retain their bottom scroll clearance.

Validation for this update: 29 purchase/shared-drawer tests passed, ESLint passed, and production build passed with the bundle-size advisory. The fixture browser script additionally exercises search/Clear, category drawer Apply/Reset, scanner open/close, and footer dimensions across all eight create/edit steps. Existing checks cover supplier changes, product selection, Previous/completed-step draft retention, Save validation/retry, and return navigation without refetch. Captures cover 393px, 320px and 768px plus Myanmar history. Final picker, Costs and Review screenshots were inspected. Physical camera scanning remains unverified; scanner opening/closing is verified with isolated browser fixtures.

`node scripts/check-purchases-reference.cjs` uses an isolated browser context and intercepted fixture APIs, with no live purchase mutations. Both Chromium and Firefox runs exercise all thirteen mapped captures, responsive overflow, create/edit payloads, date/reference persistence in requests, FOC conversion, failed save/retry, draft and source retention, unchanged Back without list refetch, PIN/delete cancellation, supplier confirmation, filters and Myanmar history.

Frontend purchase/shared drawer/AppShell checks: 50 tests passed; targeted ESLint passed. Backend tests `PurchasePaymentFilterTest` and `PurchaseReferenceMetadataTest` use isolated in-memory SQLite connections and passed. They verify payment-state totals/pagination, selected purchase-date filtering, metadata persistence and stock of 21 bags from two cartons plus one free bag. Physical camera/scanner/printer and Android hardware were not exercised. Production build was skipped as requested.

Results: [checks.json](../../../artifacts/purchases-reference/checks.json). The component inventory includes `PurchaseDateInput` and the supplier sheet contract.

## Schema and factual content

Migration `2026_10_16_030000_add_purchase_reference_dates.php` adds nullable `reference_no`, `purchase_date` and `expected_delivery`. It was applied to the local development database. Legacy records and old API clients remain supported; date filtering falls back to `created_at` when no selected purchase date exists.

The comparison fixtures preserve meaningful state through a real create/edit flow, so names, units, item counts, examples and amounts can differ from the individually composed reference images. For example, reference 014's visible row amounts total 547,000 while its hero shows 1,240,000; the implementation does not manufacture that discrepancy. References 019 and 021 also show different line sets/costs. Device status chrome and platform font rasterization are external to the app. These facts do not authorize layout deviations or establish a pixel-identical claim; the linked final screenshots are the visual evidence.
