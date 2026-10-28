# Suppliers reference implementation

Routes: `/suppliers`, `/suppliers/new`, `/suppliers/:id`, `/suppliers/:id/edit`, `/suppliers/:id/payments/new`, `/suppliers/:id/payments/:paymentId/edit`.

## Reference coverage

| Reference | Implemented state |
| --- | --- |
| 034 | Directory header, search/filter/export, initials contact cards and balance/state footer |
| 035 | New supplier fields and pinned Cancel / Save supplier |
| 036 | Edit supplier details, address and additional-information panels |
| 037 | Supplier identity, current balance, Pay / Statement / Edit, purchase tab and total/paid/balance history cards |
| 038 | Full-page new payment with supplier context, direction choices, amount, method and note |
| 039 | Edit payment, original date, Delete, balance explanation and Save changes |
| 108 | Payment records tab with search/filter/export and payment amount/direction cards |
| 116 | Shared native right filter drawer with account state, name sorting, staged Reset / Apply |

The module uses shared MKPOS theme colors, typography, radius tokens and compact field sizes. Pages scroll naturally. Fixed form actions reserve bottom-navigation and safe-area space. Narrow translated tab labels wrap rather than clipping.

## Intentional acceptance differences

- Phone, contact person, address and note retain existing optional rules. Only supplier name is required. Notes remain unrestricted by the illustrative 200-character reference counter.
- Actual configured business currency replaces hard-coded reference MMK; no illustrative purchase or payment identifiers are fabricated. Purchase reference numbers use saved `reference_no` when available.
- Payment direction remains the supported **Supplier refunds shop**. Reference wording implying that a refund increases supplier receivables is not copied. A recorded payment has a Recorded state rather than an unrelated purchase Paid badge.
- Payment date on edit displays the original date read only; the existing API does not accept payment-date edits. Editing payment amount/method/direction/note preserves the date.
- Statement downloads the real account statement as CSV. It does not pretend to open an unsupported print preview. Existing directory/purchase/payment CSV exports remain available and respect applied filters.
- Existing aggregate account information is retained in an expandable Account summary below primary actions. Contact notes and action menus remain available.
- The detail payment action now opens the mapped full payment page, replacing the former extra payment sheet. Confirmation/action sheets still use shared components.
- Native browser controls, real record counts and data differ from illustrative reference fixtures. Larger content scrolls instead of reproducing compressed frames. No app-wide density change was made.

## Behavior checks

| Control | Result and evidence |
| --- | --- |
| Directory Add, contact, action menu | New/detail/edit navigation; existing Delete preserves purchase history. Browser navigation and frontend tests. |
| Directory search/filter/sort | Server queries use `q`, `account_status` and whitelisted `sort`; Reset stages changes, Escape discards drafts, Apply updates rows. Browser and API tests. |
| Directory/purchase/payment exports | Applied query/filter export paths; payment export excludes fixed pagination so subsequent CSV pages advance. Browser download and utility checks. |
| Back / Cancel / browser Forward | Existing mounted directory search and data remain; no initial supplier list fetch on unchanged return. Unsent new-supplier draft resumes through Forward. Browser checks. |
| Purchase row and nested Back | Opens existing purchase detail; browser Back resumes supplier detail. Browser checks. |
| Purchases / Payment records | Loaded history is retained without new initial fetches merely for switching tabs. Browser checks. |
| Purchase filters | Invalid ranges remain visible inside the drawer. Reset stages a draft without fetching. Browser and frontend tests. |
| Payment search/filter | Search issues debounced queries; closing the drawer discards changes. Browser checks. |
| Pay / payment identity | Full-page payment form; identity and Cancel return to the source supplier. Browser and frontend checks. |
| Save supplier / Save changes / Record payment | Validation, failed draft retention, duplicate-submit guard, disabled busy controls, correct supplier payload and success navigation. Tests and intercepted browser saves. Successful new forms clear their saved draft before reuse. |
| Edit-payment Delete / retry | Shared confirmation, visible in-sheet failure and retry, successful delete returns to supplier. Frontend tests; browser confirmation cancellation. |
| Missing or mismatched payment | Wrong-supplier edit URL is rejected; loading/error retains Back and Retry. Frontend test. |
| Empty/error states | Shared compact states, Retry and empty Add action. Intercepted browser checks. |

## Verification

