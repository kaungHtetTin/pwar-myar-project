# PwarMyar One-Month Free Trial Roadmap

Status: Phase 9 implementation and rehearsal complete; production rollout pending  
Created: 2026-08-20

## Objective

Automatically give every newly registered business one calendar month of free PwarMyar access.

During the trial, users can use the normal POS features but cannot:

- Download/export a business backup.
- Restore business data from a backup.

This plan treats the trial as a server-controlled subscription entitlement so the same rules apply to the web app, Windows desktop app, mobile/Android app, Office administration app, and direct API requests.

## Scope assumption

“Download data” refers to the business backup download in **Settings → Data**.

The following remain available during the trial unless the policy is changed later:

- Report CSV exports.
- Receipt viewing and printing.
- Normal POS operations.
- Offline product caching and offline sales while the trial is valid.

## Entitlement rules

| Account state | Main POS | Billing | Backup download | Data restore |
| --- | ---: | ---: | ---: | ---: |
| Active trial | Yes | Yes | No | No |
| Active paid plan | Yes | Yes | Yes | Yes |
| Expired or cancelled | No | Owner renewal flow only | No | No |
| Staff account | Inherits business entitlement | No | No | No |

Existing businesses without a subscription will not automatically receive a trial. This prevents old or intentionally blocked accounts from being activated unexpectedly. Office administrators can handle those businesses manually.

## Phase 1: Confirm the trial contract

Status: Complete (2026-08-20)

Extend the subscription response with stable entitlement information:

- `access_type`: `trial` or `paid`.
- `is_trial`: convenience boolean.
- `starts_at` and `ends_at`.
- `server_now` for consistent client countdowns.
- `days_remaining`, calculated by the server.
- `capabilities.data_export`.
- `capabilities.data_restore`.
- A lifecycle notice code such as `trial_active`, `trial_ending`, or `trial_expired`.

Use one calendar month rather than a fixed 30-day approximation. For example, a trial beginning on August 20 ends on September 20. Store timestamps in UTC and display them in the business timezone.

### Acceptance criteria

- Every client receives the same entitlement type, dates, capabilities, and lifecycle state.
- Client device time is not used as the authoritative online entitlement clock.
- Paid subscriptions remain backward-compatible with the existing API contract.

### Implemented contract

The existing `is_valid`, `reason`, `subscription`, and `pending_request` fields remain unchanged. The subscription response now also includes:

```json
{
  "access_type": "trial",
  "is_trial": true,
  "starts_at": "2026-08-20T10:00:00.000000Z",
  "ends_at": "2026-09-20T10:00:00.000000Z",
  "server_now": "2026-08-20T10:00:00.000000Z",
  "days_remaining": 31,
  "capabilities": {
    "data_export": false,
    "data_restore": false
  },
  "notice_code": "trial_active"
}
```

Lifecycle codes are `trial_active`, `trial_ending`, `trial_expired`, `no_subscription`, `subscription_expired`, `subscription_cancelled`, `subscription_not_started`, and `subscription_inactive`. An active paid subscription has a `null` notice code because no lifecycle warning is required.

## Phase 2: Add trial-aware subscription records

Status: Complete (2026-08-20)

Create a Laravel migration that:

- Adds trial/paid classification to business subscriptions.
- Adds system/public classification to subscription plans.
- Creates a hidden, non-purchasable system trial plan.
- Defaults existing subscription records to `paid`.
- Prevents the system trial plan from appearing in client plan selection.
- Keeps trial grants out of payment and revenue records.

The trial should remain a normal subscription record for history and auditing, but it must not create a subscription payment.

### Acceptance criteria

- Existing paid subscriptions behave exactly as before.
- The system trial plan cannot be purchased, edited into a normal plan, or accidentally deleted through Office.
- Trial records are visible in business subscription history but not billing payment history.
- The migration does not grant trials retroactively.

### Implemented schema

