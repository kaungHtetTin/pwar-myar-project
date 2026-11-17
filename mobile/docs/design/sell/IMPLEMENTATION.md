# Sell module implementation

References 001–005, 111, 127, 128, 143, 144 and 169 guide the Sell flow. The revised acceptance rule prioritizes compact MKPOS consistency, useful controls and natural scrolling over reproducing a screenshot's compressed frame.

## Screen coverage

| Reference | Implemented surface | Final comparison |
| --- | --- | --- |
| 001 | Product selection, search/scanning, price type, stock and cart summary | [Sell](../../../artifacts/sell-module/comparison-001.png) |
| 002 | Paid/FOC quantities, pack shortcut, stock warnings, remove and totals | [Cart](../../../artifacts/sell-module/comparison-002.png) |
| 003 | Customer, totals/discount, methods, paid/balance/change and submit | [Checkout](../../../artifacts/sell-module/comparison-003.png) |
| 004 | New customer with retained checkout context and supported fields | [New customer](../../../artifacts/sell-module/comparison-004.png) |
| 005 | Existing offline queue, real status counts, sort and receipt actions | [Offline queue](../../../artifacts/sell-module/comparison-005.png) |
| 111 | Shared right drawer, category/price choices and draft Reset/Apply | [Filters](../../../artifacts/sell-module/comparison-111.png) |
| 127 | Searchable customer sheet with pending choice and confirmation | [Customer selection](../../../artifacts/sell-module/comparison-127.png) |
| 128 | Permission error, camera retry and manual barcode entry | [Scanner fallback](../../../artifacts/sell-module/comparison-128.png) |
| 143 | Saved receipt, financial result, customer/method and print/new sale | [Success](../../../artifacts/sell-module/comparison-143.png) |
| 144 | Existing offline conflict notice, retry and stored queue state | [Sync conflict](../../../artifacts/sell-module/comparison-144.png) |
| 169 | Offline without cache, connection retry and return to login | [Unavailable offline](../../../artifacts/sell-module/comparison-169.png) |

## UI/UX decisions

The forest-green palette, shared type/icon families, radius tokens and navigation remain in use. Product names, stock, prices and amounts come from actual data. Product cards retain the reference hierarchy; cart stock badges participate in layout instead of overlapping names. Narrow cart quantity controls stack, financial values wrap, and forms scroll naturally. Fixed cart/checkout actions are constrained to the app's 720px content width with enough end padding to reach the last content above navigation. English/Myanmar remain readable.

Filters use the existing shared right drawer and animation. Category and price-type edits remain drafts until Apply; close/Escape discards them on reopening, and Reset changes only the draft. The toolbar price-type selector still applies directly. The reference's additional Available/Below cost stock filters are not drawn as inactive or misleading controls: the existing Sell listing supports category/search, and the server's stock modes have different semantics. Actual stock/below-cost indicators and stock warnings remain available.

The checkout customer picker opts into explicit confirmation. Selecting a row, walk-in or New customer changes the pending choice; Confirm selection commits the customer or opens the existing create route. Close preserves the current customer. Search, pagination, retry and the walk-in path remain available. Existing sale-edit and history-filter callers retain immediate selection through the same component's default behavior.

The unsupported disabled sale-note field is removed from Checkout. Customer notes in the supported new-customer form remain editable and saved. No fake receipt barcode, customer code, payment record or financial value is introduced to match example content. Camera denial keeps useful retry/manual-entry controls and removes the blank camera preview. The app does not claim it can open browser/system permission settings through an unsupported API.

The no-cache offline screen uses a shared green connection icon and readable recovery actions. Retry explicitly reloads the session check; Back to login returns to the real login screen without reloading the document. Native system chrome and the reference's illustration are not reproduced.

## Checkout and receipt safety

Saving a sale and retrieving its receipt are separate outcomes. A successful sale POST followed by receipt failure now clears the completed draft, displays the saved result and offers receipt-only retry. Print receipt retrieves the existing sale's receipt and never sends another sale POST. Duplicate submit/print actions are guarded while pending. Rejected sale requests preserve the draft and reveal validation errors.

Success displays saved receipt identity/date, total, paid amount, balance, change when applicable, customer and method. Server values take precedence; submitted values supply immediate context when a minimal response omits them. Local invoices are identified by their real local receipt number, not merely by an online sale's `completed` status. Existing offline full-payment/walk-in constraints, stock checking at sync, conflict retention and receipt formatting remain unchanged. This change does not add server-side online idempotency or resolve an indeterminate sale POST outcome.

