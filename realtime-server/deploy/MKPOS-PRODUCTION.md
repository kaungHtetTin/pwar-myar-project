# PwarMyar hosted socket configuration

Customer app: `https://shop.pwarmyar.com/`. Include its exact origin in `CHAT_ALLOWED_ORIGINS` and Laravel CORS.

Public endpoint: `https://socket.pwarmyar.com`, Socket.IO path `/socket.io`, health `/api/health`.

All four applications (owner web, owner mobile, Office, customer shops) obtain the socket configuration and short-lived tickets from Laravel at runtime. Do not add a separate socket URL or shared secret to Vite settings.

On the Laravel server, merge `release/realtime-server/production-laravel-socket.env` from this workspace into `.env`, keeping the existing `SHOP_CHAT_APP_SECRET`, then run `php artisan config:cache`. Browser connections and signed backend publishing both use HTTPS port 443 on the socket domain. Forward `/events` to Node as well as `/socket.io/`.

On the Node host, merge `release/realtime-server/production-node-socket.env`, keeping the working `CHAT_HOST`, `CHAT_PORT`, and `CHAT_SECRET`. The secret must match Laravel's `SHOP_CHAT_APP_SECRET`. Restart the Node process after changing its environment. The `.env.production.example` contains the same exact origin allowlist.

The allowlist includes the production website, Android's `https://localhost`, Capacitor, desktop file origin, and the existing local development app ports. Origins contain scheme and port, with no URL path or trailing slash. Add any additional deployed app subdomain before using it. Applications hosted under different paths of `https://www.pwarmyar.com` share that single origin.

Health alone does not verify origin access, ticket signatures, or `/events` publishing. The configuration check must also open an authenticated WebSocket from each app origin. Preserve the existing shared secret when applying these non-secret settings.
