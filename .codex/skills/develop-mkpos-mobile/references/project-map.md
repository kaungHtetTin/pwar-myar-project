# MKPOS mobile project map

## Repository boundaries

- `mobile/`: standalone React 18 + Vite mobile SPA. Make mobile feature changes here.
- `frontend/`: desktop Business SPA and the source of feature-parity behavior. Inspect but do not import its components or styles into mobile.
- `laravel/`: Laravel 12 API (PHP 8.2+), Sanctum session/token auth, validation, tenancy, permissions, and subscriptions.
- `office/`: platform administration SPA; outside normal mobile Business scope.

## Mobile foundations

- Entry: `mobile/src/main.jsx`
- Composition and authentication handoff: `mobile/src/app/App.jsx`
- Sanctum client: `mobile/src/api/client.js`
- Global/auth design tokens: `mobile/src/styles/index.css`
- Module styles: `mobile/src/styles/<module>.css`
- Brand assets: `mobile/public/branding/`

Keep `VITE_API_URL=/api` for the existing request contract. Mutations obtain `/sanctum/csrf-cookie`; requests include credentials and the XSRF header.

## Authentication contract

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`

The mobile dev origins `localhost:5176` and `127.0.0.1:5176` must remain in Laravel Sanctum stateful-domain and CORS configuration.

## Product contract

- `GET /api/products?with_total=true&limit=<n>&offset=<n>`
- Filters: `q`, `category`, `barcode_q`, `stock_status`
- `GET /api/products/summary`
- `GET /api/products/low-stock`
- `GET /api/products/barcode/{barcode}`
- `GET /api/products/{id}`
- `GET /api/categories`
- `GET /api/price-types`
- `POST /api/products`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}`
- `POST /api/products/{id}/adjust-stock?quantity=<n>&reason=<text>`
- `GET /api/products/{id}/stock-movements?limit=<n>`

Read the corresponding Laravel controller and desktop screen again before changing behavior; this reference is a routing map, not a replacement for source inspection.

## Purchase contract

- `GET /api/purchases?status=completed&with_total=true&limit=<n>&offset=<n>`
- Filters: `q`, `supplier`, `date_from`, `date_to`
- `POST /api/purchases`
- `GET /api/purchases/{id}`
- `PUT /api/purchases/{id}`
- `DELETE /api/purchases/{id}` with `{ "admin_pin": "..." }`
- Purchase items accept `product_id`, `unit_name`, `quantity`, `foc_quantity`, and integer `unit_cost`.
- Use `GET /api/suppliers?with_total=true&limit=<n>&offset=<n>&q=<query>` for supplier lookup.

## Supplier contract

- `GET /api/suppliers?with_total=true&limit=<n>&offset=<n>&q=<query>`
- `POST /api/suppliers`
- `GET /api/suppliers/{id}?purchase_q=<query>&date_from=<date>&date_to=<date>&limit=<n>&offset=<n>`
- `PUT /api/suppliers/{id}`
- `DELETE /api/suppliers/{id}` soft-deactivates the supplier; linked purchase history remains intact.
- Supplier forms accept `name`, `phone`, `contact_person`, `address`, and `note`; `name` is required.

## Customer contract

- `GET /api/customers?with_total=true&limit=<n>&offset=<n>&q=<query>` returns `account_summary` with receivable, payable, and open-account totals.
- `POST /api/customers`, `PUT /api/customers/{id}`, and `DELETE /api/customers/{id}`.
- `GET /api/customers/{id}/detail` returns customer and lifetime balance summary.
- `GET /api/customers/{id}/sales?with_total=true&start=<date>&end=<date>&limit=<n>&offset=<n>`.
- `GET /api/customers/{id}/payments?with_total=true&start=<date>&end=<date>&limit=<n>&offset=<n>`.
- `GET /api/customers/{id}/statement?start=<date>&end=<date>` returns complete printable statement data.
- `POST /api/customers/{id}/payments`, `GET /api/customer-payments/{id}`, `PUT /api/customer-payments/{id}`, and `DELETE /api/customer-payments/{id}`.
- Customer forms accept `name`, `phone`, `address`, and `note`; payment forms accept integer `amount`, `direction`, `payment_method`, and `note`.

