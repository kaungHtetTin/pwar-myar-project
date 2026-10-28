# Financial book

Updated 24 October 2026. Open **Financial book** in Office navigation. This is a cash book for PwarMyar platform operations, separate from each shop's POS expenses.

## Daily workflow

1. Choose the currency in Filters. Balances are separate for each currency; there is no exchange-rate conversion.
2. Subscription payments appear automatically from existing payment records. Do not enter them again as Other income.
3. Use New entry to record expenses, separate income, founder capital contributions, or founder profit payouts. Record category, counterparty, payment method and receipt reference where available.
4. Allocate profit from a selected bank book to distribute the active founders' shares immediately. The bank balance and total recorded cash decrease, and each share is recorded as paid. The amount must fit both unallocated profit and available bank funds. Allocations use today's date.
5. Use Founder payout only to settle older unpaid allocations. New allocations already include payment and cannot be paid again. The amount cannot exceed the founder's unpaid allocation, source bank funds, or recorded cash.
6. Use a row's action menu to view details or void an incorrect manual entry with a reason. Create a replacement entry if needed. The original record and administrator remain in history. Voiding a new paid allocation restores its source bank balance and reverses the recorded founder payments. For older unpaid allocations, enough unpaid allocated profit must remain for every founder in the allocation snapshot; void separate payouts first if needed.

## Founders and calculations

Open **Finance > Founders** (or **Financial book > Founder settings**) to manage founders on a dedicated page. Use **Add founder**, edit names and percentages in the shared Office table, then **Save founders** to save all shares together. **Reset changes** restores saved values; **Cancel** returns without saving. Browser Back and the app-bar Back control retain the financial-book search, filters, page and scroll. Remove founders through the shared row-action menu. Active shares must total 100%, with up to two decimal places. Removing a founder archives their identity; it does not delete earlier allocations, payouts or contributions. Archived founder totals remain visible.

Fresh financial-book installations initially have Kaung Htet Tin and Min Htet Kyaw at 50% each. Upgrading an existing installation copies its actual founder names and percentages into stable founder IDs 1 and 2 and preserves the settings version. It does not reset existing shares.

Changes are audited and affect future allocations. Every allocation stores the participating founder IDs, names, percentages and amounts. Amounts use integer minor units internally. Only active founders with a positive percentage participate; the last participating founder receives any rounding remainder so the split adds up exactly. Version checks reject stale settings and allocation forms.

Recorded profit = subscription receipts + other income - expenses.

Recorded cash = opening adjustments + receipts + other income + founder contributions - expenses - separate founder payouts - paid profit allocations.

Unallocated profit = recorded profit - active allocations. Each founder's unpaid profit = allocated amount - payments included in new allocations - separate active payouts. Contributions are tracked independently and do not grant profit entitlement or represent profit payouts.

Balances cover all recorded dates. Search, date, type, founder and status filters affect the paginated entries table. A founder filter includes their contributions/payouts and shared profit allocations. Subscription receipts remain managed through the existing payment flows. Removing an existing receipt or recording a late expense can produce a deficit; the book displays it and blocks further profit allocation.

## Implementation and verification

The additive migration creates settings, manual book entries and settings audit records. All book endpoints require Office authentication. Mutations are serialized through the settings lock. Entry request UUIDs prevent repeat recording after a retry. Share settings use version checks, and allocations reject stale share versions. No bank transfer is initiated by this feature.

- OfficeFinancialBookTest: authentication, currency separation, exact allocation snapshots, capital/profit distinction, payout limits, void history, idempotent retries, validation and pagination.
- FinancialBookPage.test.jsx: New entry, Cancel/Escape/focus restoration, error retry, saving/duplicate guards, search/filter Apply/Clear, founder-page navigation, allocation, View/Void entry and retained drafts/state.
- Dashboard.test.jsx: sidebar entry, shared app bar and browser Back without a return fetch.
- scripts/financial-book-ui-smoke.cjs: rendered desktop widths, 80px shared action column, retained draft, cancel/save, allocation, filter and details controls. Uses in-memory fixtures, with no real financial mutations.

## Bank books and transfers

