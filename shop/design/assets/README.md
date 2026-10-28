# MKPOS Shops — UI Implementation Asset Pack

Editable SVG + CSS tokens for the customer marketplace design. All graphics in this bundle were authored as reusable **vector templates**, not extracted from the AI mockup. They are not final photographs or the official, approved company logo. The existing codebase/product owner should approve replacement branding.

## Contents
- `branding/`: square storefront marks (teal/white) and horizontal mock wordmarks.
- `icons/outline/` and `icons/teal/`: self-contained 24×24 SVG files for shared tab navigation and product, order, chat, account and checkout controls.
- `categories/`: 96×96 category shortcuts. Unicode/emoji glyphs in a few categories are **font-dependent**: swap them for Lucide icons in React for strict device-wide consistency.
- `illustrations/`: empty cart, orders, chats, favorites, no results, offline, successful order and upload failure.
- `placeholders/`: missing product photo, shop cover and customer avatar, not sample product photos.
- `backgrounds/`: teal brand header, subtle waves, auth decoration.
- `tokens/`: `tokens.css` and `tokens.json` for colors, responsive scale and components.

## React/Vite integration
Copy this directory to `public/assets/mkpos/` and import `tokens/tokens.css` in the app's global stylesheet (move the CSS file under src if your bundler requires it). Use ordinary URLs, for example:

```jsx
<img src="/assets/mkpos/branding/mark-white.svg" alt="MKPOS Shops" width={32} height={32} />
<img src="/assets/mkpos/icons/outline/chats.svg" alt="" aria-hidden="true" />
<img src="/assets/mkpos/illustrations/empty-cart.svg" alt="" />
```

Do not use decorative icons as the sole accessible label. The 393×852 design reference is a **viewport**, not a fixed CSS screen height; preserve real-device safe areas and scrolling. Keep five navigation items: Home, Cart, Orders, Chats, Me. Authentication screens omit bottom navigation.

## Content / feature accuracy
- Product photos, shop covers, avatars, logos for third-party shops, sale tags, prices and order information must come from your authorized catalog/backend. The SVG placeholders are used when these are missing.
- Do **not** ship the screenshot mockups as interface assets; build responsive components.
- Use only server-confirmed fees, product availability, stock, status and order totals; **one shop per cart**. Payment proof is optional evidence subject to staff review.
- Mockups may depict unsupported social login, password recovery, QR scanning, location selection, free-shipping thresholds or loyalty features. Do not implement these without separate product approval.
- Original handoff font families are DM Sans, Manrope and Noto Sans Myanmar. Fonts are **not redistributed** in this package; install them via your approved font source or use system fallbacks.
- Product photos use `object-fit:cover` inside their media area; preserve aspect ratio, provide meaningful alt text and a missing-image fallback.

## Suggested use with Codex
“Implement the MKPOS Shops UI from the UI/UX spec, using these assets and tokens as supporting design inputs. Keep routes, backend contracts, single-shop cart and manual payment semantics unchanged. Reuse SVGs as presentation assets and use one cohesive component library, with responsive mobile-first layouts.”
