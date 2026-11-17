# Phase 9 implementation and rehearsal evidence

Date: 2026-08-21  
Repository implementation: Complete  
Production activation: Pending deployment authorization and target details

## Configuration and safety controls

- `TRIAL_ENABLED` controls only future automatic grants. A regression test proves disabling it does not invalidate existing trials.
- `TRIAL_MONTHS` controls future calendar-month terms; a controlled-date test proves a two-month override.
- `TRIAL_OFFLINE_SYNC_GRACE_DAYS` controls the existing pre-expiry offline invoice policy.
- Legacy `MKPOS_TRIAL_*` names remain fallback-compatible.
- `trial:rollout-check` validates migration state, required columns, the hidden system plan, configuration bounds, duplicate-trial invariants, and subscription counts.

## Migration rehearsal

The rehearsal used a transaction-consistent copy of `mkpos` in the isolated `mkpos_phase9_20260821_rehearsal` database.

| Check | Result |
| --- | --- |
| Source backup | Passed |
| Prepare pre-trial schema | Passed |
| Forward migration | Passed |
| Post-migration rollout check | Passed |
| Rollback | Passed |
| Second forward migration | Passed |
| Final rollout check | Passed |
| Existing businesses preserved | 2 of 2 |
| Existing subscriptions preserved | 4 of 4 |

The rehearsal exposed and fixed a MariaDB dump/import rollback defect involving the legacy JSON check constraint. The complete forward/rollback/forward sequence passed after that correction.

Successful backup: `laravel/storage/app/rollout-backups/mkpos-before-phase9-20260821-143153.sql`  
Backup SHA-256: `0DCD5962EA20DA2638480DD0296DB105E7AF6641884691F3B0C2030CCCB90A32`  
Machine-readable evidence: `laravel/storage/app/rollout-backups/phase9-rehearsal-20260821-143153.json`

The disposable rehearsal database and redundant failed-attempt backup were removed after evidence capture. The successful backup remains available.

## Staged artifact rehearsal

`scripts/phase9-staged-rollout.ps1` completed these local stages in order:

1. backend migration and entitlement validation;
2. Office Laravel artifact build;
3. web Laravel artifact and Windows renderer builds;
4. mobile production build;
5. Capacitor Android native synchronization.

## Production read-only preflight

The documented production backend at `https://www.pwarmyar.com/mkpos-server/public` passed the non-mutating preflight on 2026-08-21:

- HTTPS health returned `200`;
- the service identified itself as Laravel with MySQL connectivity;
- the documented browser origin passed the CORS preflight;
- the protected subscription-plan endpoint rejected an unauthenticated request.

Machine-readable evidence: `laravel/storage/app/rollout-backups/phase9-production-preflight-20260821-143945.json`

## Monitoring

The API pipeline now writes structured rollout events to the dedicated daily channel:

- `trial.registration_failed`
- `trial.subscription_required`
- `trial.paid_feature_restricted`
- `trial.conversion_failed`

Integration traffic produced the expected `402` and paid-feature `403` events in `storage/logs/trial-rollout-2026-08-21.log`. Monitoring tests also prove exception events are logged and rethrown.

## Regression verification

| Area | Result |
| --- | --- |
| Laravel | 57 tests passed; Pint passed for all changed PHP files |
| Web | 94 tests passed; lint passed; staged Laravel and Windows builds passed |
| Mobile | 141 tests passed; lint and production build passed; Android sync passed |
| Desktop shell | 15 tests passed |
| Office | 13 tests passed; lint and staged Laravel/production builds passed |

## Remaining external step

No production server, hosting target, store/release channel, credentials, or deployment authorization was provided. The repository and local production-like rehearsal are complete, but the live staged rollout, production smoke accounts, activation, and monitoring window must not be claimed as performed until those details are supplied.
