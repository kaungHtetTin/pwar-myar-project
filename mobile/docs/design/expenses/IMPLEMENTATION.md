# Expenses reference implementation

The expense list, new/edit forms, validation state and right filter drawer use the compact MKPOS theme. Routes and expense API contracts remain unchanged.

| Reference | Route/state | Comparison |
| --- | --- | --- |
| 040 | `/expenses` | [List](../../../artifacts/expenses-reference/comparison-040.png) |
| 041 | `/expenses/new` | [New expense](../../../artifacts/expenses-reference/comparison-041.png) |
| 042 | `/expenses/:id/edit` | [Edit expense](../../../artifacts/expenses-reference/comparison-042.png) |
| 117 | List filter drawer | [Drawer](../../../artifacts/expenses-reference/comparison-117.png) |
| 151 | Invalid new expense | [Validation](../../../artifacts/expenses-reference/comparison-151.png) |

## Behavior

- Compact Today/This month summary; existing filtered total and top category remain available through Spending details.
- Search, filter and CSV controls share one toolbar. Expense rows retain category, date, amount, payment method, note and the edit/delete action menu. Known transport, utilities and rent categories use purposeful icons.
- Forms retain date, free-entry category with suggestions, whole-number amount, configured non-credit payment methods and optional note. Errors retain drafts and identify invalid fields. Edit actions sit in the header; new expense actions sit below the fields.
- Filter radio selections are drafts until Apply. Existing date presets, category/payment choices, custom dates, Reset, Escape and backdrop dismissal remain supported in the shared native-dialog drawer.
- Back and Cancel use source-history navigation. New and edit submit targets use distinct form IDs so retained forms cannot intercept each other's header Save action.

## Verification

`node scripts/check-expenses-reference.cjs` runs against the dev server using intercepted fixture requests, with no live mutations. It captures all five references at 393x817 and responsive screenshots at 320 and 768 pixels, checks overflow, validation, failed-save draft retention, unchanged Cancel return without list refetch, edit PUT, delete cancellation, filter Apply/Reset, and search/clear. Myanmar index/drawer screenshots are included. See [results](../../../artifacts/expenses-reference/checks.json).

Expense screen/utilities and AppShell tests: 26 passed. Targeted ESLint passed. Production build intentionally skipped at the user's request. CSV generation and protected/unprotected delete requests retain existing implementations; deletion with/without Admin PIN is covered by existing expense unit tests. Browser/device keyboard presentation and physical Android Back were not tested on a device.

## Reference differences

Comparisons were inspected; these are not pixel-identical matches. Native date formatting and keyboard presentation vary by browser/device; the desktop capture does not reproduce the reference's painted phone keyboard or status bar. Real dates, `Ks` formatting and `#id` are retained rather than fabricated `EXP` references or forced `MMK` labels. Category remains free entry because the API supports arbitrary categories. The shared drawer retains additional existing presets, All choices and custom-date fields, so it scrolls. Existing notes, spending details, history heading, pagination feedback and bottom navigation remain available. The reference's claim that an expense edit recalculates stock/supplier balances is omitted because this is not the expense API's behavior. Shared theme borders, typography, focus indicators and control styling remain consistent with the app.
