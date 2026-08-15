# Household Ledger — Google Sheet Schema
Create one new spreadsheet named `Household Ledger` with these tabs. Column order matters for the n8n nodes below (they auto-map by header name, but keep headers exact).

## Tab: `Catalog`
| item | category | store | price | unit_price | size | unit_label | last_updated | confidence | product_url | barcode |
|---|---|---|---|---|---|---|---|---|---|---|

- `confidence`: free text for now, e.g. `receipt` / `web-search` / `estimate` / `in-store-scan`
- `in-store-scan` — added 2026-08-15 for the in-store price logging feature (Feature 1, `log_price` action): a human-confirmed price read directly off a shelf tag while scanning a barcode in-store. Treated as higher-confidence than a web scrape — it writes straight to this row (matched by `item`+`store`) rather than sitting through the Price Refresh Agent's 24-48h freshness gate, and it's the caller's job (the frontend confirm form) to have a real user-entered price, never a guess. Also appends a `PriceLog` row in the same call for the historical trend record. If the barcode doesn't match an existing `item`+`store` row, a new `Catalog` row is created instead of guessing values — `unit_price`/`size`/`unit_label` are left blank since the scan-confirm form doesn't collect a pack size.
- Seed this tab from `purchase_history.csv` — one row per item/store pair, same as the current CATALOG array in the app
- `product_url` — optional, added 2026-07-31 for `Household_Ledger_Price_Refresh_Agent.json`'s hybrid price-source design (Open Decision #1, resolved): a direct link to this item's product page at this store. Rows with a URL get scraped directly (more reliable); blank rows fall back to a general web search instead. Fill these in gradually — not required for the workflow to run.
- `barcode` — optional, added 2026-08-11 for the in-app barcode scanner feature: the UPC/EAN printed on the item, used to match a camera scan straight to this row for an instant, free price lookup. Same "fill in gradually" convention as `product_url` — most rows will start blank and get filled in as items are actually scanned. When a scanned barcode has no match here, the List/Budget Webhook Agent's `barcode` action falls back to the UPCitemdb trial API (no key, ~100 lookups/day, coverage inconsistent) for product identity and any offers it can find — those results are clearly labeled as live/external in the UI, never merged into this sheet automatically (no write-back, per the "never invent or silently trust external data" convention).
- `store` naming convention (added 2026-08-11 for online-channel pricing, Open Decision #6, resolved): online/delivery orders from a store that also has in-store pricing get their own `store` value with an ` - Online` suffix — e.g. `Costco - Online`, `Walmart - Online` — kept distinct from the plain `Costco` / `Walmart` in-store rows since the two channels don't always charge the same price for the same item. Amazon has no in-store channel, so it's just `Amazon`. No schema change needed for this — `store` was already free text. `Household_Ledger_Price_Ingestion_Agent.json`'s extraction prompt applies this suffix automatically when a receipt is clearly an online order confirmation (falls back to the plain store name when it can't tell, same "don't guess" convention as everything else in this project).

## Tab: `ShoppingList`
| item | category | store | price | qty | cadence | added_date |
|---|---|---|---|---|---|---|

- `item` is the matching key the Webhook Agent upserts on — must exactly match `Catalog.item`

## Tab: `LastSavedList`
| item | category | store | price | qty | cadence | added_date |
|---|---|---|---|---|---|---|

- Same columns as `ShoppingList` — a single-snapshot mirror, not an append-only history. Added 2026-08-08 for the "Load last list" feature: on every `finalize`, the Webhook Agent clears this tab and re-appends the just-finalized list here (same clear+append pattern as `Clear ShoppingList Rows`), so the list survives a subsequent `Clear all` on `ShoppingList`. The `recall` action reads this tab and upserts its rows into `ShoppingList` (merging on top of whatever's already there, matched on `item` — same as a normal `upsert`), letting next week's list start from last week's as a base.

## Tab: `Settings`
| budget | cadence | CheckIn_Status | CheckIn_ResumeURL | home_address |
|---|---|---|---|---|
| 200 | Week | idle | | |

- Single row, values editable from the app or directly in Sheets
- `CheckIn_Status`/`CheckIn_ResumeURL` — needed by `Household_Ledger_CheckIn_Agent.json`'s pause/resume mechanism (see that file and `Household_Ledger_CheckIn_Reply_Listener.json`). Mirrors the `Status`/`ResumeURL` columns BNS's own Telegram Approval Listener uses on its `Calendar` tab, just on this single-row tab instead of a per-day row, since there's only ever one household check-in pending at a time. Already live in the real spreadsheet (`provision_sheet.py` creates these columns).
- `home_address` — added 2026-08-01 for Open Decision #5 (resolved: auto-geocoding). Used by `Household_Ledger_Recommendation_Agent.json`'s geocoding step as the origin address for distance lookups. **Left blank by default and not committed anywhere** — a real street address is personal information, so this must be filled in by hand directly in the live Sheet, never in a file checked into this repo. Until it's filled in, the geocoding step skips (no origin to measure from) and `Stores` distances stay manual/empty, same as before this feature existed.

## Tab: `PriceLog`
| item | store | price | date | status | scraped_at |
|---|---|---|---|---|---|

- Append-only history, one row per price observed by the Price Refresh Agent — this is what eventually powers trend/annual-savings math
- `status`/`scraped_at` — needed by `Household_Ledger_Price_Refresh_Agent.json`'s 24-48h freshness gate (CLAUDE.md §5): a scraped price is staged here as `status: pending` and only promoted into `Catalog` once it's sat unchallenged past the hold period — `scraped_at` needs hour-level precision for that, unlike `date`. Already live in the real spreadsheet (`provision_sheet.py` creates these columns).
- `status: confirmed` — added 2026-08-15 for the in-store price logging feature (`log_price` action, see `Catalog`'s `confidence: in-store-scan` note above). Used instead of `pending` because a human-confirmed in-store read bypasses the freshness gate entirely rather than sitting in it — `confirmed` reads clearer than reusing `pending` for a row that was never actually pending anything.

## Tab: `Inventory`
| item | status | last_purchased_date | last_finished_date | avg_days_to_finish | cycle_count |
|---|---|---|---|---|---|

- `status`: `stocked` / `low` / `finished`
- `cycle_count`: increments each time an item completes a purchase→finish cycle

## Tab: `Stores`
| store | address | lat | long | distance_from_home_mi | est_trip_cost | channel | delivery_fee |
|---|---|---|---|---|---|---|---|

- Start with `distance_from_home_mi` and `est_trip_cost` entered manually for Costco and Walmart; add rows as new stores (Publix, Amazon N/A, bulk warehouses) come online
- `channel`/`delivery_fee` — added 2026-08-11 for online-order pricing (Open Decision #6, resolved): `channel` is `in-store` or `online`; `delivery_fee` is a flat dollar amount charged once per checkout from that store, used by the List/Budget Webhook Agent to add delivery to the app's running total whenever the current shopping list includes an item from that store. Add one `Stores` row per channel actually used — e.g. `Costco` (`in-store`, blank fee) and `Costco - Online` (`online`, its delivery fee), matching the `store` naming convention documented under the `Catalog` tab above. **Flat fee only for v1 — no free-delivery-above-$X threshold modeling yet** (Walmart+/Costco same-day promos that waive the fee above a minimum order aren't accounted for), same "don't fake precision beyond what's actually modeled" spirit as the Catalog caution-icon convention. `delivery_fee` is manually maintained here, same as `distance_from_home_mi`/`est_trip_cost` — it is *not* auto-updated from scanned receipts (the Price Ingestion Agent logs whatever delivery fee it actually reads on a receipt into `PriceLog` as its own `Delivery Fee` row per store, for a historical record, but the live app total always reads the fee from this tab, not from the last receipt).
- `lat`/`long` — added 2026-08-15 for auto-geolocated store setup (Feature 2, `update_store_location` action): can now be populated from the app's "Manage stores" screen via a "Use my location" button (browser `navigator.geolocation`), in addition to manual entry directly in the Sheet. Raw coordinates always get saved as-is when the user taps it — no validation against the store's claimed `address`, since there's no reliable way to check that server-side (trust the human standing there). If `address` is blank at save time, a best-effort reverse-geocode (Google Maps Geocoding API) fills it in; a non-blank `address` is never overwritten. The app shows the auto-filled address back to the user rather than assuming it's exactly right (reverse-geocoded addresses are sometimes the nearest building, not the actual storefront).

---
**Next:** once this spreadsheet exists, grab its ID from the URL (`docs.google.com/spreadsheets/d/THIS_PART/edit`) — the Webhook Agent JSON below needs it dropped into every Google Sheets node's `documentId`.
