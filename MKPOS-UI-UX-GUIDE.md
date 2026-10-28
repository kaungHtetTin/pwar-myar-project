# PwarMyar UI/UX Guide

Reusable design reference for the PwarMyar Business POS, its mobile companion, and PwarMyar Office. This guide describes the current product patterns so another application can reuse the visual language and interaction model without depending on this repository's component code.

## 1. Product and experience

PwarMyar is a business operations product for small retailers. The Business app supports daily work such as selling, stock management, purchasing, customer and supplier accounts, expenses, reporting, and shop settings. Office is the platform operator's administration console. The mobile app is a separate touch-first client for business users.

The design favors quick recognition, compact information, and direct task completion. It uses a configurable brand color (green by default), neutral work surfaces, clear status colors, compact tables on desktop, and larger touch targets and cards on mobile. The experience should feel dependable and practical rather than decorative.

## 2. Brand and visual language

### Core palette

The table below describes packaged defaults. Since the Office update dated
24 October 2026, **Office > Branding** lets super administrators set the shared
primary color. Updated web clients derive dark and pale brand shades and
selection accents from that color. Use the configured tokens for identity and
primary controls; retain semantic error/warning colors and compact geometry.

| Role | Color | Use |
| --- | --- | --- |
| Brand deep | `#0C4A3A` | Desktop navigation background, strong brand surfaces |
| Brand | `#0E684E` | Primary actions, links, active indicators, key icons |
| Brand hover | `#0A4E3D` | Hover state for primary actions |
| Brand pale | `#DDF5E9` | Selected navigation, soft success emphasis |
| Workspace | `#F6F8F7` | Desktop page background |
| Surface | `#FFFFFF` | Panels, forms, cards, tables |
| Border | `#DDE5E1` | Panel outlines, separators, control borders |
| Text | `#132238` desktop; `#17211E` mobile | Main text and figures |
| Muted | `#687486` desktop; `#66736F` mobile | Supporting text, captions, hints |
| Danger | `#DC3C3C` desktop; `#B43C3C` mobile | Destructive actions and errors |
| Danger pale | `#FFF4F3` | Error surface |
| Mobile lime accent | `#D9F75F` | Small brand highlight, never a large text background |

Use the configured brand color (green by default) for identity and active task controls, white for content, and its pale shade for selection or low emphasis. Reserve red for errors/destructive actions and amber for warnings. Do not communicate a status by color alone; include a label or icon.

### Type

- Use **Noto Sans Myanmar** with Inter/system sans-serif fallbacks. Myanmar glyph support is required for localized use.
- Desktop is compact: body text is about 12–13 px, table headings 10–11 px, secondary labels 11–12 px, and page titles about 22 px.
- Mobile uses scalable rem sizing, with body text generally around 14–16 px and stronger line-height for readability.
- Use medium or semibold weight for labels and controls; bold weight for totals, important values, and headings.
- Align currency and count values consistently. Use tabular numerals in data tables where possible.
- Keep labels sentence case. Use short, task-oriented page titles and supporting descriptions.

### Shape, spacing, elevation

- Desktop uses a tight spacing rhythm based on 4, 6, 8, 10, and 14 px. Keep related controls close and separate unrelated regions with whitespace or a border.
- Common desktop corners are 4–6 px for controls and compact panels, 8 px for dialogs, and 12 px for auth shells.
- Mobile uses a softer scale: 4 px subtle, 6 px small, 8 px controls, 10 px cards, 12 px surfaces, 14 px sheets, and pill-shaped badges.
- Prefer a one-pixel neutral border and little or no shadow for work panels. Use stronger shadows for overlays and authentication surfaces only.
- Keep icons simple and consistent in stroke style. Icons support labels; they do not replace labels for primary navigation or important actions.

## 3. Product surfaces

### Business desktop

Use a fixed left sidebar and a broad, scrollable work area. At wide layouts, the sidebar is about 204 px and can collapse to a 56 px icon rail. The top app bar is about 44 px tall and holds navigation toggle, contextual search, page actions, language, and refresh utilities. Page content uses approximately 14 px horizontal padding.

The sidebar is deep green with light text. The selected item uses a pale green fill and dark green text. Place account identity and sign out at the bottom. The main workspace uses a very light green-gray background; panels and tables are white with thin borders. Compactness matters because users compare and update many records during a shift.

Page heading row: title and one short description at left; contextual actions or trial/billing information may align at right. Keep the heading compact and avoid large hero areas inside daily work modules.

