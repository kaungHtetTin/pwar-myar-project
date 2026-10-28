# PwarMyar Mini Ecommerce Specification

Version: 1.0  
Date: 2026-10-03  
Status: Phases 1–3 implemented in the repository. Validation evidence and remaining deployment requirements are tracked in `ECOMMERCE-DEVELOPMENT-PLAN.md`; this specification does not by itself indicate a production release.

## 1. Purpose

Expand PwarMyar into a small ecommerce platform with two customer entry points:

1. An independent storefront for each business.
2. A shared PwarMyar marketplace where customers discover participating businesses and their products.

Both entry points use the same catalog publication rules, ordering backend, inventory, and business order management. Each business manages its products and orders once.

The agreed first release limits every cart and order to one business. Customers can place separate orders with multiple businesses. Combined checkout across businesses is deferred.

## 2. Existing foundation and implementation boundaries

PwarMyar currently provides React business, mobile business, and Office applications backed by Laravel and MySQL/MariaDB. Existing capabilities include business isolation, products and photos, price types, unit conversions, stock movements, customers, sales, receipts, permissions, and subscriptions.

The ecommerce extension must:

- Reuse existing business, product, and inventory records rather than maintain a second inventory.
- Preserve existing POS API contracts and workflows.
- Add explicit ecommerce orders instead of treating pending orders as completed POS sales.
- Keep customer browsing and checkout separate from staff authentication and business administration.
- Resolve public storefront tenancy explicitly; existing authenticated business scoping alone is insufficient for guest requests.
- Apply repository mobile development requirements when changing `mobile/`, including separate full-page submission forms, the shared authenticated refresh shell, and endless-scroll lists.

No native customer Android/iOS application is required initially. The customer experience is a responsive web application. Production deployment preparation is a separate implementation task; the repository README already identifies the backend upgrade requirement.

## 3. Agreed scope and delivery order

| Phase | Deliverable | Completion condition |
| --- | --- | --- |
| 1 | Shared ecommerce foundation | Publication settings, order lifecycle, stock reservations, checkout validation, payments, fulfillment, and POS integration work with automated backend verification. |
| 2 | Independent storefronts | A customer can browse a business, check out, track an order, and have staff complete it through the POS integration. |
| 3 | Shared marketplace | Customers can discover opted-in shops and products, enter a shop, and order through the same checkout and staff workflow. |

Phase 1 establishes contracts and backend behavior. Phase 2 is the first complete customer-facing release. Phase 3 must not duplicate checkout or order processing.

### Included in the initial complete release

- Business branding and a shareable storefront link.
- Explicit product publication, category browsing, search, product details, and photos.
- A cart containing products from one business.
- Guest checkout, delivery or pickup, and server-calculated totals.
- Cash on delivery/pickup and manually verified bank or wallet transfers.
- Private guest order tracking.
- Staff order processing and an audit trail.
- Shared inventory reservations and completed-order integration with POS sales.
- Store settings and basic order reporting.
- Marketplace participation and discovery in Phase 3.

### Deferred

- A combined cart or checkout across businesses.
- Automated payment gateways, settlements, commissions, and payouts.
- Customer accounts, wishlists, reviews, loyalty, and recommendations.
- Coupons, promotional pricing, and marketplace advertising.
- Courier integrations and live shipment tracking.
- New variant systems, digital goods, backorders, and subscriptions for products.
- Automated refunds, partial fulfillment, partial cancellation, and partial returns.
- Custom domains and native customer applications.

## 4. Storefront and marketplace visibility

Each business has independent `storefront_enabled` and `marketplace_enabled` settings. Marketplace participation requires an enabled storefront and an eligible business subscription. Enabling a storefront does not automatically list it in the marketplace.

Storefront settings include:

