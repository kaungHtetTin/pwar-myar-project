# Resource updates

Laravel remains authoritative for authentication, permissions, stock validation,
transactions, payments, AI execution and durable jobs. Node broadcasts cache
invalidation hints; it has no database credentials or permission to perform sales.

## Included behavior

- Desktop and mobile join `private-business.resources.<business_id>` using
  five-minute Laravel tickets. Owners and staff can obtain their own business's
  ticket; all detail reads retain their existing API permission checks.
- Successful product, price, stock movement and online stock reservation writes
  invalidate inventory. Sale, purchase, expense and payment writes also invalidate
  the relevant history/report resources. Bulk imports use the same write observer.
- Settings and pricing changes update other devices. Desktop setting fields being
  edited are preserved. Mobile form routes retain drafts; loaded endless lists
  reconcile their existing pages. Desktop POS preserves its loaded product range.
- Wyne Wyne completion/failure invalidates assistant delivery. A pending client
  reads its own authenticated delivery receipt immediately; recovery polling is
  every 15 seconds with a private socket and every two seconds without one.
- All four applications subscribe to `public-platform.branding`. The public
  room carries only the `branding` resource name, never private tenant events.
- Socket bursts coalesce in clients. Hidden/offline clients reconcile on resume.
  Inventory/settings/report recovery runs every 120 seconds while connected and
  every 30 seconds while disconnected. Existing chat/order alert feeds retain
  their own cursor-based recovery. These are in-app updates, not closed-app push.

Laravel's successful-write observer captures the current tenant, registers an
after-commit callback, and coalesces resources per room. HTTP termination,
command termination and queue job completion/failure flush the committed hints.
Rollback and nested savepoint rollback discard callbacks. Writes without a
tenant context cannot generate private stock hints. SQL text, message bodies,
customer details and amounts are never sent to Node.

Hints are deliberately not a durable event log: a killed process or unavailable
socket service can lose a hint. API reconciliation and checkout validation remain
necessary. No stock is accepted from a socket payload.

## Deployment

1. Deploy the matching Laravel, Node and rebuilt SPA files together. There is no
   new migration or package dependency.
2. Keep existing `SHOP_CHAT_REALTIME_ENABLED`, shared signing secret, socket host,
   HTTPS and `/events` proxy configuration. Chat itself may remain disabled.
3. Ensure `CHAT_ALLOWED_ORIGINS` includes desktop, mobile, customer shop and Office
   origins. Restart Node and long-running Laravel workers after deployment.
4. Clear/rebuild Laravel configuration cache using the normal deployment process.
5. Keep scheduled recovery jobs and existing authenticated feeds enabled.

New endpoints:

| Endpoint | Access |
| --- | --- |
| GET `/api/realtime/resources/config` | Authenticated active business user |
| POST `/api/realtime/resources/auth` | Same business; requested room must match |
| GET `/api/branding/realtime/config` | Public, throttled |
| GET `/api/branding/realtime/auth?channel_name=public-platform.branding` | Public room only, throttled |

The AI Node dispatcher accepts `wyne-wyne` alongside `sales-ai` and
`customer-service`. New Wyne Wyne requests save the message and job together,
return HTTP 202, and generate through the worker. Node wakes that queue after
commit; `cron:work wyne-wyne` every minute provides recovery. Unstarted work can
be recovered; already-processing attempts are never automatically replayed.
Configure signed callbacks using [AI-JOBS.md](AI-JOBS.md).

Server health remains an independent HTTP check every minute. Moving that check
onto the service being monitored would prevent it from reporting socket outages.
Business reports now refresh on relevant socket hints as well as explicit refresh.

## Verification

- `npm test` in `realtime-server`: room isolation, public/private payload rules,
  rejected identities, signed publishing, queue wakeup and existing chat/orders.
- Laravel `ResourceRealtimeTest`: coalescing, commit/rollback/savepoints, tenant
  capture, public branding and unauthenticated/private ticket rejection.
- Laravel `AiNodeQueueTest`: actual queue reservation, locks, allowlists and Wyne Wyne
  queue execution without provider replay.
- Frontend `resourceRealtime.test.js`: reconnect authorization, backoff, hidden
  tabs, periodic recovery, coalescing and cleanup.
- Product/sale/settings regressions cover retained pages, cart drafts, unsaved
  settings fields and existing form/Back behavior.

Live two-device delivery and native Android remain deployment acceptance checks;
automated fixtures do not establish production connectivity.

### Local verification, 2026-10-28

- Node: 22 tests passed.
- Laravel: 70 focused tests passed across resource updates, AI queue dispatch,
  Wyne Wyne execution/access and mobile product APIs.
- Mobile: all 133 test files / 807 tests passed; an additional regression checks
  that related resource hints produce one refresh per module. Lint and production
  build passed.
- Customer shop: all 44 test files / 214 tests passed; production build passed.
- Desktop: focused socket, settings draft, product-page retention, branding and
  AI delivery tests passed; lint and production build passed.
- Office: all 45 test files / 227 tests passed; lint and build passed.
- Two existing `PlatformThemeTest` AI generation cases return 503. They also fail
  with `SHOP_CHAT_REALTIME_ENABLED=false`; palette validation and non-AI theme
  update cases pass. No theme-generation behavior was changed by this work.
- In-app browser verification was unavailable because the browser runtime rejected
  initialization with a missing `sandboxPolicy` field. No visual or live
  production-delivery verification is claimed.
