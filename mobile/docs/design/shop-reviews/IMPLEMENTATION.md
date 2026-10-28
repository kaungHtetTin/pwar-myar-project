# Shop reviews

References: 085 reviews list, 086 reply editor and 124 right filter drawer. Routes remain `/shop/reviews` and `/shop/reviews/:id/edit`.

The list follows the reference Back/title/export/filter header, search, Matching reviews / Awaiting reply shown summaries, and compact review cards. Customer identity/date/type and green five-star rating appear together. Product reviews include the actual product name, current base-unit context and authenticated review-scoped photo, with a package fallback. Comments, rating-only states, awaiting-reply status, existing reply/date and permission-aware Reply/Edit reply remain available. Long customer/product names, replies and Myanmar text wrap naturally.

The full-page reply editor separates the original review, the saved reply snapshot and the editable Public reply section. It explains public visibility, shows the 2,000-character counter and makes blank-to-remove behavior explicit. Cancel/Back resume the retained list without restarting it. Save trims the reply, guards duplicate submission, preserves validation errors/draft and updates the retained editor snapshot from the response before returning. Reopening a just-saved reply therefore shows its saved context and correct removal warning. The source list reconciles after actual mutations while preserving filters/loaded-page scope.

The shared right drawer uses radio groups for type, stars, reply status, comment presence, date and sorting. All/Last 7 days/Last 30 days/Custom range retain the API's supported date filters, using business-local today for presets. Custom fields permit open-ended ranges. Reset changes only the filter draft; closing discards un-applied edits; Apply validates dates and commits. Search is preserved by filter Reset. Newest/oldest/highest/lowest sorting remains supported.

Export fetches all matching pages with the reviews API's 50-record page maximum, using applied search/filters rather than un-applied drafts. The shared CSV helper preserves formula escaping and download/share behavior. Exports include customer, review/product identity, current product unit, rating, comment, reply and real UTC creation/reply timestamps. Empty/error export notices remain recoverable.

## Intentional reference corrections

- Matching reviews is the API's filtered total. Awaiting reply shown counts only loaded, unreplied rows, including rating-only reviews; it is not represented as a whole-result total.
- The API permits replies to rating-only reviews. The screenshot's omission of a Reply action on one such card does not impose a new restriction.
- Existing reply text/date are shown only when the server supplies them. Shared business-time date formatting is retained instead of copying illustrative dates.
- The reply limit remains 2,000 characters. Empty replies continue removing an existing reply on explicit Save; an unreplied review may remain without a reply. Editing never changes the customer's rating/comment.
- Product context uses current product metadata, not an invented historical purchase snapshot. Photos are served through `/shop-admin/reviews/:id/photo`, scoped to the review's business/product and protected by the existing review-read permission; no catalog-management permission is added. Public buyer-review responses and write contracts remain unchanged.
- Shared compact controls and natural scrolling replace compressed frame spacing. At narrow widths, star ratings move below the identity text so real names remain readable. Native status chrome, actual records and unavailable photos deliberately differ from the reference fixtures.

## Controls and verification

Run `node scripts/check-shop-reviews-reference.cjs`; use `REVIEWS_BROWSER=firefox` for Firefox. All API reads and reply writes are intercepted fixtures. Screenshots/call records are under `artifacts/shop-reviews-reference/<browser>`. Final screenshots must be inspected beside the same-viewport references.

| Control | Expected / checked behavior |
| --- | --- |
| Back / Cancel | Resume the retained source route, applied filters, search, loaded rows and draft without an initial list fetch. |
| Search / Clear review search | Debounced bounded query and clear-to-unsearched scope. |
| Header/toolbar filters | Shared right drawer; Escape/close discard draft changes. |
| Type/stars/reply/comment/date/sort radios | Correct API values; native keyboard selection and visible focus. Custom dates validate before requesting. |
| Reset / Apply filters | Draft-only reset, preserved search and explicit application. |
| Reply / Edit reply | Open the correct context once; view-only staff receive no reply action. |
| Public reply / Save reply | Counter/limit, retained validation failure, guarded save, saved snapshot reconciliation and explicit blank removal. |
| Export reviews / notice dismiss | All matching pages within API limits; download current applied scope and retain page state. |
| Load more / Try again | Keep existing cards on failure; retry appends without duplicates. |

React tests cover draft cancellation/Reset, total-vs-loaded counts, date validation, duplicate-save prevention, error retention, source Cancel, saved-snapshot reconciliation/removal, permission-gated requests and export pagination. Laravel tests cover filters/sort/date boundaries, review permissions, public reply/removal, and tenant-scoped product context/photos. Browser checks cover all three mapped layouts at 320/393/768px, Myanmar/long content, app/browser Back/Forward drafts, save retry/removal, CSV, pagination retry, empty and restricted states. Native Android execution/share dialogs and real user product images are not exercised by these browser fixtures. No production build is run.

Completed: Chromium and Firefox checks passed. All 12 scoped frontend tests and 79 EcommerceApiTest feature tests passed, along with scoped ESLint and handoff validation. Final mapped screenshots and narrow Myanmar editor states were inspected; same-viewport comparisons are `artifacts/shop-reviews-reference/chromium/compare-085.png`, `compare-086.png` and `compare-124.png`. These document the corrections above rather than claiming a pixel-identical match.
