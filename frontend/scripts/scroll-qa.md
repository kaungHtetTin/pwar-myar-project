# Web document scrolling regression

The page retention layer adds `[data-retained-view]` elements inside `.module-view`. The old document-scrolling selectors required page roots to be direct children of `.module-view`, so retained pages kept their legacy viewport heights and hidden overflow. Products reproduced with 3,053px of content clipped inside a 663px section at a 1280×720 viewport.

`workspace-viewport.css` now accepts page roots inside retained frames, including nested customer/supplier frames. Existing unwrapped screens remain supported. The purchase main-panel exception follows the same wrapper-aware selector. No retention components or navigation handlers changed.

Run `node scripts/scroll-ui-smoke.cjs` from `frontend/`. It bundles the actual application with read-only synthetic API responses from `desktop-ui-smoke.py`, then uses a hidden Electron window. All writes are rejected by the fixture. Before the fix, it fails because Products overflow is hidden. After the fix it checks:

- Wheel input over the Products table scrolls the document.
- Customers → Products preserves the original table node and document scroll offset.
- The last product row and pagination footer can be reached; a screenshot is saved.
- Products, Customers, Suppliers, Purchases, Expenses, Transactions, Reports, Billing, Settings and Access page roots allow document overflow.
- Sell still locks the document, and returning to Products releases that lock.

Observed: all rendered checks passed, and the bottom-of-list screenshot was inspected. The focused Products, retained-view, keep-alive and table-style suites passed (34 tests); the production build passed. This verifies scrolling and the affected module navigation, rather than unrelated CRUD controls. The rendered check uses synthetic data at a desktop viewport; live merchant data and touch input were not exercised.
