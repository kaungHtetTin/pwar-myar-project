# Shop distribution

Open **Workspace → Shop distribution** or `#/shop-distribution` in PwarMyar Office. Both active Office admin roles can use this page, with the same access boundary as the Businesses list. Business-owner sessions cannot call the endpoint.

The map plots saved `shop_owner_locations` GPS coordinates. Shop names, addresses and phone numbers come from the existing business profile settings. Missing and invalid coordinates remain available in the list and the Without location filter. Suspended businesses remain visible, with amber markers; active businesses use blue markers. These indicate business status, not subscription status.

Use the app-bar search (Enter to apply) for business/shop name, address or phone. The filter drawer supports saved location, shop enabled/disabled, marketplace enabled/disabled/suspended, open/closed for orders, and current paid-plan status. Filters combine with search; Apply resets pagination and Clear resets all filters while preserving search. Coverage counts reflect search and all status filters before applying the location filter. Click a marker or Show on map to select a shop, inspect its GPS accuracy, open Google Maps, or open business details. Fit shops restores the overview. The standard Office pagination supports 10/25/50/100 rows.

Open for orders requires an enabled storefront, accepting orders, and no future temporary closure. This describes order acceptance, separately from the shop's published weekly opening hours. Missing storefront setup counts as disabled/closed. Marketplace suspension is distinct from disabled. Paid status uses the same selected current subscription as the Businesses list: active paid, free trial, expired, cancelled, scheduled, or no plan. No active paid plan matches every state except active paid; historical paid periods do not make a current trial count as paid. These states are shown on each shop and the selected-shop card.

## Data and performance

`GET /api/office/shop-distribution` accepts `q`, `location`, `shop`, `marketplace`, `orders`, `access`, `page` and `per_page`. All parameters are validated. List pages are capped at 100 rows; map markers are capped at 1,000, independently of list pagination. The response includes `map_total` and `map_limit`; the UI explains when searching is needed to narrow the overview. Every matching shop remains available in the list, and Show on map can select a listed location outside the overview cap.

The API uses joined business/profile/location/storefront queries with existing primary/unique indexes and no per-business queries. A lightweight billing-only query shares current-subscription selection and classification with the Businesses index, without its sales/catalogue aggregations. It excludes owner IDs, account emails and payment records; only the current access classification is included. No schema migration is needed. Leaflet and map styles load in a separate page bundle; canvas markers avoid creating one DOM node per shop.

The retained Office view preserves map instance, pan/zoom, selected shop, search, filters, pagination and scroll when returning from business details. Back does not fetch locations again. Refresh and Retry explicitly reload data. API failures retain previous results and label them accordingly; background-tile failures keep location markers and the list available, with Retry map.

## Map background

The background uses [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html) and OpenStreetMap tiles, requiring an internet connection. Visible OpenStreetMap attribution is retained. Browser cache headers and referer behavior are left intact, with no prefetching or bulk tile downloads, following the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION` can configure a compatible tile endpoint and its required attribution. Shop markers come from the authenticated API, independently of background tiles.

## Verification

PwarMyar verification after synchronization:

- 21 isolated backend tests passed, 461 assertions, covering the storefront toggle, shop distribution, business summary, Businesses index and subscription contract.
- 34 focused Office UI/navigation tests passed across Dashboard, BusinessStorefront, ShopDistributionPage and officeNavigation.
- Full Office lint and production build passed. The complete Office test suite was not rerun for this synchronization.
- Actual PwarMyar UI browser fixtures passed at 1440px and 390px: real map tiles/markers, combined filters, pagination, business details/Back, map/scroll retention, mutation reconciliation, retry, and missing/empty results.
- Separate browser checks passed for the published-product count and storefront toggle, including mouse/keyboard activation, failure/retry, retained card/draft and reload persistence.
- Screenshots were visually inspected. No live business records were changed; API fixtures and the isolated test database were used.
- In-app browser access is unavailable in this session, so local standalone Playwright was used.

Run `node scripts/check-office-shop-distribution.cjs` against the local Office server on port 5175, or set `OFFICE_ORIGIN` for another port.
