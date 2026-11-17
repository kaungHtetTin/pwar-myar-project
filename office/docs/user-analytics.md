# User analytics

Open **Workspace → User analytics**. Choose Business users (owners and staff) or Shop customers and a 7, 30, or 90 day period. The shared Refresh action reloads the report. Returning from another Office section retains the selected accounts, period, charts, and scroll.

The authenticated `GET /api/office/user-analytics` endpoint accepts `audience=business|customers` and `days=7|30|90`. All Office administrators can read aggregate counts; no account details are returned.

- DAU is today's distinct accounts with at least one successful authenticated API request. WAU and MAU use the last 7 and 30 calendar days, including today. Background requests count; these metrics do not measure time spent in the foreground. Anonymous visitors and Office administrators are excluded.
- Activity middleware stores one row per account, audience, and day. A unique index prevents duplicates, with a daily cache to avoid repeated inserts. Activity recording failures are reported without failing business/customer requests.
- Activity collection begins after deployment. Dates before the first recorded activity are marked Not tracked. Earlier activity cannot be reconstructed from account creation or current sessions. Comparisons and rolling windows may be partial until sufficient history accumulates.
- Registration trends use account creation timestamps, including staff created by an owner and customers added by Office. Growth reflects accounts still in the database. Disabled accounts remain included; deleted accounts are excluded from registration/growth, while recorded aggregate activity remains.
- All day boundaries follow `app.timezone`, matching SQL timestamp storage and the Office timezone. Today and the current period are incomplete.

Deploy the Laravel migration `2026_11_14_000001_create_user_activity_days.php` before serving the new analytics page, then deploy the Office build and backend changes. The migration has been applied to the local app and testing databases.

## Verification

Rendered component and Dashboard tests verify account/period selection, keyboard chart detail, pre-tracking labels, stale response protection, failure/Retry, sidebar routing, shared Refresh, sidebar return, and browser Back. Return resumes the same summary DOM node and filters with no additional analytics request. The existing retained-view shell owns scroll restoration. These top-level sidebar pages have no app-bar Back control. No separate interactive browser visual review was performed.

Backend feature tests cover Office authentication, filter validation, unique daily activity, independent audiences, local date boundaries, zero-filled days, previous-period registrations, and real business/customer authenticated API activity capture. Build and targeted ESLint checks cover the new page.
