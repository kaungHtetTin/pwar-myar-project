# Office shop reviews

Office > Shop reviews manages customer reviews across all shops. New, View, Edit and Delete use the shared modal over the mounted list. Shop reviews reuse the Product reviews UI and API behavior, scoped to `shop_reviews.target_id = 0`; product reviews remain separate (`target_id > 0`). No database migration is needed.

Creation requires an active customer with a completed ecommerce order from the selected shop, and allows one review per customer per shop. Shop and customer stay fixed during editing. Admins can change the 1–5 rating, optional customer comment and seller reply. These changes immediately affect the existing storefront review and rating summary. Deletion removes the review and its reply after confirmation.

The Office-authenticated `/api/office/shop-reviews` endpoints support list, options, create, show, update and delete. Updates/deletes use a version token to reject concurrent edits, including seller replies. Write routes are throttled. Options are searchable, scoped and capped at 25 matches.

Search covers shops, customers, comments and replies. Drawer filters include shop, rating, reply status, written/rating-only content, date range and sort. Shared table actions and Businesses-style pagination support 10/25/50/100 rows. Apply/Clear preserve search and page size. Section changes and browser Back retain existing list state and drafts without a return fetch.

## Verification

All mutations in rendered QA use in-memory fixtures; Laravel feature fixtures are rolled back. No live customer review was edited for QA.

| Controls | Handler and expected behavior | Observed / method |
| --- | --- | --- |
| Shop reviews navigation, browser Back | Resume Shop reviews with existing search and list, no initial fetch | Passed Dashboard integration test |
| Search shop reviews, clear search | Submit query/reset search while preserving other filters | Submit and clear passed UI tests |
| Refresh current page | Explicitly request the current list | Passed Dashboard integration test |
| New review, Shop, Customer, Rating, Save review | Load shop-scoped eligible customers, submit once without product identity | Passed UI tests and rendered Electron fixture |
| Actions for shop review, View/Edit/Delete review | Open corresponding modal over the same table | Passed UI tests and rendered fixture |
| Close, Cancel, Escape | Dismiss without writes and restore trigger focus | Passed UI tests |
| Save review, Delete review on failure | Retain draft/confirmation, retry; block duplicate save and busy dismissal | Passed UI tests |
| Filters, Apply filters, Clear, Escape | Apply/reset drawer-owned filters or dismiss drafts, preserving search and page size | Passed UI tests; Apply also rendered fixture |
| First, Previous, Next, Last, Rows per page | Shared pagination, boundary disabling and page-size reset | Passed UI tests |
| Section switch with modal draft | Hide/resume existing modal and draft without list fetch or remount | Passed UI tests and rendered fixture |

Options Retry and clearing the selected shop passed an additional UI test. Touch activation was not separately exercised. Existing shared modal/drawer backdrop and close-control behavior is unchanged. Rendered checks at 1440px and 1100px verified no page overflow and the global 80px action column; list and create-modal screenshots were inspected.

Checks: `OfficeShopReviewTest` (6), `OfficeProductReviewTest` (7), both review page suites (16), Dashboard suite (6), targeted ESLint, Office production build, and `node scripts/shop-reviews-ui-smoke.cjs`.
