# Delivery plan and acceptance checklist

[Handoff home](../../UI-UX-HANDOFF.md) | [Screens](02-screen-specifications.md) | [Components](03-component-catalog.md)

## Deliverables expected from the next design developer

1. A design-system page showing actual PwarMyar tokens, type, spacing, radii, icons, semantic colors and accessibility checks.
2. A component library covering the catalog plus inline elements, with meaningful variants and interaction annotations.
3. Screen frames for every route family and variant in the screen specification, including form steps, settings sections and in-page tabs. Reusing a frame is acceptable only when its differences are explicitly annotated.
4. State frames for first-load, refresh, empty/no-results, error/retry, save/busy, permission/subscription/offline and missing-media conditions where applicable.
5. Interaction flows for filtering, list/detail/Back, order decisions, customer linking, chat/profile, review reply, checkout/offline sync, printing and protected data operations.
6. Responsive examples at phone, landscape and tablet sizes; both English and Myanmar samples; keyboard and safe-area annotations.
7. A source-linked implementation change list, verification evidence and a list of unresolved product questions or device checks. Keep backend behavior changes explicit and separately reviewed.

Suggested design-file structure: Foundations; Shared components; Authentication and shell; Sell; Products; Purchases; Sales; Customers; Suppliers; Expenses; Transactions; Reports; Billing; Access; Settings; My Shop overview; Orders; Catalog; Shop customers; Chat; Reviews; Shop report; Promotions; Shop configuration and branding; States and flows. Frame naming: `Module / Screen / Variant / State / Viewport / Language`. Component naming follows implementation ownership where useful; duplicate local wrappers should converge visually on the shared primitives.

## Implementation sequence

| Stage | Work | Exit condition |
| --- | --- | --- |
| 1. Foundations | Audit tokens, global controls, type and navigation; establish shared skeletons/notices | One visual language; readable Myanmar; baseline phone/keyboard/focus checks. |
| 2. Shared patterns | Right filter drawer, forms, sheets, contact/order rows, toolbar and list states | Consistent behavior across representative modules; no Back/state regressions. |
| 3. Core operations | Sell, Products, Purchases, Sales and credit contacts/suppliers | Draft/stock/account/receipt behavior preserved across all route variants. |
| 4. Finance/admin | Expenses, Transactions, Reports, Billing, Access and Settings | Accurate scope/direction/permissions; device and destructive flows remain explicit. |
| 5. Shop operations | Overview/gates, Orders, Customers, Chat, Reviews and Report | Accepted user designs honored, shared OrderCard truly reused, profile/Back flow verified. |
| 6. Shop configuration | Catalog, Promotions, Contacts, Delivery, Methods, Storefront/branding/location | Scope/limits/shared-identity/upload constraints preserved. |
| 7. Full review | Cross-module consistency, complete inventory, English/Myanmar and device pass | Every applicable screen/component/state has evidence or a clearly recorded unverified dependency. |

This sequence is guidance for the next implementation, not permission to omit later stages or a statement that they are complete.

## Global acceptance

- [ ] References guide layout and hierarchy; inconsistent or cramped reference details are corrected using the shared PwarMyar design system. Pixel-identical reproduction is not required.
- [ ] Content scrolls naturally; text, controls and spacing are not compressed to fit everything into one screenshot. Fixed actions do not obscure content or focused fields.
- [ ] Final screenshots and full scrollable states are inspected against references at matching viewports; intentional departures have a brief UI/UX rationale. Behavioral tests alone do not establish visual acceptance.
- [ ] Existing forest-green theme preserved; no reference-chat palette/wallpaper/pill styling introduced.
- [ ] Every module/route variant in the screen specification is accounted for in designs and implementation review.
- [ ] Every component inventory entry is retained, intentionally consolidated, or explicitly mapped to a replacement; inline primitive families are also covered.
- [ ] Page headings, controls, spacing, borders, status colors and summaries are consistent.
- [ ] All mobile filters slide from the right, including date presets; fixed Reset/Apply and correct reset defaults.
- [ ] No horizontal page overflow at320px; long content, large money values and Myanmar labels remain readable.
- [ ] Keyboard/safe-area behavior works for forms, drawers and chat; no unreachable save or send action.
- [ ] Interactive targets are at least44px where required by the target design; focus is visible; icons have appropriate names.
- [ ] Dialog focus, return focus, body locking, Escape, backdrop, browser Back and hardware Back work.
- [ ] Returning to a source retains query, filters, tab, loaded rows, selected items, draft and scroll as appropriate.
- [ ] First load, refresh, empty/no-results, retry, pagination, busy and denied states are distinct and usable.
- [ ] Permission/subscription guards remain enforced; no unauthorized controls or data flashes.
- [ ] No changed financial calculation, currency aggregation, stock conversion, account direction or audit logic hidden inside visual refactoring.
- [ ] Reduced-motion behavior, contrast, screen-reader labels and equivalent chart values checked.
- [ ] English/Myanmar complete, UTF-8 preserved, user content not translated as UI labels.

