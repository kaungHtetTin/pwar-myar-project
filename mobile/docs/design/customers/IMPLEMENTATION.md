# Customer references 028-033, 107 and 115

Implemented and visually reviewed 2026-10-15. Scope: credit customer contacts and account/payment screens, not the separate shop customer module. No production build was run.

## Mappings and final visual review

All six comparisons were inspected side by side for labels, font hierarchy/weight, wrapping, spacing, panel borders, form focus and action placement. Reference images remain unchanged. They are normalized from 853 x 1844 to 393 x 850, with 33px of native status chrome excluded. References 028/030/031/032/033 also have a 16px blank native bottom inset excluded, yielding matched **393 x 801** viewports. Reference 029 retains the bottom region to avoid clipping its lower navigation text, yielding **393 x 817**. Both sides of each comparison use the same viewport. The app uses real safe areas and the shared 60px navigation; it does not draw a fake clock, battery or home indicator. Shared theme fonts, green actions, radius tokens and focus rings remain in use.

| Reference | Route/state | Inspected comparison |
| --- | --- | --- |
| [028](028-customers-contacts-default.png) | `Contacts /customers` | [Reference / app](../../../artifacts/customers-reference/comparison-028.png) |
| [029](029-customers-new-create-default.png) | `New customer /customers/new` | [Reference / app](../../../artifacts/customers-reference/comparison-029.png) |
| [030](030-customers-id-edit-edit-default.png) | `Edit customer /customers/:id/edit` | [Reference / app](../../../artifacts/customers-reference/comparison-030.png) |
| [031](031-customers-id-account-detail-default.png) | `Account /customers/:id` | [Reference / app](../../../artifacts/customers-reference/comparison-031.png) |
| [032](032-customers-id-payments-new-new-movement-default.png) | `New payment /customers/:id/payments/new` | [Reference / app](../../../artifacts/customers-reference/comparison-032.png) |
| [033](033-customers-id-payments-paymentid-edit-edit-movement-default.png) | `Edit payment /customers/:id/payments/:paymentId/edit` | [Reference / app](../../../artifacts/customers-reference/comparison-033.png) |

Additional inspected evidence: [search focus](../../../artifacts/customers-reference/history-focus.png), [name focus](../../../artifacts/customers-reference/customer-name-focus.png), [Myanmar contacts](../../../artifacts/customers-reference/myanmar-index.png), and the 320px/768px captures under `artifacts/customers-reference`.

## Supported behavior and explicit visual differences

This is not a pixel-identical claim. The following differences preserve the application contracts:

- **Required fields:** name remains required; phone remains optional because both the existing customer API and checkout allow customers without a phone. The reference's phone-required asterisk is not copied. Email validation and existing error IDs remain intact.
- **Character counters:** show the real character count without imposing the mockups' inconsistent 200/500 limits. Existing longer addresses/notes remain editable. Native textarea resize controls and number-input formatting remain available; amount inputs use the actual numeric value rather than inserting grouping separators into a numeric control.
- **Saved metadata:** payment date is server-owned `created_at`, displayed as read-only rather than an unsavable date picker. Customer/payment IDs use real `#id` values, not invented CUS/PAY codes. Created by is shown only if the API supplies a creator name; no shop-owner attribution is fabricated.
- **Real customer data:** the references disagree about Emma's phone, email and address between detail and edit. The fixture uses a consistent saved customer. Existing notes remain visible in the profile; payouts remain visible when nonzero. Extra or long data scrolls above navigation and pinned actions, so history position can differ from the shorter reference.
- **Financial summaries:** Total sales uses the API's `total_sales`, not its credit-only `credit_total`. Total paid includes money received at sale plus subsequent customer-to-shop payments. Shop payouts stay separate; balance retains `credit_total - paid_total + payout_total`. Saved sale totals are authoritative; the reference's item amounts do not sum to its displayed 49,000 total.
- **History search:** supports invoice number/payment method, the actual customer-sales API search contract. The label says method rather than promising unsupported product-name search. Search and date filters compose; Reset explicitly clears both. CSV export stays available beside the history filter even though the reference omits it.
- **Directory actions:** the trailing chevron retains the existing accessible Actions menu; the main contact row opens detail. Edit/delete and directory export remain available. Receivable/payable/settled colors use the application's existing semantic colors. Shared Lucide icons are retained rather than tracing the mockup's icons. List end-state text remains available for pagination/accessibility.
- **Layout:** all filter surfaces remain right-side drawers. New-contact actions follow its panels as in reference 029; edit/payment actions remain pinned above shared navigation. Button/radius/font rendering follows the existing theme, including device safe-area differences. The edit direction selector preserves its supported two-direction choices; the new form adds radio cards with balance-effect descriptions.

