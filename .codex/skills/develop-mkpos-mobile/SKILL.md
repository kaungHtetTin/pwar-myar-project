---
name: develop-mkpos-mobile
description: Build and revise the MKPOS mobile React SPA in this repository while preserving desktop feature parity, existing Laravel/Sanctum API contracts, and a consistent mobile-first design system. Use for any work under mobile/, when porting a frontend/ screen to mobile, when adding mobile CRUD/forms/navigation, or when creating or changing a list; submission forms must use separate full-page routes, authenticated pages must use the shared swipe-to-refresh shell, and user-facing lists must use endless-scroll pagination.
---

# Develop MKPOS Mobile

Build the standalone `mobile/` SPA page by page. Preserve business behavior from `frontend/`, but redesign interactions for touch and small screens instead of copying desktop layouts.

## Required workflow

1. Inspect the complete desktop screen, its helpers, styles, tests, API client calls, and Laravel controller/routes before editing mobile code.
2. Write a short feature-parity inventory. Include filters, CRUD, validation, secondary dialogs, exports/imports, calculations, permissions, empty/error/loading states, and cross-screen effects.
3. Read [references/project-map.md](references/project-map.md) for the repository boundaries and backend contract.
4. Read [references/ui-and-lists.md](references/ui-and-lists.md) whenever adding UI, navigation, cards, forms, sheets, or a list.
5. Implement in `mobile/` without importing code or CSS from `frontend/`. Reimplement small shared business helpers locally and test them.
6. Reuse existing Laravel endpoints. Change backend behavior only when the existing contract cannot support correct mobile behavior.
7. Run `npm run lint`, `npm test`, and `npm run build` in `mobile/`.
8. Verify the rendered page at mobile and wider viewports with the in-app browser when available. Exercise loading, empty, error, filled, validation, and sheet/dialog states.

## Non-negotiable UI rules

- Reuse tokens and shared primitives before adding page-specific styles. Keep color, typography, spacing, radii, shadows, button heights, notices, cards, form fields, sheets, and skeletons consistent across every module.
- Keep touch targets at least 44 CSS pixels. Respect safe-area insets and dynamic viewport height.
- Use one sticky app header pattern, one page-title pattern, one notice pattern, and one bottom-sheet/dialog pattern throughout the SPA.
- Wrap every authenticated page in the shared swipe-to-refresh shell. Register its page-specific data refresh action instead of implementing a separate gesture or indicator.
- Present dense desktop tables as cards or compact rows on phones. Add a table only when comparison across columns is the primary task and provide a small-screen alternative.
- Put the primary page action near the title. Put secondary tools in a compact expandable tools surface.
- Present every create, edit, adjustment, checkout, payment, settings, or other submission form on a separate full-page route. Do not put submission forms in modals, dialogs, drawers, popovers, or bottom sheets.
- Surface Laravel validation beside the related field through `aria-describedby`; use `role="alert"` for new errors.
- Preserve focus visibility, semantic labels, keyboard access, reduced motion, and screen-reader status announcements.
- Use the existing MKPOS logo source and shared logo-frame styles. Do not create per-page brand treatments.
- Do not add decorative UI that competes with operational data.

## Endless-scroll requirement

Every user-facing dynamic list must use endless-scroll pagination. Do not render Prev/Next buttons or numbered pagination.

- Request bounded pages with `limit` and `offset`; use `with_total=true` when the endpoint supports it.
- Append new items and deduplicate by stable ID.
- Trigger the next page with an `IntersectionObserver` sentinel. Provide a visible "Load more" fallback when observation is unavailable or loading fails.
- Keep initial loading, incremental loading, exhausted, empty, and retry states distinct.
- Reset items, offset, exhaustion, and request generation whenever search, filters, sort, tenant, or scope changes.
- Ignore stale responses and prevent concurrent page loads.
- Preserve existing items when an incremental request fails.
- Never infer exhaustion from viewport height alone. Use `total` when available; otherwise stop when a page returns fewer than `limit` items.
- Export, print, and offline-download actions may deliberately retrieve the complete dataset; the visible list must still remain paginated.
- Test first-page load, append, deduplication, filter reset, no-more-results, and load-more failure.

## Feature parity decisions

- Match business capabilities and validation, not desktop geometry.
- Keep pricing, costing, unit conversion, stock status, permissions, subscription gates, tenant isolation, and destructive-action safeguards equivalent to desktop.
- Use optimistic updates only when rollback is explicit and tested. Otherwise keep the affected sheet open during save and refresh the relevant list/meta after success.
- Confirm destructive actions in a consistent mobile sheet. Explain preservation or loss of linked history.
- Keep search debounced and request-race safe. Barcode scans may perform exact lookup immediately.
- Refresh summary/meta independently from paginated list items.

## Completion checklist

- Confirm the parity inventory is implemented or call out an intentional exception.
- Confirm every dynamic list, including list dialogs, uses endless scroll.
- Confirm every authenticated route inherits the shared swipe-to-refresh shell and refreshes both app configuration and current-page data where applicable.
- Confirm there is no duplicated page-specific version of an existing primitive.
- Confirm submission forms have dedicated URLs with loading, deep-link, save, cancel, and browser back behavior. Keep modals/sheets only for confirmations, read-only detail, or compact non-submitting choices.
- Confirm API requests include session credentials through `src/api/client.js`.
- Confirm tests cover business calculations and the main mobile interactions.
- Report any visual QA that could not be performed.