- `business_subscriptions.access_type` persists `trial` or `paid` and defaults existing/new ordinary records to `paid`.
- `subscription_plans.is_system` distinguishes application-owned plans.
- `subscription_plans.is_public` controls client purchase visibility.
- The reserved `free-trial` system plan is zero-price, disabled, non-public, and protected from Office update, deletion, and manual assignment.
- Public plan listing and payment requests require active, public, non-system plans.
- Trial records appear in Office subscription history but create no billing-history or revenue record.

## Phase 3: Grant the trial during registration

Status: Complete (2026-08-20)

Update registration so the business, owner, default settings, price rules, and trial subscription are created in one database transaction.

Required behavior:

- Both session-based registration and token-based registration receive the trial.
- Registration returns an active trial subscription immediately.
- Trial start and expiration are calculated by the server.
- A business cannot receive a second automatic trial.
- Any failure rolls back the complete registration.

### Acceptance criteria

- The registration response contains `subscription.is_valid = true` and `access_type = trial`.
- The new owner can enter the POS immediately.
- Exactly one trial subscription exists for the new business.
- No payment or revenue entry is generated.

### Implemented registration behavior

- Session and token registrations grant the same active trial entitlement.
- The grant runs inside the existing business/owner/settings registration transaction.
- Trial duration uses `addMonthsNoOverflow`, so January 31 correctly ends on February 28 or 29.
- Trial creation is idempotent and locks the business record before checking for an existing lifetime trial.
- Missing or invalid system trial configuration rolls back the entire registration.
- Trial creation writes no subscription payment or revenue record.

## Phase 4: Enforce paid-only backup and restore

Status: Complete (2026-08-20)

Laravel must be the authoritative enforcement layer. Client-side disabled buttons are for usability, not security.

Route behavior:

- Keep `GET /api/data/status` available during the trial so clients can render the Data page and explain the restriction.
- Restrict `GET /api/data/export` to subscriptions with the data-export capability.
- Restrict `POST /api/data/restore-file` to subscriptions with the data-restore capability.
- Return HTTP `403` with a stable code such as `trial_feature_restricted` for a valid trial attempting a paid-only feature.
- Include the denied capability and current subscription metadata in the error response.
- Continue returning HTTP `402` when the whole subscription is expired, cancelled, or missing.

### Acceptance criteria

- Direct API requests cannot bypass the restriction.
- The restriction applies to every user belonging to the trial business.
- Paid owners can export and restore as before.
- Trial users can still view database status and record counts.

### Implemented enforcement

- The active-subscription middleware keeps missing, cancelled, and expired subscriptions on the existing HTTP `402` contract.
- A reusable subscription-capability middleware enforces `data_export` and `data_restore` before backup controller code runs.
- Valid trials receive HTTP `403` with `code`, denied `capability`, and the complete current `subscription` entitlement payload.
- `GET /api/data/status` remains available to an active trial owner, including current-business record counts.
- Capability checks run before the owner-only gate on export and restore, so direct requests from any trial-business user receive the same restriction.
- Active paid owners retain the existing export, validation, PIN, safety-backup, and restore behavior.

## Phase 5: Convert trials to paid subscriptions correctly

Status: Complete (2026-08-21)

When Office approves a paid request during an active trial:

- Convert access to paid immediately so backup and restore unlock immediately.
- Preserve unused trial time.
- Calculate the paid end date from the later of the current time or the existing trial end.
- Cancel the old trial record without deleting its history.
- Record only the paid plan as revenue.
- Prevent Office’s generic renewal action from renewing the hidden trial plan.

The subscription service must prioritize the currently valid entitlement rather than selecting a record only because it has the latest end date.

### Acceptance criteria

- Paying before trial expiry does not discard unused trial days.
- Backup and restore unlock as soon as payment is approved.
- Office financial reports do not count free trials as sales.
- Trial history remains available for auditing.

### Implemented conversion behavior