## Module-specific acceptance

| Area | Required evidence |
| --- | --- |
| Auth/shell | Login/signup validation; session load/expiry; authorized navigation; business isolation; offline unavailable recovery. |
| Sell | Three steps, draft persistence, price/FOC/stock warnings, customer requirement, success/print separation, offline queue/conflict. |
| Products | Search/scan/filter, wizard, stock adjustment, photo/camera/crop, menus/import/export/barcode and deletion. |
| Purchases | Four steps, supplier picker, unit/FOC/cost, below-cost warning, detail/edit and stock-reversal confirmation. |
| Sales | Filtered history, detail, two-step edit, customer/product pickers, receipt and protected deletion. |
| Customers/suppliers | Compact contact rows, balance direction, history tabs/filter retention, movements and statement print. |
| Expenses/transactions | Scope-labeled summaries, customer/supplier direction, filters/export, save/delete state. |
| Reports | Period vs current snapshots, currency/amounts, zero-data and chart alternatives. |
| Billing | Trial/valid/expired/pending; account absence; proof validation; pending office approval. |
| Access | Roles/Staff tabs, role permission selection, protected rows, staff status/password and denial states. |
| Settings | Every section, staff limits, shared business identity, template/device distinction, preview, restore/reset gates and confirmations. |
| Shop overview/location | Permission/subscription filtering and owner/staff GPS recovery. |
| Shop orders | Same OrderCard in main and customer history; meaningful distinct panel icons; icon+label actions; action modal/deep links; request/payment/return/refund rules. |
| Shop customers | Compact contact-style rows; guest/account/blocked variants; currency separation; explicit credit link; history/chat return. |
| Chat | Full-page white header; Back; avatar/name profile target; no duplicate profile utility; composer/media/product variants; retry identity/draft/keyboard. |
| Reviews | Matching vs awaiting-shown scope; rating-only/product/shop/replied cards; public reply/blank removal; retained source. |
| Shop report | Required period/currency; valid Reset; comparisons/zero-data/breakdowns and source retention. |
| Catalog/promotions | Filtered bulk scope vs loaded rows; selection retention/limits; product/schedule/used-item constraints. |
| Configuration/branding | All three list/form families; limits; last-active/reference rules; upload/remove/cancel; shared logo and storefront switches. |

## Fixture scenarios

Use synthetic data and API interception or an isolated test business. Include: no records; one record; multiple pages; large counts/amounts; zero and negative balances; long mixed-script names; missing contact/address/image/product; guest and registered buyers; blocked buyer; multiple currencies; unpaid/proof/paid/refund orders; pickup and delivery; pending request; rating-only and long review; replied/unreplied review; outgoing failed text/image; expired chat image; read-only staff; expired subscription; missing location; denied camera/GPS; offline-ready and unprepared device; sync conflict; validation/server failure; slow and out-of-order responses.

Do not send real chat messages, change live orders, record payments, submit billing proof, execute restore/reset or print to a physical device merely to get screenshots. Mock mutations or use the explicitly intended test environment. Never include real customer information, tokens, private proof URLs, passwords or PINs in handoff artifacts.

## Verification commands and evidence

For **this documentation package**:

```powershell
node scripts/generate-ui-handoff-inventory.cjs
node scripts/validate-ui-handoff.cjs
```

The generator checks that discovered named JSX components have design contracts. The validator checks local Markdown targets, generated source locations, component/catalog agreement, module/screen route coverage and anchored route-regex coverage against representative documented paths. The screen inventory is extracted from route-bearing specification table rows. It is a documentation aid, not a replacement for runtime navigation tests or an API schema.

For **a subsequent code redesign**, run the repository's appropriate lint/tests/build and meaningful focused interaction checks. Available commands are `npm run lint`, `npm test`, `npm run build`. Do not report a command as passed without running it for the change under review. Test list-return retention, dialog close/Back and mutation reconciliation where those behaviors change. Prefer checks of user outcomes over tests that merely mirror CSS markup.

Capture representative current and redesigned screens at320px and390px phone widths, landscape and tablet; include Myanmar and keyboard examples. Record route, state, viewport, language, fixture identifier and date for each capture. Existing screenshots under `artifacts` and scripts under `scripts` can help create fixtures, but some represent earlier iterations. Re-capture current source before calling them a baseline; screenshot existence does not prove present behavior.

Physical Android camera/file chooser/keyboard/hardware Back, real GPS, Bluetooth/TCP/system printers, live realtime service, offline sync against a real server, production deployment and final accessibility checks need dedicated evidence. A mocked browser screenshot does not verify these integrations. This handoff was produced from source inspection; it does not claim a fresh visual or device verification of every app screen.

## Completion report format

Report what changed and why; list affected screen/component families; give commands and outcomes; link designs/screenshots; describe unresolved device or service checks. Identify intentional departures from this handoff and obtain a product decision if they conflict with an accepted user constraint. Do not label the redesign complete while screens, variants, permissions or major states remain unaccounted for.