- Unique public store slug, display name, logo, description, and public contact details.
- Storefront enabled/disabled and accepting-orders enabled/disabled.
- Marketplace participation.
- Selected ecommerce price type and business currency.
- Pickup instructions, delivery zones, delivery fees, and supported payment methods.
- Customer-facing order instructions and pending-order expiration duration.

Default behavior is storefront disabled, marketplace disabled, and products unpublished. Businesses explicitly enable online selling.

The initial eligibility rule requires an active business and valid subscription for public catalog visibility and new orders. Subscription expiration or disabling a store must block new orders without deleting existing orders or reservations. Owners must retain narrowly scoped access to resolve existing ecommerce orders and payment obligations; this must be designed explicitly rather than inherit the existing subscription block on all POS APIs.

Disabling marketplace participation removes the shop from discovery while its independent storefront can remain available. A temporary pause of order acceptance can leave the eligible catalog visible with checkout disabled.

Illustrative logical routes, adapted to the deployment prefix:

```text
/store/{storeSlug}                 Independent shop
/store/{storeSlug}/products/{id}   Product details
/store/{storeSlug}/cart            Shop cart
/store/{storeSlug}/checkout        Shop checkout
/marketplace                      Marketplace home
/marketplace/shops                Shop discovery
/marketplace/products             Product discovery
/orders/track                     Private order lookup
```

## 5. Catalog and pricing

Publication is an ecommerce property attached to an existing POS product. An active POS product is not automatically public.

A public listing requires an eligible store, explicit publication, an active product, a valid ecommerce price, and a supported sales unit. Marketplace results additionally require the store's marketplace participation.

Public product responses expose only approved fields: public identifier, name, description, category, image, selected unit, online price, currency, and availability. Buying cost, supplier data, internal stock movements, customer balances, staff details, and other price tiers must remain private.

Use one selected existing price type per business for the first release. Missing or invalid prices prevent publication or checkout; do not silently substitute a private wholesale price. The first release offers one selected existing sales unit per product and uses the existing unit conversion to reserve base-unit stock. No new variant system is introduced.

The cart displays current prices. Checkout revalidates prices, publication, unit conversion, availability, store eligibility, payment method, and fulfillment settings on the server. Changed prices or delivery fees require the customer to review the updated quote before submitting again.

Persist product name, selected unit, conversion factor, price, currency, and delivery-fee snapshots on the order. Subsequent catalog edits must not change an accepted order's amounts or historical sale.

Money and quantities must follow the existing POS representation and rounding rules. Use fixed-decimal or integer money calculations rather than binary floating-point totals. An order has exactly one currency. Marketplace listings show each shop's currency and do not aggregate amounts across currencies.

## 6. Customer experience

### Browsing

Store pages show branding, search, categories, product cards, availability, and cart access. Product pages show the price, selected unit, photo, description, quantity selector, and fulfillment information.

Marketplace pages support shop discovery, product search, category filtering, and entry into a shop. Every product identifies its selling business. Initial search is database-backed; an external search service is unnecessary.

Use bounded backend pagination. Customer product and shop lists use endless scrolling with loading, empty, error, and retry states. Keep stable ordering so pagination does not repeatedly show the same records.

### Cart

- Store carts locally for guest convenience; a local cart is not a stock reservation.
- Every cart has exactly one business ID.
- Adding an item from another business requires an explicit choice to replace the existing cart or keep shopping in the current shop.
- Never silently remove items or combine products from different businesses.
- Revalidate restored carts before checkout.

### Guest checkout

Collect customer name and phone number, delivery or pickup, delivery address and supported zone when applicable, payment method, and optional order notes. Email is optional. Do not require a staff or customer account.

Present item totals, delivery fee, currency, and grand total before submission. Initially, delivery fees are fixed per configured zone and pickup is free. Unsupported delivery addresses/zones cannot proceed. Tax treatment must follow explicitly configured POS rules; never silently add a new ecommerce-only tax.

Successful submission returns an order reference and private tracking credential. Submission must be idempotent: retrying the same request must return the original order without reserving stock or creating payments again.

