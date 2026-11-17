# Subscription calendar

Open **Subscriptions → Subscription calendar** (`#/subscription-calendar`) in PwarMyar Office. Both active Office admin roles can view it.

The primary view is a Monday-first monthly calendar, with trial endings, paid-plan expirations, and combined expiry counts inside each date. The three cards above it show current trial, paid and expired business totals matching the search. Plan-type filtering applies to calendar dates, while the cards retain the current totals for matching businesses. Dates with expirations within seven days get an amber top border; within three days and past dates use red. Today is marked separately.

Month navigation includes Previous, Next, Today and a native month picker. Calendar day buttons support arrow keys and visible focus. The standard Office search and filter drawer support business/owner search and trial-only/paid-only filtering. There is no main table or timeline.

Selecting a day opens the shared read-only Office modal with the matching businesses, owner contact, plan, status, expiry time and View business action. Details load in bounded pages of 25, with Load more and independent retry. The day panel and its loaded rows/scroll are retained while viewing business details. Back returns to the same calendar month, search, filter, selected date and panel without an initial refetch. Explicit refresh and successful subscription changes reconcile the data. Editing a billing period emits the subscription-change event; existing assign/renew actions already advance the shared refresh token.

## Counting rules

Each business contributes only its currently selected subscription, using the same selection and classification as the Businesses index. Renewed/superseded periods and trial periods superseded by a paid plan are excluded. A plan with no expiry contributes to the active-paid total but has no calendar event. Expired, cancelled and scheduled selected periods retain their actual trial/paid type and saved end date in the calendar; their current access status is shown in the day panel. Current expired-card totals follow the existing Office expired classification.

This is an expiry calendar built from current records, not a historical daily snapshot of how many businesses used each plan in the past. Subscription edits or renewals can therefore change past calendar events. No historical snapshots, new database table, Firebase SDK, calendar library or paid map/calendar service is required.

## API

- `GET /api/office/subscription-calendar?month=YYYY-MM&kind=all|trial|paid&q=...` returns at most one count row per date, current status totals, Office timezone, today and server time.
- `GET /api/office/subscription-calendar/day?day=YYYY-MM-DD&kind=all|trial|paid&q=...&offset=0&limit=25` returns selected-date businesses, total and has_more. The limit cannot exceed 100.

Dates use the Office/storage timezone from `app.timezone`; the SQL range is inclusive at the start and exclusive at the next month/day boundary. Detail timestamps are serialized to UTC and displayed in the existing Office timezone. Inputs are validated, with years limited to 1900–2100. Queries group businesses once and avoid per-business application queries. The shared billing projection now exposes period dates, type and plan name without adding sales/catalogue aggregations. No schema/index migration was needed.

## Validation

PwarMyar synchronization checks:

- Backend: 14 tests / 252 assertions passed across subscription calendar, Businesses index, shop distribution and financial report.
- Office: all 40 focused tests passed across the calendar page/helpers, navigation, Dashboard and distribution page. The initial concurrent run passed 38 and hit two Dashboard five-second timeouts; rerunning that file separately with one worker passed all 19 Dashboard tests.
- Full Office lint and production build passed. Package version remains 1.0.4, with PwarMyar branding and existing environment settings preserved. No new dependency or schema migration was added.
- Browser fixtures passed calendar checks at 1440px, 390px and 320px, including month navigation, counts, date panels/Load more, search/filters, keyboard, nested business details, Back/Forward, retained state and error/retry.
- Payment request/history and Financial report business links and menu actions passed browser checks. Back preserves report/payment state and scroll without a new source fetch.
- Screenshots were visually inspected. Business APIs were intercepted; no live records were mutated. Local standalone browser automation was used because in-app browser access is unavailable in this session.

Run `node scripts/check-office-subscription-calendar.cjs`, `node scripts/check-office-payment-business-links.cjs` and `node scripts/check-office-financial-business-links.cjs` against the Office server at port 5175, or set `OFFICE_ORIGIN` for another origin. Screenshots are under `artifacts/office-subscription-calendar/`, `artifacts/office-payment-business-links/` and `artifacts/office-financial-business-links/`.
