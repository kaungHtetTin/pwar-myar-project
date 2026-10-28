# Ecommerce development plan and implementation evidence

Date: 2026-10-04

The phase order follows `ECOMMERCE-SPECIFICATION.md`. The customer application lives in `shop/` and can run on another domain through the shared Laravel API.

| Phase | Implementation | Evidence |
| --- | --- | --- |
| 1 — Shared foundation | Store settings, explicit publication, scoped public catalog, integer checkout quotation, immutable item snapshots, idempotent submission, private tracking, stock reservations, payment/proof review, refunds, fulfillment transitions, scheduled expiry and transactional POS completion. | `EcommerceApiTest`; two independent PHP workers competing for the last item and retrying one submission. |
| 2 — Independent storefronts | Responsive customer catalog and product pages, local single-shop cart, full-page checkout/tracking, customer-safe errors and retries. POS configuration/publication, endless order lists, full-page staff processing, reports and inventory reservation visibility. | Browser checkout → staff fulfillment → POS completion → tracking; desktop and 390 px storefront screenshots; customer cart and lost-response tests. |
| 3 — Marketplace | Eligible opted-in shop/product discovery, database search/category filters, endless pagination, store attribution, explicit cart replacement, origin tracking and Office marketplace suspension. | Marketplace eligibility tests and mobile browser verification; the same checkout/processing services handle both channels. |

## Finalized implementation choices

- `shop/` is a separately built static React/Vite application. Hash routes allow independent-domain and subdirectory hosting without server rewrites.
- Existing active business and valid subscription rules determine public eligibility. Outstanding order/payment resolution bypasses subscription expiry but preserves business authentication and individual permissions.
- Delivery zones/payment instructions are validated JSON configuration under one tenant-owned storefront record. The store row serializes settings changes and checkout idempotency keys; product locks serialize inventory writes.
- Quantity arithmetic uses integer thousandths; money uses integer POS currency units. Guest orders never merge customers by name/phone. Immutable snapshots keep accepted totals and POS completion stable after catalog edits.
- Delivery fee is a separate field on the linked POS sale and receipt. No new tax behavior is introduced.
- Discovery sorts by stable IDs and uses bounded offset pagination. Categories use exact existing business category text; no new cross-business taxonomy is introduced.
- Phase 1 deliberately blocks legacy data replacement and Office deletion for any business with order history, preserving orders and refund obligations until a coordinated ecommerce backup/restore feature exists.

## Validation record

- Ecommerce feature tests pass, including tenancy, private field allowlists, payment review, expired-subscription resolution, reservations, snapshot completion, void/refund behavior and marketplace exclusion.
- Final targeted backend run: 42 tests passed, including all 14 ecommerce tests plus POS sales/inventory, permissions, backups, supplier credit and Office business summaries.
- Four customer tests cover cart isolation, explicit replacement and preservation of the exact checkout payload/key after a lost response.
- Existing POS frontend: 198 tests passed. Office frontend: 25 tests passed.
- Shop, POS and Office production builds passed; POS lint passed without warnings. Customer-origin browser requests work directly across origins without staff cookies.
- Broader backend suite: 92 passed, 3 failed in existing landing-page/tutorial expectations (`LandingPageTest` home/docs text and `OfficeTutorialTest` homepage tutorial count). Ecommerce does not change those views/controllers.
- Browser artifacts: `shop/artifacts/store-desktop.png`, `store-mobile.png`, `checkout-desktop.png`, `checkout-mobile.png`, `marketplace-mobile.png`, `staff-orders-desktop.png`, `staff-order-detail-desktop.png` and `staff-settings-desktop.png`.

Initial verification used an isolated MariaDB instance on port 3310 and `mkpos_ecommerce_test`. The main database originally did not complete requests. On 2026-10-05, after MySQL was repaired, its migration status confirmed that the ecommerce schema was already applied. No demo fixtures were added to the business database.

## Deployment work still required

### Local deployment preparation — 2026-10-05

- Added environment-driven customer/staff release builds with a configuration manifest and isolated release directory. Local values live in ignored `shop/.env.local`; URLs can be changed without source edits.
- Added bounded read-only deployment preflight for API/database health, public catalog, customer CORS, session-free responses and customer HTML.
- Added a local scheduler launcher; production still requires an installed once-per-minute scheduler task.
- Main port 3306 is listening, but `artisan migrate:status` still did not finish. The read-only diagnostic was stopped; no main-database migration was attempted.
- Customer dev port is 5177, distinct from the mobile app on 5176.
- Local customer/staff release builds passed, and the customer dev server returned HTTP 200 on port 5177. `schedule:list` confirms the minute-by-minute expiry command registration; the scheduler worker has not been started against the blocked database.
- Preflight passed against a temporary HTTP contract fixture and rejected an incorrect customer origin and an unavailable API. This validates the script, not the main database or a production deployment.

