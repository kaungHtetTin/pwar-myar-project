# Shop payment methods

References: 098 `/shop/methods`, 099 `/shop/methods/new`, and 100 `/shop/methods/:id/edit`.

The list follows the reference header/Add, introduction/count, cash/bank icon cards, receiving summary, Manual payment label, active state and overflow action. Overflow opens the shared action sheet with Edit and Delete. Delete uses the shared confirmation sheet, retains API errors for retry and preserves existing order records. Account summaries show the final four characters; editing always uses the original full account value.

Add/Edit follows the reference's section order: Method name, Payment type radio cards, Bank account details when transfer is selected, Payment instructions with counter, then Active status with a switch. Save method / Save changes and Cancel stay above shared bottom navigation. Shared compact MKPOS typography, green theme, radius tokens and controls remain in use. Pages scroll naturally; fields, focus and the final switch can scroll above fixed actions. Myanmar and long method/account names wrap without page overflow.

## Supported API behavior

No backend or payment-processing behavior was changed. Cash and manual bank/wallet transfer remain the supported types; provider is always manual. The API accepts custom bank/wallet names, so the reference's bank dropdown is a labeled text field rather than a fabricated bank directory. Receiving details retain their existing optional status; the form does not add required-bank/account constraints absent from the API. Method name and type remain required. Instructions retain the supported 2,000-character limit rather than the reference's 300-character example, preserving existing content. The method cap remains 20. Creation is blocked at capacity on the list and direct Add page.

Switching Cash/Bank transfer preserves the receiving draft until Save. The existing backend removes transfer-only fields when a Cash method is saved. At least one active method must remain; server errors for disabling/deleting the last active method stay visible and recoverable. Existing order payment snapshots and checkout availability continue using the same APIs. Permission, subscription and owner-location gates remain active.

## Controls and navigation

Add opens the new form. Card overflow opens the actions sheet; Edit opens the selected full-page form; Delete opens confirmation. Sheet close/Escape and confirmation Cancel never mutate. Confirmation Delete sends one request, retains a failure for retry, and reconciles the list after success. Cash/Bank transfer cards and the active switch support native pointer/keyboard interaction. Save submits only the supported fields once, retains values on failure and returns to the list on success. Back/Cancel resume the retained source list without a new initial fetch; Browser Forward restores the draft. Retained new/edit forms use unique field IDs and radio-group names.

## Verification

`node scripts/check-shop-methods-reference.cjs` checks 098/099/100 at 320/393/768 widths, full/masked account values, required-name validation, radio draft retention, Save failure/retry, active state, deletion Cancel/retry/last-active rejection, source retention, unique field IDs, footer clearance, the 20-method limit, long names, Myanmar forms/list and restricted states. Set `METHODS_BROWSER=firefox` for Firefox. All API mutations are intercepted fixtures.

Screenshots and verification records are in `artifacts/shop-methods-reference`. Final screenshots must be inspected beside the matching reference. Native OS status chrome, real records, shared compact styling, natural scrolling, supported free-text bank/wallet fields and the existing instruction limit are deliberate differences. React tests cover edit/save payloads, retained server errors, duplicate submission, capacity and receiving drafts. Existing Laravel payment tests check checkout filtering, immutable order snapshots, default cash behavior and tenant isolation. No production build was run.

Completed checks: Chromium and Firefox browser scripts passed, with 92 scoped frontend tests and 3 existing Laravel payment feature tests passing. Scoped ESLint and handoff validation passed. Final 098/099/100 screenshots and 320px Myanmar forms/status were inspected. Same-viewport comparisons: `artifacts/shop-methods-reference/compare-098.png`, `compare-099.png` and `compare-100.png`.
