# Customer shop feature implementation

Additional feature: private customer shop reports and the Office review queue are implemented. Customers use the shop-header flag; Office uses **Shop reports**. See [reporting verification](test-artifacts/shop-reports/verification.md) for access rules, database rollout, controls and test evidence.

Completed scope: all twelve agreed additions. The teal shopping design, one-shop cart, authoritative checkout quotes, private guest tracking and existing payment/inventory/refund controls are preserved.

| Feature | Implementation | Verification |
| --- | --- | --- |
| Buy again | Current-price preview, adjusted quantities, confirmed cart replacement | API, component and browser checks passed |
| Product/shop favorites | Card hearts, shop save action, account lists and removal | API isolation, mutation/retry and browser checks passed |
| Multiple saved addresses | Address book, one default, checkout picker and retained-state updates | API, component and browser checks passed |
| In-app order notifications | Private updates inbox, unread badge, read controls and order links | API idempotency/isolation and browser checks passed |
| Cancellation requests | Customer request, immediate unpaid cancellation, staff review | API inventory/permission checks, retry and retained staff table checks passed |
| Catalog sorting/filters | Actual sale-price sorting, stock, sale, rating and price filters before pagination | API pagination/pricing and browser Back checks passed |
| Recently viewed products | Account-scoped local history, deduplication, clear action | Component and browser checks passed |
| Same-shop related products | Available same-category recommendations using current catalog data | API exclusion and browser checks passed |
| Customer receipts | Private order summary, escaped HTML download and print view | API privacy, component escaping and browser controls passed |
| Opening hours/announcements | Public service hours and announcement; staff weekly table and temporary checkout closure | API timezone/closure, staff component and browser checks passed |
| Back-in-stock alerts | Sold-out enrollment, account management, once-per-enrollment scheduler notifications | API scheduler/re-enrollment and browser checks passed |
| Return/refund requests | Private optional evidence, customer status/reply, staff approval and controlled resolution | API privacy/financial safeguards, component and browser checks passed |

All additions include responsive components and English/Myanmar customer copy. The additive migration was applied locally after a full database backup. Production deployment is outside this implementation goal. Back-in-stock updates require the Laravel scheduler; return approval uses the existing PIN-protected sale void and full manual-refund process.

See [verification and screenshots](test-artifacts/customer-features/verification.md) for controls, observed Back behavior, test evidence and testing limits.
