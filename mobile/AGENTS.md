## Visual rules

### Mandatory UI/UX acceptance for all future UI work

Use mapped reference screenshots as guidance for screen structure, content hierarchy and design intent. They may contain inconsistent components or compressed spacing intended to fit everything into a single frame. Acceptance prioritizes usable UI/UX, the shared MKPOS design system and correct behavior over pixel-identical reproduction. Correct reference inconsistencies instead of copying them.

- Preserve the compact/dense MKPOS UI, theme colors, typography family, icon family and shared radius tokens. Keep density consistent across modules, components and loading/error/empty states.
- Use consistent shared typography, page gutters, card padding, field heights, icons and gaps across equivalent components. Use reference measurements when they fit these patterns; correct cramped or inconsistent measurements locally. Do not apply an app-wide less-dense/comfortable redesign unless explicitly requested.
- Preserve the reference's primary layout, section order and action presentation. Usability corrections are local adjustments with a concrete reason; they do not authorize replacing a modal with a page, omitting supported controls, or adding summary sections absent from the reference.
- Let pages, forms, drawers and sheets scroll naturally. Never shrink text, controls or gaps, clip content, or remove information just to fit the entire reference into one viewport. Keep primary actions reachable and ensure sticky/fixed controls do not obscure the last content or keyboard-focused field.
- Preserve readable text, Myanmar vowel marks, visible keyboard focus and usable touch targets without unnecessarily increasing visible spacing. Prevent clipping and overlap; reserve enough scroll space for fixed actions, bottom navigation, safe areas and the keyboard.
- Keep essential identity, status, amounts, errors and actions available. Do not remove information or change business behavior to achieve compactness.
- Compare final rendered screenshots with the reference at the same viewport to inspect hierarchy, typography, spacing, borders, focus and action placement. Verify the full scrollable page, narrow/mobile widths, long/real content, keyboard behavior and translated content. Fix unexplained differences and usability problems before completion; briefly record intentional departures and their UI/UX reason. Tests prove behavior, not visual quality. Never claim visual verification without inspecting final screenshots.
- A local spacing correction does not authorize an app-wide density change. Keep the explicitly requested billing overview spacing adjustment.

This supersedes the previous exact-screenshot acceptance rule and its requirement to copy every line break or spacing measurement. Compact density remains the default; the canceled app-wide less-dense pass remains canceled.

### Accepted mappings

- Sell (`/sell`): `docs/design/sell/001-sell-product-selection-default.png`.
- Cart (`/sell/cart`): `docs/design/sell/002-sell-cart-quantity-step-default.png`.
- Checkout (`/sell/checkout`): `docs/design/sell/003-sell-checkout-checkout-default.png`.
- New checkout customer (`/sell/customer/new`): `docs/design/sell/004-sell-customer-new-new-checkout-customer-default.png`.
- Offline sales (`/sell/offline-sales`): `docs/design/sell/005-sell-offline-sales-offline-queue-default.png`.
- Products inventory (`/products`): `docs/design/products/006-products-inventory-default.png`.
- New product Basic (`/products/new`, step 1): `docs/design/products/007-products-new-create-default.png`.
- New product Inventory (`/products/new`, step 2): `docs/design/products/008-products-new-inventory-step-inventory-step.png`.
- New product Prices (`/products/new`, step 3): `docs/design/products/009-products-new-selling-price-step-selling-price-step.png`.
- Edit product Basic (`/products/:id/edit`, step 1): `docs/design/products/010-products-id-edit-edit-default.png`.
- Edit product Inventory (`/products/:id/edit`, step 2): `docs/design/products/011-products-id-edit-inventory-step-inventory-step.png`.
- Edit product Prices (`/products/:id/edit`, step 3): `docs/design/products/012-products-id-edit-selling-price-step-selling-price-step.png`.
- Product stock adjustment (`/products/:id/stock`): `docs/design/products/013-products-id-stock-stock-default.png`.

