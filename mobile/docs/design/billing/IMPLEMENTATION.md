# Billing reference implementation

Implemented the billing overview, payment-request form and pending-approval confirmation with the shared green theme and existing subscription APIs.

| Surface | Reference |
| --- | --- |
| `/billing` | [047](047-billing-billing-overview-default.png) |
| `/billing/request/:planId`, editable request | [048](048-billing-request-planid-plan-payment-request-default.png) |
| Same route with a matching saved pending request | [149](149-billing-request-planid-payment-request-pending-payment-request-pending.png) |

## Visual verification

Compared final rendered screenshots side by side at 393 x 817 CSS pixels after normalizing reference dimensions and cropping native status chrome. Evidence is under `artifacts/billing-reference`, including 320/768 px overflow checks, account keyboard focus, history/support sheets, Myanmar overview and pending state after reload. No pixel-identical match is claimed.

## Preserved contracts and explicit differences

- Current plan, status, expiry, prices, actual duration in days, account details and payments come from the existing APIs. A 30/180/365-day entitlement is not relabeled as an exact calendar month/six months/year. Saved payment entries say Paid rather than asserting a separate approval field absent from the API. Trial, suspended, expired and lifecycle notices remain truthful.
- Account numbers remain complete and selectable for real transfers. The screenshots use conflicting bank data across pages; the app uses configured accounts while saved pending requests use the bank/account snapshot stored on that request. Multiple configured accounts add a selector and can require scrolling. Copy actions have success/failure feedback and named controls.
- The API supports one optional message of up to 1000 characters, not a separate transfer-reference column. The reference and note are serialized as `Transfer reference: ...` plus the note in that existing field. The combined counter/validation uses the actual 1000-character limit rather than the reference's 200. Previously saved free-form messages remain notes. No schema or API mutation contract changed.
- Proof uses real uploaded files, with JPG/PNG/WebP and 5 MB validation. Local previews use revoked-on-change object URLs, and invalid replacement files preserve the valid selection. QA uploads a synthetic proof image, not the reference's bank receipt. Filenames remain available to assistive technology.
- Successful submission remains on the request route and shows pending office approval. It never claims the plan was instantly activated. The entitlement event reconciles retained billing screens/history after a mutation without clearing selected plans. Back alone does not reload the overview.
- Pending requests are read-only: the API has no endpoint to edit/remove their proof. The reference's pending Replace/Remove controls are therefore omitted. The local file preview remains immediately after submission; after reload the private image cannot be fetched through the mobile API, so the page reports Payment proof received. No storage path or fake image is exposed.
- Selecting a plan with a pending request opens its saved confirmation. Submitting another plan follows the existing backend replacement semantics, with a visible warning that the earlier pending request is replaced. Current-plan renewal remains available through the plan selector.
- Billing history and support open shared sheets from the reference's shortcut rows. History retains pagination/retry and scoped CSV export; support retains the configured phone/Telegram/Viber/email/community links. Plan features remain available in a disclosure when configured.
- Submit and pending confirmation actions stay above shared bottom navigation; long notes, multiple accounts and translated content can scroll. Cancel remains available below the request form in addition to header Back. Shared radius tokens, green theme, Lucide icons, browser controls, font rendering and native safe areas remain authoritative; device status chrome is not fabricated.

## Control and navigation verification

