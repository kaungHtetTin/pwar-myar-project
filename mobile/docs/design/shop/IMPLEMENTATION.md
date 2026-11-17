# My Shop overview

Reference: `071-shop-my-shop-default.png`, mapped to `/shop`.

## Order attention badges (October 18)

The My Shop bottom-navigation icon and Orders overview row share a reusable count
badge. The server supplies a tenant-scoped `action_required_count` on the existing
order-notification baseline/poll endpoint. It counts each order once when the
current user can perform a processing, payment, refund or customer-request action;
completed/closed orders with no remaining action do not count. Read-only staff
receive zero. This is work remaining, independent of dismissed notification toasts.

The shell owns one order monitor and shares its count through context, preserving
retained source views. Local shop mutations trigger a count refresh; polling,
socket submission signals, reconnect and visibility resume also update it. Zero
is hidden, large counts show `99+`, and screen readers retain the full count in
English/Myanmar. User/business/permission scopes prevent stale cross-account
badges, and offline mode hides them. Deploy the updated Laravel notification
controller with the mobile UI to provide the count.

Verification: 32 scoped badge/monitor/shell/overview/alert tests and all 122 App
navigation tests pass. Three Laravel notification/attention/authorization tests
pass with 70 assertions, covering deduplication, closed records, pending returns,
refunds, staff permissions and tenant isolation. Chromium and Firefox checks in
`scripts/check-order-attention-badges.cjs` cover both badges, completion updating
the count, retained Back, zero removal, `99+`, and 320/375px English/Myanmar layouts.
Final rendered screenshots in `artifacts/order-attention-badges` were inspected.
Lint passes; no live orders or payments were changed.

The overview uses a compact task header, real business identity, and grouped Operations, Catalog and Configuration navigation. Shared MKPOS colors, type, Lucide icons and radius tokens match the implemented Settings and other reference modules. Cover and business logo use distinct icons.

## Acceptance decisions

- The reference compresses all fifteen destinations into one frame. The implementation scrolls naturally, keeps readable labels and touch targets, and reserves space for bottom navigation. Configuration and the final Location row remain reachable below the fold.
- Actual business name replaces the placeholder. No fictional store type or city is shown. The identity opens Storefront only when the account can configure it; otherwise it remains informational.
- Existing labels and descriptions retain accurate meaning: Publication manages online publications, Contacts manages public contact channels, and Pickup instructions does not imply a new fulfillment workflow.
- Owner/staff permissions, subscription filtering and the owner-location gate are unchanged. Empty navigation groups are omitted. Owner logo/location tools keep their previous visibility and destination restrictions.
- Only the overview is redesigned by reference 071. Existing Shop destination screens retain their established designs and business behavior.

## Controls and verification

| Control | Expected result | Verification |
| --- | --- | --- |
| Back to workspace | Existing shell workspace return, Products fallback outside shell | Routing unit test; existing shell suite |
| Manage storefront | `/shop/storefront` for eligible accounts | Routing and permission unit tests |
| All thirteen section rows | Their existing `/shop/:section` routes | Each row activated in unit tests |
| Business logo / Shop location | Owner destinations `/shop/logo`, `/shop/location` | Routing and restricted-account unit tests |
| Browser Back / Forward, Back to My Shop | Resume mounted overview and source scroll without another overview location fetch | Chromium and Firefox fixture checks |
| More / language | Existing navigation drawer, Myanmar overview | Chromium and Firefox fixture checks |

`node scripts/check-shop-reference.cjs` uses the dev server and intercepted APIs. Set `SHOP_BROWSER=firefox` for Firefox. It checks 320, 393 and 768px layouts, scroll retention, source mount identity, owner/staff visibility, and language. Artifacts live in `artifacts/shop-reference`, including the reference comparison and full-scroll captures. No location submission or business mutation is performed.

The focused Shop, shell and radius suites passed 78 tests; scoped lint passed. Final rendered reference comparison, configuration, narrow and translated layouts were inspected. Production build was skipped as requested.
