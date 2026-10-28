# Design system and layout contracts

[Handoff home](../../UI-UX-HANDOFF.md) | [Screens](02-screen-specifications.md) | [Components](03-component-catalog.md)

## Visual direction

Target: a compact, readable business app with white content surfaces, forest-green actions, restrained borders, clear monetary hierarchy, and consistent mobile interaction. Design for a shop operator doing repeated tasks with one hand. Put the next useful action near the relevant content. Keep financial context visible during confirmation.

Current foundations live in [index.css](../../src/styles/index.css). Module styles extend them; consolidate recurring patterns rather than introducing a second visual language. The application currently uses a light theme. Contrast and accessibility require validation; do not infer compliance from the existing palette.

## Existing tokens to preserve

| Token | Current value | Intended use |
| --- | --- | --- |
| `--brand-950` | `#092f26` | Strongest green, hover/emphasis |
| `--brand-900` | `#103f33` | Strong branding/text emphasis |
| `--brand-800` | `#145441` | Primary button and important green |
| `--brand-700` | `#176b55` | Supporting green |
| `--brand-100` | `#dff2ea` | Selected/soft green surface |
| `--accent` | `#d9f75f` | Sparse accent; not a replacement primary |
| `--surface` | `#ffffff` | Cards, fields, sheets |
| `--text` | `#17211e` | Main text |
| `--muted` | `#66736f` | Secondary text |
| `--border` | `#d8e3dd` | Dividers and outlines |
| `--danger` / `--danger-bg` | `#b43c3c` / `#fff4f3` | Destructive/error emphasis |
| Body/root backgrounds | `#eef3f0` / shell `#f1f5f3` | Quiet app canvas |
| Radius subtle / small | `.25rem` / `.375rem` | Small visual details |
| Radius control / card | `.5rem` / `.625rem` | Inputs/buttons and cards |
| Radius surface / sheet | `.75rem` / `.875rem` | Larger panels and overlays |
| Radius round | `999px` | Avatars, dots and small badges only |

Current shared `.mobile-danger` uses a solid red variant; action tiles can use pale red with red text. Normalize these through shared semantic variants when redesigning. Never use color alone to indicate payment, stock, unread, or destructive state.

## Type, spacing and icons