### Business mobile

Mobile is a distinct application, not a shrunken desktop layout. Follow the mobile app's compact header/navigation shell and let content use the viewport width. Use clear page titles, readable touch-friendly cards, and full-page routes for create/edit tasks. Use bottom or sheet-based secondary actions when they keep the main task in context. Use endless scrolling for user-facing record lists and a shared swipe-to-refresh shell on authenticated pages.

Mobile background is `#EEF3F0`, with white cards and controls derived from the shared brand color (green by default). Mobile lists should surface the identity, most useful secondary detail, status, and one obvious action without requiring horizontal table scrolling. Preserve currency, inventory status, and customer/supplier balances as scannable values.

### PwarMyar Office

Office is a dense desktop-first admin console for platform operations. Navigation and primary actions use the configured shared brand color, with compact neutral panels. The current large-screen sidebar is about 204 px, collapsing to 56 px; smaller layouts use the shared responsive shell. Use grouped navigation, descriptive section labels, search/filter toolbars, tabular business data, and explicit review/approval actions.

Administrators and Branding navigation are available to super admins; Activity log, Bank books and Financial book support daily admin operations. Administrator/book CRUD uses shared modal forms over retained lists. Founder settings supports a variable list of names and percentage fields, Add/Remove controls and a visible 100% total. Removal archives the founder on save. Payment approval shows the receiving-book selector before submission.

Office list searches and primary actions live in the shared app bar. Use the shared right-hand filter drawer, 10/25/50/100 pagination and sticky 80 px action column with RowActions menus. Cancel and browser Back retain the source list's search, filters, page, loaded records and scroll without an initial reload. Preserve failed form values and block duplicate submissions.

Branding uses a color control and separate logo, app-icon and favicon upload/restore controls. Reuse `BrandImage` and the platform-branding runtime; preserve packaged fallbacks when an image fails. Settings apply when updated clients open or refresh. Treat packaged launcher icons and installed home-screen icons as release/reinstall work.

Treat Office as an admin interface: include operational context and status in the table, keep filters close to the dataset, and make potentially consequential account/plan operations explicit. Office should not inherit POS checkout patterns.

## 4. Layout and responsive behavior

- Desktop breakpoint: the compact desktop workspace is active at 981 px and wider. Below this, reflow content and avoid forcing desktop tables beyond the viewport.
- Keep the sidebar fixed in the shell while the main workspace scrolls. The app bar remains sticky and may collapse low-priority action labels when space is constrained.
- Data-heavy lists can scroll horizontally only within their table container; keep page-level navigation and actions visible.
- Desktop tables use roughly 42 px body rows, 34 px headers, 12 px body text, subtle alternating rows where useful, and a persistent/visible action column when the action is important.
- Desktop controls are about 34 px high. Primary actions are filled brand green; secondary actions use a white surface and neutral border; destructive actions use a white surface with red text/border.
- On touch devices, icon buttons and menu items expand to at least 40–44 px. Keep enough gap to prevent adjacent accidental taps.
- Avoid layouts that rely on hover. Provide focus, pressed/selected, and disabled states for every interactive control.

## 5. Reusable interaction patterns

### Navigation

- Use stable module labels and consistent icons.
- Highlight exactly one current destination.
- Desktop supports expanded and collapsed navigation; preserve tooltips/accessibility names in collapsed mode.
- Mobile navigation is optimized for frequent destinations and limited width. Do not copy the full desktop sidebar onto a phone.

### Search and filters

- Place global/contextual search in the app bar when the page has a clear primary search target. On constrained desktop widths, the search can expand on focus and temporarily make action controls icon-only while retaining accessible names.
- Put secondary or multi-field filters in a filter drawer/sheet. Show an active filter count and provide a clear reset path.
- Keep the search query and applied filters visible or easy to reopen. Avoid hiding important filtering context.

### Lists, tables, and summaries

- Begin with a title/description, then concise KPI cards only when the numbers help the user's next decision.
- Use tables for desktop record comparison and cards for narrow/mobile layouts.
- Place common row actions in a predictable overflow menu; label destructive options and separate them visually.
- Make status badges text-bearing (for example, “In Stock”, “Paid”, “Pending”). Use pale status backgrounds and darker foreground text.
- Format money with the shop's currency and keep units explicit. Do not make users infer whether a number is a quantity, amount, or count.
- Empty states should explain what the list represents and offer a relevant next action when possible. Loading and failure states should preserve context and provide a retry path.

