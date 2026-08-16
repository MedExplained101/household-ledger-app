# HANDOFF — Tally (Household Ledger) — 2026-08-15

Sync document for the next session picking up this project. Written at the end of a session that shipped `log_price` + `update_store_location` (v1 and v2) end-to-end, merged them to `main`, and confirmed the Geocoding API path live. `TODO.md` has the full blow-by-blow history with every bug found and fixed; this doc is the condensed "what's true right now" snapshot.

## What's live right now

- **Production app**: `https://tally-mutandi.netlify.app`, deploys automatically from `main`. Last deploy triggered by commit `086379d` (the log_price/manage-stores merge) — nothing has changed on the frontend since.
- **Backend**: "Household Ledger - List Budget Webhook Agent" on n8n Cloud (`medexplained101.app.n8n.cloud`), production webhook `https://medexplained101.app.n8n.cloud/webhook/household-ledger-list`. Currently **Published**, 66 nodes. All 11 actions are live and confirmed: `get`, `upsert`, `remove`, `clear`, `finalize`, `recall`, `voice`, `barcode`, `set_budget`, `log_price`, `update_store_location` (v1 lat/long + v2 reverse-geocode).
- **Data layer**: Google Sheet "Household Ledger" (`1sPxqWNLfs5bT7hSJBgjwTdwJVx7l01D9VQXmKNB5-5Y`), tabs `Catalog`, `ShoppingList`, `Settings`, `PriceLog`, `Inventory`, `Stores`, `LastSavedList`. `Stores` is fully populated — every physical store has a real `address`; online-only channels (`Costco - Online`, `Walmart - Online`, `Amazon`) correctly stay blank across `address`/`lat`/`long`.
- **Other backend agents** (Price Refresh, Budget Alert Listener, Check-In Agent + Reply Listener, Recommendation Agent): all deployed and live-tested in earlier sessions, unchanged this session. Recommendation Agent still can't produce real output — blocked on `Inventory` purchase-cycle history accumulating over time, not a bug.

## This session's work

1. **Merged `claude/log-price-manage-stores` → `main`** (`086379d`). Ships: barcode/manual "Log price only" flow, the "Manage stores" geolocation modal, a fixed geolocation-permission-denied error message, and a resync of the checked-in n8n JSON to match live drift (`barcode`, `set_budget`, `update_store_location` v1 routing). No `gh` CLI available in-session (Bash or PowerShell) — merged and pushed directly with `git`.
2. **Confirmed the Geocoding API is enabled** (`c1c16ad`) on the `HomeManager` Google Cloud project — checked directly in the Maps Platform console (Enabled/Disabled status filters). This was the last unknown blocking `update_store_location` v2.
3. **Scaffolded `update_store_location` v2** in the repo JSON (`4cff573`): 6 new nodes implementing reverse-geocode-to-`address`, gated so it only ever fires when `Stores.address` is genuinely blank. Structurally validated, not yet live.
4. **Built it live in n8n and published.** Wired `Store Row Found?` → `Has Existing Address?` → (true: `Keep Existing Address` / false: `Reverse Geocode via Google Maps` → `Parse Geocode Result` → `Geocode Succeeded?` → true: `Update Store Address` / false: skip) → all converging on `Format Update Store Location Response`. Deleted the old direct v1 edge into that node.
5. **Found and fixed a real bug**: `Format Update Store Location Response` still had its v1 code (`row.address`, a pre-write snapshot) instead of the v2 code already sitting in the repo (`$json.address`, the resolved value). The underlying Sheets write was correct the whole time — only the webhook's response was wrong. Fixed live, republished, re-verified.
6. **Live-tested all three paths** against the production webhook and confirmed via direct Sheet reads:
   - `Costco` (has address) → address unchanged.
   - `Amazon` (blank address, used as a disposable test case) → real address geocoded and written; response echoed it correctly. Cleaned back to blank immediately after.
   - Unknown store name → clean `404`.
