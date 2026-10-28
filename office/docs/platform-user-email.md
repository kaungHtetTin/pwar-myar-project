# Email a platform user

In **Platform users**, open a customer's row action menu and choose **Send email**. The Office modal shows their registered address, Subject and Message. The recipient is fixed; change the customer account first if its address is wrong. One email goes to one customer, including inactive accounts when selected deliberately. Plain text and line breaks are rendered in the PwarMyar template, with a plain-text alternative.

The list stays mounted when composing, cancelling or sending. Its search, filters, page size, page and scroll remain intact; sending does not refetch the list. Section changes retain an unsent modal draft. Cancel/close/Escape discard the current composer; dismissal and duplicate submission are blocked while sending.

## Backend

`POST /api/office/platform-users/{id}/email` requires Office authentication and is throttled to 10 requests per minute. The payload is `subject` (1–160 characters, no CR/LF), `message` (1–10,000 characters), `recipient_email` (the displayed registered address), and a UUID `idempotency_key`. A changed recipient is rejected before sending.

Email uses the existing Laravel SMTP environment settings through PHPMailer. See `laravel/docs/password-reset.md` for `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME`. `SmtpMailer` centralizes the configuration for both password recovery and Office email. No queue worker is required. SMTP acceptance is reported as success; this is not a guarantee of inbox delivery.

Templates:

- `laravel/resources/views/emails/platform-user-message.blade.php` — branded HTML with escaped subject/name/message.
- `laravel/resources/views/emails/platform-user-message-text.blade.php` — the literal plain-text alternative.

`php tests/Fixtures/platform-user-email-preview.php` from `laravel/` generates a synthetic HTML preview without sending. Apply the new `2026_10_16_000002_create_platform_user_emails` migration on deployment; it was applied locally during development. It stores request IDs, customer/admin IDs, a payload hash and delivery state, without storing message bodies. Records cascade when a customer is deleted.

The browser reuses the same request ID after a connection failure. A previously accepted identical request returns success without a second SMTP call. A processing request or uncertain send cannot be automatically repeated. SMTP failures return a sanitized error and disable the current Send action; check with the recipient before deliberately composing a new message. Before SMTP submission, validation/configuration errors can be corrected and retried. Raw SMTP errors, recipients and message bodies are excluded from failure logs.

## Verification

All QA sends use fake SMTP or intercepted requests. No real customer email was sent. Actual provider credentials, inbox delivery and email-client rendering remain deployment checks.

| Controls | Handler / expected result | Observed |
| --- | --- | --- |
| Row actions → Send email | Opens the shared modal for the selected customer | UI test and rendered fixture passed |
| Subject, Message | Required, bounded fields; preserve failed drafts | UI tests passed |
| Send email | Posts once with fixed recipient and request ID; shows success without list fetch/remount | UI tests and rendered fixture passed |
| Retry after connection failure | Reuses the same ID and content | UI/API tests passed |
| Send after uncertain delivery | Disabled, with explanatory error | UI/API tests passed |
| Cancel, Close email composer, Escape | Dismiss unsent compose; blocked during send | UI tests; Cancel also rendered fixture |
| Section switch and return | Retains unsent subject/message | RetainedViews UI test passed |
| Source list and focus | Original table resumes and trigger focus is restored | UI test and rendered fixture passed |

Backend coverage includes authentication, saved-address checks, header injection/limits, unknown customers, sender/request isolation, duplicate requests, processing/uncertain states, HTML escaping and PHPMailer composition. Password-reset tests also pass after the shared SMTP refactor. Targeted ESLint and the Office production build pass. Rendered list/edit/email checks use `node scripts/platform-users-ui-smoke.cjs`; email screenshots cover 1440px, 1024px and 390px. Touch input was not separately exercised.


## Business owners

Businesses now offers the same Send email row action. Business details also has an Email owner button in the Business owner card. Both use the shared composer with the saved owner name/address and business name. Missing owner addresses disable the action. Owner accounts can be contacted even when account/business access is disabled, for example about billing.

`POST /api/office/businesses/{businessId}/email` requires Office authentication and the same message/address/request-ID fields and throttling. The server resolves an owner within this business, rejects missing or ambiguous owners and rejects changed addresses. Staff and platform customers are not eligible owner recipients. Owner delivery records use `business_owner_emails`, separate from customer email records. Apply migration `2026_10_16_000003_create_business_owner_emails` on deployment (already applied locally).

The shared Laravel HTML/plain-text templates use PwarMyar Business context for owner messages. SMTP setup, content limits, idempotency, processing/error behavior and logging follow the platform-user email flow above.

Verification: six owner API tests plus the existing customer-email/password-reset suites passed. Businesses list and Dashboard detail tests verify send/cancel, recipient display, retained source tables and Back without a return fetch. Existing composer tests cover busy, duplicate submission, failure/retry and uncertain delivery. Targeted lint and Office build passed. `node scripts/business-owner-email-ui-smoke.cjs` verifies actual list/detail flows at 1440px and 1100px, cancellation, one request per send and retained source state; screenshots were inspected. Tests use mock SMTP/intercepted requests. Real inbox delivery and touch input were not exercised.
