# Screen specifications

[Handoff home](../../UI-UX-HANDOFF.md) | [Design system](01-design-system.md) | [State contracts](04-flows-and-states.md)

Each row is a required design surface. Multiple routes in one row are variants of the same design, not permission to omit a route. Parameter names are documentation placeholders, not literal URLs. In-page steps, tabs, dialogs and gated states are included below the route tables. All screens inherit the design system's first-load, refresh, empty, error, busy, keyboard, localization and responsive requirements; the final column highlights additional conditions.

Use the listed source as the authority for field payloads, validation and permission checks. This specification supplies visual hierarchy and interaction intent; it does not authorize changing those business rules. Unknown IDs, stale records, denied permissions and unavailable features must have meaningful recovery, not a blank page.

## 1. Authentication and application frame

Sources: [App](../../src/app/App.jsx), [AuthScreen](../../src/app/AuthScreen.jsx), [AppShell](../../src/navigation/AppShell.jsx), [modules](../../src/navigation/modules.js).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Login `/login` | Brand/context; welcome title; email/password; visibility control; Remember me; primary Login; signup link | Preserve login validation, server errors, pending state, keyboard submission and session recovery. Do not expose password text by default. |
| Signup `/signup` | Brand/context; business name, owner name and email; password/confirmation; create-account action; login link | Preserve minimum-eight-character password and current validation. Show field-level and general errors without clearing values. |
| Boot/session check (no separate route) | Stable brand-sized loading surface with short status | Avoid briefly showing logged-out or unauthorized content. Expired session returns to the authentication flow. |
| Offline unavailable (no separate route) | Connection explanation; retry/reconnect; eligible offline-sale entry if existing session/cache allow | Distinguish no connection from no prepared device data. Do not promise a complete offline management app. |
| App frame (all authenticated routes) | Compact business/module context; module navigation grouped Operations, Contacts, Finance, Administration; content region | Render only enabled/authorized modules. Preserve app/account switching and logout behavior. Mobile navigation must not cover content or trap Back. |
| Missing/unavailable module state | Title + reason + safe authorized destination | ModulePlaceholder is a fallback, not a new business screen. Unknown paths must not imply unauthorized data exists. |
| Subscription/trial banner | Compact status and renewal path in shell | Keep billing truth from session/server. Suppress alongside shell header in full-page conversation only; do not globally remove it. |
| Chat alert | Small nonblocking notification with customer/message context | Open correct thread via app navigation; avoid duplicate notices and interfering with a dialog or focused form. |

Module order: Sell, Products, Purchases, Sales, My Shop; Suppliers, Customers; Expenses, Transactions, Reports; Billing, Access, Settings. Existing default module resolution remains authoritative.

## 2. Sell and offline sales

Sources: [SaleScreen](../../src/sell/SaleScreen.jsx), [OfflineSalesPage](../../src/sell/OfflineSalesPage.jsx), [sale rules](../../src/sell/saleUtils.js).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Product selection `/sell` | Sale header/cart count; search + scan; category filter drawer; product rows/cards with photo, name, stock, price options; cart continuation summary | Add using correct price type; preserve selected quantities and draft while filtering. Show unavailable/out-of-stock/below-cost context from source. Offline cache readiness/sync context remains visible. |
| Quantity step `/sell/cart` | Back/title and line/unit count; one card per selected price line; quantity stepper, FOC field, pack/unit shortcut; line total; Continue | Distinguish sold quantity from free quantity. Show stock and below-cost warnings at affected line. Remove is clearly labeled. Empty cart links back to product selection. |
| Checkout `/sell/checkout` | Back/title; confirmed customer selection; totals/discount; payment method and paid-now amount; balance/change; submit | Require customer when credit remains according to source. Online/offline constraints must remain explicit. Disable duplicate checkout and keep draft on rejection. Omit the unsavable sale-note field. |
| New checkout customer `/sell/customer/new` | Reference-mapped header/cart shortcut; retained-cart panel; one form panel; Cancel/Create customer | Name and phone required in this checkout-specific form; optional email/address/customer note. Select created customer in Checkout without losing cart/payment. See the mapped reference and implementation record. |
| Sale complete (checkout state) | Success mark; receipt/reference; total/result context; Print receipt; Start new sale | Different text for local unsynced receipt and server-confirmed sale. Printing failure must not imply checkout failed. New sale explicitly clears completed draft. |
| Offline queue `/sell/offline-sales` | Back/title/menu; connection banner; four stored status counts; Sync now; latest/oldest sort; local receipt cards with amount, units/items, date, status and action menu; receipt preview | Follow mapped references 005 and 144. Separate pending, syncing, conflict and completed states. Sync actions use the existing waiting queue; disable sync offline and retain failed records for explicit retry. Preserve canonical local receipt IDs, source draft and list sort on Back. Never call a local sale server-confirmed before sync. |

