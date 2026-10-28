# PwarMyar customer shop

The customer React app uses the existing Laravel API and database. No database credentials belong in this app. Public customer APIs are stateless; staff authentication remains in the POS application.

## Run locally

1. Start MySQL and the Laravel backend on port 8000.
2. Run `php artisan migrate` from `laravel/` to add the ecommerce schema. Existing storefronts and publications default to disabled.
3. Run `npm ci --legacy-peer-deps` from `shop/`, then `npm run dev`, or use `start-shop.cmd` at the repository root. Open `http://127.0.0.1:5177`. The mobile app uses port 5176, so both apps can run together.
4. In the POS, open **Online shop → Settings**, choose the public name, slug, price type, payment instructions and delivery zones. Enable the storefront and order acceptance.
5. Use **Publication** to publish individual products and select their base or existing purchase unit.

The storefront URL is `/#/store/{slug}`. The marketplace is `/#/marketplace`; private tracking is `/#/orders/track`. Hash routes work on ordinary static hosting without a server rewrite. Set `VITE_DEFAULT_STORE` to a slug to make an independent shop the default home page.

Home is the root of the shop navigation stack. Browser and app-bar Back unwind visited screens to Home; repeated browser Back remains at Home. Selecting Home explicitly resets the previous navigation stack while preserving Home's retained search and loaded content. A direct link opens above Home, including after reload. With `VITE_DEFAULT_STORE`, the configured storefront is Home. WebViews that dispatch the standard document `backbutton` event use the same Back handler; the browser app does not exit or close its tab at Home.

Navigation checks: `node scripts/check-shop-root-navigation.cjs` exercises **Cart**, **Me**, **Forgot password?**, **Home**, app-bar **Back**, and browser Back at 375 and 1366 pixels with intercepted demo APIs. The login email draft survives Forgot password → Back; Cart → Back resumes the same Home input and retained DOM with no data refetch. Repeated root Back, explicit Home stack reset and direct-link reload also pass. Unit tests cover nested Back/Forward with stable page keys, the configured storefront root and simulated WebView Back. Physical Android hardware Back is not device-tested. Screenshots are saved under `artifacts/shop-root-navigation`.

Customer new-message alerts use the owner mobile app's compact top-card pattern: message icon, localized label, shop name, preview and a separate 44 px dismiss control. Tapping the card (accessible name **Open chat**) opens that conversation and clears the alert. **Dismiss chat notification** clears it without opening chat. `node scripts/check-shop-chat-alert.cjs` verifies arrival at 320/375/768/1366 px, focus retention, both controls, keyboard activation, browser Back retaining the Home search, Myanmar labels and reduced motion using intercepted demo APIs. Screenshots are saved under `artifacts/shop-chat-alert`; physical Android interaction is not device-tested.

Message popups are shown once per new message ID. Shop and owner apps persist only the notification cursor in local storage, scoped to the customer or owner/business; polling, reconnects and component remounts do not replay already processed messages. Existing unread counts update badges without producing a repeat popup, and suppressed chat-page messages are not announced on leaving chat. Opening a browser without a saved cursor establishes a baseline. Dismissing a popup does not mark the conversation read. Tests cover duplicate payloads, reconnect, remount, stale cursors and account isolation; the shop browser check also verifies that an unread alert stays dismissed after reload.

Checkout keeps step 4 (Review) visible with a disabled **Placing order…** button during submission, optional payment-proof upload and the confirmation read. The fetched order is handed to Tracking in memory, scoped to the current account session, so successful checkout opens order details without a second initial fetch or loading screen. The cart is cleared once Tracking is active. Failed or interrupted submissions retain their original checkout key and expose **Retry submission**; **Start over** is disabled while a retry runs. A failed confirmation read retries tracking without placing another order.

Verification: checkout/loading/navigation tests cover duplicate clicks, a stable Review screen across delayed requests, safe retries and confirmation-read failure. `node scripts/check-shop-checkout-loading.cjs` verifies the rendered flow at 375 and 1366 pixels using intercepted demo APIs; screenshots are saved to `artifacts/shop-checkout`. The **Place order** handler submits once, remains disabled through all three stages, and opens the confirmed order; existing retry tests verify that **Retry submission** reuses the exact payload. No live orders are created by these checks.