### Application recheck after MySQL repair — 2026-10-05

- Main database queries respond normally. All migrations, including `2026_10_04_000000_create_ecommerce_tables`, are marked applied; no further migration was needed.
- The deployment preflight passed against the actual local backend/customer app: database health, public catalog, customer-origin CORS, no session cookie and no-store headers.
- Live customer marketplace, cart and tracking pages passed browser checks at 1280 px and 390 px without JavaScript errors or horizontal overflow. Direct customer-origin API requests returned HTTP 200.
- The main database currently has zero storefront settings and zero published products. The empty marketplace is expected until an owner configures/enables their storefront and publishes products.
- Customer tests: 4 passed. Targeted backend regression tests: 42 passed, including all 14 ecommerce tests. The old port-3310 test instance could not start; the successful rerun used the separate `mkpos_shop_check_20261005` database on the working MySQL server, with transactions rolling back fixture records.
- Scheduler registration is confirmed. No local `schedule:work` process was running during the check; launch `start-shop-scheduler.cmd` when testing automatic reservation expiry.

### Remaining local work completed — 2026-10-05

- At the user's request, created **PwarMyar Demo Store** in the local database, enabled storefront/order acceptance/marketplace participation, and published three sample products. `scripts/setup-shop-demo.ps1 -CreateDemo` reuses the saved demo owner when rerun. Its credentials are stored in ignored `data/shop-demo-access.json`; no credentials are packaged into releases.
- Repeated demo setup was checked and its product-list handling corrected to use the explicit paginated response. Duplicate sample listings from the initial retry were unpublished; their rows and the completed demo order were preserved. Repeated setup now leaves exactly three public listings.
- Started the local scheduler worker and verified repeated minute-by-minute successful expiry runs with an empty scheduler error log. Restart it using `start-shop-scheduler.cmd` after a computer/backend restart.
- Added Myanmar explanatory text, loading/empty states, accessibility labels, cart replacement confirmation, checkout recovery, order/payment statuses, proof guidance and customer-safe errors. Business-entered content retains its original language.
- Verified a real local demo browser checkout, language switching with the quote/customer details preserved, staff acceptance/packing/pickup, simulated full cash payment, one linked POS sale and translated private tracking. Mobile checkout and marketplace fit a 390 px viewport without JavaScript errors. The completed sample sale uses fictitious customer data and represents no real payment.
- Customer tests: 4 passed; customer/staff builds and the local deployment preflight passed. Myanmar screenshots are in `shop/artifacts/demo-checkout-my-mobile.png` and `demo-tracking-my-mobile.png`.
- Added `shop/OPERATIONS.md` with demo refund ownership, local data-retention handling, backup scope, scheduler monitoring and the remaining production gate. Production deployment and real-customer retention/refund policies remain outside the user's local-only scope.

Production deployment is separate from phase implementation. Configure the real customer domain/API origins, apply the migrations to a healthy target database, build/deploy both customer and staff assets, configure and monitor the scheduler, resolve the existing backend upgrade requirement, and document retention/refund operational ownership. Individual per-business custom-domain mapping and automated payment gateways remain deferred.

### Customer account separation extension — 2026-10-05

At the user's request, guest checkout now coexists with optional platform customer accounts. This extends the original guest-only scope.

- Business-owned POS `customers` and staff `users` remain separate from `platform_customers`. No existing record is merged, converted, or automatically matched by name, email or phone.
- Platform sign-up/sign-in uses a separate token table, hashed credentials, revocable tokens with a 30-day expiry, and dedicated customer middleware. Platform tokens cannot authenticate staff or Office APIs; staff tokens cannot authenticate customer account APIs.
- An authenticated checkout records the platform account on the online order. Guest checkout retains a null account link, including when a signed-in buyer explicitly chooses guest checkout. Completed sales retain the existing POS posting behavior; they do not automatically attach a business customer.
- Customer account pages provide a saved profile/default address and paginated order history across shops. Each shop can still see only its own online orders and its own POS customer list. Guest orders remain accessible through their private tracking credentials and do not enter account history by contact matching.
- Checkout retries preserve both their original payload and account/guest identity. Invalid or expired account authentication is rejected, never silently retried as a guest.
- Migration applied to the local and isolated test databases. Verified registration, login/logout, refresh restoration, profile autofill, account/guest checkout, history/tracking and Myanmar mobile layout. Backend: 25 ecommerce/account tests passed. Customer frontend: 7 tests passed; build passed.
- Email verification, password-recovery delivery and explicit business-customer linking are separate future extensions; no automatic linking is enabled.

