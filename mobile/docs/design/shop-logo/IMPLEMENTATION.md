# Business logo

`/shop/logo` follows `104-shop-logo-logo-default.png`.

The screen keeps the reference's square contained preview, Your business logo explanation, owner-only note, image requirements, side-by-side Replace logo/Remove logo controls and fixed Cancel/Save changes bar above shared bottom navigation. Shared compact MKPOS type, green theme and radius tokens remain in use. Long filenames, Myanmar labels and narrow screens scroll without clipping. The actual saved business logo is displayed; the browser fixture uses the repository's MKPOS logo instead of inventing the reference's Evergreen identity.

The existing shared `/settings/logo` API remains authoritative. PNG/JPG/WebP up to 512 KB are accepted, with maximum 2400 × 2400 dimensions enforced by the backend. Non-square logos are contained without cropping; square is a recommendation. Invalid MIME/size selections retain a previously valid selection; backend dimension errors retain the file for retry. An unchanged form has a visibly disabled Save button.

Remove opens the shared confirmation sheet. Confirmation stages removal locally; only Save sends DELETE. Undo restores the saved image. Cancel, Back and confirmation dismissal never save or delete. A successful upload/removal dispatches the existing shared-logo event so receipts and the storefront receive the same identity. Busy guards prevent duplicate mutations. Non-owners cannot request this editor's settings or invoke changes; permission/subscription/owner-location gates remain active.

Controls: Replace logo opens the native file picker (including keyboard activation); Remove logo opens confirmation; confirmation Cancel dismisses without changes; confirmation Remove stages removal; Undo removal restores the saved preview; Cancel/Back resume the retained source; Save submits once and returns to My Shop on success. Browser Forward resumes a previously selected file without an initial settings fetch. Upload and removal failures remain editable and retryable.

Verification: `node scripts/check-shop-identity-reference.cjs`, with `IDENTITY_BROWSER=firefox` for Firefox. Fixture checks cover reference 104 at 320/393/768 widths, native file picker, MIME/size rejection, retained files and source, upload failure/retry, removal confirmation/Undo, delete failure/retry, logo events, empty state, Myanmar and owner restrictions. API writes are intercepted. React tests cover staged deletion, file/error preservation and non-owner restrictions; existing Settings logo tests also run. No production build was run.

Screenshots and verification records are in `artifacts/shop-identity-reference`. Same-viewport comparisons record shared compact styling, natural scrolling, actual logo content and missing native status chrome as deliberate differences.

Completed verification: Chromium and Firefox fixture checks passed; 92 scoped frontend tests passed, along with the expanded Laravel location feature test. Scoped ESLint and handoff validation passed. Same-viewport comparisons: `artifacts/shop-identity-reference/compare-072.png`, `compare-154.png`, and `compare-104.png`. Final screenshots were inspected, including 320px width, Myanmar text and scrollable content.
