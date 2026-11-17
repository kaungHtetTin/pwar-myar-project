# Prompt for the deployment agent

Complete `target.example.json` with non-secret hosting details, then provide its
contents with this prompt in your Codex Cloud task. Supply private credentials
through the environment's supported private configuration, not this prompt.
Commit and push the deployment documentation and application changes first.

```text
Deploy the existing PwarMyar project to shared hosting/cPanel for Laravel and
the four web apps, plus a separate Node server for sockets.

Read DEPLOYMENT.md, BRANDING.md, applicable AGENTS.md files and the supplied
target worksheet. Read the cloud-runtime skill if your environment provides it.
Use the specified repository commit. No new features, modules or business logic.

Preserve these URLs:
- Landing: https://pwarmyar.com
- Laravel API: https://pwarmyar.com/public/api
- Office: https://office.pwarmyar.com
- Shop: https://shop.pwarmyar.com
- Mobile: https://mobilepos.pwarmyar.com
- POS: https://pos.pwarmyar.com
- Socket: https://socket.pwarmyar.com

First inspect the checkout and perform read-only hosting/transport preflight.
Build all four web apps from the lockfiles and stage reviewable artifacts with
checksums. Validate PHP/Composer requirements and inspect pending migrations.
Confirm the actual target paths, database, document roots, backup and production
configuration before changing remote state. Complete independent build work
while asking for any missing hosting facts. Never guess a path or credential.

Follow DEPLOYMENT.md for cPanel rewrites, private environment configuration,
storage, migrations, designated super-admin provisioning, cron jobs, Node
process management, TLS/reverse proxy, CORS and end-to-end verification.
Preserve live data, storage, APP_KEY and existing unrelated configuration.
Do not seed local defaults into production, reset other users, expose secrets,
wipe the database, fabricate migration prerequisites or bypass security checks.
Do not enable optional AI/Telegram integrations without the supplied settings.

Prepare and validate the exact remote change plan and artifacts before any
approval that the active environment requires. If deployment authorization
has already been given, continue within it without redundant confirmation.
An instruction to prepare artifacts only does not authorize remote publication.

If remote execution or networking is unavailable, produce verified upload
packages and exact host-side commands for the operator, and identify the block.
Never report deployment success based solely on a build or local health check.

Finish with the deployed commit, actual paths, backup reference, migrations,
cron and Node restart instructions, verification results and remaining steps.
Include no credentials. Keep the change limited to deployment configuration
and documentation; report application defects separately.
```
