# Shop Cover implementation

Reference 103 (`103-shop-cover-cover-default.png`) maps to `/shop/cover`.

The screen uses one compact task header, a wide image preview with Replace/Remove actions, an image-requirements card, an unsaved-changes note and a fixed Cancel/Save changes bar above navigation. Empty, pending removal, validation, upload failure and translated states use the same theme, Lucide icons and radius tokens. The separate business-logo flow is unchanged.

## Acceptance decisions

- Shared compact spacing and natural scrolling take precedence over inconsistent reference measurements. Fields and actions remain readable at 320, 393 and 768px. The preview fits the entire selected image inside a wide canvas instead of silently cropping the uploaded file.
- Replace opens the native file picker. PNG/JPEG/WebP type and 2 MB size limits are checked before replacing the valid draft. Dimensions remain enforced by the server's existing 4800-by-4800 validation; server errors retain the selection for retry.
- Remove requires confirmation and becomes a pending change. It sends no delete request until **Save changes**, matching the reference's promise that changes remain private until saved. Undo restores the saved cover. Cancel/Back preserves the saved cover and retains the draft when returning through browser Forward.
- Save is disabled until a valid replacement or pending saved-image removal exists. Busy actions prevent duplicate submissions. Successful save clears the local draft and updates the retained saved image, so reopening does not show an obsolete selection.
- Permissions, subscription restrictions and the owner-location gate are preserved. Restricted cover routes retain a Back header. API endpoints and upload payloads remain unchanged; there is no crop transformation or new backend dependency.

## Controls and verification

| Controls | Verified behavior |
| --- | --- |
| Header Back / Cancel | Return to mounted My Shop at the original scroll position; Forward restores the unfinished selection |
| Replace / Choose image | Opens native input; supported image preview and file name |
| Invalid type / oversized file | Error without discarding the previous valid selection |
| Save / retry | Multipart `cover` upload; server validation retains the file; retry succeeds |
| Remove / confirmation Cancel | No deletion before Save; confirmation cancel leaves saved image unchanged |
| Confirm removal / Undo | Pending empty state; Undo restores the saved image |
| Save pending removal / retry | Existing DELETE endpoint; failure retains pending removal for retry |
| Empty state / language | No-image placeholder, disabled actions and Myanmar requirements/layout |

`node scripts/check-shop-cover-reference.cjs` runs against the dev server with intercepted APIs. Set `COVER_BROWSER=firefox` for Firefox. It checks the reference and empty states at 320/393/768px, draft retention, type validation, upload error/retry, removal cancellation, staged removal/Undo, delete retry and Myanmar. The reference cover is cropped only into an isolated QA fixture; no reference image is bundled into the application. No live cover is uploaded or deleted.

Artifacts are in `artifacts/shop-cover-reference`. Final screenshots are inspected alongside the normalized reference at the same viewport. The focused Shop, shell and radius suites passed 83 tests; scoped lint and handoff validation passed. Production build was skipped as requested.
