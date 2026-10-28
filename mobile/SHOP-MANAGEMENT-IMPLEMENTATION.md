# Mobile shop management implementation

The target is full business capability parity with `frontend/src/screens/ShopScreen.jsx` and its shop components. Implement locally in mobile, using existing tenant-scoped Laravel endpoints. Submission forms have dedicated routes; lists use endless scroll; Back retains source state.

## Required feature inventory

- Owner location prerequisite, updates and permission failures.
- Orders: search, order/payment status, business-timezone date ranges, customer-request filters, endless cards, detail, items/totals/promotions, payment methods, private proof selection/retry, receipt approval/rejection, refunds, expired-order reopening, fulfillment/cancellation/failed delivery/physical return, customer requests and evidence, audit history, customer and linked-sale navigation.
- Catalog: category/stock/publication/price/sort/search filters, stock/photos/units/prices, publish/unpublish and filtered bulk publication.
- Customers: account/guest filtering, customer detail/history/orders, blocking, explicit credit-contact creation, customer chat.
- Chat: inbox/search/unread, conversations, pagination, read/presence/realtime, text/images/product sharing, customer navigation, notification entry.
- Storefront: shared business profile, slug/link, description, enable/order/marketplace switches, logo/cover, announcement/hours/temporary closure, location.
- Contacts, delivery zones, receiving payment methods: complete CRUD, validation, active states and deletion safeguards; pickup instructions.
- Promotions: coupons and flash sales, product selection, dates/pricing/limits, edits/deletes/bulk actions.
- Reviews: filtering/list, ratings/comments, replies and permissions.
- Reports: date filters, summary/series/breakdowns, customer/product analytics and exports supported by desktop.
- English/Myanmar localization, subscription restrictions, tenant reset, source retention and app/browser/Android Back, error/retry/duplicate-save handling and touch-sized controls.

## Verification

Run mobile lint, tests, build and browser QA with intercepted test data. Check each button/event plus nested/direct-link Back flows. Completion requires the full inventory, not only a successful build.

## Implementation

All feature groups above have local mobile pages in `src/shop/`. Configuration and catalog permissions hide unavailable sections; expired subscriptions retain order/customer/chat/review/report access while catalog/settings management requires renewal. Location capture is an owner-only full-page flow. Android declares coarse/fine location and uses the existing WebView runtime permission handler.

Forms use dedicated URLs, credentials through the shared API client, duplicate-submit guards, field validation and retained drafts. Operational lists and selection lists use bounded endless pagination; configuration arrays are backend-limited to 20/100 rows and revealed incrementally. Aggregate report charts use the backend's bounded date range; daily values are also available in a table.

Laravel now provides tenant-scoped GET detail routes for publications, promotions and reviews so edit/reply pages work from direct links. Deploy these backend changes with the mobile update. No database migration is needed for these routes. The debug APK build uses the production HTTPS API configured by the existing build script; local code changes have not been deployed to that server.

The existing customer app in `../shop/` is linked directly: development uses its running URL `http://127.0.0.1:5177`; production links use the API server's sibling `/shop/` endpoint (e.g. `https://www.pwarmyar.com/public/shop/`). Store and product hash routes match `shop/src/main.jsx`. Laravel serves the customer build from `public/shop/`; create it with `npm run build:laravel` in `shop/` and deploy it with the `/shop/` web route. `VITE_SHOP_URL` remains an override for a separate customer domain; the debug script also accepts `-ShopUrl`. This does not deploy anything remotely.

## Verification record (2026-10-13)