- Purchase history (`/purchases`): `docs/design/purchases/014-purchases-purchase-history-default.png`.
- New purchase Basic (`/purchases/new`, step 1): `docs/design/purchases/015-purchases-new-create-default.png`.
- New purchase Products (step 2): `docs/design/purchases/016-purchases-new-select-products-step-select-products-step.png`.
- New purchase Costs (step 3): `docs/design/purchases/017-purchases-new-quantities-and-costs-step-quantities-and-costs-step.png`.
- New purchase Review (step 4): `docs/design/purchases/018-purchases-new-review-and-submit-step-review-and-submit-step.png`.
- Edit purchase Basic (`/purchases/:id/edit`, step 1): `docs/design/purchases/019-purchases-id-edit-edit-default.png`.
- Edit purchase Products (step 2): `docs/design/purchases/020-purchases-id-edit-select-products-step-select-products-step.png`.
- Edit purchase Costs (step 3): `docs/design/purchases/021-purchases-id-edit-quantities-and-costs-step-quantities-and-costs-step.png`.
- Edit purchase Review (step 4): `docs/design/purchases/022-purchases-id-edit-review-and-submit-step-review-and-submit-step.png`.
- Purchase detail (`/purchases/:id`): `docs/design/purchases/023-purchases-id-detail-default.png`.

- Customer contacts (`/customers`): `docs/design/customers/028-customers-contacts-default.png`.
- New customer (`/customers/new`): `docs/design/customers/029-customers-new-create-default.png`.
- Edit customer (`/customers/:id/edit`): `docs/design/customers/030-customers-id-edit-edit-default.png`.
- Customer account (`/customers/:id`): `docs/design/customers/031-customers-id-account-detail-default.png`.
- New payment (`/customers/:id/payments/new`): `docs/design/customers/032-customers-id-payments-new-new-movement-default.png`.
- Edit payment (`/customers/:id/payments/:paymentId/edit`): `docs/design/customers/033-customers-id-payments-paymentid-edit-edit-movement-default.png`.

- Sales history (`/sales`): `docs/design/sales/024-sales-sales-history-default.png`.
- Sale detail (`/sales/:id`): `docs/design/sales/025-sales-id-sale-detail-default.png`.
- Edit sale cart (`/sales/:id/edit`, Cart): `docs/design/sales/026-sales-id-edit-edit-sale-default.png`.
- Edit sale checkout (`/sales/:id/edit`, Checkout): `docs/design/sales/027-sales-id-edit-checkout-edit-step-checkout-edit-step.png`.
- Sales right filter drawer (`/sales`, Filters): `docs/design/sales/114-sales-right-filter-drawer-right-filter-drawer.png`.
- Saved receipt print failure (`/sales/:id`, Print receipt error): `docs/design/sales/135-sales-id-receipt-and-print-failure-receipt-and-print-failure.png`.

Preserve the MKPOS theme and existing business behavior. Native operating-system chrome and live product/customer data must remain real; document their differences when comparing reference fixtures.

## Access reference mappings

- Access /access: `docs/design/access/049-access-access-default.png`.
- Access /access/roles/new: `docs/design/access/050-access-roles-new-new-role-default.png`.
- Access /access/roles/:id/edit: `docs/design/access/051-access-roles-id-edit-edit-role-default.png`.
- Access /access/staff/new: `docs/design/access/052-access-staff-new-new-staff-default.png`.
- Access /access/staff/:id/edit: `docs/design/access/053-access-staff-id-edit-edit-staff-default.png`.
- Access /access/staff/:id/password: `docs/design/access/054-access-staff-id-password-reset-staff-password-default.png`.
- Access /access (Staff tab): `docs/design/access/110-access-staff-tab-staff-tab.png`.
- Access /access (unauthorized): `docs/design/access/157-access-permission-denied-permission-denied.png`.

See `docs/design/access/IMPLEMENTATION.md` for preserved API constraints and visual differences.

## Authentication reference mappings

- Login (`/login`): `docs/design/authentication/105-login-login-default.png`.
- Create account (`/signup`): `docs/design/authentication/106-signup-signup-default.png`.
- Session check: `docs/design/authentication/168-session-check-loading.png`.

See `docs/design/authentication/IMPLEMENTATION.md` for behavior and explicit differences.

## Billing reference mappings

- Billing (`/billing`): `docs/design/billing/047-billing-billing-overview-default.png`.
- Payment request (`/billing/request/:planId`): `docs/design/billing/048-billing-request-planid-plan-payment-request-default.png`.
- Matching pending request (same route): `docs/design/billing/149-billing-request-planid-payment-request-pending-payment-request-pending.png`.

