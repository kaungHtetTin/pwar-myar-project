# Shared React controls

Use `src/components/Controls.jsx` for new controls. The app's existing forms and toolbars use these components; do not introduce native inputs or another button style family in a screen.

| Component | Purpose |
| --- | --- |
| `Button` | `primary`, `secondary`, `danger`, `ghost`, `danger-ghost`, and selected `choice` actions |
| `IconButton` | An icon action with a 44 px target; provide an accessible name |
| `Input`, `Select`, `Textarea` | Native form controls with shared appearance, focus, disabled and invalid states; native attributes and refs are forwarded |
| `Field` | Label, hint, error and native-control accessibility associations, including inputs nested in a compound field |
| `FieldShell` | Shared field styling around an existing label/control composition without adding a DOM wrapper |
| `InputGroup` | A single border around a field with an icon, action, currency or unit |
| `SearchInput` | Controlled search, optional clear action and focus restoration; supports composition for scanner actions |
| `Checkbox`, `Radio`, `Switch` | Native choice behavior and consistent visuals; switches keep a compact track inside a 44 px target |
| `ChoiceGroup` | A fieldset/legend and consistent selectable rows |
| `Badge` | Compact status pills with shared success, information, warning, danger, violet and muted tones; optional dot |
| `MobileFilterToggle`, `MobileFilterPanel`, `MobileFilterActions` | Shared filter trigger, right drawer, and Reset/Apply actions from `MobilePrimitives.jsx` |
| `MobileSheet`, `MobileDeleteSheet`, `MobileNotice` | Existing shared sheets, destructive confirmation and notices from `MobilePrimitives.jsx` |

`MobileField` remains available and delegates to `Field`. `ShopField` keeps its existing error lookup and delegates through the same shared field implementation. Existing module field helpers use the shared controls and field shell.

App-bar icon actions use `IconButton` with the `ghost` variant. The shared app-bar rules provide 44 × 44 px targets, 20 px Lucide icons with a 2 px stroke, matching brand colour and control radius, consistent action gaps, hover feedback and muted disabled states. Cart uses this same control as Chat, More, Back, export and print actions.

`node scripts/check-mobile-action-buttons.cjs` checks Sell, Products and My Shop at 320, 375 and 768 px. Rendered checks confirm equal target/icon sizes, colour and radius without action overflow. **Open cart** opens `/sell/cart`; **Back to products** returns to Sell; **Shop chat** opens `/shop/chat` and browser Back returns to Sell; keyboard activation of **Open app menu** opens Main navigation, and Escape dismisses it. Screenshots are saved under `artifacts/mobile-action-buttons`. Focused Sell, AppShell, common-shell and shared-control tests pass; native device interaction was not tested.

```jsx
import { Button, Field, Input, InputGroup, SearchInput, Select } from '../../components/Controls';

<SearchInput
  aria-label="Search products"
  value={search}
  onChange={event => setSearch(event.target.value)}
  onClear={() => setSearch('')}
/>

<Field id="amount" label="Amount" error={errors.amount} hint="Shop currency">
  <InputGroup>
    <Input inputMode="decimal" value={amount} onChange={onAmountChange} />
    <span>MMK</span>
  </InputGroup>
</Field>

<Field label="Category">
  <Select value={category} onChange={onCategoryChange}>
    <option value="">All categories</option>
  </Select>
</Field>

<Button onClick={onCancel}>Cancel</Button>
<Button variant="primary" type="submit" busy={saving}>Save</Button>
```

Buttons default to `type="button"`. Use `type="submit"` for form submission. The migration preserves each existing type and handler, including native submit defaults where previously used.

Use `variant="plain"` for a composed control such as an order card, tab, wizard step or menu row. Its component structure and page layout remain in module CSS; ordinary actions should use a styled variant. Backdrops remain native dialog/sheet infrastructure. Native file pickers, dates, camera and other operating-system UI remain real.

## CSS ownership

`src/styles/cascade.css` is the single application stylesheet entry point. Its layers, from lower to higher priority, are:

1. `mkpos-pages`: existing page layout and reference styles.
2. `mkpos-drawers`: the shared drawer frame, scrolling body and pinned footer.
3. `mkpos-components`: `controls.css`, the source of control appearance.