## API change

`CustomerController::sales` accepts optional `with_items=true` with paginated `with_total=true` history. It attaches sale items for the loaded page in a single batch query, including saved product name/price/quantity, current base-unit label and optional photo URL. It exposes no storage path. Pagination, customer scope, status/date/search filtering and existing callers remain unchanged. The mobile history requests this option; it does not issue one detail request per sale. This controller change must accompany the mobile source when deploying.

## Controls and verification record

| Control | Handler / expected behavior | Observed evidence |
| --- | --- | --- |
| New customer, Back, Cancel | Open existing route; return to real source without saving | Browser new/cancel/Forward retains draft; App tests verify source DOM, search, tabs and nested Back without initial refetch. |
| Contact row / Actions / menu View/Edit/Delete | Open account or existing action sheet; retain contact identity | Browser opens detail and edit; screen tests cover menu and deletion flows. |
| Directory search / Clear / Export CSV | Debounced API query and filtered export | Screen tests verify search/export scope; actual downloaded file not manually opened. |
| Directory Filters / Account status / Sale activity / Apply / Reset | Right drawer; send supported query parameters and reset defaults | Browser applies receivable and resets; no horizontal overflow. Sale activity handler uses supported API field; not separately clicked in browser. |
| Name/phone/email/address/note / Save customer / Save changes | Existing POST/PUT contracts and errors; values survive failed save | Browser required-name validation, retained draft and recoverable edit failure; screen/App tests cover successful create/edit reconciliation. |
| Profile Edit / main Edit / Customer actions | Existing edit route/action sheet | Browser Edit and Customer actions exercised. |
| Add payment / direction radios / amount / method / note / Record payment | Existing integer validation and POST; selected direction preserved | Browser checks shop-to-customer payload; screen tests cover integer validation and route. |
| Edit payment / direction select / Save changes | Existing single-payment load and PUT with customer ID | Browser loads saved metadata and checks amount 12,000 PUT; App tests preserve unsaved payment draft and selected history tab. |
| History tabs / search / date filter / Reset / sale header | Correct list/query and sale navigation, source retention | Browser payment/sales tabs and search; App tests cover sale/editor return to retained customer; date-filter handlers retained and query composition inspected. |
| Customer/payment Delete / Cancel | Existing confirmation and balance/history semantics | Browser customer cancellation sends no DELETE; screen tests verify payment/customer delete handlers. |
| Print statement | Existing complete statement preview/printing utility | Existing screen tests verify request/print call; physical printer and OS popup behavior not tested. |
| More / shared bottom navigation | Permission-aware app navigation and active module | Browser More and language switch exercised; navigation remains shared. |

The isolated dev-server fixture uses intercepted API responses and does not mutate live business data. Six screen captures, 320px/768px overflow checks, Myanmar contacts, focus screenshots, new/edit payment payloads, failed-save retention, deletion cancellation, filters and retained list DOM passed. Replay: `node scripts/check-customers-reference.cjs`; [browser evidence](../../../artifacts/customers-reference/checks.json).