| Controls | Expected behavior | Evidence |
| --- | --- | --- |
| Plan radios / Request payment | Select one actual plan; open its request or matching pending confirmation | Browser selects different plans, returns to initial selection and opens the real route. |
| Current pending shortcut / View pending request | Open saved pending request without submitting again | Browser reopens confirmation and asserts no extra POST. |
| Account selector / Copy bank name, account number, account name | Select real account; copy exact configured value with feedback | Browser checks multiple-account selection in a separate fixture tab and all three clipboard values; keyboard focus inspected. |
| Latest payment / Billing history / Need help | Open existing history/support sheets; close without mutation | Browser opens and captures both sheets and closes with Escape; existing unit test checks support link destinations. External phone/chat apps were not launched. |
| Proof upload / Replace image / Remove | Validate file; preview real selection; remove without submission | Browser checks missing/invalid proof, selection and removal/reselection; file replacement uses the same input handler. Oversize boundary is guarded in code but was not uploaded in browser. |
| Reference / Note / Submit request | Existing multipart contract, combined message limit, busy guard, errors retain draft | Browser inspects multipart fields, blocks missing proof, checks API failure preserves note/proof, then retries to pending. Helper test verifies serialization and legacy note handling. |
| Header Back / Cancel / browser Forward | Return to retained overview/selected plan and preserve request draft/file | Browser Back/Forward preserves reference and file; App tests cover page/header/hardware Back, Cancel, direct unavailable-plan fallback and retained source without Back-only requests. |
| View billing / Done / pending Back | Return to billing; no resubmission or approval implication | Browser exercises both actions and reloads a pending deep link. Unit test asserts read-only pending UI, saved account/message and no POST. |
| History CSV / pagination / retry | Preserve existing scoped download and endless list behavior | Existing handlers retained; this fixture has one payment, so additional pages, retry and downloaded CSV contents were not separately exercised. |

`node scripts/check-billing-reference.cjs` checks the dev server with intercepted synthetic data and mutations. Focused Billing/App/radius checks and ESLint were run. No production build, real transfer, account mutation or live approval was performed. The known in-app browser bootstrap failure required isolated Chromium. Physical device behavior is covered only where existing App tests simulate the hardware Back event.

The handoff validator still reports four pre-existing broken product/purchase implementation-document links. Billing links and generated component contracts are current.

## Compact overview spacing refinement

The billing overview alone now uses 12px card gaps/padding, 12px between section headings and controls, 8px between plan choices, and clearer account-picker/detail spacing. Compact typography and all payment/request screens remain unchanged. Verified the one-plan/pending/multiple-account case at 393px and 320px, including scrolling the final help row above bottom navigation. Evidence: `overview-spacing-*.png` and `overview-spacing-end-*.png` under the existing billing artifacts.

The overview payment-account selector and details now use the full card body width. Detail rows reserve a 44px copy-button column, align labels and values with 8px gaps, and use subtle row dividers. History and help shortcuts use consistent 12px vertical padding. This corrects the former 22px grid column that could not contain the shared 44px icon control. Verified final screenshots at 393px and 320px, copy actions, account selection, keyboard focus, history/help sheets and unchanged payment submission using `scripts/check-billing-reference.cjs`. Mobile lint, 11 billing tests and production build passed.

## Payment request spacing refinement

Payment accounts use shared Radio controls in a labeled fieldset instead of a dropdown. Options show only bank/provider names, flow horizontally and wrap onto additional rows when needed. Each option retains a 44px minimum touch height and selected styling; full account details remain below. Each mounted selector has its own group name, so a retained hidden overview cannot interfere with the request form. Selecting an option updates the existing recipient details and copy actions. Pending requests remain read-only. Browser checks verify horizontal placement, wrapping with three accounts at 320px, no overflow, and selection at 393px and 320px. Twelve billing tests, changed-component lint and production build passed.

The request page uses 12px card padding/gaps and full-width account, proof and note fields. Account rows reuse the overview alignment and 44px copy targets. Proof controls use equal flexible columns with an inset 44px remove action; filenames remain visible and long validation messages have a padded error surface. Reference/note headings no longer rely on negative margins. Reference input, Cancel and remove actions retain 44px targets; notes have an 88px minimum height. Bottom padding reserves space for the existing fixed Submit action and navigation. Submission, validation, manual approval and Back behavior remain unchanged.

Browser checks cover 320/393/768px widths, copy-button containment, long proof errors, proof replace/remove, retained notes and Back/Forward draft, retry to pending, and Cancel above the fixed Submit button at the end of scroll. Screenshots: `request-spacing-*.png` and `request-spacing-end-*.png` in `artifacts/billing-reference`. Mobile lint, 11 billing tests and production build passed.