Page styles may position controls and set container widths. Update `controls.css` to change shared typography, heights, padding, colors, radius, focus or states. Do not import page styles outside the cascade or add control-specific `!important` overrides. Existing class names remain for layout, localization and established selectors.

`Select` fills a form field by default. Use `fullWidth={false}` for an inline toolbar selector, such as Sell's price type. Composed search/scanner fields must use `SearchInput` around their input and actions so the inner input does not acquire a second border.

The controls use PwarMyar color/radius tokens and the existing Inter/system/Noto Sans Myanmar font stack. Latin text uses the Inter-style system face from reference 159, with Noto Sans Myanmar available for Myanmar text. Default field height is 40 px, action targets are 44 px and visible switch tracks are 38 × 22 px. Coarse-pointer inputs use 16 px text to avoid browser focus zoom; labels remain compact. Long text and Myanmar marks can increase height naturally. Compound fields share one border and keep units on one line.

## Acceptance and intentional differences

Shared control sizes replace inconsistent per-screen heights, weights and borders. Forms may extend farther down the page; they scroll instead of shrinking to match a reference frame. Drawer widths, headers, fields and action rows now follow the shared implementation. Page structure, section order, icon family, action presentation and business handlers are retained. Billing overview spacing is retained.

Reference screenshots contain fixture data and sometimes native keyboard chrome. Automated browser checks intercept API requests and use synthetic data, so identities, amounts, dates, photos and native date rendering can differ. Browser viewport reduction checks keyboard-height layout; it does not certify a real Android/iOS keyboard.

Run `npm run lint`, `npm run build` and `npm test`. `Controls.test.jsx` covers submission, disabled/busy behavior, refs, accessible fields, native values, search clearing and switches. `controlUsage.test.js` prevents native form-control and stylesheet-entry regressions. Existing module tests retain behavioral coverage.

Browser checks and evidence are recorded under `artifacts/shared-controls/` and the existing module reference artifact directories. `check-filter-drawers.cjs --shared-controls` captures computed control styles as well as testing focus, close/cancel, Reset/Apply and retained navigation. `check-products-reference.cjs --shared-controls` additionally checks the last field and action footer in a shortened viewport.

### Verification on 2026-10-16

- Lint and production build passed. The build retains its existing bundle-size warning.
- Full test run: 522 passed, 26 failed out of 548. Before implementation: 512 passed, 27 failed out of 539. The nine added tests pass; the existing radius-token failure is fixed by using the shared round token for the storefront switch. Remaining failures are the same 25 App navigation tests and one KPI source-structure test found before this change.
- Browser suites passed for authentication; products/create/edit/stock and error states; purchases; sell/cart; checkout; expenses; shop payment methods; and all 18 filter-drawer routes. API traffic was intercepted for these checks.
- Drawer checks include Reset/Apply, invalid-date validation, focus trapping/restoration, backdrop/Escape/device-Back dismissal, narrow/landscape/tablet widths and Myanmar text. Browser and app-bar Back resumed the mounted orders source and retained its search without a new initial-list request.
- Final screenshots were inspected against mapped references for representative fields, search/actions, radio groups, drawers and compound controls. Inspected output includes product creation at a reduced 320 × 400 viewport, expense creation, checkout, payment-method creation and active-status continuation, product filters and the Myanmar orders drawer. Updated product references additionally cover 320/393/768 widths, full scroll and focus states.
- The keyboard-height product check measured the last input at y=211.5–255.5 and the footer at y=279–340 inside a 400 px viewport. Real-device keyboard and operating-system chrome remain outside browser simulation coverage.

### Visual refinement from design-system reference 159

The shared component appearance now follows `docs/design/design-system/159-design-system-visual-design-system-reference.png`: green primary actions with restrained depth, the `#103f33` pressed state, green-outlined secondary actions, solid disabled surfaces, soft destructive actions, clearer field borders and labels, mint icon wells, compact elevated surfaces and semantic status pills. Typography uses the same existing font families in an Inter-style order for Latin text; Myanmar glyphs retain the Noto fallback. Body control text is 14 px, while coarse-pointer fields retain the 16 px anti-zoom treatment.

