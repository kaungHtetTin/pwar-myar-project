# MKPOS Shops — Customer App UI/UX Specification

**Version:** 1.0 · **Date:** 13 October 2026  
**Audience:** Product owner, UI/UX designer, React implementation team, Codex AI  
**Product:** Customer-facing marketplace/shop app, **not** staff POS or Office administration.

> **Source of truth:** `MKPOS-Shop-App-Designer-Handoff-2026-10-13.docx`. This document translates its current feature inventory and rules into an implementable design specification, together with the newly generated teal, edge-to-edge mobile visual direction. When a mockup depicts behavior that is absent from the source product, the existing implementation rules win. Sample names, photos, promotions, badges, ratings, stock amounts and prices in illustrative mockups are **demo content, not backend claims**.

## 1. Objective and design principles

Create a polished, coherent, mobile-first customer shopping experience that works for marketplace discovery and individual shops. Keep the customer focused on finding a product, understanding its price and unit, buying from **one shop per cart and order**, contacting the shop, and tracking the purchase.

1. **Consistent:** identical typography, header, colors, cards, badges, bottom navigation, density and interaction feedback on every page.
2. **Full-frame:** designs must fill the 393 × 852 mobile artboard. No device mockup, presentation border, outer canvas margin or letterboxing. Normal interior spacing and device safe areas remain.
3. **Compact, not cramped:** reduce decorative blank space, keep visible information dense, but maintain accessible tap areas (target 44 × 44 px) and readable text.
4. **Trustworthy:** show shop attribution, price **and unit**, stock states, actual service availability, payment review status and order progress clearly.
5. **Faithful to commerce rules:** server-calculated prices/fees, manually reviewed payment proof, one-shop checkout, no assumed refunds or guaranteed delivery.
6. **Recoverable:** preserve navigation context, drafts, loaded lists, filters and scroll when switching between product/shop/chat/login screens.
7. **Bilingual:** English and Myanmar translations, flexible line wrapping and Noto Sans Myanmar verification.

## 2. Visual design system

### 2.1 Canvas and responsive frames

| Target | Frame | Layout |
|---|---|---|
| Primary mobile reference | **393 × 852 px** | Edge-to-edge screen; status/safe area handled by real device, no mockup border |
| Small mobile | 360 px wide | Reflow cards and controls; avoid overflow |
| Large mobile | 430 px wide | Same density rhythm, fluid card widths |
| Tablet | ~768–1024 px | Expanded content, optional side/secondary panels |
| Desktop | **1366 px wide** | Responsive web shell with larger content grid; adapt navigation appropriately |

Use a fluid width container, not fixed screenshot-scale dimensions. The 393 × 852 frame is a **reference viewport**, not a request to hard-code screen height. Pages longer than the viewport scroll naturally; only the visible viewport is clipped in screen captures. Sticky navigation, where used, must not cover page content, overlays or the chat composer.

### 2.2 Color roles

| Token | Proposed HEX | Intended use |
|---|---|---|
| `brand.primary` | `#087F74` | Primary actions, teal brand identity; inherited from handoff baseline |
| `brand.deep` | `#006E63` | Deep-teal header/background variant |
| `brand.light` | `#E7F7F2` | Selected states and light promotional surfaces |
| `page.background` | `#F8FAF7` | App canvas |
| `surface.primary` | `#FFFFFF` | Cards, inputs, sheets |
| `text.primary` | `#20342E` | Body text; inherited baseline |
| `text.heading` | `#101D32` | Headings in selected mockup direction |
| `text.secondary` | `#64748B` | Secondary information |
| `border.default` | `#E0E7E6` | Card boundaries, input borders, dividers |
| `status.success` | `#16845A` | Available, success, completed |
| `status.warning` | `#B7791F` | Pending review, warnings |
| `status.danger` | `#DC3D50` | Error, failed, sold out |
| `status.info` | `#2673C8` | Processing and informational states |

These are **proposed implementation tokens** based on the handoff's baseline and visual mockups; confirm with product owner before finalizing. Avoid teal-on-teal low-contrast text. Distinguish all statuses by label or icon as well as color. Do not blindly implement gradients throughout the app: reserve richer teal treatment for the shared brand header and selected promotional surfaces; favor simple white cards for content.

### 2.3 Type and geometry

