# PwarMyar Mobile

Separate mobile-first React SPA for PwarMyar. It shares the existing Laravel `/api` contract and Sanctum cookie authentication, but it does not import or modify the desktop-oriented `frontend/` source.

## Development

Start Laravel first, then run:

```powershell
cd mobile
npm install
npm run dev
```

Open `http://127.0.0.1:5176`. Vite proxies `/api` and `/sanctum` to `http://127.0.0.1:8000` by default.

Copy `.env.example` to `.env.local` only when the defaults need to change. Keep `VITE_API_URL=/api` for same-origin production hosting. If the SPA is deployed on another origin, Laravel's CORS, Sanctum stateful-domain, cookie, and HTTPS settings must also allow that origin.

## Quality checks

```powershell
npm run lint
npm test
npm run build
```

## Installable web app

Build the production PWA into Laravel's public directory:

```powershell
npm run build:laravel
```

Serve Laravel over HTTPS and open `/public/mobile/` (or `/mobile/` when the
web-server document root is `laravel/public`). The browser can then install
PwarMyar from its install/app menu. The service worker caches only the application
shell and static assets; API data continues to use the mobile app's existing
offline storage and synchronization flow.

## Structure

- `src/api/` — shared Laravel/Sanctum request client
- `src/app/` — app composition, login, registration, session restore, and authenticated handoff
- `src/products/` — mobile inventory cards, product CRUD, pricing, units, stock adjustment/history, filters, CSV tools, and barcode workflows
- `src/config/` — module and application configuration
- `src/styles/` — mobile-first design system and global styles
- `src/test/` — test environment setup

The authentication flow reuses `/api/auth/login`, `/api/auth/register`, and `/api/auth/me`. Products is the first authenticated mobile workspace and reuses the existing Laravel product, category, price-type, and stock endpoints without coupling to the desktop SPA.

## UI/UX documentation

For the complete mobile redesign brief, screen specifications, component catalog, interaction contracts and acceptance checklist, see [UI/UX handoff](UI-UX-HANDOFF.md).

