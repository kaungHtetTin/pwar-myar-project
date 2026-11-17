# Office storefront controls

Business details → Customer storefront now includes an accessible Storefront enabled switch. The switch saves immediately through `PUT /api/office/businesses/{businessId}/storefront`, accepting only the `storefront_enabled` boolean. Existing storefront setup is required; missing setup returns 404. Active Office admins can use it. Business-owner sessions and inactive Office admins cannot use the Office endpoint.

The change updates only storefront enabled status and its timestamp. Marketplace participation, marketplace suspension/reason, order acceptance and other settings remain intact. The mutation and Office audit entry commit together; the audit includes the requested enabled value. Disabling prevents customers from opening the public shop; enabling is still subject to the existing subscription/business eligibility checks.

The switch shows saving feedback, blocks duplicate/concurrent storefront and marketplace saves, retains the previous value on failure, and supports retry. Saving updates the existing card from the server response while retaining the marketplace reason draft and detail-page scroll. The toggle supports mouse, Space and Enter, visible focus, and a 44px minimum touch height at narrow widths.

Successful storefront/marketplace changes notify the retained Shop distribution page to reconcile its filtered results and coverage counts. Returning to the map preserves its instance, position, filters, page size and pagination; the data reload is caused by the mutation, not by Back.

Verification after PwarMyar synchronization: 21 backend tests passed (461 assertions), and 34 focused Office UI/navigation tests passed. Full Office lint and production build passed. Intercepted browser fixtures at 1440px and 390px verified the toggle, map reconciliation, filters and published-product count. No live business records were changed. Screenshots and repeatable browser scripts are under `artifacts/` and `scripts/check-office-shop-distribution.cjs`.
