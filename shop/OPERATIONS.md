# Local shop operations

Environment: local development only. Updated: 2026-10-05.

## Demo ownership

The local business is **PwarMyar Demo Store**, at `/#/store/mkpos-demo-shop`. Its owner is **Demo Owner**. Sign in to the POS using the email/password in ignored `data/shop-demo-access.json`. Keep that file out of public assets and production environments.

Three sample products are published with cash-only instructions and a sample delivery area. Use fictitious customers and sample proof images. Do not collect or transfer real money.

Demo Owner handles acceptance, sample payment confirmation, cancellations and refund records. Existing staff roles can delegate processing, payment and refund permissions independently. Review unpaid, proof-submitted, prepaid pending, return-pending and refund-pending orders at the start and end of each test session.

## Customer account separation

The customer web app supports guest checkout and optional platform customer sign-in. Platform accounts are independent of each business's POS Customers list and of staff/Office logins. A matching email or phone does not link an existing POS customer or guest order to an account.

`/#/account/register` creates a customer account; `/#/account/login` signs in; `/#/account` edits saved contact details and lists account orders across shops. Signed-in buyers can still choose **Continue as guest** at checkout. Owners continue managing their own Customers list in PwarMyar. Account registration never creates a shop, staff user or POS customer.

Customer sessions last up to 30 days and logout revokes the current token. Expired or invalid customer authentication requires sign-in. Retrying a submitted account order requires the same account; guest retries remain guests. Logging out clears saved account tracking access in the browser, while separately saved guest tracking remains available.

The full-database backup must include `platform_customers`, `platform_customer_tokens`, and the account links on `ecommerce_orders`. Business-level exports exclude platform accounts. Email verification, password-recovery emails and explicit linking to a shop's POS customer records are not part of this local extension.

## Scheduler

Use `start-shop-scheduler.cmd` after restarting the backend or computer. Run only one worker. The background worker started during setup writes to `laravel/storage/logs/shop-scheduler.log` and `shop-scheduler-error.log`; the command-file launcher writes to its terminal.

```powershell
cd laravel
php artisan schedule:list
php artisan schedule:run
```

Expiry runs every minute without overlap and releases overdue pending/unpaid reservations. Orders awaiting proof review, verified prepaid orders and accepted orders remain for staff resolution. Check successful runs and the error log during testing. The local worker does not survive a computer restart; production needs its own persistent scheduler task.

## Payments and refunds

Orders with a submitted proof stay reserved while manual review is pending; the scheduler expires only pending **unpaid** orders. After a pending order's proof is rejected, its payment deadline restarts for the shop's configured expiration period so the customer has time to resubmit. Review or cancel pending proofs explicitly.

For orders already expired by the old flow, **Reopen for payment review** checks current product availability/units and unreserved stock, then reserves the items again atomically. It requires order-processing permission. If stock is unavailable or fulfillment cannot resume, verify actual receipt and choose **Record payment for refund**, then record the completed full refund. Recording late receipt leaves the order closed and stock released. Recovery actions are audited and retry-safe; no existing order is reopened automatically.

1. In **Shop management → Payment methods**, add/edit shop-owned cash or manual bank/wallet methods, receiving account details and customer instructions. Disable a method to hide it from new checkout, or delete it. Existing orders retain their original method and receiving details. Keep at least one active method; each shop supports up to 20 methods.
2. Open an order, inspect the proof if supplied, and check the full amount against cash collected or the receiving account. Optionally enter a receipt/transfer reference and internal review note, check the receipt-verification box and choose **Approve full payment**. Proof upload alone never confirms payment. Only authorized payment reviewers can approve or reject; a rejected proof requires a customer-visible reason and can be resubmitted.

   Customers using manual bank/wallet transfers can optionally attach a JPG, PNG or WebP payment screenshot (maximum 2 MB) during checkout, or upload it later through private order tracking. Checkout places the order first, then sends the screenshot to its private proof endpoint; the payment stays pending manual review. An unconfirmed upload redirects to tracking with a recovery message and never places a replacement order. Selected files stay in memory; after a page reload customers may need to select the screenshot again on tracking.
3. Complete fulfillment after full payment; PwarMyar creates one sale and consumes the reservation.
4. For paid cancellation, review `refund_pending`, simulate the full refund, then record its full amount and optional reference after checking the refund-verification box. A refund record does not transfer money. Receipt and refund entries retain the staff reviewer, timestamp and internal note; they are not editable or deletable financial records.
5. Confirm physical return before cancelling failed delivery. Correct completed sales through controlled POS void and resolve the resulting refund obligation.

Shop receiving methods are tenant-owned storefront configuration, separate from Office/platform subscription methods. This version uses `provider: manual` (legacy methods default to manual). Automatic banking/card payments remain a future integration: provider credentials must stay server-side, with separately authenticated callbacks, idempotent payment events and provider-specific refund handling. Unsupported providers/types cannot be offered at checkout or approved through the manual endpoint.

API: `/api/shop-admin/payment-methods` supports GET/POST, and `/{methodId}` supports PUT/DELETE under `ecommerce_settings` permission and valid subscription. Approval/refund requests now require `verified: true` alongside the full `amount`; `reference` and `review_note` are optional and private to staff. Storefront settings may omit `payment_methods`, which preserves the current methods and prevents stale settings forms overwriting dedicated CRUD changes. No database migration is needed for this extension.

## Local retention and backups

Keep fictitious demo records for development until the operator explicitly disposes of the local demo environment. No automatic financial-history or proof deletion is enabled. This is the local test policy, not a retention policy for real customers.

The old business-level backup excludes ecommerce. Reset/restore and business deletion are blocked after order history exists. Back up the full MySQL database and `laravel/storage/app/ecommerce-proofs/` together, restrict access, and verify restoration in a separate database. Protect the Laravel application key outside public assets.

Do not log tracking credentials, request bodies, proof images or passwords. Keep credentials, environment files, database dumps and private storage outside hosted static directories.

## Production boundary

Production remains outside the requested local-only scope. Before real use, name the refund reviewer and backup owner, choose real order/customer-data and proof-retention periods, document deletion and financial-history handling, upgrade the backend as required in the root README, and verify HTTPS, exact CORS origins, backup restoration and persistent scheduler monitoring. The demo does not supply these business-specific production decisions.
