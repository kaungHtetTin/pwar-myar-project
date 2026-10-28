# Consistent UI and endless-scroll patterns

## Shared visual language

Use the existing CSS variables in `mobile/src/styles/index.css`. Extend tokens there only when a value is reused by multiple modules. Keep module layout rules in `mobile/src/styles/<module>.css`.

Prefer reusable components for:

- app header and account action;
- page heading and primary action;
- notice/status message;
- summary metric card;
- search field and expandable filters/tools;
- content card and compact row;
- bottom sheet, confirmation sheet, and fields;
- initial skeleton, incremental spinner, retry, empty, and end-of-list state.

Avoid multiple components with the same role but slightly different radius, spacing, or colors. Refactor the existing primitive first.

## Submission form navigation

Render every form that creates or mutates server data as a dedicated full page with its own route. This includes create/edit forms, stock adjustments, checkouts, payments, settings forms, and similar workflows.

- Use stable paths such as `/products/new`, `/products/:id/edit`, and `/products/:id/stock`.
- Support direct loading and browser refresh by fetching the required record from the route ID; never depend only on list-row state.
- Provide a visible back action plus correct browser back/forward behavior. After a successful save, replace or navigate to the appropriate detail/list route without reopening a modal.
- Preserve field-level Laravel validation on the page and prevent accidental duplicate submission while saving.
- Keep long forms readable with grouped sections, a bounded content width, safe-area spacing, and accessible sticky actions when useful.
- Do not use a modal, dialog, drawer, popover, or bottom sheet for a submission form. Reserve those surfaces for confirmation, read-only detail, or compact choices that do not submit mutations.
- Test the route transition, direct deep link, save, validation failure, cancel/back behavior, and absence of a dialog wrapper.

## Shared swipe-to-refresh contract

Wrap every authenticated route with the shared app-level swipe-to-refresh shell. Do not create module-specific pull indicators or gesture handlers.

- Start tracking only for a single downward touch when the window is already at scroll position zero.
- Ignore gestures that begin inside dialogs, sheets, or elements marked to disable swipe refresh.
- Apply damped movement, a bounded pull distance, and an explicit release threshold. Snap back without refreshing below the threshold.
- Prevent concurrent refreshes and always settle the indicator after success or failure.
- Refresh app configuration/permissions on every route. Register page-specific list, summary, and metadata refresh actions when that page owns remote data.
- Reset paginated visible lists through their existing reload mechanism so offsets, stale request generations, deduplication, and exhaustion remain correct.
- Announce the active refresh with an accessible status and honor reduced-motion preferences.
- Test below-threshold cancellation, threshold refresh, app-level plus page-level callbacks, and duplicate-gesture protection.

## Endless-scroll state model

Maintain at least:

```js
const [items, setItems] = useState([]);
const [offset, setOffset] = useState(0);
const [total, setTotal] = useState(null);
const [initialLoading, setInitialLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [loadMoreError, setLoadMoreError] = useState('');
const generation = useRef(0);
const loadingRef = useRef(false);
```

On query-scope changes:

1. Increment `generation.current`.
2. Clear items and offset.
3. Clear total/exhaustion and incremental error.
4. Load offset zero.

On page success:

1. Ignore the response when its generation is stale.
2. Append with stable-ID deduplication.
3. Advance offset by the number of received records.
4. Mark exhausted when accumulated unique items reach `total`, or when a page is shorter than the requested limit if total is unavailable.

Use a callback ref or effect-backed `IntersectionObserver`. Observe only while there are more results and no request is active. Disconnect it during cleanup and before observing a replacement sentinel.

Render the sentinel after the list:

- spinner/status during incremental loading;
- retry button after incremental failure;
- “You’re all caught up” only when at least one item exists and exhaustion is authoritative;
- accessible Load more fallback when `IntersectionObserver` is unavailable.

## List mutation behavior

- Create: prepend or insert consistently, then refresh summary. Avoid silently duplicating the server record.
- Update: replace by stable ID without changing scroll position.
- Delete: remove locally, decrement known total, refresh summary, and fetch another page when needed to fill the viewport.
- Filter/search: reset rather than append a different query scope.
- External refresh: retain the current scroll only if item identity and order remain stable; otherwise reset explicitly.

## Required tests

- initial page renders items and summary;
- sentinel requests the next offset;
- next page appends without duplicate IDs;
- filter/search resets to offset zero;
- short final page or total count stops requests;
- incremental error preserves existing cards and offers retry;
- empty first page shows the actionable empty state;
- create/edit/delete and secondary sheets still update the endless list correctly.
