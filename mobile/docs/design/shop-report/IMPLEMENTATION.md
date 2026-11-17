# Shop report

References: 087 overview, 125 right filter drawer and 165 breakdown continuation at `/shop/report`.

The report uses the reference Back/title/filter/export header, period/currency toolbar, four primary metrics, daily sales/orders chart, top products and compact summary cards. Expanded breakdowns continue below the overview with the resolved period/currency/order count, outcomes, origins, buyers, fulfillment, payment status, historical segments and inactive-customer follow-up. View details jumps to the relevant expanded section without navigating or reloading. Shared compact MKPOS controls, colors, typography and radius tokens remain in use. Content scrolls naturally above bottom navigation instead of being compressed into one frame.

The shared right drawer stages date/currency changes. Last 7 days and Last 30 days use business-local today; Custom supports explicit dates. Existing additional date presets remain under More date ranges. Reset restores the first resolved default scope in the draft; Apply is required. Closing/Escape/hardware Back discard un-applied edits. Both reversed ranges and ranges exceeding 366 days are rejected before requesting. Currency changes request a single currency scope. During failures, the previous report and its currency remain visible with Retry; the UI does not relabel stale amounts as the requested currency.

The chart combines completed-sales lines and completed-order columns using clearly labeled separate axes. Integer ticks keep the order scale readable. Show daily table exposes exact dates, amounts and order counts. Summary comparisons distinguish percent changes from percentage-point differences; zero baselines never produce invented growth. Metric info opens the actual definition, full comparison and previous value. Top products initially shows three of the API's up-to-ten rows; View all / Show fewer expands without fetching or losing state. Percentages describe shares of the listed product sales.

CSV export uses the displayed data and shared escaped CSV/browser/native export helper. It includes summary/previous-period values, daily sales/orders, product sales/quantities, outcomes/origins/buyers/fulfillment, historical segments, prepaid value and follow-up purchase/spend values, with unit/currency/date/timezone context. It does not silently run another differently scoped report. The API's existing top-ten-product and top-ten-follow-up limits still apply.

## Intentional reference corrections

- Completed sales includes delivery fees and excludes voided completed sales under the existing API; it is not renamed to unrestricted Total revenue. Product sales excludes delivery fees.
- Refunded order value and Paid order value describe the current payment status of orders placed during the selected period. They are not cash/refund transaction totals. Payment-method receipt breakdowns from 087 are not fabricated.
- Completion rate uses completed, non-voided orders divided by all orders placed during the period. It is not an independently measured delivery/fulfillment success rate. Actual delivery/pickup counts are added as a read-only report aggregation using the same business, date and currency scope; calculations and mutation behavior are unchanged.
- New/returning buyers are buyer counts, not order counts. Historical customer segments retain their existing cutoff and purchase definitions. Follow-up lists inactive repeat buyers rather than inventing chat awaiting-reply counts or a refunded-order follow-up queue.
- Average order value, cancellation rate, repeat-purchase rate and existing buyer comparisons remain available below the primary summary/in the expanded buyer section. They are preserved API information, not replacement headline metrics.
- The report does not expose product-photo URLs. Top products uses a consistent package fallback rather than requesting catalog-restricted images or showing invented photos.
- Natural scrolling, readable shared controls, real records/currency/dates and omitted native status chrome intentionally differ from the compressed illustrative frames. Long labels and Myanmar text wrap; narrow summary cards stack where needed.

## Controls and verification

Run `node scripts/check-shop-report-reference.cjs`; set `SHOP_REPORT_BROWSER=firefox` for Firefox. All API requests use intercepted fixtures and remain read-only. Screenshots/call records are in `artifacts/shop-report-reference/<browser>`. Same-viewport comparisons must be inspected before claiming visual acceptance.

| Control | Behavior / verification |
| --- | --- |
| Back | Resume My Shop/source; first-load errors retain Back. |
| Header filters / date control / filter icon | Open the shared drawer with resolved active scope. |
| Presets / dates / currency / Reset / Apply / close | Draft edits; valid business dates; draft-only Reset; explicit Apply; dismiss without a request. |
| Report currency / Retry | Currency-scoped request; failure retains correctly labeled old data; retry requests intended scope. |
| Metric info / Done | Actual definition, previous value and comparison; close without refetching. |
| Show daily table / Show chart | Exact daily values and accessible table remain available. |
| Product View all / Show fewer | Expand the loaded top-product list locally. |
| View details / Customer follow-up | Scroll to the corresponding section without a request or route change. |
| View customer | Open that buyer; app/browser Back and Forward retain the report's scope, loaded data and scroll without a new initial report fetch. |
| Export shop report / notice dismiss | Download/share a CSV of displayed data, with escaped cells and scope metadata. |

Frontend checks cover validation, draft Reset/dismissal, stale-data currency retry, first-load Back/retry, comparison math, business-local presets, table data and export escaping. Laravel ShopAnalyticsTest covers timezone/DST boundaries, currency and tenant isolation, voided-sale exclusion, history cutoffs, ranges, guest denial and the new fulfillment counts. Native Android execution/share dialogs and product images are not exercised by the browser fixtures. No production build is run.

Completed: Chromium and Firefox fixture checks passed at 320/393/768px, including all three mapped screens, full scroll, Myanmar, table/product expansion, filter controls, currency failure/retry, customer Back/Forward retention, CSV download, zero data, first-load failure and permission restriction. All 16 scoped frontend tests and 5 analytics feature tests passed. Scoped ESLint and handoff validation passed. Final screenshots were inspected beside same-viewport references; comparisons are saved as `artifacts/shop-report-reference/chromium/compare-087.png`, `compare-125.png` and `compare-165.png`. These document the intentional corrections above rather than claiming an exact pixel match.