- Latin: **DM Sans** (primary), Manrope fallback. Myanmar: **Noto Sans Myanmar**. Browser fallback: `system-ui, sans-serif`.
- Typography suggestions: 26–30 px page title, 20–22 px section title, 16 px item title, 14 px body, 12–13 px metadata. Adjust Myanmar line heights independently; avoid clipping stacked diacritics.
- Spacing: 4 px scale with values `4, 8, 12, 16, 20, 24, 32`. Primary mobile horizontal content padding **16 px**, reduced to 12 px only if essential on 360 px.
- Radius: buttons 10–12 px, cards 12–16 px, inputs 10–12 px, bottom sheets 20–24 px upper corners, pill chips fully rounded.
- Elevation: light 1–2-level shadows for cards, no heavy floating-card effect on every item.
- Form/input height: 44–48 px minimum. Button primary height: 48–52 px. Secondary icon touch target 44 px.
- Product media: edge-to-edge within the **image portion** of each card (no inset padding); crop with `object-fit: cover`, keep meaningful subject centered; fallback when absent.
- Shared icon family: Lucide-style consistent 1.8–2 px strokes; never mix filled and outlined navigation icons without a defined active treatment.

### 2.4 Global structure

**Shopping screens**: safe-area/status region → shared brand/header variant → content region (scrolling) → bottom navigation when applicable. Header remains compact; avoid oversized hero headers on transactional screens.

**Bottom navigation**, in this exact order: **Home / Cart / Orders / Chats / Me**. Show current active tab, numeric cart badge and unread chat badge. Do not substitute a four-tab navigation as shown in some exploratory illustrations. Authentication screens are **standalone**, with Back and language choice, and **without** shopping bottom navigation.

**Common header variants**:
- Marketplace: MKPOS shops mark, search entry, updates notification affordance.
- Shop/product: Back, concise current title or brand, relevant favorite/cart actions.
- Orders/Cart/Chats/Me: same app identity/compact chrome; page title at a consistent top offset.
- Conversation: Back, shop avatar/name and available presence info, shop link/menu; composer anchored above keyboard/safe area.
- Auth: Back, MKPOS brand and language switch, title, labeled form.

Do not add location selectors, QR scanners, free-delivery thresholds, loyalty tiers, social login, reset-password flow, “trusted” certification, a Help Center, or automatic promotions **as functional requirements** simply because a concept image shows them. Treat those as proposals unless confirmed as implemented.

## 3. Screen inventory and behavior

The following screens reflect the source handoff's implemented routes and supporting flows. All screen layouts should be delivered in English and reviewed in Myanmar; design loading, empty, failure and restricted states where applicable.

| Screen | Current route | Core layout and components |
|---|---|---|
| Marketplace | `#/marketplace` | Search; Products/Shops tabs; sorting/filtering; product/shop results, pagination, applied filters |
| Shop page | `#/store/{slug}` | Shop identity; hours, announcement, categories, products, contact/location; favorite, reviews, chat |
| Product detail | `#/store/{slug}/products/{id}` | Media, explicit price/unit, stock, description, quantity, add-to-cart, favorite, reviews, related products |
| Cart | `#/cart` | One shop, item rows, quantity/removal, summary, proceed to checkout |
| Checkout | `#/store/{slug}/checkout` | Guest/account choice, contact, pickup/delivery, payment, optional proof, server-quoted totals |
| Orders | `#/orders` | Signed-in history, status tabs, order summaries, buy-again; guest opens private tracking |
| Guest tracking | `#/orders/track` | Reference + tracking credential, lookup, private order details, authorized actions |
| Chats inbox | `#/chats` | Shop conversation rows, latest message/date, unread count, refresh, endless pagination |
| Conversation | `#/chats/{uuid}` | Messages, read receipts, product/image sharing, composer, history, retry and Back |
| Login | `#/account/login?next=...` | Standalone email/password, language, validation, return destination |
| Sign-up | `#/account/register?next=...` | Standalone name/email/password/confirmation, guidance, existing-account switch |
| Me | `#/account` | Signed-in profile or guest CTA, account links, session/sign-out state |
| Favorites | `#/account/favorites` | Product and Shop tabs, removal, unavailable items |
| Addresses | `#/account/addresses` | Address list, editor, default address, delete confirmation |
| Recently viewed | `#/account/recent` | Up to 30 **device-only** recent products, clear confirmation |
| Updates | `#/account/notifications` | Updates inbox, unread, mark all read, contextual destinations |
| Stock alerts | `#/account/alerts` | Alert list, enroll/cancel, restock information (not stock reservation) |
| Report shop | `#/store/{slug}/report` | Private report form, reason, optionally related order, report history/status |

