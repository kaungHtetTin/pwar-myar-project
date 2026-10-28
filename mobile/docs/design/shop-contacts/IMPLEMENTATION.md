# Shop Contacts implementation

| Reference | Route |
| --- | --- |
| 092 | `/shop/contacts` |
| 093 | `/shop/contacts/new` |
| 094 | `/shop/contacts/:id/edit` |

The list uses a compact task header with Add contact, the real 100-contact capacity, platform icons, identity/value rows and separate edit/delete controls. Add and Edit use the same grouped field cards, compact typography and bottom action bar above navigation. Existing shared radii, colors and Lucide icons are preserved. Long content and narrow layouts scroll and wrap naturally.

## Intentional differences

- Label remains optional according to the actual API and existing form contract, despite the reference asterisk. Both forms use Save contact for a consistent action label.
- Platforms remain the supported phone, email and social services. The value field displays Phone number, Email address, Contact link, or Phone number or contact link, retaining its platform-specific input type and existing limits. Changing platform clears the previous value as before.
- Contacts are public channels for the customer shop. The existing disclosure remains visible above the form. Lucide platform-category icons replace brand logos to preserve the app icon family. Exact contact values are retained rather than shortening URLs or phone numbers.
- Contact values span the available row width below identity, preventing long links from colliding with action buttons. Edit/delete controls remain side by side at narrow widths without shrinking them.
- Contact fields receive unique IDs per retained Add/Edit page. This fixes duplicate label associations between mounted forms; shared ShopField defaults remain unchanged for other callers.
- Subscription and owner-location gates are unchanged. Contacts subscription restrictions retain a task-header Back action after replacing the shell header.

## Control verification

| Controls | Verified behavior |
| --- | --- |
| List Add | Opens full-page Add form; original 100-contact limit retained |
| Row edit | Opens correct record with current values |
| Row delete / Cancel | Shared destructive confirmation; cancel makes no delete request |
| Delete confirm / retry | Server failure leaves confirmation recoverable; retry removes the row |
| Platform | Changes value field label/type and clears prior platform value |
| Save / retry | Correct supported payload; field error preserves values; retry returns to the reconciled source list |
| Cancel / Back / browser Forward | Source remains mounted without a Back-only fetch; unfinished Add draft survives Forward |
| More / language | Existing module drawer and Myanmar layout |

`node scripts/check-shop-contacts-reference.cjs` uses the dev server with intercepted APIs and fixture contacts. Set `CONTACTS_BROWSER=firefox` for Firefox. It captures the three references at 320, 393 and 768px, exercises create/edit/save failure and retry, delete cancellation and retry, platform changes, retained navigation, Myanmar and long links. No live contact is changed or removed.

Artifacts and per-engine results are in `artifacts/shop-contacts-reference`. Final screenshots are compared at the same viewport, including narrow and translated layouts. The Shop, shell and radius suites passed 80 tests; scoped lint and handoff validation passed. Delivery/payment tests continue to pass because the redesign is scoped to Contacts. The 100-record cap logic is preserved but the visual fixture does not exhaust all 100 records. Production build was skipped as requested.
