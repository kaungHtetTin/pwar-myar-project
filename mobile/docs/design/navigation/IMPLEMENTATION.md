# Navigation drawer reference implementation

Reference: [navigation-drawer-reference.png](navigation-drawer-reference.png), supplied as `MKPOS Mobile Drawer Over Catalog.png`.

The shared drawer now follows the reference: MKPOS/business header, circular Close, simple outlined module icons and labels, Operations/Contacts/Finance/Administration sections, pale green active row with a left accent, language selector and a horizontal account/Sign out footer. Shared MKPOS theme tokens and compact typography remain in use.

## Preserved behavior and accepted differences

- Module visibility/order still comes from the existing permission-aware module configuration. Empty sections are omitted; no role or staff permissions are invented.
- Business name, user name and role use actual session data. Initials replace the generic user icon fallback. An uploaded shop logo remains supported in the footer.
- Language is an actual native English/Myanmar selector, showing the current language. Switching keeps the source page and drawer open. Browser-check scripts were updated for this control; their other module checks were not rerun as part of this styling task.
- Offline invoices and Tutorials remain reachable below the primary groups, despite being absent from the reference. Navigation scrolls independently when these shortcuts, translated labels, long names or shorter viewports require it. The header/footer remain reachable without shrinking all rows into one frame.
- Backdrop, close, Escape, Android hardware Back, navigation events, logout and existing left-slide/fade animations remain in place. Keyboard Tab wraps inside the drawer and focus returns to its opener on close.
- The actual catalog stays behind the overlay; illustrative products/prices from the supplied image are not fabricated. Icon shapes follow the installed Lucide family and the real MKPOS logo asset is retained.
- A scoped select override prevents the existing global `#root select` background chevron from appearing alongside the drawer's chevron. Filter-drawer animation/style rules are unchanged.

## Acceptance and verification

Compared the reference and final render at 393x850. Inspected the initial drawer, scrolled navigation, fixed footer, long business/user names, restricted staff permissions, Myanmar, and 320/768 widths. Evidence: `artifacts/navigation-reference/{chromium,firefox}` plus `artifacts/navigation-reference/comparison.jpg`.

- `scripts/check-navigation-reference.cjs`: Chromium and Firefox passed with intercepted API traffic. Checks active My Shop/Products navigation, all section headings, footer language selection, keyboard focus loop, Close/Escape/backdrop/hardware Back, retained catalog data on unchanged return, permission-restricted staff, and one intercepted logout.
- `npx vitest run src/navigation`: 31 passed, including 17 AppShell tests.
- Scoped AppShell ESLint passes. Handoff component inventory and local links validated.
- No production build was run. No live account was signed out during checks.

## Main entry app bars

Main module entries (`/sell`, `/products`, `/purchases`, `/sales`, `/suppliers`, `/customers`, `/expenses`, `/transactions`, `/reports`, `/billing`, `/access`, `/settings` and `/shop`) omit the Back button. Their titles align with the page gutter; existing menu, Add, cart and other actions remain available. This intentionally departs from reference images that show Back at a module root: module switching uses the bottom navigation or navigation drawer.

Shared headers render Back only when supplied an explicit return action. Forms, details, cart/checkout and nested Shop destinations retain their existing source-aware return paths and state retention.

Verification: 67 targeted tests passed; lint and production build passed. `check-filter-drawers.cjs --entry-headers` checks all 13 entries at 320px and 362px with intercepted API fixtures. Final Sell, Purchases and Settings screenshots were inspected for title alignment and compact spacing. Evidence is under `artifacts/filter-drawers/entry-*.png`. Fixture identities and empty lists differ from live data.

## App menu at the right end of app bars

The bottom navigation now uses Sell, Products, Sales, My Shop and Reports. Reports replaces the former More drawer trigger and navigates directly to `/reports`, with the same permission, offline-availability, localization and active-state rules as the other destinations. App navigation remains available from the shared app-bar menu.