### Tracking

Use an unguessable tracking credential scoped to one order. An order reference or phone number alone must not grant access. Store credential hashes and rate-limit lookups. Do not expose tracking secrets through analytics or logs.

Tracking shows customer-safe status, ordered items, totals, fulfillment instructions, and payment confirmation state. Internal staff notes and audit details stay private. Guest proof uploads use the same scoped access control.

## 7. Orders and fulfillment

Order state and payment state are separate. Staff actions are server-validated, permission checked, and recorded with actor, timestamp, and reason where applicable.

| Order state | Meaning | Allowed next states |
| --- | --- | --- |
| `pending` | Submitted, reserved, awaiting staff acceptance | `accepted`, `cancelled`, `expired` |
| `accepted` | Business has accepted the order | `packing`, `cancelled` |
| `packing` | Preparing goods | `ready_for_pickup`, `dispatched`, `cancelled` |
| `ready_for_pickup` | Pickup order prepared | `completed`, `cancelled` |
| `dispatched` | Delivery order handed over | `completed`, `return_pending` |
| `return_pending` | Failed delivery awaiting confirmed physical return | `cancelled` after return confirmation |
| `completed` | Delivery or pickup finished; linked POS sale recorded | Terminal in this release |
| `cancelled` | Rejected, cancelled, or returned before completion | Terminal |
| `expired` | Unaccepted order exceeded its reservation deadline | Terminal |

Only pickup orders use `ready_for_pickup`; only delivery orders use `dispatched` and `return_pending`. Customers initially request cancellation through the shop's contact channel; staff perform the action.

Default unaccepted-order expiration is 24 hours and is configurable per business within validated bounds. Accepted orders no longer expire automatically. A scheduled worker expires eligible pending orders safely and releases reservations. Verified prepaid pending orders must be protected from automatic expiration and surfaced for staff resolution. Deployment must include and monitor this worker.

Completed-order corrections use the existing controlled POS void workflow. If a linked sale is voided, ecommerce tracking and reporting must show that correction and any refund obligation without allowing a second completion or stock restoration. General ecommerce return processing is deferred.

## 8. Stock reservations and POS integration

```text
available_to_sell = POS stock - active ecommerce reservations
```

Cart activity never reserves stock. Successful order submission locks the relevant business/product records, verifies available quantities in base units, and creates the order plus reservations in one transaction. Lock products in a consistent order to avoid unnecessary deadlocks.

Reservations remain active through preparation and dispatch until completion or a valid release. Pre-dispatch cancellation and expiration release them exactly once. Failed delivery retains reservations until staff confirm the goods have physically returned; do not immediately make shipped goods available again.

For the initial release, the POS stock quantity is decremented at order completion. Dispatched quantities therefore remain represented in POS stock but are unavailable through reservations. Staff inventory screens and reports must distinguish reserved and dispatched quantities so the displayed POS stock is not mistaken for physical stock still on the shelf.

Completion must atomically:

1. Validate fulfillment and full payment confirmation.
2. Create exactly one linked POS sale using the order's accepted item and price snapshots.
3. Decrement stock using the existing sales/stock movement logic.
4. Consume the reservations without a second stock deduction.
5. Record completion and the sale link.

If any step fails, the entire completion rolls back. Pending and cancelled orders do not appear as completed POS sales or sales revenue. Manual transfer funds received before completion appear as ecommerce receipts awaiting fulfillment, separately from completed sales revenue.

Refactor shared sale behavior into a reusable service where needed; do not call authenticated controllers from public checkout or duplicate inventory accounting.

Reservation checks must apply to all stock-decreasing paths, including POS sales, sales edits, stock adjustments, product unit changes, and offline-sale synchronization. A POS stock reduction cannot consume quantities reserved for other orders. Conflicts must return an actionable error; offline sales may require manual resolution after reconnecting. Product archive/delete and business data reset/restore must not invalidate unresolved orders or orphan reservations. Block those destructive actions until dependencies are resolved or implement an explicit coordinated reconciliation.

