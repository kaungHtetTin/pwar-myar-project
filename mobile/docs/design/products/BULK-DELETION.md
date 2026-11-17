# Mobile bulk product deletion

Scope: PwarMyar mobile `/products`, using the existing Laravel
`POST /api/products/bulk-delete` contract. No database migration is needed.

## Feature parity inventory

- Product search, filters, sorting, summaries, endless pagination and swipe refresh
  remain in use. Single-product actions, full-page forms, import/export and barcode
  printing remain separate from bulk-delete selection.
- Select products enters a touch selection mode. Select loaded products covers
  only loaded eligible rows; additional pages can be loaded and selected. Selection
  is limited to 1,000 products and pending products cannot be selected.
- Select is an icon button beside Search and Filter, using the same control size
  and appearance as Filter. It toggles selection mode and exposes its pressed
  state. The product-count line has no duplicate Select action.
- Focusing Search expands it across the row and hides Filter, Select and barcode
  scan. Clear remains available and returns focus to the input, keeping it
  expanded. The buttons return when focus leaves. Selection is disabled while a
  changed search is waiting for its debounce/data refresh.
- Selection controls occupy one compact row, with a close action to leave the
  mode. Delete/Clear appear in a bottom action bar only after something is
  selected. The bar clears bottom navigation and the final row's scroll area.
  Import/print/export and Add are restored when leaving selection mode.
- Clear selection and Done selecting explicitly clear the selection. Search,
  category, stock, sort, barcode scope, user or business changes clear it as well.
- Confirmation uses the shared mobile destructive-action sheet. It explains
  archival/history preservation and skipped unfinished-order reservations.
- The selection review is paginated in bounded pages and has an independent
  scroll area so Delete and Cancel remain reachable for large selections.
- Confirmation sends one request. Only server-confirmed deleted IDs are removed.
  Skipped products remain selected and listed for retry, with counts and an
  explanation inside the sheet. All-skipped results leave inventory unchanged.
- Genuine errors stay inside the sheet and retain selection. Single-product
  reservation errors now use the same in-sheet feedback rather than a page notice
  behind the sheet. Admin authorization remains owned by the shared API client.
- Cancel, sheet close, Escape and device Back retain source selection and query
  state. Busy sheets reject dismissal; a synchronous guard prevents double writes.
- Confirmed deletions update the loaded list and known total immediately, adjust
  the next offset, and invalidate in-flight list responses. This prevents deleted
  rows reappearing or later pages skipping surviving products. Summary refresh is
  independent. Late mutation results cannot change another business's UI.
- English and Myanmar labels and result messages are supported; product names and
  codes are displayed as actual data.

## Button checks

| Control | Expected behavior | Verification |
| --- | --- | --- |
| Select products | Enable per-card selection | Component tests |
| Search focus / Clear / Blur | Expand the input, hide adjacent controls, retain focus on Clear, restore controls on blur | Component and browser checks |
| Individual checkbox / Select loaded | Retain selections across appended pages | Component tests |
| Clear selection / Done selecting | Clear without mutation | Component tests |
| Delete selected | Open confirmation without mutation | Component tests |
| Confirm delete | One bulk request; busy guard | Component tests with delayed response/double click |
| Cancel / Close / Escape | Preserve search and selected IDs; no source refetch | Component tests |
| Device Back | Dismiss failed confirmation, retain selection and restore trigger focus | Component test |
| Retry after skipped result | Submit only skipped IDs | Partial/all-skipped component tests |
| Review Load more | Append selected rows without unbounded initial rendering | Component test |
| Single Delete | Keep reservation error visible inside its sheet | Component test |

Layout changes are local to selection controls and the confirmation review.
Checkbox labels and new buttons have 44px touch targets. Cards reserve room for
the selection control. Long product names wrap within their copy column instead
of covering the checkbox. Compact typography, theme tokens and safe-area sheet
styles remain in use. The bulk confirmation omits the redundant target-count
card and end-of-list message, and uses shorter, equally sized action buttons.
Single-product confirmations retain their target identity card. No submission
form was moved into a sheet; this is the existing destructive confirmation pattern.

## Compact selection design verification

The in-app browser remains unavailable because of an environment metadata error.
The repository's local Chromium/Playwright test runner was used as a fallback,
with isolated storage and intercepted API fixtures; no real product was deleted.
`mobile/scripts/check-bulk-product-design.cjs` captures zero selection, selected,
confirmation, partial-result, resting-toolbar and focused-search states in English
and Myanmar at 320, 402 and 768px widths. Screenshots are in
`artifacts/mobile-bulk-design` and were visually
inspected. The toolbar is 48px tall; the selected action bar is 62px tall.

Browser checks cover actual checkbox taps with long names, horizontal overflow,
bottom-navigation clearance, confirmation review content, partial deletion,
retained skipped selection, clear/exit controls and the last loaded product's
visibility after scrolling. Myanmar selection counts use whole translated strings.
Physical-device touch/keyboard behavior and browser Back remain unverified.
Toolbar checks compare Search/Filter/Select alignment and the buttons' computed
size, border, radius, background and color. Search gains 110px on focus at each
tested width. The same checks verify hiding/restoring the controls and clearing
without losing focus. Toolbar-only previews are `toolbar-row.png` and
`focused-search-row.png` in the screenshot directory.

Verification on 2026-11-13: full `npm run lint` and production `npm run build`
passed. The full mobile suite passed after the toolbar/focus update: 147 test
files / 898 tests. The browser fixture checks passed all six width/language
combinations. Vite reports its existing large-bundle advisory.

Built output is `mobile/dist`; installing an updated APK is a separate packaging
step. No remote deployment or APK installation is included in this change.
