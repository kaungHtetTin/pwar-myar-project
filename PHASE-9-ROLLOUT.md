# Phase 9 migration rehearsal and staged rollout

## Configuration

Production must explicitly set:

```dotenv
TRIAL_ENABLED=false
TRIAL_MONTHS=1
TRIAL_OFFLINE_SYNC_GRACE_DAYS=7
TRIAL_PLAN_SLUG=free-trial
TRIAL_MONITOR_LOG_CHANNEL=trial_rollout
```

Keep `TRIAL_ENABLED=false` while database and client stages are being deployed. Changing it to `true` starts grants only for subsequent registrations; existing trials remain valid if it is changed back to `false`.

## Database rehearsal

Run against a production-like source and a new database whose name ends in `_rehearsal`:

```powershell
.\scripts\phase9-rehearse.ps1 `
  -SourceDatabase mkpos `
  -RehearsalDatabase mkpos_phase9_rehearsal
```

For authenticated MySQL installations, pass `-MySqlDefaultsFile` pointing to a restricted MySQL option file. The script:

1. creates a timestamped, transaction-consistent source backup;
2. refuses the source database or a non-empty target;
3. imports the copy and prepares a pre-trial state when the source is already migrated;
4. runs the forward migration and `trial:rollout-check`;
5. rehearses rollback;
6. runs the forward migration and check again;
7. proves existing business and subscription row counts were preserved;
8. writes JSON evidence beside the backup.

Rollback deliberately refuses to remove trial schema while trial records reference the system plan. After trial grants begin, rollback means disabling `TRIAL_ENABLED`, keeping the schema, and deploying the prior clients—not dropping trial data.

## Staged deployment

With the verified backup path from rehearsal:

```powershell
.\scripts\phase9-staged-rollout.ps1 `
  -DatabaseBackup .\laravel\storage\app\rollout-backups\mkpos-before-phase9-YYYYMMDD-HHMMSS.sql `
  -SyncAndroid
```

Deploy in this order:

1. backend migration and entitlement contract;
2. Office artifact;
3. web artifact and Windows renderer;
4. mobile/Android artifact;
5. set `TRIAL_ENABLED=true`, run `php artisan config:cache`, then run `php artisan trial:rollout-check`.

## Production smoke checks

Before deploying, run the read-only production connectivity check:

```powershell
.\scripts\phase9-production-preflight.ps1
```

It verifies HTTPS health, the Laravel/MySQL identity, browser-origin CORS, and authentication protection without creating or changing production data.

Use disposable, clearly labelled test businesses and remove them through the approved administrative retention process after sign-off.

- Register once from the session-auth web client and once from the token-auth mobile client.
- Confirm both responses show `access_type=trial`, `is_valid=true`, the configured calendar-month end, and zero subscription payments.
- Confirm POS, data status, and swipe refresh work.
- Confirm backup export and restore each return `403` with `code=trial_feature_restricted`.
- With a controlled application time in a non-production rehearsal environment, confirm the exact expiry boundary returns `402`.
- Assign or approve a paid plan and confirm immediate access, preserved unused trial time, payment/revenue creation, and unlocked backup/restore.

## Monitoring and stop conditions

`storage/logs/trial-rollout-*.log` contains structured events:

- `trial.registration_failed`
- `trial.subscription_required` (`402`)
- `trial.paid_feature_restricted` (`403`)
- `trial.conversion_failed`

Watch those events together with registration volume and Office payment/revenue totals. Stop new grants by setting `TRIAL_ENABLED=false` and refreshing the configuration cache if registration failures or conversion errors increase unexpectedly. This does not invalidate existing trials.