See `docs/design/billing/IMPLEMENTATION.md` for API constraints and explicit visual differences.

- Customer payment records (`/customers/:id`, Payment records): `docs/design/customers/107-customers-id-payment-records-tab-payment-records-tab.png`.
- Customer balance filter drawer (`/customers`, Filters): `docs/design/customers/115-customers-right-filter-drawer-right-filter-drawer.png`.

## Expense reference mappings

- Expense history `/expenses`: `docs/design/expenses/040-expenses-expense-list-default.png`.
- New expense `/expenses/new`: `docs/design/expenses/041-expenses-new-new-expense-default.png`.
- Edit expense `/expenses/:id/edit`: `docs/design/expenses/042-expenses-id-edit-edit-expense-default.png`.
- Expense right filter drawer: `docs/design/expenses/117-expenses-right-filter-drawer-right-filter-drawer.png`.
- Expense validation: `docs/design/expenses/151-expenses-new-validation-error-validation-error.png`.
- Implementation and documented differences: `docs/design/expenses/IMPLEMENTATION.md`.

Product module additional mappings: `docs/design/products/112-products-right-filter-drawer-right-filter-drawer.png`, `129-products-delete-product-and-pin-delete-product-and-pin.png`, `130-products-new-photo-crop-photo-crop.png`, `131-products-csv-import-review-csv-import-review.png`, `132-products-barcode-preview-barcode-preview.png`, and states 145-148 in the same folder. See `docs/design/products/IMPLEMENTATION.md` for evidence and supported behavior differences.

Purchase additional acceptance references: `docs/design/purchases/113-purchases-right-filter-drawer-right-filter-drawer.png`, `docs/design/purchases/133-purchases-new-supplier-picker-supplier-picker.png`, and `docs/design/purchases/134-purchases-new-below-cost-warning-below-cost-warning.png`. See `docs/design/purchases/IMPLEMENTATION.md` for final comparison evidence.

## Reports reference mappings

- Reports `/reports`: `docs/design/reports/046-reports-reports-default.png`.
- Right filter drawer: `docs/design/reports/119-reports-right-filter-drawer-right-filter-drawer.png`.
- Refresh failure with retained data: `docs/design/reports/156-reports-refresh-failure-with-data-refresh-failure-with-data.png`.
- Cash movement continuation: `docs/design/reports/160-cash-movement-continuation.png`.
- Inventory and trends continuation: `docs/design/reports/161-inventory-and-trends-continuation.png`.
- Breakdowns continuation: `docs/design/reports/162-breakdowns-continuation.png`.

Use the revised UI/UX acceptance rule: a naturally scrolling page, consistent shared cards/drawer/navigation and accurate API values take priority over squeezing every reference section into one viewport. See `docs/design/reports/IMPLEMENTATION.md` for scope and verification.

## Sell overlay and state references

- Right filter drawer: `docs/design/sell/111-sell-right-filter-drawer-right-filter-drawer.png`.
- Customer selection: `docs/design/sell/127-sell-checkout-customer-picker-customer-picker.png`.
- Camera permission failure/manual entry: `docs/design/sell/128-sell-scanner-permission-denied-scanner-permission-denied.png`.
- Completed sale: `docs/design/sell/143-sell-checkout-sale-success-sale-success.png`.
- Offline sync conflict: `docs/design/sell/144-sell-offline-sales-offline-sync-conflict-offline-sync-conflict.png`.
- Offline without cache: `docs/design/sell/169-offline-unavailable-without-cache.png`.

Follow the revised acceptance rule and preserve offline accounting, receipt-only retries, draft/source retention and the distinction between server-confirmed sales and local invoices. See `docs/design/sell/IMPLEMENTATION.md`.

## Settings reference mappings

Settings routes `/settings` and its account, shop, receipt, barcode, printer, payments, prices, security, data, language and about destinations use references 055 through 070 in `docs/design/settings`. States 142, 152, 163, 167, 170 and 171 extend these flows. See `docs/design/settings/IMPLEMENTATION.md` for exact mappings and intentional usability differences. Preserve real device capabilities, access restrictions and destructive confirmations.

## Shop reference mapping

My Shop overview (`/shop`) uses `docs/design/shop/071-shop-my-shop-default.png`. Follow `docs/design/shop/IMPLEMENTATION.md` for grouped navigation, actual destination terminology and intentional scrolling differences. Preserve permissions, subscription visibility, the owner-location gate and retained source navigation.