The initial books are Kaung Htet Tin (1), Min Htet Kyaw (2), and VISA (3). Use the separate **Bank books** navigation screen to create and rename books, archive books, delete unused books, and choose **Receive subscriptions here** for the default receiving book.

Existing subscription receipts are assigned to book 2, matching the running system's previous calculation. New approvals, assignments and renewals store the selected receiving book on the payment record, or use the configured default. Changing the default never moves previous receipts or recomputes their book assignment. The receiving-book selector is an internal ledger choice, separate from customer-facing subscription payment methods.

Archived books retain their balances and transaction history. New cash entries and subscription receipts require active books. A referenced book cannot be deleted; archive it instead. Change the subscription default before archiving or deleting that book.

All new cash entries, including profit allocations, require a bank book. Existing manual cash entries remain unassigned until reviewed. Their net balance and count are shown separately, and Assign bank book in each row's action menu records the selected bank and assigning administrator without changing amount, date or profit. The sum of all bank-book balances, including archived books, plus the unassigned net balance equals recorded cash.

Use Transfer in the app bar to record a completed movement between two bank books. Select a source, destination, amount, date, description and optional reference. A transfer is one atomic entry with matching outgoing and incoming movements. It has no effect on income, expenses, recorded profit, total cash or founder entitlement. A transfer between founder-named bank books is distinct from a founder profit payout.

Transfers use the selected currency and require two different valid books with sufficient source funds in that currency. There is no currency conversion or external bank execution. Transfers appear in the shared ledger and an account filter matches both incoming and outgoing transfers. Voiding a transfer reverses both movements and requires enough remaining funds in the receiving book. Ordinary expenses can show a negative book balance when documenting past expenses or credit-card spending.

Verification additionally covers subscription routing, matching two-sided transfer balances, unchanged profit/founder totals, same-currency funding limits, duplicate retries, selected-bank payouts, transfer reversal restrictions, assigning historical entries, and bank-book filters. The rendered UI fixture checks the Transfer app-bar button and modal in addition to the existing book controls.

## Paid profit allocation compatibility

New profit-allocation entries contain a source account and represent both allocation and payment in one immutable ledger entry. The allocation snapshot supplies each founder's paid share; its shares sum exactly to the bank debit. No additional payout rows are created, so retries and later Founder payout cannot double-deduct the amount. Voiding that one entry restores cash and reverses all entitlements and payments stored in its snapshot atomically.

Historical allocations have no account and remain unpaid entitlements. They are excluded from bank movements and unassigned-cash review, and can still be settled with separate Founder payout entries. They cannot be assigned a bank retroactively. No migration or historical monetary rewrite is required for this behavior.

## Opening adjustments for an already running project

Opening balances are additive adjustments, as requested. They do not reset the bank books, exclude older transactions, change subscription receipts, or create income/profit. No actual starting amounts are seeded by the application.

Use Opening adjustment on the relevant bank-book card. Select a currency through Filters first if needed. The form shows the existing balance, signed adjustment and resulting balance. Enter only the amount to add or subtract, not the full bank-statement balance. Positive values increase funds; negative values reduce funds and support a negative VISA balance. Zero and more than two decimal places are rejected.

Each adjustment records its date, reason, optional reference, bank book, amount and administrator in the existing immutable ledger. It can be searched, filtered as Opening balance adjustment, viewed and voided with a reason. Retries reuse a request UUID, and a bank-balance comparison under the write lock rejects stale previews. Existing unassigned manual entries remain unassigned for review.

Opening funds can fund transfers or recorded expenses, but do not create distributable founder profit. Income, expenses, founder contributions and profit allocations remain separate. The adjustment date is for history; all existing recorded movements continue to be included in balances.

Verification covers existing income plus opening adjustments without double counting, positive and negative amounts including negative fractions, unchanged profit/founder totals, stale-balance conflicts, duplicate retries, void history, opening-funded transfers and blocking profit allocations when opening cash is the only funding. The form checks include preview, selected account, cancellation and preserved drafts after failure. The rendered UI smoke test records an opening adjustment using in-memory data.


## Administrator attribution

Payment approvals and rejections retain the reviewing admin on the request.
Subscription payments retain the recording admin and receiving bank book.
Assignment, renewal, period edits, trial extension and access-status changes
record the admin who last changed the subscription; Office billing history
shows that name alongside the original assigning admin.