The customer layout starts the marketplace on Products and uses Home, Cart, Orders and Me navigation on phones. Signed-in Orders opens the existing account order history at `/#/orders`; guests use private tracking. Shop categories come from the existing catalog. Product purchase and cart checkout controls remain visible above phone navigation. The teal theme, single-shop cart confirmation, quote-before-checkout flow and existing API contracts are preserved. Layout and navigation verification is recorded in `test-artifacts/shopping-redesign/verification.md`.

Production customer hosting uses `https://shop.pwarmyar.com/` with API `https://www.pwarmyar.com/public/api`. `shop/.env.production` and `.env.laravel` use that API and a root (`/`) asset base. Local development keeps `.env.local`. Owner web/mobile, desktop and Office production settings use `VITE_SHOP_URL=https://shop.pwarmyar.com` for storefront and product links.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-shop-release.ps1 -EnvFile shop/.env.production` from the repository root. Upload the **contents** of the generated `shop` folder (or `shop-upload.zip`) to the shop subdomain document root. The generated `staff` folder updates the owner web application links. Mobile and Office need their updated production assets; an installed APK/desktop package needs its normal release rebuild before its embedded links change.

Laravel must allow `https://shop.pwarmyar.com` in `CORS_ALLOWED_ORIGINS`, preserving existing origins. Node must include it in `CHAT_ALLOWED_ORIGINS` and restart after the environment change. Socket addresses and authorization tickets continue to come from Laravel at runtime. Customer authentication uses bearer tokens, so no cross-domain session-cookie changes are needed. Run the deployment preflight against the deployed Laravel version to check public catalog routes, CORS and customer HTML.

The deeper component design covers catalog cards, product details, cart rows, checkout, orders, tracking, account forms, reviews and chat. Page-by-page screenshots, interaction checks and testing limits are recorded in [component design verification](test-artifacts/component-redesign/verification.md).

The customer shop also includes repeat orders at current prices, product/shop favorites, saved delivery addresses, an updates inbox, cancellation and full-order return/refund requests, catalog sorting and filters, recently viewed and same-shop related products, downloadable/printable order summaries, shop hours/announcements and back-in-stock alerts. Account tools are available under **Me**; receipts and requests are available inside private order tracking. Staff manage service hours in **Storefront**, and review requests from **Orders**, including a requests-needing-review filter. See [feature implementation](FEATURE-IMPLEMENTATION.md) and [verification](test-artifacts/customer-features/verification.md).

The default customer design is dense and compact. Use the shared compact spacing in `src/compact-ui.css` and `IconButton` for familiar secondary actions, with translated accessible names and tooltips. Keep text on primary commerce actions, form submissions, confirmations and actions whose meaning needs explanation. Prefer icon buttons for edit/delete, favorites, filter launchers, receipt tools and inbox shortcuts. Keep mobile touch controls usable and preserve the teal theme. See [compact UI verification](test-artifacts/compact-ui/verification.md).

Product search in both the marketplace and individual shops matches partial terms in any order across product names, categories, public descriptions, SKU and barcode. Case, extra whitespace and joined words/codes are supported: `tea green`, `gre te` and `greentea` can find Green Tea. Every term must match, and catalog eligibility, filters and pagination still apply. Queries are bounded to 120 characters. See [search verification](test-artifacts/product-search/verification.md).

These additions require the additive `2026_10_09_000001_add_shop_customer_features.php` migration. The existing once-per-minute scheduler also runs `shop:notify-restocks`; stock alerts are in-app only and do not reserve goods. Opening hours are informational, while a temporary closure pauses checkout. Return approval uses the existing PIN-protected sale void and full manual refund before resolution; it does not send funds automatically.

## Environment-driven local release

