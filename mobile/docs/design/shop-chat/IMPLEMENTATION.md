# Shop Chat implementation

| Reference | Route or state |
| --- | --- |
| 083 | `/shop/chat`: inbox, search, presence, last-message time and unread counts |
| 084 | `/shop/chat/:uuid`: full-page conversation and composer |
| 123 | Shared right-side unread filter drawer |
| 140 | Searchable product picker with confirmed attachment |
| 153 | Failed send with retained draft and expired-image state |

## Acceptance decisions

- Compact shared typography, theme colors, radius tokens and Lucide icons take precedence over inconsistent reference spacing. The inbox has one task header and standard bottom navigation. Conversations fill the viewport and have their own Back/profile header and composer.
- The customer's avatar and name remain a single clickable profile control when a customer detail route exists. There is no separate placeholder profile button. Presence, unread counts and read status remain real.
- Conversation bubbles use a neutral incoming surface and the app's soft brand color for outgoing messages. Compact times and day separators preserve chronology; full timestamps remain available on the time elements. The message viewport scrolls independently, preserving history anchoring and drafts through profile navigation.
- The filter uses the shared drawer and supported All/Unread select. Edits and Reset remain drafts until Apply; close/Escape discards them. This corrects the old immediate filtering behavior.
- Product selection requires confirmation. **Attach product** places the product in the composer, preserving typed text; only Send posts the message. Cancel/close leaves the existing draft unchanged. The API supplies real public product photos; unavailable photos use a package fallback. No SKU or other unavailable metadata is fabricated.
- A failed send stays in the composer with its attachments and a Retry send action. It is not displayed as an acknowledged sent bubble. Retry retains the existing client ID for the unchanged payload. Existing text/image validation, duplicate-send guard, permissions and backend contracts are preserved.
- Expired images show an ImageOff state with the existing 14-day retention explanation; they are not requested as downloadable images. Actual available images retain the existing authenticated preview/open behavior.
- Long text, product names and translated content wrap. The composer remains reachable at narrow widths and in landscape. Browser subpixel geometry differences under one CSS pixel are allowed by the layout check; no browser-specific animation or layout implementation was added.

## Controls and verification

| Controls | Verified behavior |
| --- | --- |
| Inbox Back / More | Existing My Shop and module navigation |
| Search / clear | Debounced search; clear restores query |
| Filters / Apply / Reset / close | Draft behavior regression test; shared drawer opens/closes |
| Conversation row / Back | Correct thread; original inbox search retained |
| Customer avatar and name | Customer detail; Back preserves conversation draft |
| Product picker search / row / Attach / remove | Correct product selected and attached without sending; composer attachment removable |
| Image attachment / remove | Type validation, valid preview and removable attachment |
| Send / Retry send | Draft preserved on failure; same client ID retry; success clears draft |
| Older messages / image retry / full image | Existing handlers preserved; not all history/network-image branches are exercised by this visual fixture |

`node scripts/check-shop-chat-reference.cjs` uses the dev server and intercepted API traffic. Set `CHAT_BROWSER=firefox` for Firefox. It captures all five mapped states, widths 320/393/768, landscape, profile return, picker, attachment validation, failed-send retry and Myanmar layouts. The deliberate 503 response is a retry fixture, not a live server failure. No real customer receives a message. Artifacts are in `artifacts/shop-chat-reference`.

The focused Shop, shell and radius suites passed 79 tests. Scoped lint passed. Final screenshots are inspected alongside the reference at the same viewport; fixture names, counts, photos, messages and times differ from proposed sample data. Realtime server delivery and physical device keyboard behavior require their respective environments. Production build was skipped as requested.

## Common-shell navigation update

The conversation header now renders through `PageAppBar` into the persistent shell above the swipe region. The common bottom navigation remains visible. Messages and the composer fit in the viewport between the shared 56px app bar and 60px bottom bar, including their safe areas. The profile identity and navigation handlers are unchanged; long names ellipsize within the compact bar. This user-requested common shell supersedes the earlier full-viewport conversation layout. The Chromium reference script now checks the actual space between both bars at 320/393/768 widths and short landscape. Profile returns, draft retention, sending, failed-send retry, picker and Myanmar checks pass. The broader common-shell work passed 203 targeted tests, lint and a production build.