The reference's 8 px control radius, 10 px card radius, green palette and 44 px action targets are retained. Surface shadows are subtle and do not alter page padding, section order or density. Reference app-bar styling is applied only where already appropriate; mapped white page headers remain in place. The current drawer presentation follows reference 113 below. Busy/disabled, hover, pressed, focus and invalid states are covered; transitions respect reduced-motion settings.

`Badge` provides success, information, warning, danger, violet and muted variants. Shared order cards use it for status/payment badges; cancelled states use destructive color, processing uses blue and partial payment uses violet. This changes presentation only, not status values or permitted actions.

Validation: lint/build passed and 43 targeted tests passed. Browser suites passed for products (including narrow widths and shortened-viewport focus), expenses, checkout, payment methods, shop orders and all 18 filter drawers. Final forms, compound fields, secondary/primary buttons, switch continuation and drawer screenshots were inspected against the design-system reference. Device keyboard coverage remains limited to browser viewport simulation.

### Sell toolbar correction

Sell's legacy search wrapper was replaced with the composed `SearchInput`; scanning, Enter submission, clearing and the input ref are retained. The price-type selector uses `Select fullWidth={false}` and its count label does not wrap. Firefox and Chromium checks at 320, 362 and 393 px assert a borderless inner search input, an enclosed scanner button, a compact selector and non-overlapping count/selector layout. Existing Sell/Cart checks also passed for search, price changes, filters, scanner/manual entry and retained navigation. Lint and 19 targeted tests passed. Screenshots and metrics: `artifacts/sell-reference/sell-controls-*-*.png` and `toolbar-*.json`.

### Shared drawer design from purchase reference 113

Filter drawers use a white surface, a plain 20 px title, an unboxed close action, clear section headings and full-width selectors. The default decorative header icon has been removed; callers can still provide an explicit icon for specialized picker/import flows. Radio groups have no surrounding card, border, shadow or selected-row fill. Radio controls use a 20 px outlined circle with a solid green selected dot, placed before the option text. Presets keep neutral borders and a stronger green selected state. Reset and Apply remain pinned and retain their current handlers.

The existing drawer width is retained for readable long/translatable values. Controls and radio rows keep usable touch targets instead of copying compressed reference spacing. All body rows size to their content and scroll naturally. Legacy floating date labels now sit above their controls; date and select compound fields use one border. Purchase dates retain a full-size native date-input overlay.

Lint, build and 48 targeted tests passed. Purchase browser checks passed in Chromium and Firefox. The shared drawer checks cover all 18 routes, including reference-style assertions, radio appearance, date-field containment, Reset/Apply, focus trapping/restoration, dismissal, narrow/landscape/tablet layouts and retained source navigation. Screenshot evidence remains in `artifacts/filter-drawers` and `artifacts/purchases-reference`.

### Shared app-bar menu

Place `<AppBarMenu />` last in every authenticated page app bar. It uses the shared ghost IconButton and the shell's navigation context to open the existing app drawer directly. Keep record actions before it, use horizontal dots for record action menus, and retain explicit Back handlers on nested screens. The component owns its localized label, expanded state, dialog association and compact 44px-high touch target. See `docs/design/navigation/IMPLEMENTATION.md` for acceptance evidence.

Authenticated pages declare their header with `<PageAppBar>`, rather than placing a scrolling header inside page content. It renders the active page's controls into the persistent shell app bar above the swipe layout and carries the page's localization context with it. The shell's bottom bar also stays mounted during page switches. Standalone screen tests use the component's native-header fallback. Use the existing retained-page context to suppress inactive header declarations; do not key or remount the common shell when routes change.

### Pull to refresh

Manual Refresh actions are removed from Reports, Product Tools and Shop Order options. The shared `SwipeRefreshShell` handles downward pulls at the top of the page and refreshes the workspace plus the active page without document navigation. Retry actions for failed loads, offline invoice synchronization and other business actions remain available.

The wrapper uses a non-passive native touchmove listener to prevent a competing browser document refresh. Short, horizontal, upward, cancelled and multi-touch gestures do not refresh. Scrolled inner containers, editable fields, dialogs and explicitly excluded regions such as the conversation viewport retain their own gestures. Busy pulls cannot trigger duplicate requests. The visible shared indicator announces pull/release/busy states and has English/Myanmar text.

