# PwarMyar deployment: cPanel + separate Node server

This runbook deploys the existing application. It adds no features. Use it with
the [cloud-agent prompt](deployment/cloud-agent-prompt.md) and complete the
[target worksheet](deployment/target.example.json) before changing remote systems.
Paths in examples are placeholders, not discovered hosting paths.

## 1. Deployment map

| Service | Public address | Source / build output |
| --- | --- | --- |
| Landing website | `https://pwarmyar.com` | Laravel routes, views and public assets |
| Laravel API | `https://pwarmyar.com/public/api` | `laravel/` |
| Business POS | `https://pos.pwarmyar.com` | `frontend/` → `laravel/public/pos/` |
| Office | `https://office.pwarmyar.com` | `office/` → `laravel/public/office/` |
| Customer shop | `https://shop.pwarmyar.com` | `shop/` → `laravel/public/shop/` |
| Mobile web app | `https://mobilepos.pwarmyar.com` | `mobile/` → `laravel/public/mobile/` |
| Socket service | `https://socket.pwarmyar.com` | `realtime-server/` on the Node host |

The fixed `/public/api` URL is intentional. Do not replace it with `/api`.
Android and Windows installers are separate release artifacts; deploying these
web apps does not require building or publishing native applications.

## 2. Collect the target details

Fill the worksheet with non-secret information. Supply credentials through the
cloud environment's private configuration or an approved credential connection,
never through committed files, public logs or the worksheet.

- Repository URL and exact branch/commit containing these changes. A cloud task
  cannot read this Windows working folder. Commit and push the complete source,
  including logos, lockfiles, shared code and deployment docs. Confirm a clean
  checkout works; generated builds, `vendor/` and private `.env` files are ignored.
- Fresh installation or existing production upgrade; maintenance window and
  backup/restore owner. Identify any existing business data before migrations.
- cPanel hostname, account, verified SSH/SFTP port or supported HTTPS deployment
  API; actual Laravel install path and every domain's document root. Establish
  how to execute PHP/Composer if shell access is unavailable.
- PHP CLI path/version, web PHP version/extensions, Composer availability,
  MySQL/MariaDB version, account-prefixed database name/user and privileges.
- cPanel cron access, frequency and process/runtime limits; symlink policy,
  Apache/LiteSpeed rewrite support and ability to protect private Laravel files.
- Node hostname, SSH port/account, install path, Node/npm versions, process
  manager, reverse proxy, TLS certificate paths and permissions to reload it.
- DNS destination IPs, TLS/AutoSSL access, actual Laravel outbound IP(s), SMTP
  account/senders and designated production super-admin name/email.
- Optional AI/provider and Telegram credentials, only for services being enabled.

If no remote command transport is available, prepare upload artifacts and exact
host-side commands for the operator. Do not claim deployment or migration success
from a successful local build.

## 3. Prepare the Codex Cloud environment

Connect the source repository and publish an environment with Node.js **22.12+
within Node 22**, npm, PHP **8.3+** compatible with `composer.lock`, Composer,
Git and the chosen transfer tools. Check PHP extensions using Composer platform
requirements; GD is explicitly required by this project. Web PHP and CLI PHP
must both satisfy the dependencies. Use a separate disposable MySQL database for
backend tests, never production.

Enable the required package-manager destinations and allow the exact cPanel,
Node, application and provider hosts needed by the workflow. Test the chosen
SSH/SFTP/HTTPS transport from a task: allowing an HTTP destination alone does
not prove SSH connectivity. Configure private networking if your servers need it.
The cloud workspace is a build workspace; it is not your production web host.