- Approval and manual paid assignment use the shared transaction-safe activation flow.
- Approval locks the pending request and business rows so repeated or concurrent review cannot create duplicate paid periods or revenue.
- Paid access starts immediately, while its end date is calculated from the later of server time or the active trial end plus the paid plan duration.
- The converted trial is cancelled without changing its original start or end timestamps, preserving Office audit history.
- The new subscription is explicitly classified as `paid`, so backup and restore unlock in the approval response.
- Only the paid subscription creates a payment; Office financial reports therefore exclude free trials.
- Generic renewal selects only non-system paid subscriptions and rejects a trial-only business without writing revenue.
- Entitlement selection prioritizes currently valid subscriptions and then paid access, rather than choosing an invalid record solely because it ends later.
- Office hides the generic renewal action while the current entitlement is a trial.

## Phase 6: Add shared trial lifecycle notifications

Status: Complete (2026-08-21)

Use a persistent entitlement banner for trial state. Temporary success/error notifications remain separate.

Recommended lifecycle:

| Time/state | Notification treatment |
| --- | --- |
| Registration complete | “Your one-month free trial is active.” |
| More than 14 days remaining | Compact informational trial banner |
| 14 or 7 days remaining | Renewal reminder |
| 3 or 1 day remaining | Warning banner |
| Trial expired | Owner renewal screen; staff access-blocked screen |

Every active-trial banner should show:

- Exact expiration date.
- Remaining days.
- A short statement that backup and restore require a paid plan.
- A Billing action for the owner.

Refresh entitlement state on:

- Login and registration.
- App startup.
- Browser or native app resume.
- Connectivity recovery.
- Shared swipe-to-refresh on mobile.
- Subscription-related API errors.
- Successful Office approval or client payment request refresh.

Native push notifications, SMS, and email are outside the first release because the repository does not currently contain a delivery infrastructure for them.

### Implemented lifecycle system

- The subscription contract now includes a persistent `lifecycle_notice` object while retaining the backward-compatible `notice_code`.
- Notice data contains a stable code, lifecycle stage, severity, title, message, exact UTC expiration, server-calculated remaining days, restricted capabilities, and a Billing navigation action.
- Active trials deterministically transition through `active` (more than 14 days), `reminder` (4–14 days), and `warning` (1–3 days); expired trials use the `expired` stage.
- Registration responses immediately include the active one-month-trial notice.
- Missing, cancelled, expired, and not-yet-started paid states also receive structured persistent notice data; active paid access has no lifecycle warning.
- Web and the inherited Windows desktop renderer refresh the authenticated entitlement on startup, login/registration, visible resume, connectivity recovery, subscription API errors, and payment-request updates.
- Mobile performs the same entitlement refresh on startup, login/registration, visible/native-app resume, connectivity recovery, subscription API errors, payment-request updates, and its shared swipe-to-refresh flow.
- Office already reloads business entitlement, request, and financial data after a successful approval action.
- Phase 7 remains responsible for client-specific banner presentation, localized copy, Billing labels, and paid-feature control states.

## Phase 7: Update all client applications

Status: Complete (2026-08-21)

### Web business app

- Add the persistent trial banner to the authenticated application shell.
- Label the current subscription as “Free trial” in Billing.
- Show the expiration date and remaining days.
- Disable backup download and restore controls during a trial.
- Display the paid-feature explanation and a Billing action.
- Handle `trial_feature_restricted` consistently in normal and download requests.
- Continue using the existing expired-subscription owner and staff screens.

### Windows desktop app

- Inherit the web trial UI through the bundled frontend renderer.
- Include trial metadata when caching the authenticated offline session.
- Stop creating new offline sales after the entitlement expires.
- Keep pending offline invoices visible so they are not silently lost.
- Define a safe synchronization policy for invoices created before expiration.

Recommended synchronization policy: permit pending sales created before the trial expiration to synchronize for a short post-expiry safety window, while preventing new sales after expiration.

Implemented policy: invoices created before the trial end may synchronize for 7 days after expiry. The server validates both the recorded invoice creation time and the grace deadline. New offline invoices are blocked at the cached entitlement boundary, while existing pending and failed invoices remain visible. The window is configurable with `MKPOS_TRIAL_OFFLINE_SYNC_GRACE_DAYS`.

### Mobile web and Android app