### 3.1 Marketplace (`#/marketplace`)

**Default:** compact header; search input; **Products / Shops** segmented tabs; optional featured content **only if powered by real existing data**; category/filter chips; sorting control; scrollable product cards or shop cards. Products show photo, name, shop, current price and unit, optional original price, availability and favorite/add action. Shops show shop identity, category and relevant availability info.

**Interactions:** search (submit/debounce as supported), filter sheet with Apply/Clear, sort selection, favorite (auth gate if guest), open detail, load next page. **Preserve** query/filter/sort/loaded results and scroll position when Back returns from product/shop. Build no-results and offline-retry layouts with an explicit action.

### 3.2 Shop page (`#/store/{slug}`)

Banner/media → compact shop identity and open-hours information → contact/call/location/chat actions **when data exists** → announcement (if configured) → Products / About / Reviews content → categories and catalog. Favorite control retains state. Long titles wrap gracefully. Distinguish displayed opening hours from actual ability to check out; the latter can be temporarily closed separately.

### 3.3 Product detail

Media viewer/gallery, product name, linked shop, sale/current price, original price if sale, **unit**, stock label, description, quantity stepper, Add to cart, reviews and related items. Do not hard-code stock quantity claims. Quantity supports up to **three decimal places**, subject to product unit and server rules. Show sold-out/unpublished/changed-price states. Favorite/review requires eligibility or sign-in where relevant. When adding from another shop while cart is filled, use the explicit replacement dialog in §5.

### 3.4 Cart

Show one clearly identified current shop, product rows with media/name/unit/price/quantity/removal, subtotal and **only known fee/totals**. Before checkout, delivery fee may not yet be quotable: mark it as “Calculated at checkout” rather than inventing one. When stock or price changes, show affected rows and a refresh/reconfirm action. Empty cart has a Browse shops/products CTA.

### 3.5 Checkout

Suggested progressive content: (1) contact and guest/account choice, (2) fulfillment and address or pickup location, (3) manual payment/evidence and final server quote. The 3-stage progress UI is a **presentation suggestion** and should not demand new backend steps. Respect shop-enabled pickup/delivery options and delivery-zone fees. If no fulfillment option is available, explain why and disable submit.

Payment selection must reflect **only supported cash, bank and wallet methods**. Proof image is **optional where supported**, not evidence of payment confirmation. Show `Order submitted` independently from `Proof upload failed`: allow a retry **without resubmitting the order**. On placement, provide a confirmation page with reference and private tracking instructions for guest orders.

### 3.6 Orders and order detail

Order cards show shop, reference, date, compact item previews, total, **order status** and **separate payment-proof/payment-review status** where shown. Detail includes item breakdown, fulfillment, proof state, timeline, receipt link, eligible cancellation/return/refund requests, staff reply and buy-again. Refunds and requests involve **manual review**, not instant approval. For buy-again, preview **current** prices and availability; warn before any cart replacement.

### 3.7 Chats inbox (`#/chats`) — dedicated reference design

Use the most recently generated conversation-list design as visual inspiration, but implement according to the actual inbox behavior. Full-height, scrollable list; one row per shop conversation:

- Circular shop avatar/image with fallback; bold shop name.
- Latest message preview (up to two lines, ellipsis); last-activity date/time.
- Unread count circle and clearly differentiated read/unread hierarchy.
- Optional product/attachment preview if the actual message supports it; never invent an order-specific chat category/filter.
- Keep existing list context and scroll when returning from a conversation.
- Loading skeleton, no conversations CTA, load-more/endless pagination, refresh, offline/error retry.

**Important:** the illustrated `All / Unread / Orders` tabs, location and QR icons are **not established in the current handoff**. Do not implement these as new features without separate approval. A simple search/filter control may likewise require engineering confirmation.

### 3.8 Conversation (`#/chats/{uuid}`)

