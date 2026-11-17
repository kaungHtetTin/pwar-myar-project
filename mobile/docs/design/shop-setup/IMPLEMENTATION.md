# PwarMyar mobile Shop setup

Completion now has one translated Complete action, navigating directly to `/shop` with the existing navigation reset option so the application's automatic parent-Back behavior cannot return to Review instead. Other completion links/buttons were removed. The centered green success icon and credit notice remain. Fixture checks exercise the actual destination; regression checks cover the single action and its route options.

2026-11-04 pinned actions: Cancel and Save/Continue now occupy a fixed bottom bar during the wizard. Cancel uses the existing close/source-return handler without saving; app-bar Back still follows history. Reserved page padding keeps the last control clear of the bar. Safe-area padding and the shared visual-viewport keyboard variables position the bar above an open keyboard. Browser assertions cover viewport anchoring and last-control clearance at 320px Myanmar, 390px English and tablet dark mode; physical software-keyboard testing remains outstanding. Setup/radius checks (31 tests), lint and normal/Laravel builds pass.

2026-11-04 simplified payment fields: removed Method name and Customer instructions inputs. Each transfer now exposes only Bank / wallet, Account holder, Account number / phone, checkout availability and the draft Remove action. New methods receive their bank/wallet label as their required API name, with Bank transfer as the empty-label fallback. Existing method names and saved customer instructions remain unchanged. Regression tests cover the hidden fields, automatic naming and preservation of existing values.

2026-11-04 simplified details: tab 1 now contains only cover/logo uploads, public shop name, slug, phone and address. Currency, online price selector and shop description inputs were removed. Saving details always selects Retail; the existing currency and description remain unchanged. Regression coverage verifies a prior Wholesale setting becomes Retail while hidden values are preserved.

2026-11-04 five-step flow: Fulfillment and Delivery zones have been removed from the mobile wizard, including their forms, indicators and delivery summary. The sequence is Details, Payments, Products, Sales AI, Review. Old pickup/delivery wizard URLs redirect to Payments; saved shared progress stages 2/3 resume there. Mobile saves map to the existing version-2 server IDs [1,4,5,6,7], keeping web progress compatible. Existing pickup/delivery configuration is preserved in API payloads. Dedicated Shop configuration pages are unaffected.

2026-11-04 compact products: publication entries now show only the product name, selected online price and publish checkbox in a single approximately 49px row. Category, stock, unit, price-type caption, package icon and repeated visible publication label were removed at the user's request. Long names wrap naturally; each checkbox retains a 44px target and translated accessible label. Price selection, publication validation, bulk actions, search, endless scrolling and retained Back state are unchanged. Verified visually and through browser row-height/publication checks at 320px Myanmar, 390px English and tablet dark mode; 19 setup tests, lint and both builds pass.

2026-11-04 flat layout: removed the outer wizard card border, background and shadow. Payment/delivery groups, publication rows and feature options now use simple dividers rather than nested cards. Draft Remove actions are compact ghost buttons. Form field borders, image previews and normal action controls remain. The change is scoped to Shop setup; the existing continuous background is preserved. Inspected the payment layout and verified the three GPS/full-wizard browser cases, 21 setup/radius checks, lint and normal/Laravel builds.

2026-11-04 social profile branding: cover and logo now form one profile-style preview. The 16:9 cover has a camera action, and the square shop avatar overlaps its lower edge with a camera badge. Both are single accessible upload buttons; the logo overlap does not block the cover's edit action. Optional status, type/size validation and immediate saves are retained. Fixture browser checks exercise the actual image buttons/file choosers and both empty/filled states at 320px Myanmar, 390px English and tablet dark mode.

2026-11-04 header refinement: the language switch and accessible Close setup icon now live beside Back and the title in the single shared app bar. The separate action/count row was removed; the count sits beside the step heading. Scoped compact styles preserve 44px targets and allow the Myanmar title to wrap. Verified at 320px Myanmar, 390px English and 768px dark mode; setup/radius checks (21 tests), lint and both builds pass.

Implemented 2026-11-04. The mobile wizard now has five steps: Shop details, Payments, Products, Sales AI and Review. It reuses the PwarMyar web API contracts with its own mobile flow. Existing Laravel APIs and business rules are reused.

## Feature parity inventory

| Step | Mobile implementation and preserved behavior |
| --- | --- |
| Shop details | Public name, slug and order lock, phone, address, currency, online price type, description. Separate immediate cover/logo uploads with type/size checks, 16:9 cover and square logo. Shared business contact settings. |
| Payments | Bank/wallet transfer name, provider account, instructions and checkout availability. Add/remove unsaved methods, 20-method limit. Cash is preserved in the payload without a cash-on-delivery section. |
| Products | Debounced search; bounded endless scrolling using the shared hook; stock/unit/price identity; individual publication and filtered Publish all/Unpublish all across all pages. Backend price validation and atomic bulk rules remain authoritative. |
| Sales AI | Enable switch and representative name only. Original instructions, soul, tools, policies and optimistic-concurrency version remain in the API payload. Conflict reload and wallet-credit notice. |
| Review | Saved shop summary, all three opening options checked initially and independently editable. No product-review/readiness section. Settings save followed by progress completion; errors retain the form for retry. Customer shop, catalog, balance-book and Shop actions. |