## 9. Payments

Supported methods initially:

- Cash on delivery or pickup, manually confirmed by authorized staff.
- Bank/wallet transfer using business-configured instructions and optional proof upload.

Payment states: `unpaid`, `proof_submitted`, `paid`, `refund_pending`, and `refunded`. Proof submission is evidence only and never automatically marks an order paid. Rejected proof returns to unpaid with a customer-safe explanation; retain its review history.

Require the full order amount to be confirmed before completion. Partial payments and customer credit checkout are deferred. Payment confirmation is idempotent and records amount, method, reference, staff reviewer, and timestamp.

Cancellation after confirmed payment creates a manual refund obligation. Staff record the refund reference, amount, and date before marking it refunded. No automatic transfer or payment processing is implied. Order state, payment state, refund obligations, and actual money received must remain independently auditable.

Payment proofs use private storage, size/type validation, and authenticated staff or scoped guest access. Office subscription-payment methods and ecommerce shop-payment methods are separate concepts and must not be shared accidentally.

## 10. Business and Office administration

Business administration includes storefront settings, publication controls, fulfillment/payment configuration, order lists, full-page order details, payment reviews, order transitions, and basic reports. Display pending-order counts and make outstanding payment/refund obligations visible.

Introduce permissions for storefront configuration, catalog publication, viewing orders, processing orders, confirming payments, and recording refunds. Owners receive these permissions; staff access remains configurable and enforced server-side.

Office can inspect marketplace participation and suspend marketplace visibility with a recorded reason. Marketplace suspension does not automatically disable an otherwise eligible independent storefront. Platform business suspension can block both channels. Office does not process a business's orders, verify its customer payments, or access private proofs by default.

Reports separate submitted orders, fulfilled orders, cancellations, expiration, pending payments, refunds, and completed sales. Preserve the origin (`storefront` or `marketplace`) as attribution only; do not count the same order twice.

## 11. Proposed data model

Names below are proposed and may be adjusted to repository conventions during implementation.

| Record | Main responsibility |
| --- | --- |
| `storefront_settings` | One per business: slug, branding, flags, price type, fulfillment rules, reservation deadline. |
| `ecommerce_product_settings` | Business/product publication, public description, selected sales unit. |
| `ecommerce_delivery_zones` | Business-specific supported zones and fixed fees. |
| `ecommerce_payment_methods` | Business-specific enabled cash/transfer instructions. |
| `ecommerce_orders` | Business, reference, origin, customer/fulfillment snapshots, totals, separate states, expiration, tracking hash, linked sale. |
| `ecommerce_order_items` | Business/order/product references and immutable name, unit, conversion, quantity, price snapshots. |
| `ecommerce_stock_reservations` | Business/order/product, base-unit quantity, active/consumed/released state and timestamps. |
| `ecommerce_payments` | Payment/refund confirmations, proof references, amounts, reviewers, and timestamps. |
| `ecommerce_order_events` | State changes, payment reviews, cancellation reasons, and staff audit events. |
| `ecommerce_checkout_requests` | Business-scoped idempotency key, request hash, and resulting order. |

Enforce business ownership on every relationship and lookup. Use unique constraints for store slugs, business order references, idempotency keys, and linked sales. Reject reuse of an idempotency key with a different payload. Historical order snapshots survive product edits or archival.

Guest orders do not require creating a customer account. At completion, link to a business customer only through an explicit matching policy; a name or phone match alone must not merge unrelated customers or expose prior purchase history.

## 12. API and security requirements

Add separate public ecommerce routes, for example under `/api/ecommerce`, and authenticated business routes for administration. Existing private `/api/products` and `/api/sales` endpoints remain protected.