Edit `shop/.env.local` (copy `.env.example` first if needed):

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api
VITE_SHOP_URL=http://127.0.0.1:5177
VITE_BASE_PATH=/
VITE_DEFAULT_STORE=
```

The API URL and default store configure the customer app. The release script uses the shop URL for staff links and derives the customer asset base path from that URL. Keep `VITE_BASE_PATH` consistent with the shop URL when running Vite directly. Restart the dev server after changing environment values; existing production assets require rebuilding.

From the repository root:

```powershell
powershell -NoProfile -File scripts/build-shop-release.ps1 -Local
```

This builds the customer app and Laravel staff assets against the shared API and copies both into a dated `release/shop-*/` directory with a public configuration manifest. It does not apply database migrations or publish the assets. Environment files and database credentials are excluded from the package. The script reads `.env`, `.env.local`, `.env.production` and `.env.production.local` in Vite precedence order; process variables and explicit URL arguments override these values. `-EnvFile` selects a different file, and `-SkipStaff` builds only the customer app. Use literal URL/slug values rather than dotenv variable expansion in these scripts.

After starting the backend and `start-shop.cmd`, run the bounded, read-only check:

```powershell
powershell -NoProfile -File scripts/shop-deployment-preflight.ps1 -Local
```

It checks database health, public catalog access, CORS for customer POST requests, stateless response headers and customer HTML. It never creates customers, orders or payments. A database timeout means migration and checkout remain blocked until MySQL is healthy. Back up the database before running `php artisan migrate --force`, then run the preflight again.

Use `start-shop-scheduler.cmd` to run the scheduler in a separate local terminal after migration. Keep it open while testing expiry. For production, install a once-per-minute `php artisan schedule:run` task and verify successful execution in the server logs. The release/preflight scripts require HTTPS unless `-Local` is supplied.

## Build for another domain

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_API_URL=https://api.example.com/api
VITE_BASE_PATH=/
VITE_DEFAULT_STORE=
```

Run `npm run build` and host `shop/dist/` on the customer domain. The variables are embedded at build time. `VITE_BASE_PATH=/shop/` also supports subdirectory hosting.

In the Laravel server environment, include the exact customer and staff origins:

```dotenv
CORS_ALLOWED_ORIGINS=https://shop.example.net,https://pos.example.com
```

Run `php artisan config:clear` after updating backend environment configuration. Both domains must use HTTPS for production. The shop does not send staff cookies or tokens and does not need a staff CSRF session. Keep the database private to the backend. Public product image and logo URLs use Laravel's configured request/proxy origin, so configure `APP_URL` and the production reverse proxy correctly.

Install the Laravel scheduler in production and run it every minute:

```text
php artisan schedule:run
```

It invokes `ecommerce:expire-orders` without overlapping runs. Monitor successful scheduler runs and inspect overdue pending orders. Verified prepaid orders and accepted orders never expire automatically.

## Staff workflow

For local demo setup, run `powershell -File scripts/setup-shop-demo.ps1 -CreateDemo` from the repository root. This creates a local-only demo business and three published products; rerunning uses its saved owner account. Credentials are in ignored `data/shop-demo-access.json`. See [local operating instructions](OPERATIONS.md) for scheduler monitoring, refunds and demo-data handling.

**Orders** shows order and payment states independently. Open a full-page order, accept it, pack it, and mark it ready for pickup or dispatched. Confirm the full cash/transfer payment before completion. Completion creates one POS sale and consumes reservations atomically.

Transfer proofs are private images of at most 2 MB (JPG, PNG or WebP). Staff review or reject them; upload alone never confirms payment. Dispatched goods retain their reservation until completion or confirmed physical return. Paid cancellations and voided online sales create manual refund obligations; record the full refund with its reference after sending the refund.

Owners have all shop permissions. Staff roles can independently receive settings, catalog, order viewing, processing, payment review and refund permissions. Give order viewing together with processing/payment/refund permissions so those staff can open details. Order resolution remains available after subscription expiry; configuration and publication require the usual subscription access. Office manages marketplace visibility without access to business order payments or private proofs.