For current Codex Cloud, environment variables provide values programs read;
HTTP secrets use proxy substitution for matching HTTPS requests. An HTTP secret
placeholder is not a readable SSH private key or a value to copy into Laravel's
`.env`. Choose credential delivery appropriate to the actual transport and keep
server `.env` values on the server. Follow the current
[Cloud environments documentation](https://learn.chatgpt.com/docs/environments/cloud-environments).
For the separate **legacy** experience, secrets are available during setup only;
do not assume they remain available in the agent phase. See the
[legacy environment documentation](https://learn.chatgpt.com/docs/environments/cloud-environment).

Read applicable repository `AGENTS.md` files. If the managed environment provides
a cloud-runtime skill, read it before configuring networking or credentials.
Do not print private files, turn on shell tracing around secrets, or publish
credentials inside build archives or saved environment images.

## 4. Build from the selected commit

Run these Bash commands in the repository root of the cloud checkout:

```bash
set -euo pipefail
node --version
npm --version
php --version
composer --version
git rev-parse HEAD

for app in frontend mobile office shop; do
  npm ci --prefix "$app"
  npm --prefix "$app" run build:laravel
done

cd laravel
mkdir -p bootstrap/cache storage/app/public storage/framework/cache/data \
  storage/framework/sessions storage/framework/views storage/logs
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
composer check-platform-reqs --no-dev
cd ../realtime-server
npm ci --omit=dev
```

Keep the monorepo structure while building: the apps import `shared/`, and Office
uses shared frontend public assets. Verify each output contains `index.html`,
assets, branding/favicon and its SPA `.htaccess`. Inspect `.env.laravel` as well as
`.env.production`; Vite's `build:laravel` mode uses the former. All clients must
use `https://pwarmyar.com/public/api`, root base `/`, and their production
links. Vite environment values are public; never place credentials in `VITE_*`.
Ignored `.env.local` or mode-local files can override tracked configuration, so
build in a clean checkout without local development overrides.

Stage Laravel application source (`app`, `bootstrap`, `config`, `database`,
`lang` if present, `resources`, `routes`, `public`, `artisan`, Composer manifests
and both Laravel `.htaccess` files), compatible production `vendor/` dependencies,
and the four built apps. Stage the Node source and its package manifests
separately. Install Node dependencies on the target when the platform differs.
Exclude `.git`, private `.env` files, tests/test data, local databases, caches,
logs, generated `bootstrap/cache` contents, development `node_modules`, previous
releases and unrelated native builds. Do not package the local `public/storage`
symlink; create or verify the correct link on the target.
Retain required runtime directory structure. Never overwrite live storage with
local development storage. Keep archives/manifests/backups outside public roots.

Record the source commit, dependency versions, artifact SHA-256 checksums and
build results. Do not use `composer update`, `npm update` or ignore platform
requirements to make a deployment succeed. Run relevant tests in an isolated
CI environment if configured; a build is not evidence that all tests passed.
`scripts/package-all-apps.ps1` is a Windows/native release workflow, not a Linux
cloud prerequisite for this web deployment.

## 5. Configure cPanel document roots, DNS and TLS

Use actual account paths from the worksheet. For example, let the deployed
Laravel directory be `/home/CPANEL_USER/pwarmyar/laravel`:

| Domain | Document root for this layout |
| --- | --- |
| `pwarmyar.com` (and optional `www` alias if configured) | `/home/CPANEL_USER/pwarmyar/laravel` |
| `pos.pwarmyar.com` | `/home/CPANEL_USER/pwarmyar/laravel/public/pos` |
| `office.pwarmyar.com` | `/home/CPANEL_USER/pwarmyar/laravel/public/office` |
| `mobilepos.pwarmyar.com` | `/home/CPANEL_USER/pwarmyar/laravel/public/mobile` |
| `shop.pwarmyar.com` | `/home/CPANEL_USER/pwarmyar/laravel/public/shop` |

This main-domain layout uses the existing guarded shared-host rewrite and
preserves `/public/api`. Both `laravel/.htaccess` and `laravel/public/.htaccess`
are mandatory. Never point a domain at the monorepo root. Never enable directory
listing or bypass the private-file deny rules to fix a routing problem.

Serving only `laravel/public` is preferable where possible, but the existing
API URL then needs an explicitly tested `/public` alias/rewrite. Do not use that
layout with these URLs without configuring it. If cPanel fixes the main domain
to `public_html`, first map the equivalent guarded layout to its actual paths;
do not assume changing the main document root is permitted. See
[shared-host routing](laravel/docs/shared-host-routing.md).

Point the website/app DNS names to cPanel and `socket.pwarmyar.com` to the Node
server. Check existing A/AAAA/CNAME records, provision valid HTTPS certificates
for all names, and redirect HTTP to HTTPS using the host's supported controls.
Preserve unrelated mail records. Verify private-file denial before opening the
main domain to users. Each SPA document root must retain its own `.htaccess`
for deep-link refreshes and missing-asset handling.

## 6. Configure Laravel privately

Start a fresh installation from
[`laravel/.env.production.example`](laravel/.env.production.example).
For an upgrade, preserve the existing `.env` and merge reviewed new keys. Use:

```dotenv
APP_NAME=PwarMyar
APP_ENV=production
APP_DEBUG=false
APP_URL=https://pwarmyar.com/public
MKPOS_WEB_URL=https://pos.pwarmyar.com
MKPOS_OFFICE_URL=https://office.pwarmyar.com
MKPOS_MOBILE_URL=https://mobilepos.pwarmyar.com
MKPOS_SHOP_URL=https://shop.pwarmyar.com
LANDING_URL=https://pwarmyar.com
SESSION_SECURE_COOKIE=true
QUEUE_CONNECTION=sync
```

Fill `DB_*` with the actual cPanel database/user, a private strong password and
least required database privileges. Configure TLS SMTP with verified senders;
example addresses are placeholders. Retain exact HTTPS origins from the example
in `CORS_ALLOWED_ORIGINS` and hostnames in `SANCTUM_STATEFUL_DOMAINS`; use no
wildcard with credentials. The web apps use bearer token mode. Preserve
`X-MKPOS-Auth`, `MKPOS_*` keys and other internal compatibility names.

Generate `APP_KEY` **only on a fresh install** using `php artisan key:generate`.
Preserve the existing key on upgrades: it protects existing encrypted/signed
data. Do not upload the local development `.env` or database.

Configure realtime values from the example: `SHOP_CHAT_APP_SECRET` must match
Node `CHAT_SECRET` (random, at least 32 characters). Socket/public and publish
host are `socket.pwarmyar.com`, scheme `https`, port `443`, path `/socket.io`.
Keep the secret server-side. Remove unnecessary local-development origins from
the Node production allowlist while retaining the native origins actually used.

Keep AI dispatch and Telegram disabled until their credentials/configuration are
ready. If AI is enabled, set `MKPOS_AI_ENABLED=true` and the configured provider
key privately; Office AI settings additionally require a `super_admin` account.
Verify model/provider settings and wallet configuration in Office. Enabling the
flag alone does not provision a provider or fund the AI balance.

For optional Node AI wakeups, use a second, distinct random secret:

| Laravel | Node |
| --- | --- |
| `AI_NODE_DISPATCH_ENABLED=true` | Enable only once the callback works |
| `AI_NODE_DISPATCH_URL=https://socket.pwarmyar.com/ai-jobs` | Nginx forwards `/ai-jobs` |
| `AI_NODE_DISPATCH_SECRET=<private second secret>` | `AI_JOBS_SECRET=<same second secret>` |
| Signed callback route | `AI_JOBS_CALLBACK_URL=https://pwarmyar.com/public/integrations/ai-jobs/process` |

The callback is under `/public/integrations`, not `/public/api/integrations`.
See [AI wakeup configuration](realtime-server/deploy/AI-JOBS.md).

## 7. Install or upgrade Laravel

Before an existing-production upgrade, record the deployed version and migration
status, verify a restorable backup of the database, `.env`/APP_KEY and persistent
storage, then enter the agreed maintenance window. Follow the
[Office financial-book preservation procedure](README.md#upgrading-an-existing-office-financial-book)
when applicable. Stop/coordinate cron and persistent workers and wait for active
writes/jobs to finish. Do not replace code under running workers.

Upload the staged release with checksums, preserving production `.env`, storage,
uploads and host-specific configuration. Run from the deployed Laravel directory,
using the verified absolute PHP/Composer executables where required:

```bash
# Existing app: enter maintenance before replacing its files.
php artisan down

# After staging the new code and preserving production configuration:
mkdir -p bootstrap/cache storage/app/public storage/framework/cache/data \
  storage/framework/sessions storage/framework/views storage/logs
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
composer check-platform-reqs --no-dev
php artisan optimize:clear
php artisan migrate:status
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan view:cache
php artisan security:check
```

On a fresh install, `down` is unnecessary until the app has a valid environment
and key. Clear caches only after configuring the correct production environment.
Create `bootstrap/cache`, `storage/app/public`, `storage/framework/cache/data`,
`storage/framework/sessions`, `storage/framework/views` and `storage/logs` if the
archive omitted empty folders. Grant the hosting account write access to runtime
folders; do not use `777`. For an existing valid storage link, verify its target
rather than treating an "already exists" response as a failed deployment. If
symlinks are prohibited, arrange the host's supported public-storage mapping;
never expose all of `storage/`.

Review migrations first. Verify a fresh migration on an isolated empty database
before a fresh production installation. Stop on errors; do not fabricate missing
financial records, skip guards, run `migrate:fresh`, `migrate:refresh`, `db:wipe`,
or import a development database. Do not run `db:seed` in production: its default
administrator is deliberately blocked there. Existing database upgrades preserve
users and business data. Do not run application tests on the production database.

Provision the designated administrator using a private interactive password:

```bash
php artisan office:create-admin 'Production Administrator' 'YOUR_ADMIN_EMAIL'
php artisan tinker
```

In Tinker, after substituting the verified designated email:

```php
$admin = App\Models\PlatformAdmin::where('email', 'YOUR_ADMIN_EMAIL')->sole();
$admin->role = 'super_admin';
$admin->save();
$admin->refresh()->only(['email', 'role', 'is_active']);
```

The create-admin command creates or resets that account's password and revokes
old sessions; use it deliberately for an existing account. Do not reset other
administrators. Never deploy the local seeded password as a production password.
If an existing database already contains that development account, secure its
password before opening access. Keep the real credential out of the handoff.

After checks pass, bring Laravel up, resume the scheduled jobs, and restart any
persistent workers with `php artisan queue:restart` plus their existing process
supervisor. Verify workers loaded the new code. Keep maintenance active on errors.

## 8. Add cPanel cron jobs

Use **every minute** for each enabled entry. Replace `PHP_CLI` and `LARAVEL_DIR`
with absolute paths; in cPanel enter only the command in the Command field,
and set all five schedule fields to `*`. These are templates, not shell variables:

```cron
* * * * * PHP_CLI LARAVEL_DIR/artisan schedule:run >> LARAVEL_DIR/storage/logs/scheduler-cron.log 2>&1
* * * * * PHP_CLI LARAVEL_DIR/artisan cron:work sales-ai >> LARAVEL_DIR/storage/logs/sales-ai-cron.log 2>&1
* * * * * PHP_CLI LARAVEL_DIR/artisan cron:work wyne-wyne >> LARAVEL_DIR/storage/logs/wyne-wyne-cron.log 2>&1
# Add only when Telegram customer service is enabled:
* * * * * PHP_CLI LARAVEL_DIR/artisan cron:work customer-service >> LARAVEL_DIR/storage/logs/customer-service-cron.log 2>&1
```

Use absolute paths without spaces, or quote each actual path appropriately.
Verify CLI PHP is the intended 8.3+ runtime. Use `schedule:run` on shared hosting;
the app handles hosts without `proc_open`. Do not start `schedule:work` there.
The dedicated AI queue connections need workers even with
`QUEUE_CONNECTION=sync`. If switching the default queue to an asynchronous
driver, provision a separate worker for that connection as well.

`cron:work` has an overlap lock and stops between jobs after roughly 45 seconds;
an in-flight job can run for 360 seconds. Confirm the host allows that runtime
and adequate memory. Node wakeups supplement these recovery crons. If hosting
limits prevent reliable processing, report that constraint rather than hiding
failed workers. Do not duplicate an existing supervised worker setup without
reviewing its concurrency. See [worker health](laravel/docs/worker-health.md).

## 9. Deploy the Node socket service

Upload `realtime-server/` source/manifests outside any static document root.
Preserve its existing private `.env` on upgrades; for a fresh installation start
with [`realtime-server/.env.production.example`](realtime-server/.env.production.example).
Run `npm ci --omit=dev` on that server. Set `NODE_ENV=production`,
`CHAT_HOST=127.0.0.1`, `CHAT_PORT=8080`, `CHAT_SOCKET_PATH=/socket.io`, the matching
chat secret and exact allowed production origins. Configure optional AI values
only when enabled on Laravel too.

Start `index.js` (`npm start`) with the host's actual process manager, for example
its existing systemd/PM2 configuration. Configure restart on failure and reboot;
record the service name and operator restart command. An interactive terminal
running `npm start` is not a durable deployment.

Adapt the tracked [Nginx example](realtime-server/deploy/nginx.conf.example) to
the actual certificate paths and Laravel outbound IP(s). It proxies Socket.IO
with WebSocket upgrade headers, exposes health, and restricts signed publishing
routes `/events` and `/ai-jobs` to Laravel's egress addresses. `192.0.2.10` is a
documentation placeholder and must be replaced. Do not expose port 8080 publicly.
If egress addresses are unknown, resolve that with the host before applying the
IP rules. Use the actual proxy's equivalent configuration if Nginx is absent.
Test configuration before reload (`nginx -t` where applicable), then verify TLS,
local health and public `https://socket.pwarmyar.com/api/health`.

## 10. Verify before calling the release complete

- Main `/`, `/public/`, `/documentation`, landing images and PwarMyar favicon load.
  All four app subdomains load; a real client deep link survives refresh. Missing
  JS/image assets return 404 rather than SPA HTML. Logos and titles are PwarMyar.
- `/.env`, `/public/.env`, `/composer.json`, `/vendor/autoload.php` and
  `/config/app.php` return 403/404 with no private contents. Check each app and
  Node host for accidental `.env` or archive exposure too.
- `https://pwarmyar.com/public/api/health` reports Laravel/database healthy.
  Verify `security:check` passed with actual production configuration.
- Check CORS against each client origin, for example:

  ```bash
  curl -i -X OPTIONS 'https://pwarmyar.com/public/api/health' \
    -H 'Origin: https://office.pwarmyar.com' \
    -H 'Access-Control-Request-Method: GET' \
    -H 'Access-Control-Request-Headers: authorization,content-type,x-mkpos-auth,x-mkpos-client'
  ```

  Expect that exact allowed origin and required methods/headers, not `*`.
  An unrelated origin must not receive permission.
- Sign into Office with the designated super-admin; verify the role and AI
  settings visibility if enabled. Verify ordinary POS login and logout using an
  authorized test account. Unauthenticated Office API routes must return 401.
- Let real cron ticks run. `/public/api/health/workers` must return 200 for the
  required groups (503 means incomplete background processing). Do not fake
  heartbeats or run live paid recovery jobs just to pass this check.
- Node health returns 200; verify authenticated Socket.IO connection and a
  controlled existing notification flow. A health response alone does not verify
  private ticket authentication, publishing or room delivery. Publishing without
  valid authorization must fail. Avoid test payments, orders or paid AI calls
  unless specifically authorized with safe test data.
- Verify SMTP with an authorized recipient if requested, public uploaded image
  access, durable storage paths and service survival after a controlled restart.
  Remove staging artifacts from public paths and inspect logs without secrets.

Record each check as passed, failed or not run, with time, source commit and
non-secret evidence. Report unresolved cron/runtime, TLS, transport or provider
limitations explicitly. Do not describe a partial deployment as complete.

## 11. Recovery and handoff

Keep the previous code/assets, database backup and storage snapshot until the
release is accepted. If smoke checks fail, enter maintenance, stop writers and
inspect the failure. Revert code only when compatible with the migrated schema.
Database restoration or destructive migration rollback requires a separately
agreed recovery action because it can discard newer data; never automatically
run `migrate:rollback` or overwrite live storage. Preserve APP_KEY throughout.

Hand off the deployed commit, actual document roots, build checksums, migrations
applied, backup location, PHP/Node versions, cron entries, Node service/restart
instructions, TLS status and verification results. List credential *locations*
and admin email only, never passwords or tokens. Include exact remaining manual
steps when cloud access or hosting capabilities prevented completion.