**Activity log** records successful Office changes and sign-ins from this
update onward, including actor name/email snapshots, timestamp and target.
Selected action fields are available through View action details; passwords,
tokens and image data are excluded. Support-tool approvals/rejections also
write to the same log. Older actions are not reconstructed or reassigned.

## Preserving a running installation

Use the [existing-database upgrade procedure](../../README.md#upgrading-an-existing-office-financial-book).
Take a full database backup and stop financial writes, including integrations
and background approval workers, before saving the verification snapshot.

| Migration | Existing-data behavior |
| --- | --- |
| `2026_10_24_000001_office_management` | Checks legacy book 2/settings 1, copies existing founder identities/shares, expands founder IDs, adds configurable books/default and assigns missing receipt books to 2. Existing monetary rows, dates and allocation snapshots are retained. |
| `2026_10_24_000002_add_subscription_access_actor` | Adds a nullable last-changing-admin reference. Existing actions are not attributed to a guessed admin. |
| `2026_10_24_000003_backfill_legacy_subscription_bank_books` | Fills only NULL receipt-book assignments with legacy book 2, including installations already upgraded. Repeated execution preserves assigned books and the current default. Its reversal does not clear historical assignments. |

From `laravel/`, run `php artisan office:financial-snapshot` before migrations.
After `php artisan migrate --force`, run the printed verification command with
`--verify=FILENAME.json`. Pass only the filename printed by the capture command.
Snapshots are stored under private `storage/app/office-financial-snapshots/` and
include original rows/checksums plus financial totals. They supplement, rather
than replace, the full database backup. Keep them out of public web storage.

Verification compares original records, per-currency cash/profit/income and
expenses, bank balances, monthly subscription income and founder totals. A NULL
receipt book and explicit legacy book 2 are considered financially equivalent.
A changed amount, date, original record or financial total fails verification.
Keep writes stopped until it succeeds. The management migration refuses a
rollback that would discard newer receipt routing or founder settings; use a
forward fix and the saved backup for recovery planning.

`OfficeBankBookMigrationTest` upgrades a populated isolated legacy database,
including multiple currencies, opening adjustments, transfers, expenses,
voided rows, contributions, payouts and paid/unpaid allocations. It verifies
unchanged original records, balances, profit, cash, founder shares and history;
checks repeat-safe backfill and rollback refusal; and detects altered financial
history through the snapshot command. `OfficeManagementTest` covers account
permissions, attribution, book/default changes and branding validation.

FounderSettingsPage.test.jsx covers total/share validation, adding and removing founders, exact versioned saves, reset/cancel without writes, conflict reload, error retry and duplicate-submit guards. Dashboard.test.jsx verifies the dedicated page and return without refetching the financial-book table.

## Founder page button and return-flow checks

Verified locally with mocked API responses; no live financial records were changed.

| Control | Handler and expected result | Observed verification |
| --- | --- | --- |
| Finance > Founders / Founder settings | Navigate to the dedicated founder page | Dashboard tests and browser fixtures; no modal opens. |
| Add founder | Append a draft row and focus its name | Component test and browser fixtures. |
| Row actions > Remove founder | Remove the draft row; archive the saved record only on Save | Component/browser checks; last remaining row cannot be removed. |
| Save founders | Check names and exact 100% total, then send one versioned update | Component/browser checks; invalid totals blocked, errors retain edits, duplicate submits blocked. |
| Reset changes | Restore saved rows and percentages without a request | Component/browser checks. |
| Cancel | Discard the draft and return to the previous page without a write | Component/browser checks. |
| Reload saved settings | Explicitly fetch current settings after a load/conflict error | Component tests; post-save reload failures block another save until reload succeeds. |
| App-bar Back / browser Back and Forward | Resume the previous retained screen | Dashboard and browser checks; same financial-book table, search, page 2, page size 10 and shared content scroll at 180px; no initial fetch or mount on unchanged return. |

A successful founder save refreshes the financial book's affected founder data
without resetting its query or navigation state. Shared content-container scroll
is retained alongside nested scrollers. Physical device Back was not tested;
browser history is shared with the app-bar Back control.