`check-filter-drawers.cjs --bottom-reports` verifies pointer/keyboard navigation, Reports active state, no reload when selecting the active tab, retained Sell search/mounted input/data on browser Back, retained Reports data on return, narrow layout and the Myanmar label. Reports and Sell browser suites also pass. Navigation tests: 47 passed; lint and build passed. Final screenshots: `artifacts/filter-drawers/bottom-reports-{320,362}.png` and `bottom-reports-myanmar-362.png`.

Authenticated page app bars share `AppBarMenu`, including main entries, forms, detail screens, Settings and full-page Shop conversations. Its vertical dots button is the final header action and opens the existing permission-aware left drawer directly. English/Myanmar accessible names, dialog ownership and expanded state are supplied by the shared component. The shell provider now includes its own fallback app bar as well as module content.

Existing header actions remain before the app menu. Page-specific action menus use horizontal dots; checkout's receipt-action menu uses a printer icon. This distinguishes record/receipt actions from app navigation. Previous Product/Purchase/Sell drawer shortcuts are replaced by the shared trigger. Unauthenticated login/signup and the offline-without-session screen have no workspace drawer.

| Control | Handler and observed result | Verification |
| --- | --- | --- |
| Open app menu | Context opens the existing drawer once; expanded state updates; no page-data request on open/close | Shared-header unit tests and 51 browser routes at 320/362px |
| Close navigation, Escape, backdrop, hardware Back | Drawer closes; focus returns to its trigger; source remains mounted | Navigation browser checks and AppShell tests |
| Existing page actions and nested Back | Existing handlers retained; Sell/cart/checkout and source returns work | Sell and Checkout browser suites; targeted module/navigation tests |

88 targeted tests, lint and production build passed. All 51 route checks assert one trigger, final action position, no overlapping header controls, a usable touch target, drawer opening, Escape focus restoration and no refetch on dismissal. Inspected final Sell, Purchases, Settings, conversation and Orders screenshots; fixture names, totals and empty lists differ from live data. Evidence: `artifacts/filter-drawers/entry-*.png`, `artifacts/navigation-reference/chromium` and the existing Sell/Checkout browser artifacts. Four affected action-icon routes were rechecked after distinguishing their horizontal dots.

## Persistent common navigation shell

`AppShell` now owns one persistent app-bar element above `SwipeRefreshShell` and one bottom navigation element outside the refresh area. Pages declare their title, Back handler and actions through `PageAppBar`; only the active retained page renders its controls into the shell. The shared header DOM remains mounted while its content changes for the destination. The app menu remains the final action, and CSV actions remain icon-only in the header.

Existing route history and retained page owners remain in place. Module switching replaces the visible page section without a document navigation or source-page reset. Browser/app-bar Back resumes searches, filters, drafts, loaded data and scroll through the existing retention mechanism. Module localization is carried into the shell header so page-owned translations and real identity exclusions still apply. Nested history export slots reattach when their retained page becomes active.

The shared bar uses a compact 56px height plus the safe area. Pulling or refreshing moves only content below the bar. The common bottom navigation is also present in conversations; their message viewport and composer now fit between the two bars. Long conversation names use an ellipsis to avoid clipping or increasing bar height. This is an intentional departure from full-viewport conversation references, requested by the common-shell change.

Firefox Reports and Chat reference checks also passed, including swipe refresh, translated headers, conversation sizing and draft-return flows. Physical device keyboard and safe-area behavior still require device verification; short viewport and landscape layouts were verified in the browser fixtures.

## Simple language toggle

The drawer language dropdown is replaced by a single EN / မြန်မာ toggle. The selected language has the shared primary fill. The control is an accessible button with switch semantics, a 44px touch target and visible keyboard focus; click, Space and Enter toggle the two supported languages without opening a picker. It uses the existing locale provider/storage, leaves the drawer open, and preserves the source page. Settings' separately saved language form retains its existing save behavior.