Overlays: searchable customer picker with selected state and New customer entry; barcode scanner with live camera, Close, permission/loading/error/manual recovery; stock/below-cost notices. Sell intentionally retains one view/draft across its step routes. Do not remount and erase it on every URL change.

Sell references 001-005, 111, 127, 128, 143, 144 and 169 use the revised compact UI/UX acceptance rule. See [implementation, supported controls and verification](../design/sell/IMPLEMENTATION.md). Filters and customer confirmation use pending selections; receipt retry never saves the sale again.

## 3. Products

Sources: [ProductsScreen](../../src/products/ProductsScreen.jsx), [ProductPhotoField](../../src/products/ProductPhotoField.jsx), [scanner](../../src/products/ProductBarcodeScanner.jsx).

References 006–013 are implemented and take visual precedence for these screens. See the [eight-screen comparison and control record](../design/products/IMPLEMENTATION.md), [wizard](../../src/products/ProductReferenceForm.jsx), [shared header/profile/inputs](../../src/products/ProductReferenceParts.jsx), and [stock layout](../../src/products/ProductReferenceStock.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Inventory `/products` | Reference 006: Back/title/Add; two inventory summaries; search/scan + filter; count/export/tools; compact photo/name/SKU/stock/primary-price cards; shared bottom navigation | Category/stock filters remain in the right drawer. Tools retains refresh, import and barcode selection. Stock status includes text; below-cost warning remains. No product-detail route is invented. |
| Create `/products/new` | References 007–009: Basic photo/identity/base-unit form; Inventory identity/conversion/stock/cost/threshold; Prices manual/automatic cards; pinned Cancel/Previous/Continue/Save product | Wait for configured pricing rules before initialization. Preserve values/photo across steps and route return. Currency follows the active business. Shared automatic markup/rounding remain read-only; per-product mode/price remain editable. |
| Edit `/products/:id/edit` | References 010–012: photo panel and identity/description fields; inventory profile + unit/conversion/stock/cost panels; price-step profile above progress and price cards | Description uses supported online_description. Unit-size metadata is unsupported and omitted. SKU/category remain optional. Product-name and description limits follow the API. Busy saves disable form editing and guard duplicate submissions; failures retain draft and target the failing step. |
| Stock `/products/:id/stock` | Reference 013: Back/title/menu; product photo/stock/price; Add stock/Remove stock; quantity/unit, resulting balance, reason and Save adjustment; dated movement rows | Direction determines the signed API adjustment; prevent zero/nonfinite or negative resulting stock. Retain reason/quantity on failure. Refresh affected stock/history after success; preserve source search/list state on ordinary Back. |

Overlays/components: product menu Stock/Edit/Print barcode/Delete; delete confirmation including affected item and PIN when required; CSV tool/import review; barcode multi-selection and preview/print; photo picker/camera/crop. Photo target is square; existing processing aims for a small stored image (50KB limit in current product workflow). Preserve camera permission denial, device absence, cancel, crop retry and broken-photo fallback. Do not conflate this photo limit with shop or chat uploads.

## 4. Purchases

References 014?023, 113, 133 and 134: [final comparisons and verified contracts](../design/purchases/IMPLEMENTATION.md). Reference number, purchase date and expected delivery now persist through the purchase API. FOC is presented in base units and serialized in buying units; preserve the conversion.

Source: [PurchasesScreen](../../src/purchases/PurchasesScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Purchase history `/purchases` | Title + New purchase; summary/context; search + date/filter drawer + export; purchase rows with supplier/reference/date/total/payment context | Separate row navigation from overflow actions. Keep filtered history and scroll when returning. |
| Create `/purchases/new` | Four-step wizard: Basic information; Select products; Quantities and costs; Review and submit | Step 1 supplier/reference; step 2 searchable/category product selection; step 3 buying unit, conversion, paid quantity, FOC, cost; step 4 totals, payment/paid-now and note. Preserve draft between steps. |
| Edit `/purchases/:id/edit` | Same wizard with existing purchase and edit context | Explain resulting stock/account changes through existing rules; validate all lines before saving. |
| Detail `/purchases/:id` | Back/reference; supplier/date/payment summary; purchased item cards; totals; actions | Supplier navigation when permitted; edit/delete actions visible as authorized; unknown/deleted purchase recovery. |

Overlays: supplier picker; action menu; admin PIN where required; delete confirmation explaining stock reversal; selling-price-below-cost warning with Go back and edit/Save anyway. Show effective unit cost and conversion so FOC cannot be confused with paid quantity. A warning confirmation must not silently change automatic pricing rules.

## 5. Sales

Sources: [SalesHistoryScreen](../../src/transactions/SalesHistoryScreen.jsx), [TransactionsScreen](../../src/transactions/TransactionsScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Sales history `/sales` | Title; period/search/filter/export; totals with clear scope; sale rows with receipt/customer/date/amount and payment state | Shared transaction/history infrastructure remains in use; keep sales context in labels and return paths. |
| Sale detail `/sales/:id` | Back/receipt; sale total and paid/balance; customer/payment/date; item list; totals/discount; receipt and authorized edit/delete | Receipt printing is a separate operation from changing sale. Keep print progress/failure local. |
| Edit sale `/sales/:id/edit` | Two-step Cart and Checkout; selected items/prices/quantities/FOC, then customer/payment/discount and authorization | Preserve stock/account reconciliation, price type, original receipt identity and protected-edit/PIN flow. Keep errors by field/line and bring validation into view. The API has no payment-note field. |

Overlays: product picker, customer picker, sale action menu, delete/PIN confirmation, print status. A failed save retains edits and does not reset the source list. Existing print formatting remains governed by receipt/printer settings.

## 6. Credit customer accounts

Source: [CustomersScreen](../../src/customers/CustomersScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Contacts `/customers` | Title + Add; search/filter/export; compact customer contact rows with name/contact left and balance state right | This is the presentation reference for shop customer rows. Receivable/payable/settled use text as well as semantic color. |
| Create `/customers/new` | Customer identity/contact form; grouped optional details; Cancel/Save | Name, phone, optional email, address/note according to existing form; return to actual caller. |
| Edit `/customers/:id/edit` | Same form with existing identity | Preserve source detail/list state; report validation without wiping values. |
| Account detail `/customers/:id` | Customer profile/contact; receivable/payable summary; Add payment, statement print and edit actions; tabs Credit sales / Payment records | Search history and date drawer belong to active history. Preserve tab/query/page/scroll. Show account direction clearly. |
| New movement `/customers/:id/payments/new` | Account identity/balance context; direction; amount; payment method; note; submit | Explicitly label customer pays shop vs shop pays customer. Do not rely on signed numbers alone. |
| Edit movement `/customers/:id/payments/:paymentId/edit` | Same payment form populated with current record | Preserve audit/business rules, financial confirmation and required PIN. Cancel returns to correct account/history. |

Overlays: contact action menu, delete confirmation, payment removal/PIN and print status. Do not merge a shop buyer with a credit contact just because names match.

## 7. Suppliers

Source: [SuppliersScreen](../../src/suppliers/SuppliersScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Directory `/suppliers` | Title + Add; search/filter/export; contact rows and payable/account summary | Match customer directory density while retaining supplier-specific labels and direction. |
| Create `/suppliers/new` | Supplier name, phone/contact person, address/note; Cancel/Save | Keep existing optional/required rules; retain caller context from purchases if used. |
| Edit `/suppliers/:id/edit` | Same form with current supplier | Validation and missing record states. |
| Supplier detail `/suppliers/:id` | Contact summary; account balance; pay/statement/edit; Purchases and Payment records tabs; history filters | Distinguish shop owes supplier from supplier owes shop. Keep tab/date/query and loaded rows on return. |
| New payment `/suppliers/:id/payments/new` | Supplier/account context; movement direction, amount/method/note; confirm | Shop pays supplier vs supplier pays shop must be readable. |
| Edit payment `/suppliers/:id/payments/:paymentId/edit` | Same populated payment form | Reconcile affected balances/history after server success. |

Overlays: shared supplier/payment action menus, delete confirmations and native right filter drawers. Statement exports the actual account data as CSV. Payment creation uses the mapped full page. See [supplier acceptance notes](../design/suppliers/IMPLEMENTATION.md) for reference mappings, optional-field rules, original payment dates and verification.

## 8. Expenses

Source: [ExpensesScreen](../../src/expenses/ExpensesScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Expense list `/expenses` | Title + Add; today/month/filtered summary with period labels; search/filter/export; expense rows | Date/category/payment filters and presets in drawer; top-category context must identify scope. |
| New expense `/expenses/new` | Date, title/category, amount/payment method, note; Cancel/Save | Numeric keyboard, clear currency, inline validation. |
| Edit expense `/expenses/:id/edit` | Same populated form with record context | Keep source filters/scroll; missing record and save failure recovery. |

Overlays: row action menu and delete confirmation. Amount zero/invalid input must follow existing validation, not a newly invented design shortcut.

## 9. Transactions

Sources: [TransactionsScreen](../../src/transactions/TransactionsScreen.jsx), [PaymentTransactions](../../src/transactions/PaymentTransactions.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Payment history `/transactions` | Title; Customers / Suppliers tabs; search/date/filter/export; scoped totals; movement cards | Each row names party, direction, method, date, amount and reference. Switching tabs keeps context coherent; sales history is its own module. |
| Customer payment edit `/transactions/payments/:id/edit` | Party/record context; direction/amount/method/note; Cancel/Save | Use shared payment edit rules while returning to the transaction origin. |
| Supplier payment edit `/transactions/supplier-payments/:id/edit` | Equivalent supplier payment form | Keep supplier-specific direction/copy and API behavior. |

Overlays: shared payment detail/action/delete sheets, named account picker and native right filter drawer. Matching summary totals/counts include unloaded pages; loaded-only fallback is explicitly labeled. Tabs retain independent queries and loaded records. Original payment dates are read only; notes keep existing limits. See [transaction acceptance notes](../design/transactions/IMPLEMENTATION.md) for mapped references and behavior checks.

## 10. Business reports

Source: [ReportsScreen](../../src/reports/ReportsScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Reports `/reports` | Title; date period/filter/export; net profit; sales/paid/credit/expense/FOC metrics; cash movement; inventory/account snapshots; month/year sales trends; payment breakdown; top products; expense categories | Keep period activity separate from current inventory valuation and outstanding balances. Explain the applicable date/as-of values. Chart values need readable alternatives. |

Drawer includes period presets and custom dates. Metrics: debt collected, shop payouts, expected drawer and net movement need clear meaning, not just decorative icons. Current positive-stock valuation uses cost, not selling price. Empty report period still shows meaningful zero values and date context. Refresh errors retain the prior report with an honest notice.

References 046, 119, 156 and 160–162 are implemented as one naturally scrolling page with section shortcuts, six compact metrics, cash/FOC rows, inventory/account snapshots, month/year chart tabs and expandable chart-value tables. Date presets/custom dates remain drafts until successful Apply; Cancel leaves the report and export scope intact. The API does not supply previous-period comparisons or opening cash. Payment rows distinguish receipts from sales totals, and all account directions remain explicit. See [report implementation and verification](../design/reports/IMPLEMENTATION.md).

## 11. Billing

Source: [BillingScreen](../../src/billing/BillingScreen.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Billing overview `/billing` | Current plan/status/validity; latest payment; available package cards; payment account availability; billing history/export; support contacts | Distinguish trial, valid paid, expired and pending approval. Selected plan has clear price/duration from server. |
| Plan payment request `/billing/request/:planId` | Selected plan summary; payment account/instructions; transfer proof picker; reference/note/message; submit | Plan ID is numeric in current routing. JPG/PNG/WebP proof, max 5MB. Show preview/replace/upload error. Explain office approval; submission does not instantly activate the plan. |

Support rows retain phone, Telegram, Viber, email and community targets supplied by current configuration. Missing payment accounts/support values have honest fallback copy. Do not invent prices or a card checkout.

## 12. Access management

Sources: [AccessScreen](../../src/access/AccessScreen.jsx), [access routes](../../src/access/accessUtils.js).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Access `/access` | Title/context; Roles / Staff tabs; Add action; rows with role/permission summary or staff identity/status; secondary export | Owner/authorized access only. Keep current user and protected roles/staff restrictions obvious. |
| New role `/access/roles/new` | Role name; grouped page access selection; Cancel/Create | Require at least one allowed page according to source. No vague “all access” styling when only partial access is granted. |
| Edit role `/access/roles/:id/edit` | Same role form with assigned permissions | Preserve backend permission identities and dependent constraints. |
| New staff `/access/staff/new` | Name/email; role selection; active status; password/confirmation; Create | Current password rule: minimum eight characters; do not expose existing passwords. |
| Edit staff `/access/staff/:id/edit` | Identity, role and active status | Password reset is its own route; prevent confusing role save with password update. |
| Reset staff password `/access/staff/:id/password` | Staff identity; new password + confirmation; reset action | Minimum eight characters, clear busy/success/failure; never put password in a summary or toast. |

Overlays: role/staff action menu and delete confirmation. Disabled/protected operations explain why. Keep Roles/Staff tab, loaded pages and scroll when returning.

## 13. Settings and device tools

Sources: [SettingsScreen](../../src/settings/SettingsScreen.jsx), [PrinterSettingsPage](../../src/settings/PrinterSettingsPage.jsx), [ReceiptPreview](../../src/settings/ReceiptPreview.jsx), [settings access](../../src/settings/settingsAccess.js).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Settings index `/settings` | Title; grouped identity/business, output/device, administration and help rows | Permission-aware rows. Staff currently have account/receipt/printer/barcode/about only; do not expose owner tools through styling. |
| Account `/settings/account` | Current identity; profile fields; current password; optional new password/confirmation; Save | Current password required for profile changes under existing logic. Sensitive input is not retained in visible summaries. |
| Business/shop `/settings/shop` | Business name/title/contact/address/currency; logo preview/picker; Save | Shared business identity affects other modules/storefront. Logo JPG/PNG/WebP max512KB. Explain shared effect where relevant. |
| Receipt `/settings/receipt` | Content visibility toggles; footer/alignment; paper/layout/font/margins; live preview; save/test print | Preserve 50/58/80/85mm, A5/A4 choices and template behavior. Preview updates must not jump form scroll. Separate template settings from device printer profile. |
| Barcode `/settings/barcode` | Format selector; physical dimensions/margins/gaps; name/value toggles; live sample; Save/print where supported | Formats: A4 3x8 / 4x10; rolls 40x30, 50x30, 60x40; custom sheet/roll. Label dimensions are physical mm, not CSS pixel suggestions. Invalid geometry needs inline errors. |
| Printer `/settings/printer` | Native/browser context; connection type; conditional setup; paper/copies/cut/color/orientation; connection/test actions; Save | Native system/TCP/Bluetooth Classic; browser fallback explains printing path. Host/port for TCP; paired device selection and pairing help for Bluetooth. Preserve test progress/error. |
| Payment methods `/settings/payments` | Existing method rows; add/remove; save footer | Preserve validation and method names used by transactions. Avoid accidental row deletion on field focus. |
| Price types `/settings/prices` | Price rows with manual/automatic rule and usage; Add/Edit/Delete | Used types may be protected. Display automatic cost markup and rounding meaning. |
| New price `/settings/prices/new` | Identity; manual/automatic mode; markup/rounding/min profit; Save | Automatic-only fields disabled meaningfully in manual mode. |
| Edit price `/settings/prices/:name/edit` | Same form; usage count; explicit Apply to existing option | Applying to existing products replaces calculated prices; preserve explicit opt-in and explain effect. URL-encode names. |
| Security `/settings/security` | PIN status; PIN configuration/update form; Save | Preserve optional PIN protection; never render stored PIN in plaintext. |
| Data tools `/settings/data` | Backup status/download; restore entry; visually separated danger reset entry | Paid-plan gating for backup/restore; show trial restriction and Billing path. Export failure does not remove local/server data. |
| Restore `/settings/data/restore` | Prominent replacement consequence; `.mkpos-backup` picker; typed RESTORE; PIN if enabled; Restore | Max25MB; preserve server validation, long-running busy behavior and identity/cache refresh after success. No real restore during design QA. |
| Reset `/settings/data/reset` | What is removed/preserved; safety backup explanation; typed RESET; optional PIN; destructive action | Second confirmation sheet required by current flow. Preserve account/users/roles/subscription/billing; clear operational data only through server rules. Never execute in production for a visual check. |
| Language `/settings/language` | English / Myanmar choices and clear active state | Apply existing global localization behavior, preserve source navigation and mixed-script data. |
| About `/settings/about` | App version/runtime/server context; support/contact links | Distinguish browser/PWA/native build context; do not expose secrets. |

Printer detail: current native profile defaults include system/80mm, one copy, TCP port9100. Copies1-10 and port1-65535 are validation constraints; A4 is system-only. Paired devices can require pagination and refresh. Device paper is authoritative for Android while shared receipt template is separately configured. The receipt preview is an overlay/component; `/settings/receipt-preview` is an API endpoint, not a mobile page.

## 14. My Shop overview and gates

Sources: [ShopScreen](../../src/shop/ShopScreen.jsx), [ShopLocation](../../src/shop/ShopLocation.jsx), [shop rules](../../src/shop/shopUtils.js).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| My Shop `/shop` | Workspace/title/context; compact management rows with icon, title, description, chevron | Orders, Customers, Chat, Reviews, Report, Catalog, Promotions, Contacts, Delivery, Methods, Storefront, Fulfillment, Cover; owner logo/location entries. Filter by permissions and subscription. |
| Shop location `/shop/location` | Saved status/coordinates/time; public-location explanation and GPS update; expandable help; separate denied screen | References 072/154; owner-only GPS, retry without invented coordinates, retained source and required setup gate. Missing location blocks staff until the owner acts. |
| Location prerequisite gate | Compact blocking context with required next action | Do not render sensitive management content behind a misleading successful state. Preserve route for continuation. |
| Subscription restriction | Required-plan message and View subscription | Expired plan restricts catalog/promotions/settings routes; operational orders/customers/chat/reviews/report remain available according to existing guards. |
| Permission denial | Clear unavailable message and authorized destination | Do not leave active-looking buttons that navigate to denied tools. Server remains authority. |

## 15. Shop orders

References 073-076, 120, 136-138, 155, 158 and 164: [implementation and intentional corrections](../design/shop-orders/IMPLEMENTATION.md).

Sources: [ShopOrders](../../src/shop/ShopOrders.jsx), [OrderCard](../../src/shop/OrderCard.jsx), [OrderRoadmap](../../src/shop/OrderRoadmap.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Orders `/shop/orders` | Title; search/filter/export toolbar; result count/context; shared OrderCard list; endless footer | Drawer: order/payment status, dates/timezone, request-only state and existing controls. No always-open date strip. |
| Order detail `/shop/orders/:id` | Back/reference; total/item count/state hero; fulfillment roadmap; icon+label action tiles; customer and fulfillment panels; requests; items/totals/promotions; linked POS sale; payment/proof/account; audit | Distinct customer and delivery/pickup icon language. Clear optional sections. Preserve cross-module permissions on customer/sale links. |
| Action deep link `/shop/orders/:id/action/:action` | Same order context with focused action confirmation modal/form | Normal detail actions open a modal without unnecessary navigation. Deep links must remain usable and close/back safely. |
| Request review `/shop/orders/:id/requests/:requestId/review` | Full-page order summary; request type/reason/photo; decision radio cards; required review note; pinned Save decision/Cancel | Preserve accept/reject rules, required reasons, pending state and record reconciliation. |

Design roadmap and badges for pending, accepted, packing, ready_for_pickup, dispatched, return_pending, completed, cancelled and expired. Payment variants: unpaid, proof_submitted, paid, refund_pending, refunded. Do not imply every status is selectable from every other status. Source determines actions.

Completion requires payment where source enforces it. Manual paid confirmation must verify full amount. Cancellation, failed/rejected decisions, returns, refunds, reopening and linked POS void/refund prerequisites keep their existing financial/physical-goods rules. Keep reasons and evidence beside the confirmation. Payment proof selection/private image failure is independent of the whole-order loading state. Audit history can expand progressively; never hide a pending actionable request inside a collapsed decorative section.

## 16. Shop catalog

Source: [ShopCatalog](../../src/shop/ShopCatalog.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Catalog `/shop/catalog` | Title; search/filter/export or bulk controls as present; product rows with stock/online price/publication; bulk Publish/Unpublish | Drawer for category, stock, publication, online-price and sort controls. Bulk filtered action affects all matching records, not just visible rows; confirm filter scope/count. |
| Publication editor `/shop/catalog/:id/edit` | Product identity; public product/unit/description/price/publication fields from source; preview context; Save | Distinguish inventory fields from public publication fields; retain validation, missing record and subscription restriction. |

Bulk confirmation snapshots the active scope. Do not allow filter changes during confirmation to silently redirect the operation.

## 17. Shop customers

Source: [ShopCustomers](../../src/shop/ShopCustomers.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Buyer list `/shop/customers` | Title; compact search/filter/export; contact-style customer rows; pagination | Name/contact left, purchase badge/summary right, chevron. No oversized avatar, left accent stripe or decorative footer. Distinguish account/guest/blocked and optional contact information. |
| Buyer detail `/shop/customers/:customerKey` | Back/customer identity; profile/contact/state; compact actions; purchase statistics by currency; order history heading/toolbar; shared OrderCard rows | Preserve currency separation; no combined total across currencies. History filters and scroll survive order/chat navigation. Customer keys can represent account or guest and must be URL-encoded. |
| Block action `/shop/customers/:customerKey/action/block` | Customer context; current block state; explicit Block/Unblock confirmation and reason if provided by flow | Busy/error keeps context. Permission-aware; never silently block on opening detail. |
| Link credit contact `/shop/customers/:customerKey/action/credit` | Buyer identity; existing/new credit contact context from source; explicit confirmation | Reuse/link intentionally; no automatic financial balance creation or matching solely by name. |

Detail actions include chat and customer/credit operations as authorized. Opening chat creates or reuses a thread through the existing API. The list/history are not rebuilt as a different visual product: OrderCard is shared with main Orders and contact-row density is shared with credit contacts.

## 18. Shop chat

Source: [ShopChat](../../src/shop/ShopChat.jsx), [chat styles](../../src/styles/shop-chat.css).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Inbox `/shop/chat` | Title; compact search/unread filter drawer; avatar/name/last-message/time rows; unread and presence cues | Entire conversation row opens thread. Long preview truncates without hiding identity/time. Empty inbox differs from no unread matches. |
| Conversation `/shop/chat/:uuid` | Full-page white header: Back, clickable avatar+name, presence; neutral message canvas; date/history states; bottom composer | UUID is a 36-character thread key. Hide outer app header/trial banner only here. Profile group opens buyer detail. No separate placeholder-profile icon. Preserve true origin on Back. |

Message variants: incoming text; outgoing text; mixed Myanmar/Latin/multiline; image pending/loaded/expired/error; shared product; sending/sent/failed-retry; date boundaries; older-message loading; unavailable/deleted customer/product; read-only staff; chat disabled. Preserve existing Sent/Seen data and available typing/presence integration; do not display fictional delivery or realtime events when that data is unavailable.

Composer has product and image utilities, textarea and primary send button in one row; textarea can grow with an internal cap. Keep 44px utility targets. Preserve 2,000-character body limit and JPEG/PNG/WebP attachment max2MB. Images expire after14days under current behavior, so show expiration instead of a permanent broken image. Product picker is searchable, paginated and reusable. Failed send retries with the same client identity to avoid duplicates. Preserve draft, selected attachment and reading position on recoverable errors/navigation according to source. New messages must not pull the operator away from older content they are reading. Keyboard must leave composer visible.

## 19. Reviews

References 085/086/124: [implementation and intentional corrections](../design/shop-reviews/IMPLEMENTATION.md).

Source: [ShopReviews](../../src/shop/ShopReviews.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Ratings and reviews `/shop/reviews` | Title/context; search/filter/export; compact summaries Matching reviews / Awaiting reply shown; review cards; endless footer | Drawer: shop/product type, rating, reply status, content, dates and sort from source. The shown awaiting count describes loaded rows only. |
| Reply editor `/shop/reviews/:id/edit` | Review/customer/rating/target context; existing reply; clearly labeled public reply textarea; Cancel/Save | Process permission required to reply. Max2,000 characters; blank removes existing reply. Explain removal before saving blank content. Keep source list filters/scroll. |

Card variants: shop vs product review; rating-only vs comment; awaiting vs replied; short/long text; absent product/customer; view-only vs Reply/Edit action. Stars are green in theme and have a readable rating label. Reply panel is distinct from the customer's comment.

## 20. Shop report

References 087, 125 and 165: [implementation and data definitions](../design/shop-report/IMPLEMENTATION.md).

Source: [ShopReport](../../src/shop/ShopReport.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Online-shop report `/shop/report` | Title; period/currency/filter/export; summary and previous-period comparisons; daily chart/table; product/buyer/outcome/origin/segment breakdowns; payment/refund/fulfillment and customer follow-up | Currency and resolved date range are required context. Reset stages valid initial dates/currency; Apply is explicit. No cross-currency total. Show comparison absence honestly instead of infinite percent growth. |

Use labeled metrics and meaningful zero-data views. Keep report-specific status definitions from the API. Chart bars and direction indicators cannot rely solely on color. Follow-up navigation preserves report scope when returning.

## 21. Promotions

References 088-091, 126 and 141: [implementation and API corrections](../design/shop-promotions/IMPLEMENTATION.md).

Source: [ShopPromotions](../../src/shop/ShopPromotions.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Promotions `/shop/promotions` | Title + New coupon/New flash sale; search/filter; selected count and bulk actions when selected; promotion rows with type/status/schedule/discount | Selection persists across filter/page changes as implemented. Select loaded vs select matching scope must be explicit. Preserve max1,000 selected constraint. |
| New coupon `/shop/promotions/new/coupon` | Identity/code; percent/fixed discount; minimum subtotal/usage limits; enabled/schedule; review/save | Clearly show discount units/currency; optional limits distinct from zero. Use business timezone. |
| New flash sale `/shop/promotions/new/flash_sale` | Identity/schedule; product picker; per-product discount and quantity limits; Save | Up to100 product rows; used product restrictions remain visible. Product removal and price edits have clear row targets. |
| Edit `/shop/promotions/:id/edit` | Matching coupon/flash-sale form with existing usage/state context | Lock used/restricted fields according to source; do not silently reset history/limits. |

Overlays: shared right promotion product picker with draft selection and Add/Cancel, row actions, bulk delete confirmation showing selection count/scope, filter drawer. Picker keeps selection while searching; no duplicate product rows. Schedule/expired/disabled states use text.

## 22. Shop configuration

Source: [ShopConfiguration](../../src/shop/ShopConfiguration.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Contacts `/shop/contacts` | Title + Add; compact platform/contact rows; edit/delete actions; count/limit | Current maximum100. Platform icon is meaningful and paired with label/value. |
| Add contact `/shop/contacts/new` | Platform; label; value; Save | Platforms include phone/email/Facebook/TikTok/YouTube/Telegram/Viber/Instagram/WhatsApp. Preserve platform-specific validation. |
| Edit contact `/shop/contacts/:id/edit` | Same form populated | Encoded identity and missing-record recovery. |
| Delivery `/shop/delivery` | Title + Add; option name/fee rows and actions | Current maximum100; clear currency and zero-fee meaning. |
| Add delivery `/shop/delivery/new` | Option name and fee; Save | Validate fee with current rules. |
| Edit delivery `/shop/delivery/:id/edit` | Same form populated | Preserve references from existing orders. |
| Payment methods `/shop/methods` | Reference 098: title/Add, explanation/count, cash/bank cards, receiving summary, manual/active state, overflow Edit/Delete | Maximum 20; masked summary/full editable account; guarded deletion and last-active validation. Separate from POS payment labels. |
| Add method `/shop/methods/new` | Reference 099: name, payment-type radio cards, receiving-details card, instructions/count, active switch; fixed Cancel/Save method | Preserve Cash/transfer drafts, custom bank/wallet names, optional receiving details and supported 2,000-character instructions. Natural scrolling. |
| Edit method `/shop/methods/:id/edit` | Reference 100: same populated sections with Save changes | Preserve full account values, inline validation, retry, unique retained IDs and source Back state; existing orders retain their payment snapshot. |

Each list needs first-load/empty/limit-reached/permission states and delete confirmation. Preserve server references and constraints; UI restyling does not authorize deleting a referenced record.

## 23. Storefront, branding and fulfillment

Sources: [ShopStorefront](../../src/shop/StorefrontSettings.jsx), [ShopLocation](../../src/shop/ShopLocation.jsx).

| Screen / route | Target layout | Actions and special states |
| --- | --- | --- |
| Storefront `/shop/storefront` | Public URL/slug and identity context; online price type; description; storefront/accepting-orders/marketplace options; announcement; opening hours/temporary closure; Save | Shared business fields and owner restrictions remain enforced. Slug is locked after orders exist. Use labeled switches with consequence text. Show public URL as a link with correct target. |
| Fulfillment `/shop/fulfillment` | Pickup address/hours, buyer instructions, live buyer preview; fixed Save changes | Reference 102; blank address falls back to shop address, hours are descriptive, instructions retain the supported 2,000-character limit. New pickup orders snapshot the saved details. |
| Cover `/shop/cover` | Current cover/empty preview; upload requirements; choose/replace/remove; Save | PNG/JPG/WebP, max2MB and4800x4800px under current UI requirements; preserve preview vs persisted state and upload errors. Preview scales without stretching. |
| Logo `/shop/logo` | Square shared-logo preview; business identity explanation; owner note; requirements; Replace/Remove; fixed Cancel/Save | Reference 104; PNG/JPG/WebP up to 512 KB and 2400 × 2400 px. Stage removal until Save, support Undo/retry and retain selected files through Back/Forward. |

Temporary closure, disabled storefront, not accepting orders and marketplace visibility are separate states. Visual switches must not collapse them into a single “online” flag.

## Cross-screen overlays and non-route surfaces

Design these alongside their owning pages: module/navigation menu; filter drawer; bottom action sheet; delete confirmation; admin PIN prompt; order action/request review modal; customer/supplier/product pickers; promotion selection; product scanner; product photo camera/crop; attachment picker; private image loading/error/expiry; receipt preview; barcode preview; CSV busy/result; print status; purchase cost warning; reset confirmation; location/subscription/permission gates; toast/inline notices; pull-refresh and endless-list feedback. See the component catalog for each implementation owner and the flows document for close/back behavior.

## Purchase reference implementation

References 014-023 cover purchase history, all four create/edit stages and detail. See [purchase implementation record](../design/purchases/IMPLEMENTATION.md) for screenshots, supported API fields, selected-unit FOC semantics and verification gaps. Preserve real purchase costs, payment validation, PIN deletion, supplier permissions and retained source/draft behavior.

## Customer reference implementation

References 028-033 map to existing contacts, create/edit, account, and payment routes. See [customer implementation record](../design/customers/IMPLEMENTATION.md) for final comparisons, supported fields, real balance semantics and batched sale-item API response. Preserve optional phone numbers, server-owned payment dates, source drafts and payment history tabs.

## Sales reference implementation

References 024-027, 114 and 135 cover sales history, detail, both edit steps, the right filter drawer and receipt print failure. See [sales implementation record](../design/sales/IMPLEMENTATION.md). Preserve historical prices, FOC, discount/credit/PIN validation, online-sale edit restrictions and retained source/draft state. Print retry operates on the saved receipt without resubmitting the sale.

Access references 049-054, 110 and 157 are implemented: [visual acceptance and behavior notes](../design/access/IMPLEMENTATION.md).

Authentication references 105, 106 and 168: [implementation, comparisons and verification](../design/authentication/IMPLEMENTATION.md).

Billing references 047, 048 and 149: [implementation, visual differences and verification](../design/billing/IMPLEMENTATION.md).

Expense references 040-042, 117 and 151: [implementation, comparisons and verification](../design/expenses/IMPLEMENTATION.md).

Storefront reference implementation: [acceptance notes](../design/shop-storefront/IMPLEMENTATION.md). Opening hours expand in place with editable native times, retained weekly drafts and per-day closure; temporary closure uses a business-local end time. Shared profile fields remain owner-only in expandable identity details.

Shared navigation drawer: [reference and acceptance notes](../design/navigation/IMPLEMENTATION.md). Grouped label-only rows retain permission filtering, native language selection, uploaded logo/initials account fallback, keyboard focus containment and source-page state.
