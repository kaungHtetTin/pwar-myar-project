# Access reference implementation

Implemented the eight Access references with the shared green theme, task headers, Roles/Staff tabs, protected owner cards, permission groups, staff forms and pinned actions.

## Reference mappings

- `/access`: [049-access-access-default.png](049-access-access-default.png).
- `/access/roles/new`: [050-access-roles-new-new-role-default.png](050-access-roles-new-new-role-default.png).
- `/access/roles/:id/edit`: [051-access-roles-id-edit-edit-role-default.png](051-access-roles-id-edit-edit-role-default.png).
- `/access/staff/new`: [052-access-staff-new-new-staff-default.png](052-access-staff-new-new-staff-default.png).
- `/access/staff/:id/edit`: [053-access-staff-id-edit-edit-staff-default.png](053-access-staff-id-edit-edit-staff-default.png).
- `/access/staff/:id/password`: [054-access-staff-id-password-reset-staff-password-default.png](054-access-staff-id-password-reset-staff-password-default.png).
- `/access (Staff tab)`: [110-access-staff-tab-staff-tab.png](110-access-staff-tab-staff-tab.png).
- `/access (unauthorized)`: [157-access-permission-denied-permission-denied.png](157-access-permission-denied-permission-denied.png).

## Visual verification

Final screenshots were inspected side by side at 393 x 817 CSS pixels after cropping reference device chrome. Comparisons and 320/768 px overflow captures are in `artifacts/access-reference`. Keyboard focus and Myanmar layout were checked. This is not a pixel-identical claim.

## Explicit differences and preserved contracts

- The API has no role description field or role active flag. Cards show actual staff/page counts rather than unsaved descriptions or fabricated status. Role forms omit an unsavable description.
- Assignable permissions retain all actual granular API keys, including six My Shop permissions. Billing, Access and Settings remain owner-only; reference checkboxes that would imply granting them are replaced by a read-only notice. Permission groups therefore differ in height and content.
- The protected owner card uses the signed-in owner identity and is not a database staff record or assignable role. It has no edit/delete menu.
- Password reset uses the existing direct password endpoint. No emailed reset link is promised. Passwords are masked with explicit show/hide controls; length and matching confirmation are validated.
- Shared theme colors, Lucide icons, radius tokens, device-safe navigation and font rendering remain authoritative. The web viewport omits native bottom chrome; unauthorized users see only their permitted navigation modules.
- Lists retain pagination/end-of-list feedback. API data, counts, emails and status remain real.

## Controls and navigation checks

| Controls | Verified behavior |
| --- | --- |
| Roles/Staff, Add role/staff, menus and Edit | Correct routes, retained source/tab and draft after Back/Forward; no Back-only access fetch. |
| Role fields and permission checkboxes | Required name/permissions, exact selected keys in POST, server failure preserves draft. |
| Staff fields, role and status | Create/save payloads; changing role does not refetch staff or overwrite draft; clickable status switch. |
| Password visibility, confirmation, Reset | Mask toggle, mismatched confirmation blocked, direct password PUT; busy guards preserve submission behavior. |
| Delete and Cancel | Confirmation opens; Cancel sends no DELETE. Destructive real-server deletion was not performed. |
| Denied header/button | Authorized fallback; no roles/staff requests for a staff session. Server owner middleware is unchanged. |
| CSV | Existing scoped export handler retained; downloaded CSV was not manually opened in this task. |

Dev-server verification: `node scripts/check-access-reference.cjs`. Focused Access/App/radius unit checks pass, with lint checked separately. No production build was run. Browser API responses were isolated fixtures; physical-device and real-server mutation testing were not performed. The in-app browser failed its sandbox bootstrap, so isolated Chromium was used.