- Add a global subscription gate; mobile currently lacks parity with the web root gate.
- Add centralized handling for HTTP `402` subscription responses.
- Add centralized handling for `trial_feature_restricted` responses.
- Render the persistent trial banner inside the shared authenticated app shell.
- Refresh session entitlement through the shared swipe-to-refresh flow.
- Disable backup download and restore on the Data page during a trial.
- Prevent the `/settings/data/restore` deep-link from bypassing the restriction.
- Keep payment requests on the existing dedicated full-page route.
- Provide localized and accessible loading, warning, blocked, and error states.

### Office administration app

- Add distinct Trial, Paid, Expired, Cancelled, and No Subscription statuses.
- Show trial start, trial end, and days remaining in business lists and details.
- Separate trial businesses from paid active businesses in dashboard counts.
- Exclude trials from subscription revenue and paid sales totals.
- Make trial-to-paid conversion clear during plan assignment and approval.
- Prevent accidental trial renewal or system-plan editing.

### Phase 7 implementation summary

- Web and the inherited Windows renderer now show the persistent server-driven trial banner, distinguish Free trial in Billing, and disable paid-only data actions with an owner Billing route.
- Web and mobile normal/download API clients preserve structured subscription error codes and immediately publish refreshed entitlement data.
- Desktop and mobile offline authorization use the cached trial expiry. Desktop retains queued invoice counts after expiry and the backend enforces the 7-day pre-expiry invoice sync policy.
- Mobile now has owner renewal and staff blocked gates, a localized shared-shell trial banner, restricted Data controls, and a protected restore deep link; payment requests remain full-page routes.
- Office now distinguishes Trial, Paid, Expired, Cancelled, and No Subscription, exposes trial timing in list/detail views, separates dashboard counts, and explains trial conversion without offering renewal.

## Phase 8: Automated tests and QA

Status: Complete (2026-08-21)

### Laravel tests

- Session-auth registration creates one active trial.
- Token-auth registration creates one active trial.
- Calendar-month behavior works at month ends and in leap years.
- Main POS endpoints work during the trial.
- Backup export returns the paid-only `403` response during the trial.
- Restore returns the paid-only `403` response during the trial.
- Data status remains accessible.
- The trial plan is absent from public plan lists.
- A trial creates no payment or revenue record.
- Paid conversion preserves unused trial time.
- Paid conversion unlocks backup and restore.
- Expiration at the exact boundary returns the existing subscription-required response.
- Staff inherit the business restriction.
- Existing businesses are not granted trials by the migration.

### Web and desktop tests

- Trial banner displays the correct date and remaining time.
- Backup and restore controls are disabled with an explanation.
- Direct paid-feature errors render consistently.
- Expiration switches owners and staff to their correct blocked experiences.
- Desktop offline access stops at entitlement expiry.
- Pre-expiry queued invoices follow the approved synchronization policy.

### Mobile tests

- Registration enters an active trial workspace.
- Global `402` handling opens the subscription gate.
- Trial restriction errors do not appear as generic failures.
- The trial banner remains accessible at phone and wider viewports.
- Swipe refresh updates both app configuration and subscription state.
- Backup download is disabled.
- The restore route cannot be used during a trial.
- Trial expiry is respected by the offline cache.

### Office tests

- Trial badges and counts are correct.
- Trial businesses do not affect revenue.
- Business details show trial history.
- Assigning or approving a paid plan performs the correct conversion.
- System trial plans cannot be purchased, renewed, or deleted accidentally.

### Phase 8 implementation summary

- Expanded Laravel coverage for leap and non-leap month ends, a real trial POS transaction, revenue exclusion, exact owner/staff expiry, and paid restore access.
- Expanded web and desktop coverage for exact banner timing, structured normal/download restriction errors, separate owner/staff blocked experiences, offline expiry, and queued-sale policy.
- Expanded mobile coverage for registration handoff, stable live `402` gating, structured restriction errors, phone/wide banner contracts, restore deep links, and exact offline expiry.
- Corrected the mobile entitlement-event race so a subscription-only update no longer triggers an app-config loading flash.
- Added Office trial detail/history presentation contracts, conversion guidance, renewal protection, responsive rules, and keyboard-focus coverage.
- Completed all regression suites, lints, and production builds. Detailed evidence and the unavailable in-app browser limitation are recorded in `PHASE-8-QA.md`.