Header = Back + shop identity/link + presence/read information when available. Scrollable messages in chronological order, outgoing/incoming bubbles, timestamps, delivered/read cues, shared product card and optional image attachments. Composer fixed **above the keyboard**, includes attachment entry, draft field and send action. Text limit **2,000 characters**. Accept image **JPG/PNG/WebP up to 2 MB** as documented; provide errors, progress, send-failed/retry, selected/remove, unavailable and expired image presentation. Chat images have **14-day expiry** messaging; confirm exact copy with engineering. Back restores the Chats inbox and conversation draft. Starting chat from a shop page uses coherent conversation visuals and returns to the shop afterward.

### 3.9 Me / Account (`#/account`) — dedicated reference design

The latest Me visual mockup defines general layout: consistent header + clear page title + profile summary card + grouped settings rows + active Me bottom tab.

**Implement these existing sections**:

**Profile** — avatar (fallback), customer name, email/contact and edit profile where available; sign-out. Guest sees Sign in / Create account CTAs, not fabricated profile information.

**Shopping tools** — Orders, Favorites, Addresses, Recently viewed, Updates/Notifications, Stock alerts. Each row uses same 44 px minimum touch area, leading icon, label, concise caption if useful, optional state count, right chevron.

**Other supported entry points** — customer request/after-purchase tools and shop reporting from their relevant contexts. Language switch English/မြန်မာ, with wrapping verified.

Mockup-only `Valued Customer`, `Privacy & security` standalone center and `Help & support` are **not confirmed implemented features**; omit or mark proposed. Count labels (saved addresses, unread messages, stock alerts) are data-bound rather than hard-coded.

### 3.10 Supporting pages

- **Favorites:** Products/Shops tabs, product/shop cards, save/remove toast, disabled/unpublished states, empty state; retain source list position.
- **Addresses:** card with label, recipient, phone, address, Default badge; add/edit sheet or page, Make default, delete confirmation, used in checkout.
- **Recently viewed:** recent 30 device-local products, explicit device-only explanation, unavailable product handling, clear history confirmation.
- **Updates:** chronological update rows, read/unread distinction, mark all as read, open linked order/product with correct Back destination.
- **Stock alerts:** enrolled product rows, cancellation action, alert re-enable/disable and restock state; explain **“An alert does not reserve stock.”**
- **Report shop:** private reason/details, optional order link, submit feedback, report history, Office manual review status; no promised instant resolution.
- **Reviews:** star rating, verified-purchase eligibility, create/edit/delete where allowed, shop reply and no-eligible-purchase state.
- **Requests:** cancellation/return/refund reasons, optional evidence upload, status and shop/staff reply; eligibility tied to authoritative order state.
- **Receipt:** accessible authenticated/authorized summary; print/download affordances as supported.
- **Private tracking:** reference and credential, invalid/expired/auth errors, proof review, order timeline and authorized actions; do not silently merge guest orders with signed-in history.

## 4. Reusable component inventory

Every component has default, hover where relevant, focus-visible, pressed, disabled, loading, success and error variants as applicable.

| Component | Required details |
|---|---|
| `AppHeader` | Marketplace, inner page, auth and conversation variants; safe-area spacing |
| `BottomNav` | Exactly Home, Cart, Orders, Chats, Me; active state, badges, accessible labels |
| `PrimaryButton` | Solid teal, full/auto width, icon optional, loading and disabled |
| `SecondaryButton` / `TextButton` | Outline/quiet actions, no duplicate visual priority |
| `IconButton` | 44 px touch box; favorite, cart, notification, back, search, close |
| `LabeledField` | Persistent label, hint, success, error, disabled, one coherent focus ring |
| `SearchField` | Icon, clear, optional filters; keep one focus ring around whole group |
| `Select`, `RadioCard`, `Checkbox` | Clear selected state independent of color |
| `SegmentedTabs` | Products/Shops, Favorites and order filters; accessible selection |
| `FilterChip` / `FilterSheet` | Applied summary, clear, apply and loading behavior |
| `ProductCard` | Edge-to-edge media zone, title, shop, current/original price, unit, favorite, sold-out state |
| `ShopCard` | Image/avatar, name, hours/contact and review info only if supplied |
| `QuantityStepper` | Decrease/value/increase, min/max, up to 3 decimals, invalid/disabled |
| `PriceBlock` | Local currency formatting (MMK), unit and optional strike-through original |
| `StatusBadge` | Named status + icon/label; order and payment review distinct |
| `OrderCard` | Ref, shop, date, status, item preview and total |
| `InboxRow` | Shop avatar, title, preview, timestamp, unread count, attachment type |
| `MessageBubble` | Incoming/outgoing, time, read/send-failed state |
| `ChatComposer` | Text limit, attachment, draft persistence, send, keyboard-safe layout |
| `AttachmentCard` | Product/image selected, uploading, failed, expired and retry |
| `SectionCard` / `AccountMenuRow` | Consistent spacing, dividers, trailing action |
| `Dialog` / `BottomSheet` | Focus trap, explicit cancel/confirm, safe-area handling |
| `Skeleton` / `EmptyState` / `ErrorState` | Contextual title, supportive text, one useful recovery CTA |
| `Toast` / `InlineAlert` | Confirmation, warning and error; never sole feedback for essential state |

