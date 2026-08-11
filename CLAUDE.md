# CLAUDE.md — Household Ledger Project

## What this project is
A tool to plan recurring (day/week/month) household grocery and household-goods
shopping against a set budget, finding the best price per item across stores.
Location basis: Alpharetta / Milton, GA. Currently Costco + Walmart, with
Publix and Amazon planned once sample data exists.

## Who this is for
Graham makes final call on what goes on the list, based on available funding.
Rutendo will also be using and iterating on the tool going forward — build
and explain changes with both users in mind, not just Graham.

## Real-world context
Shopping is done online now (Costco same-day delivery, Walmart delivery,
Amazon for extras) — not an in-person multi-stop route anymore.

## Data on hand
`purchase_history.csv` — 162 line items merged from 7 Costco receipts
(Alpharetta #743, 05/10–06/21/2026) and 3 Walmart online orders
(07/10–07/19/2026). Categorized (Produce, Meat, Dairy, Pantry, Frozen,
Snacks, Household, Beverages, Prepared/Deli, Seafood, Bakery,
Health/Supplements), with pack size and $/lb or $/ct computed only where
the receipt actually printed a size. Now checked into this repo as
`purchase_history.csv` — not yet loaded into the `Catalog` sheet tab (see `TODO.md`).

## Key known limitation — do not silently "fix" this
Costco and Walmart receipts almost never share an exact item name, and most
Costco items don't print a pack size or weight. **Only two items have a
confirmed, size-verified price comparison across both stores: Eggs and
Potato Chips.** Every other item with prices from both stores is a
directional estimate, not a true $/lb match. The app deliberately shows a
caution icon (⚠️) on these items — this is intentional product behavior,
not a bug to clean up.

## Architecture (see household-ledger-architecture.md for full detail)
- **Data layer**: one Google Sheet, tabs = `Catalog`, `ShoppingList`,
  `Settings`, `PriceLog`, `Inventory`, `Stores` (see
  household-ledger-sheets-schema.md for exact columns).
- **n8n workflow fleet**, modeled on the existing "Beautiful Nature Scenes"
  and "ME101" workflows already built for other projects:
  - **Price Refresh Agent** — scheduled, detects stale prices, re-scrapes,
    updates `Catalog`. Not built yet.
  - **List/Budget Webhook Agent** — the one implemented so far (see
    `Household_Ledger_List_Budget_Webhook_Agent.json`). Mobile/web app POSTs
    `{action: "get" | "upsert" | "remove"}` to this webhook; it never talks
    to Sheets directly. Still needs a real spreadsheet ID and Google Sheets
    credential wired in before it's live — see `TODO.md`.
  - **Budget Alert Listener** — Telegram alert when a list goes over budget. Not built yet.
  - **Check-In Agent** — scheduled (default every 2 days) Telegram
    check-in on inventory status (`stocked` / `low` / `finished`). Not built yet.
  - **Recommendation Agent** — bulk-trip economics: is a farther bulk-price
    store worth the trip, based on `Inventory.avg_days_to_finish` ×
    price gap vs. `est_trip_cost`. Gated behind a confidence threshold of
    **8 completed purchase cycles** per item before being called "reliable"
    rather than "provisional." Not built yet.
- **Frontend**: `src/App.jsx` — React app, wired to a live n8n webhook
  (`WEBHOOK_URL` constant near the top of the file) rather than the static
  in-file catalog it started as. Confirm this URL is still correct before
  assuming the app is live.

## Open decisions not yet finalized (see bottom of architecture.md)
1. Does the Price Refresh Agent hit known store URLs, or search generally?
2. New dedicated spreadsheet, or new tabs in an existing one?
3. One shared Telegram bot for budget alerts + inventory check-ins, or two
   separate bots?
4. Check-in cadence: every 2 days (current default), daily, or every 3?
5. Store distances: manual entry to start, or auto-geocoding right away?
6. **Resolved 2026-08-11** — online vs. in-store pricing: online channels
   (Costco same-day, Walmart delivery, Amazon) get their own `store` entry
   (` - Online` suffix) rather than sharing prices with the in-store row,
   since the two can genuinely differ. Delivery fees live on the `Stores`
   tab (flat fee per store, manually maintained — no free-delivery
   threshold modeling yet) and get added to the app's budget total once
   per distinct online store on the current list. See
   household-ledger-sheets-schema.md's `Catalog`/`Stores` tab notes.

## Working style / conventions to follow
- Don't imply a price comparison is confirmed unless both sides have a
  verified pack size — keep the ⚠️ caution-icon convention for anything
  uncertain, including in any new modules (this same convention is reused
  in Section 8 of the architecture doc for data-maturity confidence, not
  just missing sizes).
- Reuse patterns from the existing Beautiful Nature Scenes and ME101 n8n
  workflows rather than inventing new shapes (gap-detection, HTTP-polling,
  pause/resume Telegram approval, clear+append tally sync) — see
  household-ledger-architecture.md Section 1 for the specific mappings.
- Recommendation: build the PWA (web app hitting the n8n webhooks) before
  investing in a native mobile build — validates the pipeline first.

## Next steps as of last check-in
1. Capture pack size/weight on future receipts (or via product photos) to
   fill in unit pricing — priority: meat (ground beef, ribs), where dollar
   swings are biggest.
2. Add Publix and Amazon once sample orders exist.
3. Get real usage from Graham and Rutendo, then iterate based on what's
   actually annoying or missing in practice.