Current font stack: `"Noto Sans Myanmar", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; Myanmar weights 400/500/600/700 are imported. Preserve UTF-8 and mixed Myanmar/Latin content. Do not translate customer names, product names or user-generated messages as interface labels.

Use a consistent compact type hierarchy across equivalent screens and components, guided by each reference's content hierarchy. Correct inconsistent type sizes or forced line breaks in references. Preserve the app's font family and readable mixed Myanmar/Latin text, including vowel marks. Support text scaling without clipping. Currency, quantities and dates must follow existing formatting helpers and currency precision; do not change financial rounding as a visual cleanup.

Use shared compact page gutters, card padding, control heights and gaps for equivalent components. Correct cramped or inconsistent reference spacing locally. Do not apply a blanket minimum font size, 48px field height or enlarged spacing scale to make the app less dense. Preserve usable touch areas and visible focus; a smaller visible control may have a larger touch area without increasing the layout's visible spacing. Icons use the existing `lucide-react` family with consistent stroke weight. Decorative icons are hidden from assistive technology; standalone icon buttons need an accessible name.

Mapped screenshots guide screen structure, hierarchy and design intent; they are not pixel-identical acceptance targets. References may contain inconsistent controls or compressed spacing to fit all content into one frame. Shared PwarMyar consistency, usability, accessibility and correct behavior take precedence. Let content scroll naturally instead of shrinking text, controls or spacing, clipping content or hiding information to fit a reference frame. Keep primary actions reachable and reserve scroll space for fixed actions, navigation, safe areas and the keyboard.

Compare final rendered screens side by side at the same viewport, inspecting hierarchy, typography, spacing, borders, focus states and action placement. Inspect the entire scrollable page and narrow widths, long/real content, English/Myanmar and keyboard states. Fix unexplained differences and usability issues; briefly document intentional departures and their UI/UX reason. Tests prove behavior, not visual quality; never claim visual verification without inspecting final screenshots. Preserve compact density across modules, shared components and loading/error/empty states.

This replaces exact-screenshot acceptance. The comfortable-density policy and planned app-wide less-dense pass remain canceled. Local spacing corrections needed for usability or shared consistency are allowed; they do not authorize an app-wide density change. The billing overview spacing adjustment remains scoped to billing.

## Page anatomy

| Pattern | Top to bottom target structure | Rules |
| --- | --- | --- |
| Module index | Shell; title + main action; optional summary; search/filter toolbar; result context; list; pagination feedback | One clear page title. Export/refresh are secondary. Summaries must identify period and scope. |
| Detail | Back + title/reference; state/total hero; contextual actions; grouped detail panels; history/audit | Keep identity and amount above long metadata. Put dangerous actions away from routine ones. |
| Form | Back + title/context; numbered/grouped sections; inline errors; Cancel/Save footer | Persistent labels. Correct keyboard/input mode. Keep draft on validation/server error. |
| Wizard | Back/title; compact step progress; current step; Previous/Continue or Submit | No forward skipping past invalid steps. Returning to earlier steps keeps data. |
| Report | Title; period/currency/filter/export; key result; metric groups; chart and accessible values; breakdowns | Explicitly distinguish period activity from current balances. |
| Conversation | Own white header with Back and clickable customer identity; message scroller; composer | Hide duplicated shell header/trial banner on this route only. One message scroll owner. |
| Settings/menu | Title/context; grouped rows with purposeful icon, label, description and chevron | Navigation row is one target. Descriptions help distinguish similar settings. |

Do not make navigation-only cards look like editable controls. Avoid nested buttons: a row's primary target and secondary menu/action must be separate siblings. A disabled control needs a nearby reason when the reason is not obvious.

## Buttons and fields

| Primitive | Target behavior |
| --- | --- |
| Primary | Solid brand green, white icon/text, control radius; one dominant submit/continue per action area. |
| Secondary | White or neutral surface, border, normal text; Cancel, Back, export, preview. |
| Destructive | Explicit verb/object; red semantic styling; confirmation when the operation warrants it. |
| Icon + label action tile | Compact grid/list; icon paired with readable verb; green routine actions and pale red destructive actions. Order detail uses this pattern. |
| Icon only | Reserved for familiar utilities, scan, close, composer attachment/send and Back; minimum 44x44px target and accessible label. |
| Busy | Keep button width and label context; spinner plus task verb; prevent duplicate submission. |
| Input/select/textarea | Visible label, helper text before error, associated error ID, focus border/ring, disabled/read-only distinction. Do not use placeholders as labels. |
| Search | Magnifier, query, clear when nonempty; keyboard submit if applicable; preserve query during return navigation. |
| Checkbox/switch | Full label clickable; helper explains consequences; do not submit immediately unless existing behavior does so. |
| File picker | Accepted formats/size, filename or thumbnail, replace/remove, busy/error states; canceling OS picker preserves existing value. |

## Filters: required global pattern

Use [MobileFilterPanel](../../src/components/MobilePrimitives.jsx) and its toggle/actions. Right edge entry; full-height surface; width capped at about 22rem while retaining a visible backdrop on phones. White header with title/Close, one vertically scrolling body, fixed bottom Reset and Apply. Date presets belong inside the drawer. Desktop-width mobile app views keep the same interaction unless explicitly redesigned later.

Primary search remains on the page. Show active-filter count or summary consistently. Opening copies or displays the current filter draft according to the module; Apply commits filters and resets paging, Close dismisses without an accidental request. Document and preserve each module's reset defaults (shop report needs resolved date range and currency, not empty values). Filter draft preservation on temporary navigation must follow retained-page behavior. Search and filter changes must not erase selected products unless the flow explicitly requires it.

Native dialog top-layer behavior, focus containment, body lock, Escape, backdrop, browser Back, hardware Back and retained-page inactivity are functional requirements. Do not recreate an untrapped CSS-only drawer. Avoid an extra portal that bypasses the module localization boundary.

## Cards and content patterns

Contact rows: identity/contact left, account/purchase summary right, chevron. Credit balance labels explain owed-to/from-shop direction. Shop rows use the same compact spacing but do not invent credit balances. Order rows in both contexts use the actual shared `OrderCard`, with reference/date, state badges, buyer/fulfillment context and amount hierarchy.

Order detail: separate customer and fulfillment panels by headings and content, with different purposeful icons where useful. Customer summary uses initials/profile context; fulfillment uses pickup/delivery meaning. No repeated placeholder icon decoration. Action tiles always show labels.

Review card: customer initials/name/time; green star rating plus readable value; shop/product target; optional comment; existing shop reply panel or Awaiting reply state; Reply/Edit action when permitted. Empty text is a rating-only review, not broken data. Summary labels are “Matching reviews” and “Awaiting reply shown”; never imply the loaded awaiting count is a global total.

Chat: neutral canvas; white incoming messages; soft-green outgoing messages; token-consistent corners. No patterned wallpaper, teal header or pill-shaped main controls. Header avatar/name form one profile navigation group. Composer: product, image, growing text area, send; utility targets 44px. Preserve message timestamps, delivery/retry information and draft while adding layout polish.

## States, accessibility and responsive design

Use layout-shaped themed skeletons for first load; hide decorative skeletons from assistive technology and announce a concise loading label. Background refresh leaves current data visible. Empty store and no filter matches need different copy/actions. First-load failure has Retry; load-more failure preserves rows and retries only the failed page. Inline save failure retains the form. Success confirms the actual server result. Reduce animation under `prefers-reduced-motion`.

Target minimum touch area 44px; visible keyboard focus; semantic headings, buttons and labels; error association; readable status text; adequate contrast checked in final colors. Dialogs return focus to the trigger. Avoid announcing every skeleton or realtime message repeatedly. Charts need an equivalent list/table. Images need meaningful alt text or an intentional decorative empty alternative. Never expose a private-image URL or financial/customer detail in telemetry or public fixtures.

Support 320px minimum width, representative 390px phone, 430px phone, 844x390 landscape, and 768x1024 tablet. These are QA targets. Current CSS has several module breakpoints (including 38/44/64rem); align behavior deliberately rather than copying conflicting rules. Prevent page-wide horizontal overflow; long names/URLs wrap, amounts remain readable, and tables get a contained scroller if needed. Bottom actions/composer must clear safe-area insets and the keyboard. Use dynamic viewport sizing where supported. Preserve scroll and avoid duplicate sticky bars consuming a small landscape viewport.