Completed results scroll to the top on first display only; Back/Forward retains the completed screen and its source. Product search/results, cart, paid amount, customer-create draft and other checkout values survive ordinary return navigation without an unchanged-return request. Start new sale explicitly clears the completed context.

## Controls and verification

| Controls | Verified behavior |
| --- | --- |
| Search, clear, keyboard barcode, camera/manual entry, product add | Existing paginated queries and real product lookup; matched product adds once per action. |
| Filter choices, Reset, Apply, close, price selector | Pending versus applied choices, supported query and restored source context. |
| Sold/FOC input and steppers, pack, remove, cart/checkout/Back | Existing quantity rules and totals; retained cart and source without return-only reload. |
| Customer choice, confirm, walk-in, new customer and cancel | Explicit commit, required-credit validation and retained checkout/create draft. |
| Discount, paid/clear/full, methods, balance/change and submit | Existing calculations/payload; failed-save retention and duplicate-save guard. |
| Saved result, receipt retry and Start new sale | Receipt GET failure remains a completed sale; printing does not resubmit; explicit new-sale reset. |
| Offline receipt/menu/sort, sync conflict/retry | Isolated IndexedDB state and intercepted sync requests; no live business writes. |
| Offline without cache | Responsive recovery screen and functional Back to login. |

Dev-server scripts use fresh browser contexts, synthetic data and intercepted APIs; no live business mutations. Run `node scripts/check-sell-reference.cjs`, `node scripts/check-checkout-reference.cjs`, `node scripts/check-new-customer-reference.cjs` and `node scripts/check-offline-sales-reference.cjs`. Set `SELL_BROWSER=firefox` to use Firefox. Then run `node scripts/compose-sell-comparisons.cjs` to compose all eleven comparisons at the same 393 × 817 viewport after removing reference device chrome.

Additional 320/768-width, focus and Myanmar captures are retained in each script's artifact folder. Browser checks cover the main flow, new customer, completed receipt retry, offline queue/conflict and no-cache recovery. Unit/integration checks cover Sell, App navigation, shared drawers, scanner, sale-edit consumers and radius tokens. Targeted lint and handoff validation are required. Final screenshots are inspected rather than treating behavior tests as visual proof. Production build is skipped as requested. Physical Android keyboard/camera permission settings, printer output and native sharing are outside browser-fixture verification.

Results: [Sell/Cart](../../../artifacts/sell-reference/checks.json), [Checkout](../../../artifacts/checkout-reference/checks.json), [Customer creation](../../../artifacts/new-customer-reference/checks.json), [Offline](../../../artifacts/offline-sales-reference/checks.json).

Verification record: 205 focused tests passed across 14 files; the final Sell/scanner/radius subset also passed (32 tests). Targeted ESLint passed. Chromium and Firefox fixture runs passed, and all eleven comparison states were visually inspected. Handoff validation passed for 194 components, 296 local links and 95 documented routes.

### Cart frame correction (2026-10-16)

Consolidated overlapping cart rules in `sell-module.css`. Stock badges now flow beside the product name when space allows, rather than consuming a forced extra row. Quantity grids use bounded tracks. On narrow screens, sold/FOC controls and totals span the card width; the product photo occupies only the identity row so it cannot leave unused grid rows. Long names, amounts and pack labels wrap within the card. Corrected the pack multiplier symbol display. Cart calculations and navigation handlers are unchanged.

Verified the mapped 002 reference at 393x817 and the final scrollable page. `check-cart-frame.cjs` passes Chromium/Firefox containment checks at 320/360/393/768, large amounts, unbroken product names, long pack labels, Myanmar and bottom-action clearance. `check-sell-reference.cjs` passes in both browsers for quantity/FOC totals, checkout return, retained product search, removal and navigation. The check uses the redesigned drawer's shortened Offline invoices label. All 26 Sell tests and scoped ESLint pass. No production build was run. Evidence: `artifacts/cart-frame/{chromium,firefox}`. Natural scrolling remains intentional; cards are not shrunk to force all products into one viewport.
## Cart action consistency (2026-10-16)