137 focused customer utility/screen, App navigation and radius-token tests passed; [results](../../../artifacts/customers-reference/unit-results.json). ESLint passed. The existing transactional Laravel customer sales-history feature test passed with added assertions for paginated item attachment, prices and hidden storage paths. No build was run. Android hardware gestures, physical printing and full end-to-end production mutations were not exercised.

Presentation owners: `src/customers/CustomersScreen.jsx`, `CustomerReferenceParts.jsx`, `customerLocale.js`, and `src/styles/customer-reference.css`. State/API ownership remains in CustomersScreen; App retains source pages and drafts.

## Compact module update (2026-10-16)

The customer module keeps the requested compact theme. Contact rows and form/profile panels have slightly clearer padding and section gaps. Actions retain labels, financial state colors, original endpoints and source navigation.

Additional mapped surfaces:

| Reference | Surface | Comparison |
| --- | --- | --- |
| [107](107-customers-id-payment-records-tab-payment-records-tab.png) | Customer detail, Payment records | [Reference / app](../../../artifacts/customers-reference/comparison-107.png) |
| [115](115-customers-right-filter-drawer-right-filter-drawer.png) | Customer index, Filters | [Reference / app](../../../artifacts/customers-reference/comparison-115.png) |

Payment records now use date/time, payment-method badge, actual record ID, amount and direction in one actionable row. Notes remain visible when present. The row opens the existing Edit/Delete action sheet; no new financial mutation was added. Total received excludes shop-to-customer payouts and says Loaded received when the list is incomplete. Counts use singular/plural appropriately.

The customer filter drawer uses balance-state radio cards with existing `all`, `receivable`, `payable` and `settled` values. Sort by shows the actual fixed Name (A - Z) ordering without an unsupported sort control. Sale activity remains under More filters; Apply/Reset and dismiss-without-committing behavior are preserved. The drawer remains right-sided, with shared header/footer/focus behavior, and is slightly wider than the reference to accommodate translated labels.

The payment endpoint does not support reference/method text search. Reference 107's search field is omitted rather than displayed as an ineffective control; date filters and CSV remain available. Its PAY code, date, amount and customer details are replaced with real saved values. Existing profile notes and the customer action menu remain available, so the history can start lower than in the reference. Typography, icons, native navigation insets and browser font rendering follow the app theme; no exact pixel match is claimed.

Final comparisons for all eight references were visually inspected at matching viewport sizes. The isolated browser script captures 320/768px layouts, keyboard/form focus, Myanmar directory and filter drawer. It checks balance filtering, sale-activity choices, Escape without a filter request, payment POST/PUT, menu/delete cancellation and retained source/drafts through Back/Forward. The payout-exclusion summary has a regression test. All 138 focused Customer/App/radius tests and ESLint pass. No production build or real-server mutation was performed. Existing physical-device and downloaded-CSV limitations above still apply. The known in-app browser bootstrap failure required isolated Chromium on the dev server.


## Detail actions aligned with suppliers (18 October 2026)

The user requested the supplier action arrangement for credit customers. Add payment, Edit and Delete are grouped inside one account surface, using primary, secondary and red destructive treatments. Add payment retains its existing customer-payment route and direction behavior. The duplicate profile Edit and detail-specific More menu are removed; the directory action menu remains. Print statement moves to an icon-only app-bar action beside CSV, preserving the existing print flow and global navigation menu at the right end. Customer names use the full profile width and wrap. At narrow widths icons sit above labels rather than clipping them.

The existing customer deletion confirmation preserves sales/payment history; Cancel does not send DELETE. All 10 customer screen tests and lint pass, including statement printing and direct delete cancellation. The fixture-only Chromium reference flow passes, covering payment forms, edit, filters, delete cancellation, nested Back and retained directory state. Final screenshots were inspected at 393px, 375px and 320px, including Myanmar detail captures. No live customer records were changed.