## Shop Catalog reference mappings

Catalog (`/shop/catalog`) maps to `docs/design/shop-catalog/077-shop-catalog-catalog-default.png`; editor (`/shop/catalog/:id/edit`) maps to 078. States 121, 139 and 150 cover the filter drawer, bulk confirmation and expired subscription. See `docs/design/shop-catalog/IMPLEMENTATION.md`. Preserve all-filtered bulk scope and the supported unit/description/publication payload; do not fabricate selection-only bulk actions or editable inventory prices.

## Shop Chat reference mappings

Inbox (`/shop/chat`) uses `docs/design/shop-chat/083-shop-chat-inbox-default.png`; conversation (`/shop/chat/:uuid`) uses 084. States 123, 140 and 153 cover the unread filter drawer, product picker, failed send and expired image. See `docs/design/shop-chat/IMPLEMENTATION.md`. Preserve full-page conversations, clickable profile identity, pending filter edits, retained drafts and idempotent send retries.

## Shop Contacts reference mappings

Shop contacts (`/shop/contacts`), Add (`/shop/contacts/new`) and Edit (`/shop/contacts/:id/edit`) use references 092, 093 and 094 in `docs/design/shop-contacts`. See `docs/design/shop-contacts/IMPLEMENTATION.md`. Preserve optional labels, platform-specific value types, the 100-contact limit, destructive confirmation and retained navigation.

## Shop Cover reference mapping

Shop Cover (`/shop/cover`) uses `docs/design/shop-cover/103-shop-cover-cover-default.png`. See `docs/design/shop-cover/IMPLEMENTATION.md`. Preserve staged removal until Save, replacement validation, backend dimensions, retained drafts and independent business-logo behavior.

## Shop Customers reference mappings

Shop Customers (`/shop/customers`), buyer detail and block/credit actions map to references 079 through 082 in `docs/design/shop-customers`; 122 maps the shared filter drawer. See `docs/design/shop-customers/IMPLEMENTATION.md`. Preserve shared OrderCard history, applied-filter/draft separation and source navigation. Use the centered block modal with optional saved reason and explicit existing/new credit-contact choices. Never create a credit balance or merge customer identities when linking.

The shared OrderCard must follow references 080 and 073: reference/status header, date, customer identity beside amount/payment, and thumbnails beside fulfillment. Reusing a component does not establish visual acceptance; inspect its rendered layout.

## Shop Fulfillment reference mapping

Fulfillment (`/shop/fulfillment`) maps to `docs/design/shop-fulfillment/102-shop-fulfillment-fulfillment-default.png`. Preserve pickup address/hours, buyer instructions, live preview and Save placement. See `docs/design/shop-fulfillment/IMPLEMENTATION.md` for the supported instruction limit, address fallback, buyer integration and immutable order snapshots.

## Shop Location and Logo reference mappings

Shop location (`/shop/location`) maps to 072 and the permission-denied state 154 in `docs/design/shop-location`. Preserve actual coordinates/time, owner GPS updates, public disclosure, retry/help and the required setup gate. See `docs/design/shop-location/IMPLEMENTATION.md`.

Business logo (`/shop/logo`) maps to 104 in `docs/design/shop-logo`. Preserve the shared identity preview, requirements, owner-only controls, staged removal/Undo and explicit Save/Cancel. See `docs/design/shop-logo/IMPLEMENTATION.md`.

## Shop Payment Methods reference mappings

Shop methods list, Add and Edit (`/shop/methods`, `/shop/methods/new`, `/shop/methods/:id/edit`) map to 098-100 in `docs/design/shop-methods`. Preserve the overflow-card list and sectioned Cash/Bank transfer forms. Keep manual processing, custom bank/wallet values, the supported 2,000-character instruction limit, 20-method cap, last-active validation and historical order snapshots. See `docs/design/shop-methods/IMPLEMENTATION.md`.

## Shop Orders reference mappings

Shop orders list/detail/action/request-review routes map to 073-076, 120, 136-138, 155, 158 and 164 in `docs/design/shop-orders`. Preserve the white progress summary, icon-label primary/Print/More actions, shared order cards, centered cancel/payment dialogs, dispatch/refund sheets and full-page request review. Keep the actual full-payment, return and POS reversal safeguards. Unsupported dispatch metadata must not appear as unsaved controls. See `docs/design/shop-orders/IMPLEMENTATION.md`.