## Compact message composer

The message textarea now uses a scoped shared-control modifier instead of the 88px form-textarea minimum. It starts at 44px (up to 45px with Firefox font rounding), grows to 120px for multiline drafts, then scrolls internally. Resize and retained-page activation recalculate height; clearing or sending resets it. The product and image actions keep their original placement with shared bordered surfaces, 44px targets and visible gaps, including at 320px. Send uses the shared primary IconButton and preserves empty/busy disabling. Enter remains a newline; drafts, attachment validation and idempotent retry behavior are unchanged. This is a local usability correction to the oversized input shown in screenshot 1909; reference 084 hierarchy and action order are retained.

The intercepted Chat browser fixture checks compact height, multiline growth/cap, internal scrolling, shrinking, separated touch targets, no send while typing, landscape layout, attachments, product picker, failed-send retry, profile Back with retained draft and Myanmar. Final compact, multiline and translated screenshots were inspected at mobile widths. Physical device keyboard behavior remains unverified.

## Product picker refinement

Choose product remains the reference 140 bottom sheet with search, single selection and explicit Cancel/Attach. The header uses compact 16px typography and a 44px close target. Rows now use fixed thumbnail/copy/selection columns, replacing the generic menu-row span flex rule that stretched photo space. Product names wrap naturally, prices stay visible and a radio-style indicator plus the shared brand selection surface communicates the pressed state. Real product photos, currency and unit values are unchanged. Search includes the shared clear action.

MobileSheet accepts an optional footer; the picker places Cancel/Attach there outside its scrollable list. Search also stays outside the list scroll. The sheet sizes to its content up to 82dvh/640px rather than leaving large gaps for short results. No summary or extra interaction step is added. Attach still stages the product in the draft and does not send it; pending searches and unavailable selections disable Attach.

The intercepted Chat browser fixture covers ten products with a long name, list scrolling with stationary search/footer, selection, empty search and clear, Cancel, close, browser Back with the same conversation draft, attaching/removing and send retry. Captures include 320/362/768px and a 393px-high viewport plus Myanmar. Screenshot inspection confirmed the dense hierarchy, complete long-name/price rows and reachable actions. Physical keyboard behavior is not simulated by the short-viewport check. Shared primitive/Chat tests, lint and production build are included in verification.

Final picker verification: Chromium and Firefox fixture runs passed, 18 Chat/shared-primitive tests passed, lint passed and production build passed (existing bundle-size advisory). No live chat messages or business records were changed.

### Picker row border behavior (reference 140)

Unselected product rows now use only a subtle bottom divider, with square outer edges and no card outline or shadow. The selected row uses the shared rounded radius and soft brand background with no visible outline. Dividers touching a selected row are suppressed, matching the reference grouping. Row padding, readable name/price content, radio-style selection, footer and existing business behavior remain unchanged. Chromium picker interaction checks passed; the final 362px screenshot was inspected against reference 140.

## Incoming message heads-up notification

### Compact last-active status (October 2026)

Conversation headers and inbox rows share a presence renderer. Online customers retain Active now; offline timestamps show date and minute precision (`18/10/26 02:33`) in the business timezone. The full last-seen timestamp remains available through the time element's title. Missing/invalid timestamps show Offline. Header status stays on one line, preventing the previous wrapped timestamp from pushing the customer's name above the app bar. Names ellipsize on narrow screens with the full identity available through the existing profile action and name title. This intentionally uses a shorter timestamp than the reference to accommodate the shared chat/menu actions without shrinking text or increasing header height.

Verification: five Chat tests, lint and production build passed. Intercepted browser fixtures check last-seen timezone conversion, complete timestamp visibility and bounded name/status geometry at 320/362/393px, plus existing profile/Back draft retention, inbox retention and send/retry flows. Final English and Myanmar screenshots were inspected in artifacts/shop-chat-reference/last-seen-*.png. Native keyboard behavior is unchanged and was not physically tested for this typography correction.