56 navigation/localization tests, lint and production build passed. Chromium and Firefox drawer checks verify both switch directions, keyboard activation, unchanged URL, retained source DOM, no language-triggered requests, drawer focus/dismissal and narrow layouts. Final English/Myanmar screenshots were inspected in `artifacts/navigation-reference/chromium/{drawer-bottom,myanmar-320}.png`. Existing browser fixtures now use `scripts/drawer-language.cjs` to set the toggle explicitly. This intentional departure from the dropdown reference follows the user's request for a two-language toggle.

Verification: 203 targeted tests passed, including shell DOM identity, retained source input identity/value, header localization, and existing navigation/module behavior. Lint and production build passed. `check-filter-drawers.cjs --common-shell` asserts unchanged app-bar geometry during pulls, persistent header/bottom DOM through Sell → Products/Sales/My Shop/Reports → browser Back, retained filtered Sell data without a return fetch, and cart app-bar Back. The 51-route check passed at 320/362px; all 17 CSV pages passed with actual fixture downloads. The 15-route swipe checks, nested Shop Back, Sales, Products, Sell, Checkout, Reports and Chat interaction suites passed in Chromium. Chat checks include 320/393/768 widths, short landscape, composer placement, profile-return drafts and failed-send retry. Screenshots inspected: `artifacts/filter-drawers/common-shell-sell-pull.png`, `swipe-reports-refreshing.png`, representative `entry-*.png`, and `artifacts/shop-chat-reference/conversation-*.png`. Test identities, totals and messages are fixtures, and no live records were changed.
## Sell as the Back boundary (2026-10-16)

Sell is now the preferred authenticated launch page and logical navigation root. If an account cannot access Sell, its first permitted module remains the root rather than bypassing permissions. Other module visits unwind in order. Explicitly navigating to Sell starts a fresh root boundary, so another Back cannot return to older module visits.

`useRootNavigation` owns browser history traversal and the Android Back listener. A same-URL base/active pair provides the web boundary without reloading or remounting Sell. Logical depth remains zero at the root; stack identity prevents reaching visits from before an explicit return to Sell. Direct entries seed their mapped parent routes above the root, retaining query/hash context. Existing history metadata is preserved, and rooted history survives reload. Authentication/tenant changes get a fresh boundary.

An open navigation drawer or active overlay consumes Back first. Browser traversal is restored when an overlay consumes the event, so the source page remains visible. Android Back traverses pages until the root, then calls Capacitor App `exitApp()` instead of minimizing from arbitrary module pages. Web Back at the root stays on that page. Forward within the current stack still restores retained pages/drafts; selecting Sell deliberately ends the older Back stack. Pending traversal/exit guards prevent duplicate hardware actions.

Validation: 18 navigation/history/module/shell unit tests and 42 focused App integration tests passed. The integration cases cover direct-link errors, app-bar/page/hardware returns, sale-step Forward retention, customer/supplier source preservation and purchase drafts. `scripts/check-root-back.cjs` passed in Chromium and Firefox for web and simulated Android, including launch from login, repeated root Back, explicit Sell selection, filter/drawer dismissal before navigation, retained Product draft and Sell search/DOM without refetch, and direct Settings parent unwinding. Existing Sell/cart browser flow checks also passed. Lint and production build passed. Android exit was observed through an intercepted Capacitor bridge; a physical Android device was not exercised.

The broader App suite was run and is not a claimed full pass: it contains older UI assertions for menu names, tab labels/counts, duplicate headers and receipt DOM shape. Root-related expectations were updated and the 42 focused integration cases were rerun successfully. Evidence: [Chromium](../../../artifacts/root-back/chromium.json), [Firefox](../../../artifacts/root-back/firefox.json), [focused App results](../../../artifacts/root-back-app.json).


