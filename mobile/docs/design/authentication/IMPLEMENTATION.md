# Authentication reference implementation

Implemented Login, Create account and real session-check loading with the shared green theme, storefront illustration, compact form panels, masked passwords and account-switch links.

## Reference mappings

| Surface | Reference |
| --- | --- |
| `/login` | [105](105-login-login-default.png) |
| `/signup` | [106](106-signup-signup-default.png) |
| Session check, before either authenticated or unauthenticated content | [168](168-session-check-loading.png) |

Final reference/rendered comparisons were inspected at 393 x 817 CSS pixels, after normalizing and cropping baked-in device chrome. Screenshots at 320 and 768 pixels, keyboard focus and Myanmar signup are under `artifacts/auth-reference`. This is not a pixel-identical claim.

## Preserved behavior and explicit differences

- Existing `/auth/login` and `/auth/register` endpoints and payloads are unchanged, including remember-me, owner creation and the session/subscription returned by the server. No backend deployment is required.
- The storefront is a code-native SVG recreation, with simpler roof, leaves and shading. Decorative waves are CSS shapes rather than the reference's raster texture. Shared green theme, radius tokens, Lucide icons, browser checkbox and font rendering remain in use. Native status bars are not simulated.
- A direct Login entry has no Back button because there is no safe in-app source. After navigating from Create account, Login Back returns to that retained signup draft. Signup Back uses its Login history source when present; direct signup falls back to Login by replacing the entry. Session checking has no Back button that could interfere with authentication recovery.
- Password visibility icons represent the available action: an eye reveals the masked value and an eye-off icon masks it. No static Strong badge is shown: the reference's password strength claim is not backed by an existing strength evaluator. The actual minimum-eight-character requirement remains visible on signup, and server validation stays authoritative.
- Demo email/name/password values are only browser fixtures. Production fields remain empty with normal placeholders and autocomplete. Passwords stay in existing component memory and are not added to storage or history. The QA request log redacts password fields.
- Busy refs prevent duplicate in-flight submissions. API validation and general errors preserve form values, and signup still checks matching passwords before a request. Existing minimum-length/required/email attributes remain intact.
- English and Myanmar labels use the existing localization boundary. Long translated content wraps and remains scrollable. Reduced-motion settings stop spinner animation without hiding loading status.
- A password recovery flow was added concurrently in the shared workspace. Its Forgot password link remains available beside Remember me, although reference 105 omits it. Recovery shares the retained form container so visiting it does not erase the login draft. Its code/reset/resend server behavior was preserved, not redesigned against a nonexistent reference; those recovery mutations were not exercised in this reference task.

## Controls and verification

| Control | Handler / expected result | Observed verification |
| --- | --- | --- |
| Login | One POST with email/password/remember, busy indicator, error or authenticated handoff | Intercepted API failure retains inputs; retry enters Products. Existing unit tests assert exact login payload. |
| Create account | Register owner/business through existing POST, preserve errors/draft | Browser checks matching-password error without request and API failure without clearing values. Existing unit test checks successful registration/trial handoff. |
| Password and confirmation eye controls | Toggle only the associated input; no submit | Browser clicks Show/Hide for login and signup confirmation; unit test covers login visibility. Keyboard Tab focus screenshot captured. |
| Remember me | Update existing remember boolean | Browser toggles it; unit test checks true in login payload. |
| Create account / Login links | SPA navigation retaining drafts | Browser checks both links, header Back in both directions and browser Forward with unchanged field values. No auth mutation is triggered by returning. |
| Signup Back / Login Back when available | Return to real auth source; direct signup fallback to Login | Browser exercises retained auth-source returns. Direct-link fallback is implemented; native Android Back was not separately exercised. |
| Session loading | Announced real check; no fake progress or flash of protected content | Browser holds intercepted session check, captures 168, then releases it to Login. |

Verification uses `node scripts/check-auth-reference.cjs`, focused AuthScreen/App/radius unit checks and ESLint. No production build was run. Requests were intercepted; no real credentials, registrations or account changes were used. The in-app browser bootstrap failed, so isolated Chromium verified the dev server. Physical device/keyboard and actual server credential acceptance are outside these fixture checks.

The handoff validator also reports pre-existing missing product/purchase implementation document links; the new authentication link resolves.