- `npx vitest run src/suppliers`: **17 passed**.
- Laravel `php artisan test --filter=SupplierCreditApiTest`: **3 passed**, including stable whitelisted sorting, existing account filters, payment/refund balances and reports. Transactional tests preserve database records.
- `npx eslint src/suppliers src/app/App.jsx src/navigation/AppShell.jsx`: passes.
- `scripts/check-suppliers-reference.cjs`: Chromium and Firefox at 393x817, with 320/768-width overflow and screenshot checks; Myanmar detail/payment forms, full scroll and form bottom captures. All API traffic is intercepted; no live supplier or payment is mutated.
- Visual evidence: `artifacts/suppliers-reference/{chromium,firefox}`. Compared all eight mapped references at the same viewport and inspected narrow/translated layouts and reachable bottom fields/actions. Full-page captures place sticky/fixed elements at the current capture scroll position; bottom viewport captures show actual clearance.
- Handoff component inventory and local links validated. No production build was run.

Backend scope: supplier index adds whitelisted ascending/descending name sorting with stable ID ordering. Existing account-state filtering, payment calculations, permissions, tenancy and schema remain in place; no migration is required.

## Combined detail export chooser (18 October 2026)

The supplier profile now shares the credit-customer profile CSS: 60px initials avatar, prominent identity, separate icon-led contact-person/phone/address rows, and the note divider. Supplier details remain real and complete; names and long contact values wrap. The supplier profile has no duplicate Edit control because the user requested Pay/Edit/Delete together in the account section. This is the intentional departure from the customer card's top-right Edit placement. Final supplier screenshots at 375px and 320px and Myanmar were inspected alongside the customer profile capture. Supplier/customer screen tests pass (22 tests), lint passes, and the supplier Chromium flow passes.

The expanded Account summary uses label-over-value cards rather than the shared icon-column grid: these five statistics have no icons. Labels and values wrap naturally without ellipsis, the last odd card spans the row, and Last purchase uses the same readable date format as purchase history. Subtle shared surfaces replace nested outlined cards. This correction is scoped to supplier account summaries. Chromium and Firefox browser checks pass, with inspected final 375px/320px and Myanmar screenshots (`account-summary*.png`). Supplier and shared KPI tests pass (26 tests); lint passes without warnings. Browser cancellation checks count statement requests rather than unrelated background polling.

Supplier detail also removes the supplier-specific app-bar More action at the user's request. Pay, Edit and Delete appear directly in the account card, with primary, secondary and red destructive treatments. Delete opens the existing history-preserving confirmation; cancellation makes no DELETE request. The global app navigation menu remains at the right end. At 320px, these three buttons place icons above labels to avoid mid-word wrapping while preserving usable touch targets. Final 393px/320px and Myanmar screenshots were inspected; all 12 supplier screen tests, lint and Chromium supplier browser checks pass after this change.

Supplier detail now has one icon-only **Export CSV** app-bar action. It opens the shared compact action sheet with **Statement**, **Export supplier purchases**, and **Export supplier payments**, regardless of the active history tab. Existing CSV columns, applied history/payment filters, filenames and pagination remain unchanged. The global menu remains at the app-bar right end.

Cancel, close, Escape and hardware Back dismiss the chooser without navigating or resetting the underlying supplier detail. Exports run once with choices disabled while busy; errors remain in the chooser for retry, and success closes it with the existing export notice.

Verification: all 12 supplier screen tests and lint pass. The intercepted supplier browser checks pass in Chromium and Firefox, including all three downloads, chooser cancellation, retained tabs/history, nested Back and the existing forms/filters. Chromium additionally verifies failed statement export and retry. Final action-sheet screenshots were inspected at 393px and 320px and in Myanmar (`artifacts/suppliers-reference/chromium/export-options*.png`). The shared scrollable sheet replaces the duplicate app-bar icons without changing page density or export scope. No live supplier records were changed.


## Shared customer/supplier payment form

Supplier new/edit payments now use the same AccountPaymentForm React component as credit customers. Profile/balance presentation, direction cards (new), direction selector (edit), currency amount group, method, note/character count, shared borders/focus and fixed action bar are identical. Supplier-specific directions, methods, phone, currency, signed balance wording, payment date, edit recalculation notice and clickable supplier identity are preserved. Old supplier payment input/select/textarea border and focus rules were removed; the supplier contact editor keeps its separate supported fields.

Customer and supplier screen suites pass (22 tests), including an explicit supplier_to_shop refund payload assertion. Lint and both customer/supplier Chromium flows pass; supplier Firefox flow passes. New/edit forms were inspected at 375px/320px, including Myanmar. No live financial records were modified.