### Forms and dialogs

- Group forms by task, use persistent visible labels, and place concise validation feedback beside the relevant field.
- Keep primary submit action visually dominant and put cancel/back nearby as a secondary action.
- Use a full page for substantial create/edit workflows, especially on mobile. Use dialogs for short confirmations or focused one-step decisions.
- Desktop dialogs have a clear header, scrollable body, and anchored footer actions. Mobile sheets have a visible handle, title, close action, and safe-area-aware padding.
- Confirm irreversible deletes with the target record identified by name. Prevent duplicate submission and communicate progress.

### Point of sale

- Keep product discovery and cart visible together on desktop. Scan/search and category/price-type controls belong near the product area; cart, subtotal, total, and checkout stay grouped.
- Emphasize the total and checkout action. Show the selected customer and payment/credit state before committing the sale.
- On mobile, prioritize fast product lookup, cart review, and checkout with full-width controls. Keep optional detail secondary.

### Reports

- Start with a visible period/date range and concise summary figures.
- Group metrics by topic (sales, expenses, inventory, accounts); label time context and units.
- Place filters/export actions in the page toolbar. Charts should supplement readable values and legends rather than become the only source of information.

### Feedback and status

- Use inline field errors for correction, toast/banner feedback for completed actions, and confirmation dialogs for consequential choices.
- Distinguish info, success, warning, and danger with icon + text + color.
- For network/offline conditions, preserve entered work when possible and explain what is pending or unavailable.

## 6. Accessibility and localization

- Maintain readable contrast for text and controls, especially muted labels on pale surfaces and sidebar text on green.
- All actions must work with keyboard focus; show a clear focus outline. Use semantic buttons/links and meaningful accessible names for icon-only actions.
- Pair inputs with visible labels and associate validation help/errors programmatically.
- Do not rely on placeholder text as a field label or color alone as a status.
- Support Myanmar text with Noto Sans Myanmar, allow wrapping, and avoid fixed widths that clip translated labels. Test both Myanmar and Latin text.
- Use localization-aware number/date/currency formatting. Preserve the intended currency/unit beside values.
- Respect mobile safe areas and reduced-motion preferences. Motion is short and functional (about 150–180 ms for desktop transitions), not decorative.

## 7. Adapting this system to another app

Keep the principles and re-map the domain:

1. Define a compact brand palette: deep brand surface, primary action color, pale selection color, neutral page/surface/border/text, and semantic status colors.
2. Choose one type family with language coverage, then establish a small set of heading, body, label, and data sizes.
3. Choose the shell based on context: fixed side navigation and sticky toolbar for desktop operations; touch-first navigation and full-page forms for mobile.
4. Reuse the panel, table/card, filter, form, dialog/sheet, status, empty, loading, and error patterns described above.
5. Keep the interface's information density appropriate to the job. Use the desktop POS density for record operations, and the mobile hierarchy for quick single-task use.
6. Replace PwarMyar names, colors, module labels, currency examples, and business terminology with the target product's brand and domain. Do not carry over POS-specific checkout behavior to an unrelated application.

## 8. Screen references

These checked-in screenshots show representative desktop patterns. The screenshots use test data.

| Screen | Reference |
| --- | --- |
| Products list: sidebar, app bar, KPI strip, dense table | [products.png](frontend/test-artifacts/desktop-ui/products.png) |
| Sell: product discovery beside cart and checkout | [sell.png](frontend/test-artifacts/desktop-ui/sell.png) |
| Reports: grouped figures and date context | [reports.png](frontend/test-artifacts/desktop-ui/reports.png) |
| Purchase workflow | [new-purchase.png](frontend/test-artifacts/desktop-ui/new-purchase.png) |
| Settings | [settings.png](frontend/test-artifacts/desktop-ui/settings.png) |

## 9. Source references

The guide summarizes the implemented styles and structure in:

- Desktop Business: `frontend/src/styles/desktop-design.css`, `frontend/src/styles/desktop.css`, `frontend/src/styles/responsive.css`, and module styles under `frontend/src/styles/`.
- Mobile Business: `mobile/src/styles/index.css`, `mobile/src/styles/navigation.css`, `mobile/src/navigation/`, and `mobile/src/components/MobilePrimitives.jsx`.
- Office: `office/src/styles.css` and `office/src/desktop-parity.css`.

This is a reusable design description, not a pixel-perfect component specification. When copying the system, verify the target app at its own screen sizes and with its own content and languages.