- Mobile: 72 test files / 406 tests passed; ESLint and production Vite build passed.
- Laravel: EcommerceApiTest 71 passed; ShopChatTest and ChatRateLimitTest 22 passed. Two existing customer-count assertions were corrected to count the current tenant instead of unrelated database records.
- Fixture-only Playwright browser checks passed at 390 × 844 and 1280 × 900; no browser runtime errors or phone horizontal overflow. Every API request is intercepted; no live business records were changed.
- Android Capacitor sync and Gradle assembleDebug passed. Local output: `releases/PwarMyar-mobile-production-debug-1.0.1.apk`.
- Screenshots and machine-readable results: `artifacts/shop/`; fixture harness: `scripts/check-shop-mobile.cjs`.
- Customer app linking: `scripts/check-shop-links.cjs` passes real mobile-to-shop and product popups, unchanged mobile source after popup close, and the compiled customer app at Laravel `/shop/` with API requests staying on that server. The Laravel shop entry-route test and production/development/override link tests pass. The updated APK was rebuilt with the same-server production links. Remote deployment remains pending.
- Existing customer-app API and navigation checks: 9 tests pass. One navigation test was scoped to the main page heading because the existing chat app bar also has a Chats heading.

| Controls / flow | Handler and expected outcome | Observed / method |
| --- | --- | --- |
| View order; app-bar/browser Back | Navigate to detail and resume the source list | Search and cards retained; zero new initial list requests on Back (browser and component tests) |
| Approve full payment; Accept order | Full-page confirmation; one POST using the exact total | Verification required; one 32,000 Ks payment submission; order accepted (browser and action tests) |
| Fulfillment/cancel/reopen/refund/request review | Permission/status rules; reason/receipt/returned-goods prerequisites | Payload and transition rules, failed field validation, unavailable actions and unresolved requests tested; every server transition covered by backend tests |
| Configuration Add/Edit/Save/Cancel/Delete | Dedicated forms; confirm deletion; preserve failed input | Payment account save, last-active validation, delivery deletion cancellation tested; API CRUD and permission behavior covered by backend suite |
| Publication unit/Save; filtered publish/unpublish | Save local publication; bulk action snapshots filter scope | Direct-link unit change tested; server atomic filtered publication and tenant isolation tests pass |
| Shop settings/Save; weekly hours; branding | Preserve unrelated delivery/payment settings; validate hours/files | Storefront save in browser; pickup settings merge tested; backend storefront/logo/cover behavior tested; native system image picker not exercised |
| Customer Block/Unblock/Credit/Chat | Confirm account action; reuse credit contact; open customer's thread | Cancel without mutation tested; backend blocking/credit idempotency and chat linking pass |
| Reply/Save/Cancel | Save or remove public reply on dedicated page | Browser reply save and component blank-reply removal pass; tenancy/permissions tested on API |
| Promotions Add/Choose/Save/Edit/Delete selection | Coupons and up to 100 products with independent discounts; atomic bulk delete | Multi-product payload, fractional limits, business-local schedule, used-product lock and cancel without mutation tested; flash creation exercised in browser |
| Chat Send/Share/Remove/Retry | Preserve draft; reuse client ID on retry; deduplicate messages | Text send and product selection/removal in browser; lost-response retry and disabled chat tested; private images/idempotency/expiration covered by backend tests |
| Chat → Customer → Order → Back → Chat | Unwind actual sources and preserve conversation | Nested app-bar Back retains customer data and chat draft, with no new initial message-history request (browser) |
| Report Filters/Apply/Clear; Show daily table | Business-timezone dates; accessible chart data | Date presets and daily table tested; phone/wide report rendered in browser |
| Search/filter/sort/endless loading/retry | Bounded pages; retained source; stale-response protection | Shared endless-list regression suite passes; shop filtering APIs tested; main shop screens rendered |

The same shell retains mounted pages per authenticated session and clears them on account/tenant changes. Android Back uses the shared history handler; sheets consume hardware Back before page navigation.

## Remaining environment checks

Physical Android GPS grant/deny, native file selection, hardware Back and keyboard sizing have not been exercised on a device. Live websocket reconnection, typing/presence, incoming notifications and real payment-proof/image transfers have not been exercised against production. Those external checks remain separate from the passing local implementation, browser fixtures and backend tests. No production deployment was performed.