7. **Documented everything in `TODO.md`** (`a1c2b8d`) with full session logs, node-by-node.

## Known open issue (not blocking, flagged for later)

Two attempts to test the geocode path against a **brand-new** `Stores` row (added in the same session) both got `404 Store not found`, even though the row was confirmed present and correctly spelled in the live Sheet. Falling back to an *existing* row (`Amazon`) with a blank address worked immediately. Root cause not diagnosed — possibly `Find Store Row`'s lookup not seeing very-recently-appended rows. Doesn't affect the realistic use case (geolocating a store already sitting in `Stores`), but would bite someone adding a store and immediately trying to geolocate it. Worth a closer look if that flow ever gets built.

## Outstanding work, priority order

1. **Frontend gap**: the "Manage stores" modal doesn't surface the resolved `address` from v2 anywhere in the UI — it only shows/sets lat/long. Minor, not blocking.
2. **Recommendation Agent**: still can't produce real output. Needs `Inventory.avg_days_to_finish`/`cycle_count` to accumulate over several real purchase cycles via the Check-In Agent. Multi-week wait, not a bug — nothing to build here.
3. **Data quality backlog** (all pre-existing, unchanged):
   - A few `purchase_history.csv` line items have receipt-scan artifacts (pen-mark-obscured names) needing a follow-up photo or manual ID before they can be seeded into `Catalog`.
   - Pack size/weight capture on future receipts, especially meat — only Eggs and Potato Chips currently have a confirmed size-verified cross-store price match.
   - Add Publix and Amazon to the catalog once real sample orders exist for them.
4. **Cosmetic**: the reused Google Maps credential is named "Google Distance Matrix API" but now backs both Distance Matrix and Geocoding calls — worth a rename in n8n's credential settings for clarity, purely cosmetic.
5. **General usage feedback** from Graham and Rutendo once they've both used the newly-shipped features (barcode/log-price, manage-stores) for a while.

## Key IDs and access notes

- Spreadsheet ID: `1sPxqWNLfs5bT7hSJBgjwTdwJVx7l01D9VQXmKNB5-5Y`
- Google Sheets credential (n8n): `zz9INbfV79dYEmQl`, "Google Sheets account"
- Google Maps credential (n8n): `jGUkE00XLHIOjbD4`, "Google Distance Matrix API" (Query Auth, backs both Distance Matrix and Geocoding calls)
- n8n workflow: "Household Ledger - List Budget Webhook Agent" on `medexplained101.app.n8n.cloud`
- `Settings.home_address` is deliberately never committed to this repo or the checked-in Sheet snapshot — real address is personal information, filled in by hand directly in the live Sheet only.
- `gh` CLI is unavailable in this environment (both Bash and PowerShell) — PRs/merges to `main` go through plain `git` commands directly.
- `npm`/`node` are unavailable in this environment's shell tools — verification relies on the `mcp__Claude_Browser__preview_start` dev server compiling/running cleanly with no console errors, not `npm run lint`/`test` directly.
- Working live-canvas techniques for n8n (documented at length in `TODO.md`'s 2026-08-15 entries): use `getBoundingClientRect()` via JS to get exact node/handle coordinates, convert to the Browser pane's scaled screenshot coordinate frame, and drag from output handles to empty canvas (opens node search) or onto/near a target node (creates the connection). Plain `scroll` pans the canvas (down = content moves up, left = content moves right); `+`/`-` keys zoom. The left sidebar occupies screen x 0–200 and silently swallows clicks/drags as text-selection if a coordinate lands on it.

## Files touched this session

- `src/App.jsx` — geolocation-permission-denied message fix (already live via the `main` merge)
- `Household_Ledger_List_Budget_Webhook_Agent.json` — `update_store_location` v2 scaffold (matches what's now live)
- `TODO.md` — full session logs
- `HANDOFF.md` — this file
