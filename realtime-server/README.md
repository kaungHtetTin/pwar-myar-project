# PwarMyar realtime chat and order alerts

Inventory, settings, reports, branding and AI delivery updates are described in
[Resource updates](deploy/RESOURCE-UPDATES.md). Deploy the matching backend and
SPAs and restart the Node service to enable the new event types.

The socket app also supports immediate Laravel AI queue wakeups through signed
POST `/ai-jobs`, without spawning PHP or storing database/model credentials.
See [AI Node dispatch setup](deploy/AI-JOBS.md) for both hosts'
environment settings and the reverse-proxy route. It is disabled until configured;
existing sockets and cron recovery continue to work.

Customer checkout also publishes `order.submitted` after the database commits. Signed owner tickets join a separate `private-shop.orders.business.<id>` room; customers cannot subscribe. Only the order ID travels over the socket. The owner web and mobile apps fetch the reference, customer and amount from the authenticated `/api/shop-admin/order-notifications` feed and display an alert with **Open order** and **Dismiss**. Staff require `ecommerce_orders` permission. Order alerts work independently of `SHOP_CHAT_ENABLED` and use the existing `SHOP_CHAT_REALTIME_ENABLED`, secret and socket host settings.

Keep the socket service running with `start-realtime-server.cmd` and restart it after updating its code. Include every owner app origin in `CHAT_ALLOWED_ORIGINS`, including `http://127.0.0.1:5176` and `http://localhost:5176` for mobile development, and the deployed mobile/Capacitor origin when applicable. Both applications obtain socket configuration and short-lived authorization tickets from Laravel at runtime.

While an owner app remains open, the order feed also checks every 15 seconds, recovers missed submissions on reconnect/resume, and does not replay dismissed alerts. Opening or reloading the app establishes a baseline rather than announcing historical orders. Checkout retries do not publish duplicate alerts, and socket failures do not prevent checkout. These are in-app alerts; notifications when the app is closed require a separate push-notification integration. No additional database migration or queue worker is needed for these order alerts.

Run `node scripts/check-order-notifications.cjs` from the repository root with the web/mobile Vite servers running to test real socket delivery against intercepted demo APIs. Screenshots are saved under `artifacts/order-notifications`; no live customer records are changed.

Order-alert verification covers the following controls in both owner apps:

| Control | Handler and expected result | Verified result |
| --- | --- | --- |
| Open order | Owner navigation receives the alert's order ID, then removes the alert | Mouse and keyboard tests open the correct order once |
| Dismiss order notification | Removes the current alert from the queue | Click tests remove it; repeated socket identifiers do not replay it |
| App-bar Back | Existing history navigation returns to the source | Browser checks retain the Products search without a new initial product request |
| Browser Back / Forward | Existing history restores source/detail | Browser checks retain search and reopen the same order |

Rendered checks cover 320, 375 and 768-pixel mobile widths and a 1366-pixel web viewport, readable alert content, focus retention and 44-pixel mobile targets. Native Android hardware Back and closed-app push delivery were not tested. Focused API tests cover authorization, tenant isolation, deferred publication, checkout retries and rollback; Socket.IO tests cover signed tickets, room isolation and identifier-only payloads.

PwarMyar has one Laravel application, in `../laravel`. This separate service is Node.js with Socket.IO. It has no database connection: Laravel authenticates platform customers and staff, checks shop permissions, stores messages in MySQL, and issues short-lived tickets for a single conversation or shop inbox. Socket.IO broadcasts message identifiers; each browser fetches the content through Laravel's authenticated API. Guests can shop and check out, but must sign in to a platform account to chat.

Shop owners open **Shop management → Chat**. Customers open a storefront and choose **Chat with shop**. Messages survive socket outages; the screens also fetch updates periodically and reconnect automatically. Blocked customers can read existing conversations but cannot send new messages. Staff need `ecommerce_orders` to read chat and `ecommerce_process` to reply.

## Chat images

Both chat apps accept JPG, PNG, or WebP images up to 2 MB, with an optional caption. Laravel compresses each upload to WebP, resizing when necessary, and stores only the compressed file at no more than 500 KB. PHP GD with WebP support is required (`ext-gd` in Composer). Images are private to the conversation and expire 14 days after sending; captions and message history remain visible with an **Image expired** placeholder.

Run Laravel's scheduler continuously for physical file deletion. In production, invoke `php artisan schedule:run` every minute using cron; locally, use `php artisan schedule:work`. The scheduled `shop-chat:expire-images` command deletes expired chat files every minute. Image access stops at the expiry time even before the next cleanup run. This cleanup only affects chat images.

## Local setup

Use Node.js 20 or newer. Copy `.env.example` to `.env`, then set `CHAT_SECRET` to the same random secret as `SHOP_CHAT_APP_SECRET` in `../laravel/.env`. Keep both files out of source control.

```sh
cd realtime-server
npm ci
npm start
```

On Windows, double-click `start-realtime-server.cmd` in the PwarMyar project root. It starts the service using `realtime-server/.env` and installs dependencies if they are missing. Keep the command window open while using chat.