## Shop Promotions reference mappings

Promotions list, new coupon, new flash sale, edit, filters and product picker map to 088-091, 126 and 141 in `docs/design/shop-promotions`. Preserve selectable summary cards, overflow/Add menus, sectioned forms, independent product discounts/quantity limits, usage, pinned actions and shared right drawers. Follow actual API rules for coupon edits, used flash-sale locks, business-time dates, overlaps and limits. See `docs/design/shop-promotions/IMPLEMENTATION.md`.

## Shop Report reference mappings

Shop report `/shop/report` maps to 087, 125 and 165 in `docs/design/shop-report`. Preserve the compact overview, business-period/currency context, daily chart/table, top products, summary cards, natural breakdown continuation and shared right filter drawer. Keep completed-sales, current payment-status values and inactive-buyer definitions accurate; do not invent cash-receipt, chat or fulfillment-success metrics. See `docs/design/shop-report/IMPLEMENTATION.md`.

## Shop Reviews reference mappings

Reviews list/reply/filter routes map to 085, 086 and 124 in `docs/design/shop-reviews`. Preserve compact identity/star/product cards, saved-reply context, public editor/removal warning and shared right radio filters. Keep rating-only reply support, the 2,000-character limit, honest loaded awaiting counts, scoped product photos, draft-only Reset/Apply and source retention. See `docs/design/shop-reviews/IMPLEMENTATION.md`.

## Storefront reference mappings

- Storefront `/shop/storefront`: `docs/design/shop-storefront/101-shop-storefront-storefront-default.png`.
- Expanded opening hours: `docs/design/shop-storefront/166-opening-hours-continuation.png`.
- Implementation, acceptance differences and checks: `docs/design/shop-storefront/IMPLEMENTATION.md`.

## Supplier reference mappings

- Directory `/suppliers`: `docs/design/suppliers/034-suppliers-directory-default.png`.
- New `/suppliers/new`: `docs/design/suppliers/035-suppliers-new-create-default.png`.
- Edit `/suppliers/:id/edit`: `docs/design/suppliers/036-suppliers-id-edit-edit-default.png`.
- Detail `/suppliers/:id`: `docs/design/suppliers/037-suppliers-id-supplier-detail-default.png`.
- New payment `/suppliers/:id/payments/new`: `docs/design/suppliers/038-suppliers-id-payments-new-new-payment-default.png`.
- Edit payment `/suppliers/:id/payments/:paymentId/edit`: `docs/design/suppliers/039-suppliers-id-payments-paymentid-edit-edit-payment-default.png`.
- Payment records tab: `docs/design/suppliers/108-suppliers-id-payment-records-tab-payment-records-tab.png`.
- Directory right filter drawer: `docs/design/suppliers/116-suppliers-right-filter-drawer-right-filter-drawer.png`.
- Acceptance notes and verification: `docs/design/suppliers/IMPLEMENTATION.md`.

## Transaction reference mappings

- Customers history `/transactions`: `docs/design/transactions/043-transactions-payment-history-default.png`.
- Customer payment edit `/transactions/payments/:id/edit`: `docs/design/transactions/044-transactions-payments-id-edit-customer-payment-edit-default.png`.
- Supplier payment edit `/transactions/supplier-payments/:id/edit`: `docs/design/transactions/045-transactions-supplier-payments-id-edit-supplier-payment-edit-default.png`.
- Suppliers history tab: `docs/design/transactions/109-transactions-supplier-payments-tab-supplier-payments-tab.png`.
- Shared right drawer: `docs/design/transactions/118-transactions-right-filter-drawer-right-filter-drawer.png`.
- Acceptance differences and verification: `docs/design/transactions/IMPLEMENTATION.md`.

## Navigation drawer reference mapping

- Shared left navigation drawer: `docs/design/navigation/navigation-drawer-reference.png` (user-supplied MKPOS Mobile Drawer Over Catalog).
- Preserve permission-aware sections, actual identities, independent navigation scrolling and the existing animation. See `docs/design/navigation/IMPLEMENTATION.md` for accepted differences and verification.