`usePageRefresh` registers explicit page handlers ahead of fallback `useShopResource` loaders. A parent settings resource can no longer replace the active transaction-list handler. When a page has no explicit handler, all its active fallback resources refresh. Inactive retained pages unregister from gesture refresh. Existing independent workspace/offline-cache updates still run.

Verification: 93 targeted navigation, Reports, Transactions and Shop Orders tests passed; lint and production build passed. The 15-route Chromium check (`check-filter-drawers.cjs --swipe-refresh`) verified removed buttons, actual data requests, retained page DOM and Sell search, visible busy state, no refresh of a retained inactive product list, and 320px Myanmar rendering. Reports reference checks passed with swipe-triggered success, failure and Retry. Inspected final Product pull, Report busy and Myanmar pull screenshots under `artifacts/filter-drawers/swipe-*.png`; reference fixtures use intercepted data. Intentional reference departure: refresh icons are replaced by the user-requested gesture and transient shared indicator.

### Product and purchase create FABs

Products and Purchase history use a shared `FloatingActionButton` for their existing `openAdd`/`openNew` actions. The create actions are removed from their app bars and duplicated empty-state buttons; app-bar CSV export and the far-right app menu remain. The FAB is a 56px circular primary icon button with an accessible label, tooltip and shared radius/color tokens. It stays 16px above bottom navigation, respects safe areas and aligns with the page column on wider screens. Main lists reserve extra bottom scroll space so their final rows can move above it. Forms and inactive retained pages do not show the list FAB.

44 focused product, purchase and shared-header tests passed; lint and build passed. Browser checks cover 320/362/768px, long and empty lists, no create control in the app bar, FAB geometry, unobscured final rows, create routing and retained list DOM on Back without a return fetch. Purchase references and the product create/edit flow are checked through the existing fixture suites. Final screenshots: `artifacts/filter-drawers/fab-{products,purchases}-*.png`. This intentionally changes reference create-action placement at the user's request.

### CSV exports in app bars

`CsvExportButton` is an icon-only ghost IconButton with an accessible name, tooltip, 44px-high touch target, busy spinner and duplicate-request guard. Place it in the page header before `AppBarMenu`; do not duplicate it in search/filter toolbars, Tools panels, empty/error states or page content. Reports retains its server CSV endpoint and uses the same icon-button appearance.

Products, purchases, sales, contacts, expenses, transactions, billing, access and Shop exports use their existing filtered handlers. Customer history follows the active history tab. Supplier detail keeps two distinct actions: its complete statement and its active purchase/payment-history export. Billing history export is available directly from the Billing app bar instead of inside the history sheet. Print statements, receipt printing and backup downloads retain their supported flows.

For a nested history that owns its filters, pass a stable `exportTarget` ref from its page header and render its button through `AppBarAction`. Payment histories supply `active` so retained inactive tabs cannot add duplicate header actions. Export state and filters remain in their existing components; only the button's DOM placement changes.

Removed obsolete export columns from search/filter toolbars. Header titles use ellipsis when actions need space; full customer/supplier identity remains in the profile below. This prevents long names from expanding compact app bars.

Verification: 174 targeted component/navigation/module tests passed across the affected suites; lint and production build passed. Chromium checks covered all 17 export pages at 320px and 362px, icon-only actions in headers, no exports in page content, menu placement/focus, successful fixture CSV downloads, and supplier/transaction tab changes. Products, Reports, Suppliers and Transactions reference interaction suites passed, including existing download/content and return-state checks. Inspected final Purchases, supplier payments, Shop customer history, Reports and Transactions screenshots in `artifacts/filter-drawers/entry-*.png`. Data is intercepted test data; no live business records were changed.
## Date range radio choices

`DateRangeChoices` composes the shared ChoiceGroup and Radio controls into the preferred Transactions-style list. Callers provide preset values, labels, optional calculated date bounds and the controlled draft selection. Reports uses it without changing preset calculations or Apply/Reset behavior. Preview dates stay secondary and wrap when needed; full-width shared date fields preserve readable native date entry at narrow widths.

## Numeric inputs without native spinners

The shared control layer hides browser up/down spinner arrows on every number input, covering all quantity fields and numeric controls consistently. Chromium/WebKit spin-button pseudo-elements are removed and Firefox uses textfield appearance. Inputs keep their number type, decimal keyboard hints, min/max/step constraints and existing handlers. Explicit application quantity buttons retain their existing behavior. Verification uses the Products stock-adjustment fixture flow, including numeric entry and invalid final-stock validation; lint/build pass.