The app-level incoming chat alert now appears as a compact top-centered banner, respecting the safe area and 12px mobile gutters, with the shared white surface/radius, restrained shadow and a 220ms arrival animation. A soft brand message icon, New message caption, actual sender and two-line preview replace the bottom-corner panel and large primary Open chat button. The message area is the Open chat action; dismiss remains a separate 44px control. Long sender names wrap, previews truncate only within the notification and remain fully available in chat. English/Myanmar labels and reduced-motion handling are supported. The existing polling/cursor, unread-clearing, dismissal and conversation-target behavior are retained. Arrival does not move keyboard focus or cover bottom navigation/actions.

Verification: two ChatAlerts tests, Chromium and Firefox intercepted notification checks at 320/375/393/768px, long names/previews, source typing focus, dismiss without route change, keyboard Open chat, Myanmar and reduced motion passed. Final English, long-content and Myanmar screenshots were inspected under `artifacts/chat-notification`. Lint and production build passed. This is an in-app notification; platform notification delivery is outside this style change.


### Needs human indicator

The mobile inbox shows a compact theme-based warning badge only when `sales_ai.mode` is `waiting_owner`, matching the owner desktop inbox. Reading a conversation does not dismiss the badge. Successful owner sends and handovers publish a local handling update so the retained inbox reconciles the row without resetting its search, filters, loaded pages or scroll. Server snapshots with newer handling versions supersede local updates. Existing endless pagination, page refresh, permissions and chat routes are retained; no new API or submission form is introduced.

Focused chat tests (14), mobile lint/build and an intercepted browser fixture passed. Visual checks covered a 393px inbox and wider 768px overflow, plus returning from handover to the existing inbox row. Screenshot: `artifacts/mobile-needs-human/inbox.png` at the repository root.

Full mobile test suite also passed; evidence: `artifacts/mobile-needs-human-full-tests.log`.


### Inbox app-bar handover action

The `/shop/chat` app bar hides the Assistant AI and Shop chat shortcuts. It shows one icon-only bulk handover action for users allowed to process chat while Sales AI is enabled. The icon has an accessible label/title, a busy indicator and duplicate-click guard. It calls the existing business-wide handover endpoint; filters never limit the action to visible chats. Success reconciles loaded handling labels while preserving list/search/filter state, and failures leave the inbox intact for retry. Back, app menu, shared refresh and endless pagination are retained.

Focused chat tests (14), mobile build/lint and the intercepted bulk-handover browser fixture passed. Visual artifact: `artifacts/mobile-needs-human/inbox.png`; browser evidence: `artifacts/mobile-chat-appbar-browser.log`.

Full-suite check: 769 passed with one new raw-radius violation in the handover icon. Replaced it with the shared radius token; the affected radius and chat tests then passed (16 tests). Final build, lint and bulk-handover browser fixture pass. Evidence: `artifacts/mobile-chat-appbar-full-tests.log` and `artifacts/mobile-chat-appbar-final-tests.log`.

## Consistent error notices

Shared ShopLoadState now uses ShopErrorNotice for initial-load and retained-data refresh failures. Chat inbox, product picker, message-load and send errors, plus shared private-image failures, use the same compact icon/title/message/action composition. Notice text uses 14px/12px shared typography, 12px padding, theme colors, shared radii, wrapping and a 44px retry target. Myanmar titles and retry labels are provided. Raw server error details remain visible.

Retry is guarded while its promise is pending, shows busy feedback and retains the failure on an unsuccessful retry. Chat Retry send preserves the original event, draft, attachments and client ID. Message-load failure no longer displays the contradictory No messages yet empty state. Existing messages/forms remain mounted on background refresh failure. This updates shared Shop resource/image errors and the listed Chat errors; it is not a whole-application error audit.

Validation: 30 focused tests pass across ShopPrimitives, ShopChat and ShopSalesAi; targeted ESLint and production build pass. artifacts/shop-error-states/check.cjs verifies timeout -> Retry, message-load -> Retry messages, preserved composer draft, failed send -> Retry send with the same client ID, 393/320 widths, long Myanmar copy and dark mode in Chromium and Firefox. Final screenshots were inspected. The existing Firefox Shop Chat reference checks pass, including attachment, picker, profile return and draft/send behavior. Sales AI browser checks cover shared image Retry and retained source navigation. All network failures and sends are intercepted demo traffic; no customer received a message. Actual realtime delivery, physical keyboard/hardware Back and screen-reader behavior remain unverified.

