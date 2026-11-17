# Shared filter drawer initial focus

The iPhone screenshot supplied on 2026-10-18 shows a green focus outline on the close button immediately after opening Products filters. `MobileFilterPanel` explicitly focused that button. All filter drawers use this shared component, including Sell, Products, Purchases, Sales, Customers, Suppliers, Expenses, Transactions, Reports and the Shop modules.

Initial focus now goes to the labelled heading with `tabIndex={-1}` and `preventScroll`. Only this static heading suppresses its outline. Interactive controls retain their keyboard focus styles. Tab moves to Close; Shift+Tab moves to the final action. Focus trapping, native modal semantics and restoration to the opener remain intact. Shared import, barcode and picker drawers receive the same correction.

This intentionally removes the default close-button ring shown in the supplied image. Layout, typography, density, scrolling, business behavior and pinned actions are unchanged. Browser fixture screenshots omit native iPhone chrome and use synthetic categories/data.

Verification:

- `npm test -- src/components/MobilePrimitives.test.jsx`: 17 tests passed. Includes initial heading focus, forward/reverse keyboard entry, focus trapping, retained draft/source element, reset failure, close/backdrop, native cancel, Escape, browser popstate, hardware Back, Apply and Reset. Dismissal does not submit; closing restores opener focus.
- `npm run lint`: passed.
- `npm run build`: passed with the existing bundle-size warning.
- `node scripts/check-filter-drawer-focus.cjs`: Chromium and WebKit at 393px and 320px passed initial focus, visible keyboard focus, forward/reverse entry, Escape, Close, Reset and Apply checks. Requests are intercepted; no live data is changed.
- Inspected final screenshots in `artifacts/filter-drawer-focus`: normal opening, keyboard focus, bottom scroll continuation and narrow Myanmar content. The close icon is plain on opening and outlined when reached by Tab; final stock options remain above the pinned actions after scrolling.

The automated component tests cover Back event handling; physical iPhone/device Back and individual module-specific filter payloads were not manually retested for this shared focus correction.