## Expense contract

- `GET /api/expenses?status=completed&with_total=true&limit=<n>&offset=<n>` with `q`, `category`, `payment_method`, `date_from`, and `date_to` filters.
- `GET /api/expenses/summary` accepts the same filters and returns today, month, filtered-total, matching-count, and top-category metrics.
- `POST /api/expenses`, `GET /api/expenses/{id}`, and `PUT /api/expenses/{id}`.
- `DELETE /api/expenses/{id}` requires `{ "admin_pin": "..." }` and permanently removes the record from history and reports.
- Expense forms accept `expense_date`, `title`, `category`, integer `amount`, `payment_method`, and `note`.

## Sale and transaction contract

- The mobile sale is a persisted, speed-first three-page flow: `/sell` selects and filters products, `/sell/cart` edits quantity/FOC/pack sizes, and `/sell/checkout` handles totals, customer, payment, and receipt completion. Keep the in-progress draft across those route changes and refreshes.
- `POST /api/sales` completes a checkout; `GET /api/sales/{id}` and `PUT /api/sales/{id}` support transaction edit deep-links.
- `GET /api/sales?with_total=true&limit=<n>&offset=<n>` is the endless sales history; filters include `q`, `start`, `end`, `payment_type`, and `payment_method`.
- `GET /api/sales/{id}/receipt`, `POST /api/sales/{id}/print`, and `GET /api/sales/last/receipt` support receipt preview and browser printing.
- Sale updates and deletes require `admin_pin`; deleting restores stock and recalculates customer balances.
- `GET /api/customer-payments?with_total=true&limit=<n>&offset=<n>` and the `/api/customer-payments/{id}` CRUD endpoints support payment history.
- Purchases shown in Transactions reuse the purchase contract and `/purchases/:id/edit` mobile route.

## Reports contract

- `GET /api/reports/summary?start=<date>&end=<date>` returns period KPIs, cash movement, current accounts, payment methods, top products, and expense categories.
- Use `all_time=true` for all-time reporting and `/api/reports/summary.csv` for the complete export.

## Billing contract

- `GET /api/subscription`, `/api/subscription/plans`, and `/api/subscription/payment-methods` provide subscription metadata.
- `GET /api/subscription/billing-history?with_total=true&limit=<n>&offset=<n>` is the endless billing history.
- `POST /api/subscription/requests` accepts multipart `subscription_plan_id`, `payment_method_id`, required `payment_screenshot`, and optional `message`.
- Payment requests use `/billing/request/:planId`, never a modal.

## Settings contract

- `GET /api/settings` and `PUT /api/settings` manage shop, receipt, payments, security, and language settings.
- `POST /api/settings/receipt-preview` and `/api/settings/test-print` render the current receipt layout.
- `/api/price-types` and `/api/price-types/{name}` manage pricing rules; use separate `/settings/prices/new` and edit routes.
- `GET /api/data/status`, `GET /api/data/export`, and `POST /api/data/restore-file` manage per-business backups; restore uses `/settings/data/restore` and requires the `RESTORE` confirmation.
- `PUT /api/auth/profile` updates the owner profile and optional password.

## Access contract

- `GET /api/roles?with_total=true&limit=<n>&offset=<n>` and `GET /api/staff?with_total=true&limit=<n>&offset=<n>` are endless owner-only lists.
- `GET /api/roles/{id}` and `GET /api/staff/{id}` support form deep-links.
- `/api/roles` and `/api/staff` expose create/update/delete; `PUT /api/staff/{id}/password` resets a staff password.
- Role, staff, and password submissions always use separate routes under `/access`.
