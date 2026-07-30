# Household Ledger — Google Sheet Schema
Create one new spreadsheet named `Household Ledger` with these tabs. Column order matters for the n8n nodes below (they auto-map by header name, but keep headers exact).

## Tab: `Catalog`
| item | category | store | price | unit_price | size | unit_label | last_updated | confidence |
|---|---|---|---|---|---|---|---|---|

- `confidence`: free text for now, e.g. `receipt` / `web-search` / `estimate`
- Seed this tab from `purchase_history.csv` — one row per item/store pair, same as the current CATALOG array in the app

## Tab: `ShoppingList`
| item | category | store | price | qty | cadence | added_date |
|---|---|---|---|---|---|---|

- `item` is the matching key the Webhook Agent upserts on — must exactly match `Catalog.item`

## Tab: `Settings`
| budget | cadence |
|---|---|
| 200 | Week |

- Single row, values editable from the app or directly in Sheets

## Tab: `PriceLog`
| item | store | price | date |
|---|---|---|---|

- Append-only history, one row per price observed by the Price Refresh Agent — this is what eventually powers trend/annual-savings math

## Tab: `Inventory`
| item | status | last_purchased_date | last_finished_date | avg_days_to_finish | cycle_count |
|---|---|---|---|---|---|

- `status`: `stocked` / `low` / `finished`
- `cycle_count`: increments each time an item completes a purchase→finish cycle

## Tab: `Stores`
| store | address | lat | long | distance_from_home_mi | est_trip_cost |
|---|---|---|---|---|---|

- Start with `distance_from_home_mi` and `est_trip_cost` entered manually for Costco and Walmart; add rows as new stores (Publix, Amazon N/A, bulk warehouses) come online

---
**Next:** once this spreadsheet exists, grab its ID from the URL (`docs.google.com/spreadsheets/d/THIS_PART/edit`) — the Webhook Agent JSON below needs it dropped into every Google Sheets node's `documentId`.