**Form design:** one highlighted border around the *entire* field or grouped input when focused. Preserve labels during typing. Field-level error text appears below input and is announced to assistive technology.

## 5. Critical interaction specifications

### 5.1 Cross-shop cart replacement

If a user adds a product from Shop B while cart contains Shop A items, display a clear confirmation:

**Title:** “Replace items in your cart?”  
**Body:** “Your cart currently contains items from Shop A. To add this item from Shop B, the Shop A items must be removed.”  
**Actions:** `Keep current cart` (secondary) and `Replace cart & add item` (destructive/primary with appropriate emphasis).

Cancel leaves Shop A cart completely untouched. Do not implement mixed-shop cart or multi-shop checkout.

### 5.2 Guest-to-sign-in return

When guest favorites, opens private chat or attempts eligible review, redirect to standalone login with original `next` destination. Preserve product/shop/source context, entered drafts and Back behavior. Review existing account-tool return normalization with engineering; do not silently redirect every user to `/account`.

### 5.3 Proof review vs order status

Use independent status slots. Example: `Order: Processing` and `Payment proof: Under review`. A receipt of uploaded proof is **not** a payment verification. Failed upload after order creation shows **Retry proof upload**, not “Place order” again.

### 5.4 Buy again

Re-fetch prices/stock, show any changed or unavailable lines, confirm intended cart replacement, then take user to updated cart. Never silently purchase with stale prices.

### 5.5 Chat state retention

Back from product preview returns to the same conversation and unsent draft; Back from conversation returns to same inbox position. Failed send keeps text/attachment visible and provides Retry.

## 6. State matrix

For **every applicable screen**, cover: `default`, `focus`, `filled`, `busy/disabled`, `loading`, `empty`, `no_results`, `validation_error`, `server_error`, `offline/retry`, `success`. Also test:

- Extremely long product/shop names, long Myanmar labels and dynamic text resizing.
- Missing images, sold-out/unpublished catalog items, invalid quantity, stock changed and stale price.
- Temporarily closed checkout even when opening hours display “open.”
- Expired guest tracking credential and expired signed-in session.
- Payment proof rejected/pending/approved independent of order progress.
- Attachment too large/wrong type, upload failed, expired chat image and unavailable media.
- Keyboard open on chat and checkout; navigation and primary action remain reachable.

## 7. Responsive and accessibility behavior

- Mobile top-level shopping navigation stays at bottom; check safe areas and scroll padding. Desktop may use a wider header and navigation links, but retain the same information hierarchy.
- For mobile grids, choose 2-column product grids where contents fit comfortably; narrow or information-heavy cards may become a one-column list. Product actions and price/units must not truncate dangerously.
- Screen reader accessible button names (e.g., “Add Fresh Apples to cart”, “Open chat with Demo Shop”).
- Use semantic headings, real `button` elements and explicit input labels. All controls reachable by keyboard, with clear focus indicator.
- Never rely solely on color to distinguish availability, unread or payment status.
- Ensure WCAG-appropriate text contrast; test light/teal surfaces, disabled states and badges.
- Review Myanmar with a fluent speaker, including line height, word break and layout overflow.

## 8. Data and content contracts