## Phase 9: Migration rehearsal and staged rollout

Status: Implementation and rehearsal complete (2026-08-21); production rollout pending authorization

Introduce configuration controls such as:

- `TRIAL_ENABLED=true`.
- `TRIAL_MONTHS=1`.
- An optional offline synchronization grace period.

Rollout order:

1. Back up the production database.
2. Rehearse the migration against a production-like database copy.
3. Deploy the backend migration and entitlement contract.
4. Deploy Office updates.
5. Deploy the web/desktop client update.
6. Deploy the mobile/Android update.
7. Enable automatic trial grants.
8. Register test businesses through each authentication mode.
9. Verify trial expiry and paid conversion using controlled dates.
10. Monitor registration failures, `402` responses, paid-feature `403` responses, and subscription conversion errors.

Disabling the feature flag should stop future automatic grants without invalidating trials already issued.

### Phase 9 implementation summary

- Added `TRIAL_ENABLED`, `TRIAL_MONTHS`, `TRIAL_OFFLINE_SYNC_GRACE_DAYS`, plan-slug, and dedicated monitoring controls with legacy environment-name fallbacks.
- Proved that disabling future grants preserves existing trials and that duration overrides apply only to newly created trial terms.
- Added `trial:rollout-check` for schema, migration, hidden-plan, configuration, duplicate-trial, and subscription-count validation.
- Added structured monitoring for registration failures, subscription `402` responses, paid-feature `403` responses, and conversion failures.
- Added guarded PowerShell tooling for source backup, isolated production-like database rehearsal, rollback, repeated migration, staged client builds, and Android synchronization.
- Completed a local forward/rollback/forward MariaDB rehearsal and fixed the dump/import JSON-check rollback defect it exposed.
- Completed all local deployment artifact stages and regression suites. Production activation remains pending because no production target or deployment authorization was supplied. See `PHASE-9-ROLLOUT.md` and `PHASE-9-EVIDENCE.md`.

## Implementation checklist

- [x] Confirm the download-data scope.
- [x] Confirm one calendar month as the trial duration.
- [x] Confirm the offline-sale synchronization grace policy (7 days for pre-expiry invoices).
- [x] Add trial-aware schema and hidden system plan.
- [x] Create the trial during registration.
- [x] Extend the subscription entitlement response.
- [x] Add server-side data-export capability enforcement.
- [x] Add server-side data-restore capability enforcement.
- [x] Implement trial-to-paid conversion rules.
- [x] Add shared lifecycle notice data.
- [x] Update the web application.
- [x] Update the Windows desktop behavior.
- [x] Update the mobile/Android application.
- [x] Update the Office administration application.
- [x] Complete automated backend and client tests.
- [x] Complete responsive and accessibility QA.
- [x] Rehearse the migration and rollback controls.
- [ ] Perform the staged production rollout.

## Current repository areas involved

- `laravel/app/Http/Controllers/Api/AuthController.php`
- `laravel/app/Services/SubscriptionService.php`
- `laravel/app/Http/Middleware/EnsureActiveSubscription.php`
- `laravel/app/Http/Controllers/Api/DataBackupController.php`
- `laravel/app/Http/Controllers/Office/BusinessSubscriptionController.php`
- `laravel/routes/api.php`
- `laravel/database/migrations/`
- `frontend/src/main.jsx`
- `frontend/src/components/SubscriptionScreen.jsx`
- `frontend/src/screens/BillingScreen.jsx`
- `frontend/src/screens/SettingsScreen.jsx`
- `frontend/src/api.js`
- `mobile/src/app/App.jsx`
- `mobile/src/navigation/AppShell.jsx`
- `mobile/src/billing/BillingScreen.jsx`
- `mobile/src/settings/SettingsScreen.jsx`
- `mobile/src/api/client.js`
- `mobile/src/offline/`
- `desktop/offline-store.cjs`
- `office/src/main.jsx`