### Shop-owned manual payments extension ? 2026-10-05

- Added a dedicated Shop management payment-method section and tenant-scoped CRUD API, with cash/manual bank-wallet types, bank/wallet name, receiving account holder/number, customer instructions and active/disabled state. Office subscription payment methods remain separate.
- Disabled/deleted methods cannot be selected for new orders; historical order method snapshots and checkout retries remain intact. Storefront settings saves omit methods to preserve independently edited receiving details.
- Every payment approval/refund requires an explicit full-receipt/full-refund verification and reference. Staff reviewers and private review notes are retained in the existing payment ledger and event history. Customer proof uploads stay pending until reviewed; rejection requires a customer-visible reason. Financial entries remain append-only, with refund handling rather than editing/deleting receipts.
- Payment configuration reserves a provider discriminator (manual by default for legacy records). Automatic bank/card gateways are deferred: add server-only credentials, authenticated provider callbacks, unique provider transaction/event IDs, amount/currency/order validation, idempotent reconciliation and provider refund handling before enabling any gateway. Manual APIs reject non-manual provider orders.
- No schema migration or demo payment-method change required. Backend regression: 30 ecommerce/account tests passed. Customer frontend: 7 tests passed. Staff method/action/translation tests: 14 passed. Staff/customer builds and staff lint passed. Local browser checks verified receiving details, CRUD, approval controls, reviewer notes and historical snapshots.

### Optional checkout payment screenshots ? 2026-10-05

- Manual bank/wallet checkout now offers an optional payment screenshot with preview/removal, JPG/PNG/WebP validation up to 2 MB, and English/Myanmar instructions. Customers may omit it and submit later through private tracking.
- Screenshots upload only after checkout returns the order reference and private credential. Checkout retry keys and account/guest identity remain unchanged; a lost checkout response preserves the selected file in memory for a safe retry. An unconfirmed proof upload preserves the placed order and directs the customer to tracking for status/recovery, without placing another order. The owner still manually reviews all proofs.
- No schema or backend contract changes. Customer tests: 13 passed, including optional omission, upload failure, lost checkout response and file validation. Build passed. Real local desktop/mobile checks confirmed preview, layout, optional checkout and owner-visible pending review.

### Proof review and expiry operation fix ? 2026-10-05

- The expiry scheduler now selects only pending/unpaid orders. The transaction repeats the unpaid guard under the order lock, preserving proof reviews even if a scheduler candidate was selected before a proof arrived. Rejecting a pending order proof restarts its configured customer resubmission window.
- Order detail automatically displays the latest private proof with local loading/error/retry controls; downloading screenshots no longer disables the whole workspace. Review instructions explain the reference/verification requirements, fulfillment buttons use action labels, and proof rejection uses a separate reason from fulfillment/cancellation.
- Existing expired proof orders can be reopened by authorized processing staff after atomic checks of product availability, original unit compatibility and unreserved stock. Reopening restores reservations, is audited and repeat-safe, and does not automatically approve payment. If fulfillment cannot resume, authorized reviewers may record verified late receipt for refund: the order stays closed and stock stays released.
- No migration or automatic rewriting/reopening of old orders. Backend: 35 ecommerce/account tests passed, including review expiry protection, rejection deadlines, stock-safe reopening, refund fallback and permissions. Staff review/header/translation tests: 14 passed; lint and release build passed. Real isolated-database browser checks passed automatic private proof preview, approval, acceptance/packing/pickup/completion, shared back navigation, and expired-proof reopening through completion.

### Optional payment/refund reference ? 2026-10-05

- At the user's request, payment approval, late-receipt recording and refunds accept an omitted, null or blank reference. The UI labels it optional and no longer disables actions for an empty reference. Receipt/refund verification and full-amount checks remain required. Reviewer identity, timestamps and notes remain recorded; no reference is fabricated. Backend: 36 ecommerce/account tests passed. Staff order-detail tests: 6 passed; lint and build passed.
