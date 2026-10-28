# Transactions reference implementation

Routes: `/transactions`, `/transactions/payments/:id/edit`, `/transactions/supplier-payments/:id/edit`.

## Reference mapping

| Reference | Implemented state |
| --- | --- |
| 043-transactions-payment-history-default.png | Customers history, segmented tabs, search/filter/export, period, directional totals and payment cards |
| 044-transactions-payments-id-edit-customer-payment-edit-default.png | Customer identity/balance, direction choices, amount/method/note, balance notice, Delete and pinned Cancel/Save |
| 045-transactions-supplier-payments-id-edit-supplier-payment-edit-default.png | Supplier identity/balance, direction notice, amount/method/original date/note, actual payment metadata and pinned actions |
| 109-transactions-supplier-payments-tab-supplier-payments-tab.png | Supplier history and compact identity/direction/method/reference rows with signed flow colors |
| 118-transactions-right-filter-drawer-right-filter-drawer.png | Shared native right drawer, real date presets/custom bounds, method/direction choices and staged Reset/Apply |

The module uses compact MKPOS theme tokens, shared icon family, radii and native form controls. It retains natural scrolling, keyboard focus, safe-area space, and bottom-navigation clearance. Sales keeps its existing implementation.

## Accepted differences and reasons

- The existing **All time** default remains; the reference's October range is an example. This month, last month, rolling seven/thirty days, Today and custom/open bounds are available. Rolling ranges use actual calendar dates.
- Summary amounts/counts are computed on the server across all matching payments, including unloaded pages. The reference's inconsistent visible row counts are not reproduced. Older API responses without summary metadata explicitly label the fallback as loaded payments.
- Actual configured currency, account names, saved references or real numeric IDs replace illustrative MMK/PAY/SUP data. Amount fields show the actual currency. Method choices preserve configured names and existing legacy values; no fictional bank/mobile method mapping is introduced.
- Existing account reassignment remains available through a searchable named-account sheet using Change account. The former raw numeric account-ID input is removed from the primary form presentation.
- Supplier refund direction remains supported and editable. Both edit forms use equivalent shared direction choices; the supplier notice states its actual direction and balance recalculation.
- Original payment date is read only. The API does not support editing creation dates. Note limits remain unchanged rather than adopting the illustrative 200-character counter.
- Supplier metadata uses the actual payment ID/date. No nonexistent reference number is generated. Incoming/outgoing colors consistently distinguish money received and paid.
- Search/filter/export and sorting use the same layout across both tabs. CSV is offered once in the toolbar instead of duplicating the reference's header export. The shared drawer is wider than the compressed reference for usable controls and readable Myanmar text.
- Content below the initial frame scrolls instead of shrinking fields or obscuring metadata behind fixed actions. Full-page captures place sticky/fixed elements at the capture position; bottom viewport images verify actual clearance.
- Payment deletion retains the existing payment API contract. Sales PIN/receipt behavior is not changed.

## Functional coverage

| Control or state | Verified behavior |
| --- | --- |
| Customers / Suppliers | Independent retained search, filters, sorting and loaded data; unchanged tab return does not issue an initial fetch. |
| Search and Clear | Debounced server query, scoped to the visible ledger. |
| Period / Filters | Shared native drawer; Escape closes without applying drafts; Reset stages values; invalid dates remain visible inside the drawer. |
| Payment method/direction | Customer endpoint now actually applies both filters; supplier endpoint preserves existing filtering. Counts reflect applied values. |
| Sort | Whitelisted newest/oldest/highest/lowest with stable ID ordering. Browser control and API checks. |
| Export CSV | Active ledger, applied search/dates/method/direction and full matching pagination; no fixed offset is embedded in the export path. |
| Payment row / actions | Shared detail sheet, Edit/Delete menu; sheet close keeps source context. |
| Edit / Back / Cancel | Retained source search, loaded rows and mounted content; browser Forward restores unsent edits. Header Back and Cancel use existing history with Transactions fallback. |
| Change account | Named paginated search; chosen ID and account identity update together without clearing the amount. |
| Save changes | Integer validation, duplicate-submit guard, correct ledger/account payload, disabled busy Back/Cancel, retained failed draft and success reconciliation. |
| Delete payment | Shared confirmation, cancellation, in-sheet failure/retry; successful delete returns to source/reconciles rows. No extra PIN flow added. |
| Load more / Retry | Failure retains previous rows; Retry appends the next page without restarting history. |
| Initial error / empty | Shared themed states and working Retry; edit-load failures retain Back and Retry. |
| Workspace Back | Uses the existing workspace destination; browser verifies Products fallback. |

## Verification

- `npx vitest run src/transactions src/suppliers`: 44 passed, including sales and supplier regressions.
- Laravel `php artisan test --filter='TransactionReferenceApiTest|SupplierCreditApiTest'`: 5 passed. Covers full matching totals with pagination, customer direction/method/search/date filtering, sort order, tenant isolation, account names, supplier historical names after soft delete, unchanged payment dates and existing credit/refund math.
- Scoped ESLint passes for transaction/supplier sources, App and AppShell.
- `scripts/check-transactions-reference.cjs`: passed Chromium and Firefox against the development server with all API calls intercepted. Captures all five mappings at 393x817, checks 320/768 widths, full/bottom form content, Myanmar history/edit forms, source retention, failed/successful saves, filter drafts, sorting, pagination retry, downloads and error/empty states.
- Compared final reference/render pairs at the same viewport and inspected narrow/translated layouts. Evidence: `artifacts/transactions-reference/{chromium,firefox}`.
- Updated component handoff inventory and validated local links. No production build was run.

Backend changes are read metadata/query behavior only: aggregate summary fields, matching filters, whitelisted stable sorting and account names. Payment write schemas and financial calculations remain unchanged; no migration is needed.


Transaction sorting now lives in the shared right filter drawer after Payment direction, for both Customers and Suppliers. The page list heading contains only the count. Date/amount order changes remain pending until Apply; closing discards edits, and Reset stages Date (newest) with the other defaults. Non-default sorting contributes to the active-filter badge. API sort values, CSV sorting and independent retained tab state are preserved. This intentionally moves sorting from the older default reference toolbar at the user's request. Nine payment tests, lint/build and intercepted browser flows cover sorting, Reset/Apply/Cancel, supplier sorting, edit/Back retention and translated layouts. Screenshots are in artifacts/transactions-reference.