## Main page top padding

Authenticated main layouts use `--page-content-top-gap: 12px` below the persistent app bar. The shared swipe-refresh content container owns this spacing, so skeletons and loading/error fallbacks receive it even before a page wrapper or header mounts. Outer page containers have zero top padding to avoid doubling the gap. The first content sibling after a header marker does not add a second top margin. Nested main containers do not receive duplicate padding. Full-height chat conversations retain their edge-to-edge layout. Existing page gutters, card/field density and billing overview spacing remain intact.

Orders' search toolbar now starts 12px below the app bar, matching the other main pages. Browser checks in `check-filter-drawers.cjs --app-bar-menus --page-top-spacing` assert the shared padding at 320px/362px and measure Orders' actual toolbar gap. This corrects the nested-header omission without changing page controls or navigation.


Loading verification: `node scripts/check-shop-loading.cjs --spacing-only` holds data requests open on nine Shop list/detail routes at 320px and 362px, asserts shell spacing and no duplicate page padding, and captures the actual skeletons. Full-height conversations retain zero shell spacing through the conversation shell modifier.

## List surfaces without outline frames

The user preference for reference 140 list-item border behavior now applies across modules. `styles/list-surfaces.css`, loaded after shared controls in the component layer, owns an explicit inventory of list cards and grouped/nested rows. Decorative outer borders become transparent without changing border widths, padding, gutters, text, card radii or page density. Standalone cards retain their white surfaces and existing gaps; grouped navigation keeps its internal separators; nested results use bottom dividers. Selected product/customer results retain fills and selection indicators instead of gaining an outer ring. Existing keyboard focus remains visible.

Scope includes Sell product/cart/customer rows and offline invoices, inventory/barcode rows, purchase history/items/payments, customer/supplier directories and account records, sales, expenses, transactions, access lists, Settings navigation/repeated rows/price types, Shop orders/catalog/customers/chat/contacts/delivery/methods/promotions/reviews, embedded product previews and loading cards. List-only enclosing panels are included. Form sections, fields, action buttons, summary metrics, dialogs and photo frames are not list-item outlines and keep their own control styling. Offline sync-status leading strips and native radio/checkbox borders retain their meaning.

This intentionally supersedes outline borders in older mapped list references while preserving their layout and content. The Chat picker retains its selected soft rounded surface and unselected dividers from reference 140. Card hover no longer introduces a border. Validation and business behavior are unchanged.

Verification: the 51-route shell/spacing audit passed at 320px and 362px, including computed no-frame checks for rendered list cards (102 route/width visits). Populated fixture interaction/reference suites passed for Sell/Cart, Products, Purchases, Sales, Customers, Suppliers, Transactions, Expenses, Access, Settings (16 routes/four widths/Myanmar), Shop Orders, Catalog, Buyers, Chat, Contacts, Methods, Delivery, Promotions and Reviews. Nine held-request loading routes passed at 320px/362px. Final populated Sales, Customers, Orders, Catalog, Cart, Promotions, Reviews, Settings navigation, Myanmar purchase history and loading screenshots were inspected; native inputs/buttons and internal dividers remain clear. Lint and production build passed. Customer/Expense fixture typography lookups were aligned with the shared app-bar portal and the Shop Buyers CSV fixture now uses the current export action label. All API interactions use isolated fixtures; physical keyboard checks remain outside this styling verification.

## Shared action-sheet rows

The action sheet row is a composite control in the shared control layer, with icon/text/chevron grid placement, left alignment, divider-only separation and a 44px-or-larger touch target. Destructive rows keep the same grid with red text and a soft red fill; generic danger-button centering and hover borders do not override their composition. The action sheet header and captions use shared compact typography and allow translated/long text to wrap.

## Currency suffix input group

`InputGroup` supports `ui-input-group--suffix` for a full-height, nonshrinking currency/unit cell. It retains the shared field border/focus, gives the editable input normal horizontal padding, removes margins from an optional 44px clear action and keeps a stable height with or without that action. Checkout Paid now uses the modifier; number/decimal parsing remains with the caller.