Public capabilities include shop lookup, paginated catalog, checkout quotation/submission, scoped tracking, and scoped proof upload. Marketplace discovery is added in Phase 3. Authenticated capabilities include settings, publication, order lists/details, transitions, payment review, and refund recording.

- Resolve the business from an eligible store slug and validate every requested product belongs to it.
- Never trust submitted prices, totals, currency, fees, business IDs, or payment states.
- Use public-field allowlists and do not bypass tenancy globally to support marketplace queries.
- Rate-limit checkout, tracking, and uploads; validate lengths, quantities, file sizes, and allowed values.
- Keep tracking credentials and payment proofs private and return generic unauthorized lookup failures.
- Apply the existing session/token protections to staff endpoints. Guest routes must not inherit staff privileges.
- Mask personal information in operational logs and document order/proof retention before production release.
- Make order transitions, completion, expiry, refunds, and payment confirmation safe under retries and concurrency.

## 13. UI requirements

The storefront and marketplace must work on phones and desktop browsers, with accessible controls, visible prices/currency, large touch targets, clear availability, and understandable validation messages.

Use full-page product details, checkout, tracking, and staff order details. Preserve cart state after recoverable checkout failures. Show clear loading, empty, unavailable-shop, insufficient-stock, changed-price, unsupported-delivery, and expired-tracking states.

Prepare customer-facing text for the existing English/Myanmar language direction. Display business currency and use the business timezone for staff dates; store timestamps consistently with the backend.

## 14. Acceptance criteria

Before releasing individual storefronts, verify:

1. Only explicitly published products of an eligible business are publicly visible; private fields never appear.
2. Cross-business cart items, order lookups, proofs, and staff actions are rejected.
3. Checkout recalculates totals and requires review after price or delivery-fee changes.
4. Concurrent buyers cannot reserve more than available stock; POS writes respect reservations.
5. Repeated submission, payment confirmation, completion, cancellation, and expiry do not duplicate orders, deductions, releases, sales, or receipts.
6. Pickup and delivery follow the permitted transitions, and failed delivery does not release stock before physical return.
7. Pending orders expire as configured; verified prepaid orders and accepted orders are protected from automatic expiry.
8. Completed orders create exactly one sale with the accepted snapshots and correct stock movement; failures roll back all completion work.
9. Payment proofs require authorized review, completed orders require full payment, and paid cancellations show manual refund obligations.
10. Catalog changes, subscription expiry, store suspension, and data maintenance cannot silently corrupt outstanding orders.
11. Mobile checkout, staff processing, private tracking, pagination, and error recovery work end to end.
12. Existing POS authentication, tenancy, sales, inventory, and subscription checks continue to pass.

Before releasing the marketplace, additionally verify:

1. Discovery includes only eligible opted-in businesses and their public products.
2. Opting out or marketplace suspension removes discovery access while preserving eligible storefront behavior and existing orders.
3. Shopping across shops preserves the one-business cart rule and requires confirmation before replacing a cart.
4. Orders reach the correct business through the same processing flow, with origin attribution and no duplicate reporting.

## 15. Implementation decisions to finalize

The scope and phase order above are agreed. These details should be finalized during their implementation phase without expanding the initial scope:

- Customer web application folder, deployment prefix, and storefront routing integration.
- Ecommerce entitlement mapping to existing subscription plans and narrowly scoped handling of outstanding orders after expiry.
- Supported delivery zones, proof-upload limits, and valid reservation-duration bounds.
- Customer matching policy, retention periods, and operational ownership of manual refund follow-up.
- POS tax and delivery-fee accounting mapping, including whether existing sale records need additional fields.
- Marketplace category normalization and the initial default discovery sort.

## 16. Suggested first implementation task

Start Phase 1 with tenant-safe storefront settings and explicit product publication. Then implement reservation-aware inventory services, checkout/orders, payment review, lifecycle processing, and transactional POS completion. Build the independent storefront against those contracts before adding marketplace discovery.