Sold/FOC quantity fields now compose the shared Field and InputGroup with the `ui-quantity-control` style: one outer border/focus ring, centered editable values, internal separators and evenly sized plus/minus icon buttons. Legacy page styles that conflicted with shared input/button appearance were removed. Field labels are associated with the actual inputs; icon actions are outside labels. Remove uses the shared danger-ghost action and consistent hover/focus colors.

At widths up to 450px the quantity controls span the card width, reserving room for 44px-wide action buttons and readable values. Below 360px sold/FOC fields stack. This local departure from reference 002 prevents squeezed values without reducing typography or touch targets. Existing quantity normalization, decimal entry, sold/FOC accounting, removal and checkout/source retention remain unchanged.

Verification: 19 focused Sell/shared-control tests, lint and production build passed. Chromium and Firefox fixture runs exercise sold/FOC plus/minus, decimal entry, line totals, Remove, checkout Back and retained source search without refetch. Mobile captures include 320px, 362px, 393px and Myanmar; final screenshots, input focus and the reference comparison were inspected. Quantity field/action width and horizontal-overflow assertions pass.


## Combined checkout summary and payment

Per the user request, the checkout Order summary card now contains subtotal, discount and total followed by payment method, Paid now and balance/change. The separate Payment details card and repeated heading were removed; compact internal dividers keep the financial controls readable. Customer identity remains separate and the FOC-only notice still replaces payment controls. Payment calculations, account requirements, formatting, clear/Pay full actions, offline disabling and sale payloads are unchanged.

Paid now uses a shared `ui-input-group--suffix` modifier: one border and focus ring, a padded editable value, a 44px clear button and a full-height currency cell with a 44px minimum width. This corrects the squeezed currency divider shown in screenshot 1918. The field retains a stable height when cleared and the currency cannot collapse to its text width. Pay full uses the shared secondary button beside the field label. Legacy Paid now input/suffix and Pay full appearance rules were removed. Existing card padding is retained without nested card padding.

Verification: 13 Sell/offline tests passed; Chromium and Firefox intercepted checkout checks passed for discount, paid formatting/clear/full/overpayment/change, payment method, customer validation, failed-save retry, receipt retry and retained Back/Forward without refetch. The fixture asserts a single summary/payment section and suffix geometry at 320/375/768px. Final mobile, focused and Myanmar screenshots were inspected. Lint and production build passed. These are synthetic fixture sales; no live sale was created.


## POS selected price through checkout

The price-type selector and filter Apply now update the current sale's existing cart as well as subsequent additions. Retail remains the default. The selected type is stored with the scoped sale draft; unit-price snapshots, quantities, free quantities, discount, payment and customer survive navigation/reload. Selecting a different type reprices all lines atomically and merges legacy duplicate product lines while retaining sold/free quantities. Older drafts without price tables resolve off-screen products on explicit price changes (or from the offline cache). Missing/failed lookups leave the selector and cart unchanged with an error, rather than substituting Retail. Products without the selected price show No price and cannot be added under a false price label.

A compact persistent warning identifies non-Retail types on product selection, Cart and Checkout, with English/Myanmar text. It disappears when Retail is restored and there are no non-Retail cart lines. This additional warning is an intentional reference departure requested by the user. Existing field heights, gutters, cards, navigation and accounting remain unchanged. Checkout submits each selected price_type and unit_price, including cached-price offline invoices.

Control verification: Price type changes update existing/new lines; filter Cancel leaves prices unchanged and Apply commits; missing types and failed legacy lookups retain the draft; quantity/FOC controls retain values; Back restores the original product list without initial refetch; reload restores the selected type; Pay full and Complete sale submit selected prices once. Synthetic Chromium/Firefox fixtures cover 320/362/768px, English/Myanmar, scroll/field focus and request payloads (artifacts/sell-price-selection). Final screenshots were inspected. Sell/offline tests, lint and build pass; physical keyboard behavior is not simulated.


Price-selector spacing refinement: the results toolbar now has an 8px gap after connection status and 12px before the product list, with count/selector aligned to the card gutters. The selector retains the shared 44px field height, a 112px minimum width and a 60% maximum; count text may wrap without overlapping it. This local correction replaces the old 48px toolbar that left almost no clearance beneath a shared-height selector. Browser geometry/flow checks passed at 320/362/375/768px, including Chromium/Firefox at the supplied 375x667 viewport and Myanmar; final retail-selector and translated screenshots were inspected. Production build passed. Pricing and cart behavior are unchanged.