If the PwarMyar realtime service is already running on the configured port, the launcher reports that chat is ready and leaves the running service in place. If another application owns the port, it shows a clear configuration message. Change both `CHAT_PORT` and Laravel's matching socket/publish ports together when selecting a different port.

Laravel configuration:

```dotenv
SHOP_CHAT_ENABLED=true
SHOP_CHAT_REALTIME_ENABLED=true
SHOP_CHAT_APP_SECRET=your-long-random-secret
SHOP_CHAT_SOCKET_HOST=127.0.0.1
SHOP_CHAT_SOCKET_PORT=8080
SHOP_CHAT_SOCKET_SCHEME=http
SHOP_CHAT_SOCKET_PATH=/socket.io
SHOP_CHAT_PUBLISH_HOST=127.0.0.1
SHOP_CHAT_PUBLISH_PORT=8080
SHOP_CHAT_PUBLISH_SCHEME=http
```

Socket service configuration:

```dotenv
CHAT_HOST=127.0.0.1
CHAT_PORT=8080
CHAT_SOCKET_PATH=/socket.io
CHAT_SECRET=your-long-random-secret
CHAT_ALLOWED_ORIGINS=http://127.0.0.1:5174,http://127.0.0.1:5177
```

Add the actual browser origins to `CHAT_ALLOWED_ORIGINS`, including their schemes and ports. Laravel's existing `CORS_ALLOWED_ORIGINS` must also allow the customer web app. Run the new chat migration and `php artisan config:clear` in the Laravel directory. The local credentials and migration are already configured in this workspace.

## Production domain or subdomain

Example: `https://chat.example.com` runs the socket endpoint, while Laravel and both web apps retain their own domains. Set Laravel's public socket settings:

```dotenv
SHOP_CHAT_SOCKET_HOST=chat.example.com
SHOP_CHAT_SOCKET_PORT=443
SHOP_CHAT_SOCKET_SCHEME=https
SHOP_CHAT_SOCKET_PATH=/socket.io
```

The public socket settings are fetched from Laravel at runtime, so changing them does not require rebuilding the web apps. Hostnames contain no scheme or path. `SHOP_CHAT_PUBLISH_*` describes the route Laravel uses to reach Node; on the same machine it can remain `http://127.0.0.1:8080`. If Node runs on another machine, configure an address reachable from Laravel and protect that connection with HTTPS or a private network.

Run `npm ci --omit=dev` and supervise `node index.js` with your production process manager. Set exact production web origins in `CHAT_ALLOWED_ORIGINS`. Keep Node bound to localhost behind your reverse proxy when both run on the same machine. An Nginx location inside the TLS virtual host for `chat.example.com`:

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 75s;
}
```

If Laravel publishes through the public HTTPS hostname, also proxy `/events` to Node. Publishing requires a timestamped HMAC signature from Laravel; browser requests cannot publish messages. Restart Node after changing its `.env`; run `php artisan config:cache` in Laravel after updating production settings. For multiple Node instances, add a shared Socket.IO adapter before scaling; this initial service uses one process.

`GET /api/health` provides a public process health check with HTTP 200 and `{"ok":true,"service":"mkpos-chat-realtime","status":"healthy"}`. `HEAD` is also supported; other methods return 405. Responses use `Cache-Control: no-store` and expose no credentials, room names, or customer data. `/health` remains a compatible alias. Locally use `http://127.0.0.1:8080/api/health`; on a separate server use `https://realtime.example.com/api/health` after applying the provided Nginx health locations. This checks that the Node HTTP process responds; it does not check Laravel, the database, or end-to-end socket delivery. A stopped/unreachable process is detected by the monitor's connection error or reverse proxy's upstream failure. Restart the deployed Node process to activate updated endpoints.

Presence uses the role and business identity signed by Laravel. “Active now” means a connected customer chat or shop chat workspace is visible. Hidden tabs and closed connections stop contributing to presence; multiple tabs are combined. Owners see active customers in their own shop, and customers see only their conversation's shop availability. Presence is temporary in-memory state and clears when Node restarts or the connection is lost.

Last-seen times are saved in the existing Laravel database through authenticated activity heartbeats every 30 seconds and when the chat is hidden or closed. Offline headers show elapsed time and continue updating. Existing conversations without a recorded activity timestamp show “Offline” until their next chat activity; message timestamps are not treated as presence.

Tests: `npm test` checks room isolation, event delivery, rejected tickets, origins, publish signatures, and presence across multiple tabs. Laravel `ShopChatTest` covers platform-only access, tenant isolation, blocking, message validation, and retry idempotency. Use the isolated test database for Laravel tests.

Customer order changes use `order.updated` on private account rooms (`private-shop.orders.customer.<id>`) and private tracking rooms (`private-shop.orders.tracking.<reference>`). Laravel issues short-lived tickets after account or tracking-credential verification and publishes only after the database transaction commits. Socket events contain event IDs and references; customer-visible details come from the authenticated order-alert feed. Restart the Node process after deploying these server changes, using `start-realtime-server.cmd` for local development after stopping the previous instance.

