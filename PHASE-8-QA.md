# Phase 8 automated test and QA evidence

Date: 2026-08-21  
Result: Complete

## Laravel

- Registration tests cover session and token authentication, a single active automatic trial, idempotency, rollback, and no retroactive grants.
- Calendar-month tests cover leap-year February, non-leap February, and a 30-day month reached from a 31-day month.
- Trial POS coverage creates a product, customer, and sale, then reads reports, settings, and data status without creating subscription payment or Office revenue.
- Backup export and restore return the paid-only `403` capability contract during trial; data status remains available.
- Trial plans remain hidden and protected. Paid conversion preserves unused trial time and unlocks export and restore.
- Exact expiry returns the existing `402` subscription-required contract for owners and staff. The pre-expiry offline-sale synchronization policy remains covered.

Primary evidence: `TrialRegistrationApiTest`, `SubscriptionEntitlementContractTest`, `DataBackupApiTest`, `TrialToPaidConversionTest`, `TrialSubscriptionSchemaTest`, `PosApiTest`, and `SubscriptionApiTest`.

## Web and Windows desktop

- The trial banner asserts the server-provided end date, remaining days, paid-only explanation, accessible status semantics, owner Billing action, compact media rule, and visible keyboard focus.
- Settings tests cover disabled backup and restore controls with the paid-plan explanation.
- Normal and download request paths preserve structured trial restriction errors and publish entitlement updates.
- Owner and staff expiry experiences are tested separately.
- Desktop tests cover exact offline expiry and queued-sale behavior; the desktop production renderer build succeeds.

Primary evidence: `TrialBanner.test.jsx`, `TrialBannerResponsive.test.js`, `SettingsScreen.test.jsx`, `SubscriptionScreen.test.jsx`, `StaffSubscriptionBlocked.test.jsx`, `api.test.js`, and the desktop Node test suite.

## Mobile

- Registration enters the returned active-trial workspace.
- Live `402` entitlement events open a stable global owner gate; app configuration no longer reloads for subscription-only session changes.
- Structured normal/download errors retain the trial restriction message and code.
- Banner tests cover accessible status content, exact end date, phone/wide layouts, 44px touch height, and keyboard focus.
- Shared-shell pull refresh, connectivity/resume entitlement refresh, backup/restore restrictions, protected restore deep links, and offline exact-boundary expiry are covered.

Primary evidence: `AuthScreen.test.jsx`, `App.test.jsx`, `client.test.js`, `TrialBanner.test.jsx`, `TrialBannerResponsive.test.js`, `AppShell.test.jsx`, `SettingsTrial.test.jsx`, and `offlineStore.test.js`.

## Office

- Trial, paid, expired, cancelled, and missing states remain distinct, with trial counts separated from paid counts.
- Business detail/history presentation uses “Free trial” and “Trial”, shows dates and remaining days, explains conversion, and does not expose renewal for a trial.
- Responsive detail-grid rules and visible keyboard focus for subscription controls are under an automated CSS contract.
- Backend tests prove trials add no payment/revenue, paid assignment/approval converts correctly, and the system plan cannot be publicly purchased, renewed, edited, or deleted.

Primary evidence: `subscriptionUi.test.js`, `TrialRegistrationApiTest`, `TrialToPaidConversionTest`, `TrialSubscriptionSchemaTest`, and `SubscriptionApiTest`.

## Final verification

| Area | Result |
| --- | --- |
| Laravel | 52 tests passed |
| Web | 94 tests passed; lint passed; web and desktop renderer builds passed |
| Mobile | 141 tests passed; lint passed; production build passed |
| Desktop shell | 15 tests passed |
| Office | 13 tests passed; lint passed; production build passed |

The production builds only report the existing Vite chunk-size advisory.

## Visual QA limitation

The in-app browser runtime rejected initialization because required `sandboxPolicy` metadata was absent, before any page could be opened. Therefore no browser screenshots were produced. Responsive and accessibility acceptance was completed through rendered component tests, semantic-role assertions, keyboard-focus rules, touch-target rules, responsive CSS contracts, lint, and production builds. A screenshot pass can be repeated when the browser connector is available without changing the Phase 8 implementation.
