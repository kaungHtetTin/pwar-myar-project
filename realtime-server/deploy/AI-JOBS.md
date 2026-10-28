# Immediate AI queue dispatch

This package includes `ai-jobs.js`. It extends the existing socket service with
signed POST `/ai-jobs` notifications, allowing AI work to start without the next
cron tick. No compilation or bundling is required. Use Node.js 20 or newer.

The queue allowlist includes `sales-ai`, `customer-service` and `wyne-wyne`.
Wyne Wyne returns an immediate HTTP 202 acknowledgement, then generates through
the same signed worker callback as the other AI queues. Completed/failed replies
trigger private socket hints and authenticated delivery fetches. Keep a separate
`cron:work wyne-wyne` every-minute entry as fallback. Processing attempts are
never automatically replayed after an ambiguous interruption.

## Node deployment

Extract the package into the existing Node application directory, preserving the
server's private `.env`. Install production dependencies with
`npm ci --omit=dev`. Keep `index.js` as the startup file (`npm start`).

Keep the existing `CHAT_SECRET`, origins, port and host. Add these environment
variables; use a new random secret of at least 32 characters:

```dotenv
AI_JOBS_CALLBACK_URL=https://pwarmyar.com/integrations/ai-jobs/process
AI_JOBS_SECRET=REPLACE_WITH_A_NEW_RANDOM_SECRET
```

Restart the Node application using the hosting control panel or its process
manager. Forward POST `/ai-jobs` to Node in addition to the existing `/events`
and `/socket.io/` routes. The nginx example contains this route; replace its
documentation IP with the actual Laravel server's outbound IP.

## Laravel deployment (also required)

The matching Laravel changes must be deployed before enabling callbacks:

- `config/ai_node.php`
- `app/Services/AiQueueWakeup.php`
- `app/Http/Middleware/VerifyAiNodeRequest.php`
- `app/Http/Controllers/AiNodeQueueController.php`
- `app/Providers/EventServiceProvider.php`
- `routes/integrations.php`

Set these Laravel environment values with the exact same new secret:

```dotenv
AI_NODE_DISPATCH_ENABLED=true
AI_NODE_DISPATCH_URL=https://socket.pwarmyar.com/ai-jobs
AI_NODE_DISPATCH_SECRET=REPLACE_WITH_THE_SAME_RANDOM_SECRET
```

Run `php artisan config:cache`; rebuild cached routes with
`php artisan route:cache` if used. Restart persistent workers with
`php artisan queue:restart` and let their supervisor start replacements.
No migration or frontend build is required. Keep the every-minute scheduler and
both AI worker crons as recovery.

## Behavior and checks

Node acknowledges the signed wakeup before making the longer Laravel callback.
Each callback processes one existing job using the real Laravel database queue.
It supports Sales AI, Kaung Kaung, Wyne Wyne and queued Telegram deliveries/notices.
The existing permissions, wallet charging and job/run idempotency remain in
Laravel. Normal Sales AI requests retain their two-second dispatch delay;
provider generation time is additional. PHP hosting request/resource limits
still apply.

Unsigned POST requests to `/ai-jobs` should return 401 when configured, or 503
when disabled. An unsigned request to Laravel
`/integrations/ai-jobs/process` behaves similarly. These checks process no jobs.
After configuration, send a new customer message to a conversation in AI mode.

If dispatch fails, Laravel logs `AI queue wakeup unavailable; cron will recover`.
Node logs `AI queue callback unavailable` or `AI queue callback interrupted`.
Neither log includes private response bodies. `/api/health` on Node checks the
socket process only; it does not prove the callback is configured correctly.

Do not upload a development `.env` or `node_modules`; neither is included in
this package. Do not expose the new secret to browsers or reuse it as an API key.