### Compact action correction

The user rejected the tall stacked action buttons. The customer account actions now stay in one 44px-high horizontal row, with icons beside labels and compact padding at every mobile width. The primary visible label is Payment (accessible name New payment, tooltip Add payment), retaining the same route. Its slightly wider grid column accommodates the translated label without reducing text size. Inspected final 375px/320px and Myanmar screenshots; Chromium reference/button/navigation checks and lint pass. This supersedes the earlier narrow icon-above-label treatment for credit customers only.


### Explicit CSV export chooser

Customer detail Export CSV now opens the shared compact action sheet with Credit sales CSV and Payment records CSV. Both choices are available from either history tab. The selected export kind, rather than the active tab, determines the existing endpoint, columns and filename. Applied history filters, full CSV pagination and tenant scoping remain unchanged. Cancel/close/Escape leave the tab, search and loaded data in place. Choices disable during export; a ref prevents duplicate requests, errors remain in the chooser for retry, and success closes it with the existing notice.

All 10 customer screen tests and lint pass. The intercepted Chromium flow verifies cancellation without export requests, exporting payments from Credit sales, exporting credit sales from Payment records, correct filenames, retained active tabs, and failed export/retry. Final 375px/320px and Myanmar chooser screenshots were inspected (export-options*.png). No live customer records were changed.

The export chooser Cancel button was removed at the user's request. The header close icon, backdrop, Escape and hardware Back still dismiss it. All 10 customer screen tests and the Chromium export/navigation checks pass; the final 375px screenshot was inspected.


### Payment form layout repair

The shared component layer was overriding the new-payment direction-card grid with generic flex rows. A scoped component rule now preserves two cards with icon/radio across the top and full-width title/help text below, matching reference 032's hierarchy. The amount input uses a full-height currency prefix and a distinct editable area with a zero placeholder; focus/error styling and numeric validation remain shared. Both new/edit forms retain their supported directions and payment payloads.

All 10 customer screen tests, lint and the intercepted Chromium customer flow pass. Final 375px/320px new-payment, edit-payment and Myanmar layouts were inspected, including note focus/scroll above pinned actions. Native keyboard behavior was not tested on a physical device. No live financial records were changed.


### Payment control border rendering

The user still saw corner artifacts in Firefox on Windows after the direction/amount layout repair. The payment form now disables native appearance and inset control shadows, clips control backgrounds inside the CSS border, and keeps the grouped amount input borderless inside its single outer border. Focus outlines remain visible, including the amount group's focus-within treatment. This is scoped to customer payment forms; checkboxes/radios retain native semantics and appearance.

The fixture browser check now supports CUSTOMERS_BROWSER=firefox and asserts the actual computed appearance, background clipping and absence of inset shadows. Focused-note screenshots at 375x667 were inspected in Chromium and Firefox; automated renders have clean corners. The original user's exact browser/graphics configuration is not available in this fixture session. Payment form submission, retries, Cancel, source retention and existing customer flows continue to pass.


### Remove legacy payment CSS overrides

At the user's follow-up request, conflicting payment-control selectors were removed at their source rather than adding further overrides. customers.css no longer supplies payment input/select borders and focus paint. customer-reference.css no longer styles payment amount/group borders, prefix surfaces, field radii/backgrounds/focus, edit input heights or action-button borders. Contact-specific rules are scoped to contact forms. Payment direction border/layout/text now have one component-layer definition; fields and buttons use shared controls. The edit panel, form placement, business data and fixed-action clearance remain intact.

All 10 customer screen tests and lint pass. Firefox and Chromium fixture flows pass. Final focused payment controls and narrow edit forms were inspected; no corner artifacts appear in these automated renders. The user's exact browser/graphics setup remains outside this test environment.

Customer PaymentForm is now extracted into shared AccountPaymentForm and reused by suppliers; customer behavior and screen tests remain unchanged.
