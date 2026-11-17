# PwarMyar Mobile UI/UX redesign handoff

Prepared 2026-10-15. Scope: the mobile application in this repository, including its browser/PWA and Android presentation. Audience: the next AI design developer and the person reviewing its work.

## Read in this order

1. [Design system and layout contracts](docs/ui-ux/01-design-system.md)
2. [Every screen and screen variant](docs/ui-ux/02-screen-specifications.md)
3. [Every named React component](docs/ui-ux/03-component-catalog.md), including source locations and public inputs
4. [Flows, permissions, navigation and state behavior](docs/ui-ux/04-flows-and-states.md)
5. [Design deliverables and acceptance checklist](docs/ui-ux/05-delivery-and-qa.md)
6. Machine-readable [component inventory](docs/ui-ux/component-inventory.json) and [screen inventory](docs/ui-ux/screen-inventory.json)

This is a design and implementation handoff, not a claim that new mockups or a new app-wide redesign have already been implemented. **Current** statements describe the local source inspected for this handoff. **Target** rules specify how the redesign should behave. Screen specifications combine existing functional requirements with a proposed visual hierarchy; preserve the former while implementing the latter.

## Brief to give the next AI developer

> Redesign every PwarMyar Mobile screen and component using this handoff. Start by reading the design system, screen specifications, component catalog, and navigation contracts. Preserve the existing forest-green theme, business rules, English/Myanmar support, permissions, retained page state, offline sale behavior, printing, and device integrations. Apply a consistent mobile layout and state system across all modules. Use the existing implementation as functional evidence and the handoff as the target design specification. Audit all route variants, dialogs, drawers, camera flows, and loading/error/empty states. Produce reviewable designs and then implement the authorized changes in this mobile repository. Do not silently alter financial logic, routes, API contracts, or the desktop application. Validate each changed flow with fixture data and document device-dependent checks separately.

## Decisions already made by the product owner

Product references 006–013 are mapped in [AGENTS.md](AGENTS.md), with visual evidence and behavior checks in the [product implementation record](docs/design/products/IMPLEMENTATION.md). Those references take precedence over older prose layout suggestions for the product module. Earlier Sell, Cart, Checkout, New checkout customer and Offline sales mappings remain recorded in AGENTS.md; their original images and comparison documents are absent from the current design folder, so preserve their existing implementations and use retained artifacts for regression checks.

- Keep PwarMyar theme colors and styling. The supplied chat screenshot is **layout inspiration only**; its teal header, wallpaper and pill styling are not the target theme.
- Put mobile filters in a right-side sliding drawer across the app, with consistent header, scrolling controls, and fixed Reset/Apply actions. Keep primary search in the page toolbar.
- Use icon **and label** for order action buttons. Use distinct, meaningful icons for customer and fulfillment information; avoid repeated decorative icons.
- Use the same `OrderCard` for the main shop orders list and the shop customer's order history.
- Make shop customer rows resemble the compact credit customer contact list: name/contact, purchase summary, chevron. Avoid oversized avatar cards and decorative footers.
- Make chat occupy the full available page. Put Back in the conversation header. Make the avatar/name group open customer detail; remove the separate placeholder profile button.
- Make shop loading states match the app theme. Preserve useful content during background refresh.
- Bring the reviews index into the same visual system, including filters, summaries, cards and reply actions.

These are accepted constraints, not optional concepts for the next designer to reconsider without a new user instruction.

## Scope and boundaries

The application contains 13 modules: Sell, Products, Purchases, Sales, My Shop, Suppliers, Customers, Expenses, Transactions, Reports, Billing, Access and Settings. Authentication, the app shell, offline sales, subscription/location gates, device tools, feedback states, and overlays are also in scope. Route variants and in-page tabs/steps count as screens for design coverage even when they share a React file.

Customer accounts at `/customers` are credit/account contacts. Buyers at `/shop/customers` are online shop customers. They share presentation patterns but have different identity, balance and linking behavior.

The desktop sibling application, public storefront and Laravel admin are outside this redesign. Shared server contracts still constrain the mobile UX. Do not add a new dark theme, desktop navigation system, or speculative capabilities as if they already exist.

## Sources and maintenance

The route and component specifications are based on `src` in this workspace, not on older screenshots alone. [README](README.md), [printing](PRINTING.md), [Android build instructions](ANDROID-BUILD.md), and [shop implementation notes](SHOP-MANAGEMENT-IMPLEMENTATION.md) provide additional context. Older implementation notes and screenshots may describe superseded layouts; use current source and the accepted decisions above when they differ.

Regenerate the component catalog with `node scripts/generate-ui-handoff-inventory.cjs`, then validate this package with `node scripts/validate-ui-handoff.cjs`. The generator inventories PascalCase functions/arrow functions containing JSX in production `.jsx` source. Inline visual primitives and nonvisual integration contracts are documented separately, since a JSX inventory alone cannot represent every UI element.

Purchase references 014-023 are implemented: [visual review, supported data differences and verification](docs/design/purchases/IMPLEMENTATION.md).

Customer references 028-033 are implemented: [visual comparisons, API support and verification](docs/design/customers/IMPLEMENTATION.md).

Sales references 024-027, 114 and 135 are implemented: [visual comparisons, preserved contracts and verification](docs/design/sales/IMPLEMENTATION.md).

Access references 049-054, 110 and 157 are implemented: [visual acceptance and behavior notes](docs/design/access/IMPLEMENTATION.md).

Access references 049-054, 110 and 157 are implemented: [visual acceptance and behavior notes](docs/design/access/IMPLEMENTATION.md).

Authentication references 105, 106 and 168: [implementation, comparisons and verification](docs/design/authentication/IMPLEMENTATION.md).

Billing references 047, 048 and 149: [implementation, visual differences and verification](docs/design/billing/IMPLEMENTATION.md).

Expense references 040-042, 117 and 151: [implementation, comparisons and verification](docs/design/expenses/IMPLEMENTATION.md).
