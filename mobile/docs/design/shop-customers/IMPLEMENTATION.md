# Shop Customers implementation

Reference mappings: 079 buyer list, 080 buyer detail, 081 block confirmation, 082 credit-contact linking, and 122 right filter drawer.

## Corrected reference structure

- The list has the reference header/export, search/filter/export toolbar, result count and compact buyer rows. Extra KPI cards and the introductory disclaimer were removed. Rows show identity, Registered/Guest/Blocked status, contact details, order count and actual completed spending separated by currency.
- Detail uses the customer's name in the header, Chat and history export actions before the app navigation menu, a compact white profile with Chat/More actions, Purchase statistics and then Order history. Extended purchase metrics are visible directly in Purchase statistics; More contains account status and permitted account actions only. History uses the same OrderCard component as the main shop order list.
- Blocking uses a centered modal over contextual customer information, with an optional reason, character counter, Cancel and destructive confirmation. Reasons persist through the API and are cleared on unblock. Cancel and dismiss never mutate data.
- Link credit contact shows buyer identity, suggested matches, an existing-contact picker, a separate create-new choice, and the identity-separation explanation. Linking requires an explicit selection; retries do not duplicate contacts or create balances.
- Filters use Type and Blocked state radio groups plus the sort field. Reset changes the draft; Apply commits it; dismiss discards unapplied changes.
- Customer and order-history CSV exports use the existing shared exporter and the applied search/filters, including all matching pages.
- Order-history cards now follow the actual 080/073 composition: order reference and status on top, date below, initials/name/item count beside the total/payment status, then product thumbnails beside fulfillment and the chevron. The previous bag-header/badge-strip card was a mismatch even though it was shared. Both list APIs now return actual item counts and up to four previews; photo downloads verify order membership and tenant ownership. Products without stored photos retain neutral placeholders.

## Deliberate shared-system adjustments

The compact MKPOS font scale, green theme, radius tokens, controls and navigation are retained. Pages scroll naturally rather than compressing content into a single frame. Currency labels and customer values come from recorded data. Browser pages omit native OS status chrome. Navigation shows only permitted modules; it never adds inaccessible destinations just to match a screenshot. Existing endless-list paging is retained in place of numbered page controls. Buyer identity is read-only; unsupported edit/delete actions shown behind the reference modal are not fabricated. The main OrderCard remains shared rather than introducing a buyer-only card variant. Contacts have numeric IDs, displayed as Contact #ID rather than inventing reference contact codes. Recommended matches start unselected so linking is an explicit decision.

These local adjustments do not permit replacing the reference structure or omitting supported controls.

## API changes

The Laravel buyer index returns completed spending per currency. Block accepts an optional reason up to 200 characters, stored by migration `2026_10_16_100000_add_block_reason_to_shop_customer_controls`. New tenant-scoped `GET /shop-admin/customers/:key/credit-options` returns matching active contacts. Credit linking accepts either `contact_id` or `create_new`; existing automatic API behavior remains available to older callers. Linking remains idempotent and never creates a balance, merges identities or changes order history.

## Verification

`node scripts/check-shop-buyers-reference.cjs` checks the five reference states, 320/393/768 widths, draft filters, CSV download, contact picker, failed block/link retries, guest/blocked/linked states, Myanmar rendering and retained source/history state. Set `BUYERS_BROWSER=firefox` for Firefox. API mutations in browser checks are intercepted fixtures.

Screenshots are in `artifacts/shop-buyers-reference`. Inspect the final screenshots alongside references at matching viewport dimensions. Scoped React tests cover pending filters, date validation, explicit contact choices, block reasons and cancellation. Laravel transaction-based feature tests cover currency separation, reason validation/persistence, tenant isolation, idempotency and unchanged balances. No production build is required.

Verified on 16 October 2026: 70 scoped frontend tests and 9 customer API feature tests passed; scoped ESLint and handoff validation passed. Chromium and Firefox fixture checks passed. Final side-by-side comparisons are `compare-079.png` through `compare-082.png` and `compare-122.png` in the artifact folder.

## Customer statistics and options refinement

Removed the duplicate More action from the app bar; the profile More action remains. Purchase details are now immediately visible beneath per-currency completed spending in Purchase statistics: total/completed/active/cancelled/expired orders, first/last purchase dates, average purchase and refund/refund-pending values per currency. Existing API fields, missing-value handling, zero counts and business-time formatting are preserved; no extra request or aggregate currency total is introduced. The section scrolls naturally rather than hiding the details in an action sheet.

Customer options now uses the shared compact action-sheet header and borderless icon/text/chevron rows, with customer identity, account status and saved block reason. Block retains the red action treatment; Unblock uses the positive shared treatment. Permission checks, linked-contact disabling, explicit credit choices and block/link confirmation flows are unchanged.

Verification: six focused customer tests passed, including zero/missing values, direct statistics placement, no header More, profile-only options and no dismiss refetch. Chromium and Firefox fixture checks passed for 320/375/393/768px, options alignment, CSV, block/link retry/cancellation, guest/linked states, retained history/source navigation, chat return and Myanmar. Final detail and action-sheet screenshots were inspected; shared navigation remains the last app-bar action. Lint and production build passed. Fixture mutations do not affect real customers.