**Backend-authoritative:** product prices, currency/unit, sale and original prices, stock/availability, quantity constraints, shop opening data, checkout closure, fulfillment options, delivery zones/fees, quoted totals, order and payment/proof states, review eligibility and return/cancellation eligibility.

**Client-local:** visual filters/state, conversation draft (per app behavior), return context and last 30 recently viewed products on device. Protect private information; never use real customer credentials or payment proof in prototype fixtures.

**Currency display:** consistently display MMK in an approved format such as `K 3,000` or `3,000 MMK` (choose one app-wide). Treat integer MMK as monetary amount, and do not introduce unsupported tax or automatic discount schemes.

**Unverified visual concepts** (e.g., fixed delivery promotion, location dropdown, customer loyalty designation, Google/Apple login, password reset, ratings/sales claims, QR scanning) must be tagged **Proposed — requires product/backend approval** if retained in a mockup.

## 9. Suggested frontend architecture for Codex AI

Illustrative component grouping (adapt to current project, **do not replace existing routing or backend contracts**):

```text
shop/src/
  components/
    layout/       AppHeader, BottomNav, InnerPageHeader, AuthLayout
    commerce/     ProductCard, ShopCard, PriceBlock, QuantityStepper, CartItem,
                  OrderCard, CheckoutSection
    chat/         InboxRow, ConversationHeader, MessageBubble,
                  ProductShareCard, ChatComposer
    account/      ProfileSummary, AccountMenuRow, AddressCard, NotificationRow
    ui/           Button, IconButton, Field, Tabs, Chip, StatusBadge,
                  Dialog, BottomSheet, Skeleton, EmptyState, Toast
  styles/
    tokens.css, typography.css, global.css
  ...existing routes/pages and services...
```

Do not invent API endpoints, new authentication mechanisms or new payment integration. Connect redesigned views to existing data/actions and add adapters only when required. Preserve guest tracking privacy and separate POS/Office accounts.

## 10. Acceptance checklist

- [ ] All 17 routed screens and relevant embedded flows have visual specifications.
- [ ] 393 × 852 mobile screenshots **fill the frame** without outer margins or device presentation shells.
- [ ] All screens use the **same five-tab navigation** and active/unread badge conventions.
- [ ] All screens share tokens, typography, spacing, radii and button/input variants.
- [ ] English and Myanmar checked at 360, 393, 430, tablet and 1366 px widths.
- [ ] Price **and unit** visible; stock/closed states clear; cart restricted to one shop.
- [ ] Checkout amounts come from server; no invented tax/fees/verification.
- [ ] Guest checkout and private tracking work without requiring a customer account.
- [ ] Proof review and order progress distinguishable; failed proof upload does not re-place order.
- [ ] Login returns to intended action; filters, list scroll, chat draft and Back state retained.
- [ ] Chat image/size/expiry/retry states and keyboard-open composer covered.
- [ ] Loading, empty, no-results, unavailable, offline and error variants implemented.
- [ ] Keyboard/touch accessibility and usable controls verified.
- [ ] Prototype-only concepts tracked separately from production scope.

## 11. Codex AI implementation prompt

> Redesign the **MKPOS Shops customer app** according to this document and `MKPOS-Shop-App-Designer-Handoff-2026-10-13.docx`. Start by inspecting existing routes and components; keep the backend, business rules, data contracts and supported features unchanged. Use 393 × 852 as the primary reference viewport, full-screen without presentation margins. Implement the same shared teal/white tokens, density, five-tab navigation, branded headers, product/shop cards, forms and states across every screen. Reuse shared components rather than duplicating markup. Match the approved mockup layout while rejecting features drawn in conceptual imagery that are not in the product. Validate at 360, 393, 430 and 1366 px, including English/Myanmar text, checkout constraints, guest tracking, chat keyboard, async/error states, and all critical journeys. Report which visuals are implemented, which concepts need scope approval and any incompatible source behavior before making product-rule changes.

---

### Source note

Primary reference: **MKPOS shops | UI/UX designer handoff**, 13 October 2026, version 1.0. The handoff explicitly calls for comprehensive screens/states, guest and account journeys, consistent auth and chat entry patterns, manual payment review, mobile+desktop, English+Myanmar, and preservation of current commerce behavior. This file adds actionable proposed design tokens, component architecture, and implementation notes; those additions should be approved and verified against the codebase.