The POS inventory list shows available, reserved and dispatched quantities. Its displayed stock includes dispatched quantities until order completion. POS sales, offline sync, product edits, adjustments and purchase reversals respect active reservations.

## Validation

The shop About tab embeds an interactive location map using the owner's saved coordinates, with the existing Open in maps link alongside it. The map loads lazily and invalid or missing coordinates hide the location block. The Google Maps iframe uses the same `maps.google.com/maps?q=<coordinates>&z=16&output=embed` approach as the Office business detail view, without an API key. `node scripts/check-shop-map.cjs` from the repository root checks live Google map rendering, 320/393/1366px layouts, tab retention, external-map opening, and returning from Cart without refetching the shop. Screenshots are saved under `artifacts/shop-map/`. Live map tiles require an internet connection.

Customer order alerts use the shared realtime socket server for order, payment, cancellation/request, and refund events. Signed-in customers receive changes for their account orders; guests receive changes for the order saved in private tracking. Each new event appears once in a queued, dismissible card, with a View order action. Existing history establishes the initial cursor without replaying old unread updates; later events resume from the locally saved cursor. The Updates badge refreshes and an open matching order refreshes in the background. A 15-second feed poll also recovers missed socket delivery. Tracking credentials remain in POST bodies and session storage, never in navigation URLs.

`node scripts/check-customer-order-alerts.cjs` from the repository root verifies account and guest delivery against an isolated socket server and intercepted APIs while the shop dev server runs on port 5177. It checks queued alerts, reload deduplication, background updates, responsive layouts, keyboard opening, and Back preserving the source page/order. Screenshots are written under `artifacts/customer-order-alerts/`. Physical Android Back behavior has not been device-tested.

```powershell
# Against an isolated, migrated MySQL database:
cd laravel
php artisan test --filter=EcommerceApiTest

cd ..\shop
npm test
npm run build
```

`scripts/e2e.mjs` creates fixture businesses/orders and verifies two-worker checkout contention plus real browser flows. Use it only with an isolated database. Set `ECOMMERCE_TEST_API` and `ECOMMERCE_TEST_API_SECOND` to two PHP worker API URLs, `ECOMMERCE_TEST_CONFIRM=isolated`, and optionally `ECOMMERCE_TEST_SHOP` / `ECOMMERCE_TEST_STAFF` for the customer and token-mode POS servers. Install the Playwright browser with `npx playwright install chromium`, then run `node scripts/e2e.mjs`. Screenshots are saved in `shop/artifacts/`.

## Operational limits

- One business per cart and order; changing shops requires an explicit replacement choice.
- No automatic customer matching: guest order completion leaves the POS customer unassigned.
- Online prices are integer currency units from one existing price type, ranging from 1 to 1,000,000,000 per selected unit; quantities use up to three decimals. Purchase unit prices derive from the existing base price and conversion factor. Unsupported conversion precision is rejected.
- Existing POS has no separate checkout tax calculation; delivery fees are stored on the order and linked sale and displayed on receipts. No extra tax is introduced.
- Pending reservations expire after 1–168 hours (default 24).
- Shop slugs become fixed after the first order to preserve links and safe retry resolution.
- The old per-business POS backup format excludes ecommerce history. Reset, restore and Office business deletion are blocked once order history exists. Use full database and private-storage backups for businesses with ecommerce history.
- Tracking credentials are stored as hashes on the server and retained in the browser session for convenience. Customers must save their credential for another browser/device; references and phone numbers alone cannot retrieve orders. Secrets never appear in tracking URLs.
- The English/Myanmar language switch covers browsing, checkout recovery, tracking statuses, proof guidance and customer-safe error messages. Business-entered names, descriptions, instructions and review reasons remain in the language entered by the business.

Before production, the business operator must choose and document the order/customer-data and proof retention periods, appoint a refund reviewer, and configure encrypted backups with restricted access to proofs. This release does not automatically purge financial history or proofs. Do not include tracking/proof request bodies in reverse-proxy logs or analytics. Deployment also requires the backend production upgrade already documented in the root README.