Language toggle refinement: removed the outer toggle background, border and shadow. The selected-language pill and visible keyboard focus remain; the switch keeps its 44px touch height. Chromium navigation checks passed, including mouse/Space/Enter language changes without closing the drawer, changing route or refetching content. Final English and Myanmar drawer screenshots were inspected.

Removed the fallback app-bar language action so loading states and pages without a registered page header no longer show an extra language button. Language switching remains in the navigation drawer; the dedicated saved language settings form is unchanged. Source search confirms LanguageToggle is rendered only by the drawer. A fallback-header regression and existing drawer interaction tests passed (20 shell tests), Chromium navigation checks passed, lint and production build passed.

## Global Shop chat action

The shared AppBarMenu composition now places a 44px Shop chat icon immediately before the app navigation menu on every eligible page, including fallback/loading headers. It opens the Shop chat inbox, leaves the menu last and keeps visited source pages retained. The icon is shown only for online accounts with the Shop module and owner/ecommerce-orders access; a disabled chat service hides it. Inbox activation is a no-op when already there.

The persistent shell owns the existing ChatAlerts monitor and exposes its current unread_count to header consumers, avoiding a second notification polling stream. Badge counts are scoped to user/business, omitted at zero and displayed as 99+ above 99; the accessible English/Myanmar name retains the exact count. Dismissing a banner does not mark messages read or clear the badge. The existing shop-chat-read event requests an updated count after reading; normal cursor polling and rate-limit handling remain intact. Notification opening still targets its own conversation. Offline/logout unmount monitoring as before.

Verification includes shared shell/chat tests, intercepted global-chat notification flows (badge updates, banner dismissal, 99+, zero, keyboard chat opening and retained source DOM/search without refetch), mobile/narrow app bars and the existing navigation menu. All interactions use fixture accounts/messages.

Final global-chat verification: 26 shell/notification/activity tests passed; Chromium and Firefox global-chat notification flows passed, including retained source search/DOM and no initial list refetch on Back. All 51 active app bars passed at 320px and 362px with the global icon enabled, preserving the final menu action and avoiding overlap. Inspected small-screen icon/count (including 99+), busy Products header, and translated screenshots. Lint and production build passed (existing bundle-size advisory). No live messages were sent.


## Create actions use shared FABs

All remaining app-bar Add/New entry actions now use FloatingActionButton: Customers, Suppliers, Expenses, Access (Roles/Staff), Settings price types, Shop contacts, Delivery, Shop payment methods and Promotions. Existing Product/Purchase FABs are preserved. The same 56px round control sits 16px above bottom navigation, with shared colors, shadow, icon and focus behavior. Each affected list reserves scroll space so its final item/footer can clear the FAB. App-bar export/chat actions remain before the final navigation-menu trigger. Promotions measures its bulk-selection bar so its FAB and popup move above that bar; extra scroll clearance follows its rendered height, including translated wrapping. This intentional departure from older mapped app-bar Add buttons implements the user's explicit request; page density and business actions remain unchanged.

Control checklist (existing handlers retained):

| Accessible name | Result |
| --- | --- |
| New customer / New supplier / New expense | Open the matching /new form |
| New role / New staff | Open the active Access tab's form; Staff still requires a role |
| New price type | Open /settings/prices/new |
| Add contact / Add delivery / Add payment method | Open the matching Shop form; existing 100/100/20 limits remain |
| Add promotion | Open choices above the FAB; New coupon and New flash sale open their existing forms |

Verification uses intercepted API responses only. The all-create-fabs browser check covers 320/362/768px geometry, app-bar placement, final-content clearance, keyboard activation, coupon/flash-sale choices, Escape, capacity limits and Myanmar. Browser and app-bar Back retain the mounted source/search without an initial list reload. Form pages have no list FAB. Screenshots are in artifacts/filter-drawers/fab-all-*, fab-myanmar-* and fab-promotion-options-*. Forty-six affected module tests, lint and production build pass. Physical Android keyboard/device checks were not performed for this action-placement change.
