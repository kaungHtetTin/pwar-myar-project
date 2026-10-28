# Reports module implementation

References 046, 119, 156 and 160–162 guide `/reports`. The revised acceptance rule prioritizes compact MKPOS consistency, real data and usability over reproducing a screenshot's compressed frame.

## Layout and behavior

- One page scrolls naturally through profit, six period metrics, cash movement, FOC, current inventory/accounts, sales trends and breakdowns. Section shortcuts jump below the sticky page header. Shared bottom navigation retains clear end-of-page space.
- Forest-green theme, shared icons, radii, focus states, native date controls and the common right drawer are retained. At narrow widths the six metrics use two columns; larger phone widths use three. Long amounts and translated labels wrap instead of disappearing behind ellipses.
- The drawer provides Today, This week, This month, Last month, This year, All time and Custom. Presets and dates are drafts; Reset restores today's draft. Apply validates complete/ordered dates and commits the displayed period/export scope only after the request succeeds. Escape, close and backdrop cancel unfinished edits.
- Refresh retains results, period and trend selection. Failure displays an inline error, last successful update time and Retry. First loading, first-load failure, zero data and export busy/failure are distinct states. CSV uses the existing authenticated download and platform save/share flow, with duplicate export guarded.
- Monthly/yearly trend controls switch existing API datasets. Charts scroll horizontally within their card; compact axis values, full accessible bar labels and an expandable exact-value table retain access to every amount.
- Existing keep-alive navigation retains report data, date scope, chart selection and scroll across Back/Forward, without an unchanged-return request. No backend/schema change is needed.

## Intentional departures from reference frames

The overview is not compressed into one screen. Continuation references describe lower sections of the same scrollable page; all real cash-flow components, current account directions, FOC received and purchase totals remain available. Cards do not show decorative chevrons without a destination. Product photos/pack sizes are not fabricated because the report endpoint only returns names and quantities.

The API does not provide previous-period comparisons, opening cash or arbitrary daily/weekly reporting aggregation. Those reference example figures/controls are omitted. Existing month/year trend tabs remain functional. Currency is the shop's currency, displayed as read-only context rather than an unsupported currency selector.

Cost of goods is reconstructed from the API's existing identity: sales minus net profit estimate minus expenses. The existing percentage helper is labeled **net margin**, since profit already excludes expenses. Cash net movement and expected drawer use the existing API figures; the page explains that opening cash is excluded. Current inventory/accounts use their own as-of dates and do not pretend to be historical date-filtered balances.

Payment-method primary amounts use the supplied `paid_total`; each row retains its sales total and receipt count. The paid/credit visualization uses actual sales payment and credit amounts. Financial calculations, currency precision, permissions and server filtering remain unchanged.

## Visual evidence and verification

`node scripts/check-reports-reference.cjs` uses the dev server, a fresh browser context and intercepted fixture APIs. It performs no live mutations. Set `REPORT_BROWSER=firefox` for Firefox. Captures normalize reference device chrome and compare the same 393 × 817 viewport, with additional 320/768-width captures, a full page, loading, zero-data and Myanmar states.

| Reference | Comparison |
| --- | --- |
| 046 overview | [Overview](../../../artifacts/reports-reference/comparison-046.png) |
| 119 drawer | [Filters](../../../artifacts/reports-reference/comparison-119.png) |
| 156 refresh failure | [Retained report](../../../artifacts/reports-reference/comparison-156.png) |
| 160 cash movement | [Cash](../../../artifacts/reports-reference/comparison-160.png) |
| 161 inventory/trends | [Current balances](../../../artifacts/reports-reference/comparison-161.png) |
| 162 breakdowns | [Breakdowns](../../../artifacts/reports-reference/comparison-162.png) |

Browser checks cover responsive overflow, all report controls, filter drafts/cancellation/validation/Apply/Reset, chart switching, scoped CSV download, refresh/retry, retained Back/Forward data/selection/scroll and English/Myanmar. Final screenshots are visually inspected, with the intentional differences above. Behavioral tests do not constitute a pixel-match claim. Production build is skipped as requested; physical Android keyboard/device and native share behavior are not exercised by browser fixtures.

Verification: 41 report/shared-drawer/AppShell tests passed; targeted ESLint passed. Chromium and Firefox dev-server runs passed. Handoff validation passed for 193 components and 294 local links. Browser results: [Chromium](../../../artifacts/reports-reference/checks-chromium.json), [Firefox](../../../artifacts/reports-reference/checks-firefox.json).
# Filter readability correction (2026-10-16)

Date presets now use the user-preferred Transactions radio-list presentation through the reusable DateRangeChoices component. All seven supported report ranges remain available, with their actual calculated start/end dates aligned on the right. Native radios support keyboard selection and share the drawer focus/selected styles. This replaces the earlier two-column preset correction. From/To now use shared Field/Input components, with one border and the real native date-picker icon. Full-width date fields intentionally depart from reference 119's side-by-side dates so localized values and picker affordances fit at 320px. Drawer body scrolling and pinned Reset/Apply remain unchanged; business filtering behavior is preserved.

Verification: all 12 report tests, lint and production build passed. Chromium and Firefox fixture checks cover presets, draft cancellation, date validation, Reset/Apply, CSV, refresh/retry and retained Back/Forward state. Screenshots were inspected at mobile widths, including Myanmar at 320px and the end of the drawer on a 320×568 viewport. Browser checks verify seven readable radio rows, complete-width date inputs, focus above the footer and final-content scroll clearance. The short viewport checks model reduced keyboard space; physical Android keyboard behavior was not exercised.


## Report period toolbar consistency

The report period now uses a standard 12px shared field label above the control row. The date range is a shared secondary Button with calendar/chevron icons, regular control typography and the shared radius/border/focus styling. The filter icon keeps the same aligned 44px target; the row uses an 8px gap. This replaces the custom two-line label inside a plain button, which gave the caption an inconsistent weight and the controls inconsistent sizing. Date presets and Apply/Reset behavior are unchanged. The period trigger exposes its drawer target/expanded state and opening/dismissing it does not fetch report data.

Chromium and Firefox report fixture checks passed, including 320/362/768px control alignment, filters, validation, retained navigation, CSV, refresh failure/retry and Myanmar. Inspected final 320px and Myanmar report screenshots against the supplied toolbar example; moving the caption above is intentional to follow shared field hierarchy. Lint and production build passed.
