# Shop fulfillment

Route `/shop/fulfillment` maps to `102-shop-fulfillment-fulfillment-default.png`.

The screen preserves the reference's header, Pickup instructions card with address and hours, Fulfillment instructions card, buyer preview card, and fixed Save changes action above the shared bottom navigation. Shared compact typography, green theme, radius tokens and controls remain in use. Content scrolls naturally, including long instructions and Myanmar labels; the preview does not need to fit entirely above the fold.

Pickup address and hours are real optional settings, added by migration `2026_10_16_120000_add_pickup_details_to_storefront_settings`. A blank pickup address uses the shared shop address without editing it. Hours are descriptive text; they do not change opening-hours enforcement or checkout availability. Existing pickup instructions remain unchanged in storage and keep their supported 2,000-character limit instead of the reference's 500-character example. The preview uses the neutral heading Order pickup rather than assuming every shop collects at a front counter.

The buyer storefront and checkout display the saved pickup details. New pickup orders snapshot the address, hours and instructions into their fulfillment instructions, so later settings changes do not rewrite previous orders. Delivery instructions and fee calculations remain unchanged.

Save reads current settings before updating only the fulfillment fields and required storefront configuration. It preserves independently updated delivery fees and payment configuration. Errors retain the form and attach to the affected field; a working guard prevents duplicate submissions. Back returns to the retained My Shop source. Browser Forward resumes the unsaved form without a new settings request. Existing ecommerce_settings permission, subscription and owner-location gates remain active.

Verification: `scripts/check-shop-fulfillment-reference.cjs` uses intercepted APIs and checks 320/393/768 widths, live preview, footer clearance, source/draft retention, server field errors, retry, long content and Myanmar. Set `FULFILLMENT_BROWSER=firefox` for Firefox. Screenshots and verification records are in `artifacts/shop-fulfillment-reference`. Backend transaction tests verify saved/public fields, validation, immutable order snapshots and unchanged business identity. Scoped mobile and buyer checkout/order-detail tests cover the affected flows. No production build was run.

Control record: Back resumes My Shop without mutation or refetch; Save submits once, retains values on error and returns to My Shop on success. The preview is informational. Fixed actions remain above bottom navigation and outside the scrollable content.

Completed checks: Chromium and Firefox browser scripts passed; 84 scoped mobile tests, 11 buyer checkout/order-detail tests and 76 Ecommerce API feature tests passed. Scoped lint, handoff validation and the buyer dev-server transform passed. Final comparison: artifacts/shop-fulfillment-reference/compare-102.png.