## Context-aware chat notifications

Mobile and frontend now share equivalent local useChatNotice policies (no cross-SPA runtime import). Unread badge/presence polling continues independently of the toast. Mobile explicitly suppresses notifications on every /shop/chat route, including error/loading states, and while its app drawer is open. Both applications suppress visible chat workspaces, visible dialogs and hidden documents; hidden retained chat pages do not suppress alerts on other modules. Entering a blocked context clears the current toast, and consumed message IDs are not replayed on Back.

New message IDs merge into one toast during its display window. A single conversation shows its latest preview and incoming-message count; multiple conversations show one count summary and an inbox action (mobile avoids incorrectly navigating to the newest conversation). Normal expiry is six seconds after new activity, capped at twelve seconds for an uninterrupted burst. Hover/keyboard focus pauses expiry; dismissal/open/read events and disabled/zero unread feeds clear the toast. A reduced unread count clears stale previews without changing server read state. Dismissal/expiry never clears the unread badge. First-login/remount snapshots, including paginated saved-cursor backlogs beyond the three-page feed budget, update badges silently.

Mobile notification monitoring lives in AppShell, so it remains active while navigating. Callback changes do not restart its cursor/feed. Frontend retains its existing Open chat navigation behavior and suppresses its retained workspace only when visible. Presence, rate-limit backoff, permission gates and account-scoped cursor storage remain intact.

Validation: mobile 25 focused tests and frontend 14 focused tests pass; both targeted lint and production builds pass. artifacts/chat-notice-policy/check.cjs exercises both actual SPAs in Chromium and Firefox using intercepted demo APIs: same-chat/multiple-chat merging, inbox suppression, returning without replay, expiry with retained badge, grouped Open inbox and browser Back; mobile also checks drawer suppression and direct conversation suppression. Final merged and suppressed screenshots were inspected. Unit tests cover duplicate IDs, read events, reduced unread totals, hidden documents, hidden retained workspaces, dialogs, callback changes, timed expiry/focus and multi-page login backlogs. Physical device Back, real socket delivery and OS notifications are not verified. No live customer messages or read states were changed.

## Owner AI reply preparation state

Owner mobile and frontend conversations now render a compact named AI status above the composer when the authoritative thread payload has sales_ai.enabled=true, mode=ai and responding=true. The indicator uses shared theme/radius/type values, a Bot icon and three decorative dots; it does not create a fake message, disable the composer or conflate AI preparation with customer typing. Myanmar copy is mapped for mobile. Dot animation respects reduced motion.

The existing backend lifecycle was traced: customer send enqueues work inside its transaction and calls ShopChatRealtime.changed afterwards; Chat.view returns responding for matching pending/processing runs; Runner completion/failure and handoff already emit changed events. No backend/provider behavior was changed. Both owner clients already refresh the complete thread state on private-thread chat.changed, including when message IDs do not advance. Layout anchoring now also reacts to responding/mode changes and retains the existing pinned/history guards.

Validation: mobile 17 focused Chat/inbox tests and frontend 12 conversation/background/socket tests pass; targeted ESLint and both builds pass. artifacts/owner-ai-reply/check.cjs runs both actual SPAs with the actual socket.io client connected to an intercepted Engine.IO/Socket.IO fixture. Chromium and Firefox checks verify status-only changed events show/hide preparation within 3 seconds, completed reply display, takeover hiding even with stale responding=true, failure-stop state and retained owner drafts. Final screenshots were inspected at mobile 393x852 and 320x640 and frontend 1366x900; Chromium additionally verifies 320x420, Myanmar labels, dark mode and reduced motion. Synthetic API/socket traffic only; no provider calls, customer messages, handoffs or live read mutations were performed. Actual deployed socket service and AI worker delivery, native keyboard and hardware Back remain unverified.