Office subscription-request approval publishes `subscription.approved` to `private-shop.subscription.business.<id>` after commit. Only authenticated business owners can obtain tickets or read `/api/subscription/alerts`; these routes remain available when the subscription is expired and do not require the Shop module. The socket sends only an event ID. The feed supplies the plan name and current subscription entitlement. Approval events have their own increasing IDs so approving older requests later cannot skip notifications. Deploy the `2026_10_17_000001_create_subscription_approval_events_table.php` migration before the updated approval controller, then restart Node. The local database migration has been applied.

Owner web and mobile apps now use the shared activity alert queue for approvals and the other high-priority events described below. The legacy subscription feed and socket event remain available for older clients. `node scripts/check-subscription-alerts.cjs` is an alias for the current owner activity browser checks; physical Android testing remains outstanding.

## High-priority activity alerts

Owner web/mobile alerts cover customer payment-proof uploads, cancellation requests, return/refund requests, subscription approval/rejection, and Office changes to subscription plans, dates, trial access, suspension, restoration and cancellation. Subscription rejection requires an Office reason, which the owner sees in the alert. Order alerts open the matching order; subscription alerts open Billing and refresh current access. Existing customer order alerts continue to cover status, payment, cancellation and return/refund decisions.

Office receives new subscription-request and new shop-report alerts. Review request opens its payment proof, and Review report opens its review modal. Existing pages retain their search, filters, pagination, drafts and Back state. Repeated submission keys and unchanged suspension state do not generate another alert.

Deploy migrations before the updated application code (the local database has already been migrated):

```powershell
cd laravel
php artisan migrate --force
```

The new tables are `realtime_activity_events` and `realtime_activity_locks`, created by migrations `2026_10_17_000002` and `2026_10_17_000003`. Transactional audience locks keep cursor IDs ordered by commit; rolled-back events are never published. Signed socket messages carry only event IDs. Owner rooms are `private-shop.activity.business.<id>`; Office uses `private-office.activity`. Only owners can authorize/read their business feed, including when access is expired; only authenticated Office admins can access the Office room/feed. Shop-module and chat entitlements do not gate subscription alerts.

Each browser account/business stores its delivered cursor locally. Alerts appear once per cursor even if the socket repeats, the alert remains unread, or the app reloads. A first visit establishes a baseline rather than replaying historical events. Delivery is scoped to that browser/device; it is not a cross-device read receipt. A 15-second authorized feed poll, visibility resume and online recovery cover missed socket delivery. Short-lived socket tickets renew on reconnect. Add Office origins (locally `http://127.0.0.1:5175` and `http://localhost:5175`) to `CHAT_ALLOWED_ORIGINS`, then stop the previous Node instance and run `start-realtime-server.cmd`. Until Node is restarted, the feed polling fallback still delivers these new events.

Browser verification uses isolated sockets and intercepted API fixtures; it sends no real emails or order/subscription mutations. Start web/mobile/Office dev servers on 5174/5176/5175 and run from the repository root:

```powershell
node scripts/check-priority-owner-alerts.cjs
node scripts/check-priority-order-alerts.cjs
node scripts/check-priority-office-alerts.cjs
```

Screenshots are saved under `artifacts/priority-alerts/`. Backend `ActivityAlertTest` covers audience isolation, rollback, deduplication, feed pagination and subscription producers; the existing order/report suites cover those producers. Each app has `activityRealtime.test.js` monitor coverage, plus alert component tests.

Approval also sends a branded HTML email with a plain-text alternative to the business's saved owner address after commit. It includes the shop, approved plan, amount paid, access dates in the business timezone, approval time, and request reference. Renewal emails use the extended subscription end date captured during approval. The existing SMTP configuration and `business_owner_emails` delivery audit are reused; no additional migration or queue worker is needed for email. Each approval has a deterministic send key, and delivery reservations prevent duplicate or uncertain sends from being repeated automatically. SMTP failure is recorded as `failed` (before an attempt) or `unconfirmed` (after an attempt) and logged without credentials; subscription approval and realtime alerts remain successful. Missing or ambiguous owners are logged without sending to an arbitrary recipient.

`SubscriptionApprovalEmailTest` covers after-commit sending, renewals, deduplication, rollback, SMTP failure, recipient selection, and HTML escaping with a fake transport. `php scripts/render-subscription-email.php` from the repository root renders a fixture preview under `artifacts/subscription-email/` without sending mail. The preview was visually checked at 375px and 640px; live inbox delivery was not tested.

See the official [Socket.IO server options](https://socket.io/docs/v4/server-options/) and [authentication middleware](https://socket.io/docs/v4/middlewares/) documentation.

Owner/staff device synchronization uses `order.changed` on `private-shop.orders.business.<id>` after each committed order event (status, payments, refunds and customer-request changes). Only `order_id` and `event_id` are published; each device reads its authorized order API. The order-notification feed also accepts `after_event_id` and returns bounded `changes`, `event_cursor` and `has_more_changes` for reconnect/poll recovery without replaying new-order alerts. Web lists retain their current page and filters; mobile lists reconcile loaded pages. Open details/action views update without clearing drafts. Deploy the Laravel, web/mobile and Node changes together; restart the separate Node service to enable the new event. No new environment variables or migrations are required.
