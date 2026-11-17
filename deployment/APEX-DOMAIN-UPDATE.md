# Update the production API to the non-www domain

Use the corrected `release/PwarMyar-1.0.0-apex` deliverables. The earlier
`release/PwarMyar-1.0.0` artifacts still contain the previous www API URL.
The application version remains 1.0.0; Android versionCode is now 30006.

## Laravel on Hostinger

In the deployed Laravel `.env`, update these two values while preserving all
other private settings, the existing APP_KEY, database and storage:

```dotenv
APP_URL=https://pwarmyar.com/public
LANDING_URL=https://pwarmyar.com
```

Keep these app links:

```dotenv
MKPOS_WEB_URL=https://pos.pwarmyar.com
MKPOS_OFFICE_URL=https://office.pwarmyar.com
MKPOS_MOBILE_URL=https://mobilepos.pwarmyar.com
MKPOS_SHOP_URL=https://shop.pwarmyar.com
```

The CORS origin list must include `https://pwarmyar.com` and all four HTTPS app
origins. Existing www and native origins may remain allowed. The Sanctum hostname
list must include `pwarmyar.com` and the app hostnames. Use the supplied production
example for the complete lists; do not replace them with wildcards.

After uploading the Laravel update and editing the environment, run from its
directory using the hosting PHP 8.3+ CLI:

```bash
php artisan optimize:clear
php artisan config:cache
php artisan view:cache
php artisan security:check
php artisan queue:restart
```

Restart persistent workers through their existing supervisor if present. Keep
the existing minute scheduler and dedicated queue crons. This URL correction
requires no new schema migration, database reset, seeding or APP_KEY generation.

## Web apps

Upload the contents of each corrected web ZIP into its existing subdomain's
document root, replacing its old build assets and keeping `.htaccess`. The
Business, Office, Shop and Mobile apps now embed:

```dotenv
VITE_API_URL=https://pwarmyar.com/public/api
```

Changing the backend `.env` alone does not change already built JavaScript.
Clear the hosting/CDN cache for replaced app assets and hard-refresh the browser.
Check the browser Network panel uses the non-www API URL on Office sign-in.

## Separate Node server

If signed AI wakeups are enabled, update the private Node environment:

```dotenv
AI_JOBS_CALLBACK_URL=https://pwarmyar.com/public/integrations/ai-jobs/process
```

Preserve both signing secrets and the existing socket domain. Keep the non-www
and app origins in `CHAT_ALLOWED_ORIGINS`, then restart the existing Node service
using its process manager. No Node cron job is needed.

## Native apps

Install the corrected APK or Windows executable. The Windows build migrates the
previous saved default `https://www.pwarmyar.com/public` to the new default while
preserving other configuration fields. Explicit `MKPOS_SERVER_URL` environment
overrides must also be corrected by the operator if they point at www. Keep
custom server configurations only when intentional.

Android uses the existing signing key, package `com.pwarmyar.mobile`, visible
version 1.0.0 and versionCode 30006. Use the APK for direct installation and the
AAB for a separately authorized store release. Windows remains unsigned.

## Verification

1. `https://pwarmyar.com/public/api/health` returns healthy JSON over valid HTTPS.
2. Office login preflight allows `https://office.pwarmyar.com` with POST and the
   requested authentication/content headers.
3. Sign in to Office/POS with authorized accounts; verify uploaded images and
   generated links use the new API base.
4. Check `https://pwarmyar.com/public/api/health/workers` after real cron ticks.
5. Verify the existing socket service and optional AI callback flow if enabled.

Fixing the www certificate remains necessary if that alias is offered to users;
the corrected clients no longer depend on it for API requests. No live hosting
changes are performed by building these packages locally.