The owner-location API decides whether an approved location still needs configuration. Older owners with an empty shop enter too; this is not a first-visit flag. Existing pending progress resumes its saved version-2 stage. Configured shops, staff, offline sessions and unavailable subscriptions do not automatically enter. The GPS success event is business-scoped and invalidates older location reads. No Shop setup navigation/drawer item was added.

## Routes and state

`/shop/setup/details`, `/shop/setup/payments`, `/shop/setup/products`, `/shop/setup/sales-ai`, `/shop/setup/review`, `/shop/setup/complete`.

A session-keyed controller lives above the main retained page frames. Form drafts survive navigation and Close in the current session. The product frame stays mounted, preserving search, loaded pages and scroll. App-bar/browser Back uses existing application history; page Back selects the preceding wizard stage. Close returns to the captured source history entry, or replaces a direct entry with `/shop`. Reload resumes server progress; unsaved field drafts are session memory only.

Every mutation is guarded against repeat submission. A save owns only the current step's fields, so earlier saves cannot enable the storefront inadvertently. Hidden cash, opening hours, announcement and advanced AI settings are retained. Failed completion does not display success. Responses after navigation cannot advance the destination page, and tenant/account unmounts discard old responses. Publication mutation reconciliation preserves the already loaded range; unchanged Back causes no list request.

The wizard inherits the single shared app bar and swipe-to-refresh shell. Its setup shell uses the existing continuous decorated background. Manual refresh updates metadata without discarding unsaved fields. Products register their own refresh action. CSS is loaded through the page cascade layer, with shared controls, radius/color tokens, focus behavior and reduced-motion support.

## Intentional mobile layout changes

- The desktop sidebar becomes a single connected row of five numbers/checkmarks. All steps fit the available width without scrolling or repeated labels. Buttons retain translated accessible names, tooltips and 44px touch targets at 320px; the page heading identifies the active step.
- Product tables become compact cards. Search and bulk actions stack on phones for usable input width; they share one line on larger viewports.
- Forms scroll naturally and actions follow their content. Text and controls are not compressed to fit a screenshot. All controls keep 44px touch targets; Myanmar text uses scoped compact type with sufficient line height for marks.
- Cover and logo remain separate, with small previews instead of a desktop-width banner.

## Verification and control record

All API writes in browser verification are intercepted fixtures. No real shop records were changed.

| Control / flow | Expected and observed result | Evidence |
| --- | --- | --- |
| Automatic entry / GPS approval | Pending owner enters the saved stage; wrong-business events and older GPS reads cannot override it. Configured/staff cases skip setup. | Component tests; `gps`, `resume`, `configured`, `staff` browser cases. |
| Step indicators / page Back | Correct full-page route, retained drafts and locale; no return-only settings load. | Component tests; complete browser flow. |
| App-bar Back / browser Forward | Products → Sales AI → app-bar Back restores search and products with zero initial list requests; Forward returns to AI. | Browser flow with network assertions. |
| Close / Back to Shop | Returns to captured source; direct setup entry falls back to `/shop`. Closing defers automatic reopening in the current visit. | Component direct-entry test; completion browser flow. |
| EN / Myanmar | Shared locale toggle; translated fields and navigation remain readable and usable. | Component test; 390px Myanmar screenshots. |
| Upload/change cover and logo | File selection, immediate API write and preview change; size/type constraints handled before upload. | Browser cover/logo writes and 16:9 geometry assertion. |
| Save & continue / validation | Saves only owned fields once; validation appears beside the field and retains the draft. | Component tests; fixture phone failure/retry screenshot. |
| Add payment method / fields | Transfer row and recipient details saved; hidden cash preserved. | Component and browser flows. |
| Available at checkout / remove new method | Wired to the current method draft. | Component test; field interaction coverage. |
| Product search / endless list | 45 rows append across three pages; empty search and exhausted states work. | Browser network and count assertions; existing endless-list hook suite. |
| Publish all / Unpublish all | Includes all matching pages; invalid-price response leaves publication unchanged, retry succeeds. Loaded range retained. | Browser bulk failure/retry and 45-row assertions. |
| Individual Publish online | Saves selected product and reconciles without clearing search. | Browser row checkbox flow. |
| Enable AI / representative name | Toggle/name save while advanced settings remain intact. | Component and browser assertions. |
| Three review checkboxes / Save shop setup | Initially checked; independently editable. Completion remains on review after progress failure and succeeds on retry. | Component test and browser completion failure/retry. |
| Manage products | Opens existing catalog route. | Component completion action test. |
| Open customer shop / Sales AI balance book | Correct customer URL and existing wallet route. | Component completion links test. |

PwarMyar verification: the full mobile suite passed all 883 tests across 147 files. Mobile lint and both normal/Laravel builds passed. Ten fixture browser scenarios passed, including GPS, saved-step resume, staff/configured exclusions, English/Myanmar, reduced motion and dark mode. Vite reports the existing large-bundle warning.

Browser harness: `node scripts/check-mobile-shop-setup.cjs`. Ten cases cover 320px/390px/768px, English/Myanmar, light/dark, reduced motion, configured/staff exclusion, GPS and saved-step resume. Screenshots and JSON are in `artifacts/mobile-shop-setup/`; rendered screenshots were inspected. The in-app browser connection failed with a sandbox metadata error, so the repository's standalone Playwright fallback was used. Physical Android Back, software keyboard and native image picker have not been tested; no APK was requested or generated.
