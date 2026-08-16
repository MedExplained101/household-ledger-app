# HANDOFF — Tally (Household Ledger) — 2026-08-16

Sync document for the next session picking up this project. Written at the end of a session that finished and shipped `add_store` end-to-end (backend was left mid-build last session), fixed a real live-wiring bug and a real error-handling bug found along the way, and brought the docs/handout up to date. `TODO.md` has the full blow-by-blow history with every bug found and fixed; this doc is the condensed "what's true right now" snapshot.

## What's live right now

- **Production app**: `https://tally-mutandi.netlify.app`, deploys automatically from `main`. Last deploy triggered by commit `4df8587` (Add-store UI + `callWebhook` fix) — confirmed live and working directly in production, not just dev.
- **Backend**: "Household Ledger - List Budget Webhook Agent" on n8n Cloud (`medexplained101.app.n8n.cloud`), production webhook `https://medexplained101.app.n8n.cloud/webhook/household-ledger-list`. Currently **Published**, 73 nodes. All 12 actions are live and confirmed: `get`, `upsert`, `remove`, `clear`, `finalize`, `recall`, `voice`, `barcode`, `set_budget`, `log_price`, `update_store_location` (v1 lat/long + v2 reverse-geocode), `add_store`.
- **Data layer**: Google Sheet "Household Ledger" (`1sPxqWNLfs5bT7hSJBgjwTdwJVx7l01D9VQXmKNB5-5Y`), tabs `Catalog`, `ShoppingList`, `Settings`, `PriceLog`, `Inventory`, `Stores`, `LastSavedList`. `Stores` still has two stray extra columns (`ok`, `result`) left over from earlier live-node-testing contamination (see TODO.md's 2026-08-08 log) — harmless, not referenced by any node, not yet cleaned up.
- **Other backend agents** (Price Refresh, Budget Alert Listener, Check-In Agent + Reply Listener, Recommendation Agent): unchanged this session. Recommendation Agent still can't produce real output — blocked on `Inventory` purchase-cycle history accumulating over time, not a bug.
- **User-facing docs**: `USER_GUIDE.md` reflects everything through `add_store` and the overwrite-confirmation. The printer-ready handout (a Claude Artifact, not a repo file) is at `https://claude.ai/code/artifact/7668c485-bcf9-44b5-8d15-6bf5f2ea0b5f`, currently **v3** (2026-08-16) — see `CLAUDE.md`'s "Handout versioning" section for the versioning standard before touching it again.

## This session's work

1. **Found and fixed a live n8n wiring bug.** The `add_store` backend (scaffolded and built live last session) looked correct at a glance, but `Find Store Row for Add` was actually wired off `Route Action` output 5 (`recall`'s output) instead of output 11 (`add_store`'s own output) — a live-canvas drag error from the prior session. The checked-in repo JSON had the correct wiring all along. Deleted the wrong edge, confirmed the legitimate `recall` edge was untouched, wired the correct one (coordinate-based drag failed silently on the small handle target — fell back to synthetic pointer events dispatched via `javascript_exec`), re-verified the full connection graph programmatically, and published.
2. **Live-tested `add_store` against the production webhook**: new-store success (200) and duplicate-store rejection (409) both confirmed. Test data cleaned up from the live `Stores` sheet.
3. **Built the frontend "Add store" UI** (`src/App.jsx`) — text input + button in the Manage Stores modal; new stores appear immediately with a working "Use my location" button.
4. **Found and fixed a second, broader bug** while testing the duplicate-store path through the actual browser UI: `callWebhook` threw on any non-2xx HTTP response, so the app's own `{ok:false, error}` JSON bodies on 404/409 responses never reached the code already written to handle them — always fell into a generic "Couldn't reach the server" message instead of the specific one. This wasn't new to `add_store`; `update_store_location`'s "unknown store" 404 path had the identical latent bug, just never caught live before. Fixed at the root by removing the throw — `callWebhook` now always returns the parsed JSON body, matching what every call site already expected.
5. **Confirmed everything live in production**, not just dev.
6. **Updated `USER_GUIDE.md`** for add-a-store and the "Overwrite location?" confirmation.
7. **Updated the printer-ready handout to v3**: added the barcode "Log price only" mode and a new "Store locations" section; found and fixed a real print bug (`.front-foot`'s bottom padding was 14px vs. `.back-foot`'s 0.4in — thin enough to fall inside a real printer's unprintable edge margin, clipping pages 1 & 4's footer text on physical output); established and documented a version-naming standard (`Tally · vN · YYYY-MM-DD` stamped on every page footer) in `CLAUDE.md`.
8. **Documented everything in `TODO.md`** with the full session log.

## Known open issues (not blocking, flagged for later)

- **Stray `ok`/`result` columns on the `Stores` tab** — pre-existing contamination from earlier live-node testing (2026-08-08), not cleaned up. Harmless.
- **Frontend gap, still open**: the Manage Stores modal doesn't surface the resolved `address` from `update_store_location` v2 anywhere in the UI — only shows/sets lat/long.
- **Recommendation Agent**: still can't produce real output — needs `Inventory` purchase-cycle history to accumulate over several real cycles via the Check-In Agent. Multi-week wait, not a bug.
- **Cosmetic**: the shared Google Maps credential is still named "Google Distance Matrix API" though it now backs both Distance Matrix and Geocoding calls.
- **Data quality backlog** (unchanged): a few `purchase_history.csv` items have receipt-scan artifacts needing manual ID; pack size/weight capture on future receipts, especially meat; Publix and Amazon still need real sample orders before they can join the catalog.

## Outstanding work, priority order

1. **General usage feedback** from Graham and Rutendo — barcode/log-price, manage-stores, and now add-store have all shipped; worth a real-world usage pass before adding more.
2. **Recommendation Agent** — no action needed yet, just time/data accumulation.
3. **Data quality backlog** — see above, all pre-existing and non-urgent.
4. **Cosmetic credential rename** — whenever someone's next in that n8n credential's settings anyway.

## Key IDs and access notes

- Spreadsheet ID: `1sPxqWNLfs5bT7hSJBgjwTdwJVx7l01D9VQXmKNB5-5Y`
- Google Sheets credential (n8n): `zz9INbfV79dYEmQl`, "Google Sheets account" — note there are similarly-named credentials in the n8n instance ("Google Sheets account 2", "ME101 Google Sheets") and the dropdown does **not** reliably default to the right one; verify by exact display name every time.
- Google Maps credential (n8n): `jGUkE00XLHIOjbD4`, "Google Distance Matrix API" (Query Auth, backs both Distance Matrix and Geocoding calls)
- n8n workflow: "Household Ledger - List Budget Webhook Agent" on `medexplained101.app.n8n.cloud`
- Handout artifact: `https://claude.ai/code/artifact/7668c485-bcf9-44b5-8d15-6bf5f2ea0b5f` — see `CLAUDE.md`'s "Handout versioning" section before editing.
- `Settings.home_address` is deliberately never committed to this repo or the checked-in Sheet snapshot.
- `gh` CLI is unavailable in this environment — merges/pushes to `main` go through plain `git` directly.
- `npm`/`node` are unavailable in this environment's shell tools — verification relies on the `mcp__Claude_Browser__preview_start` dev server compiling/running cleanly, not `npm run lint`/`test` directly.
- **n8n live-canvas technique reconfirmed this session**: plain coordinate-based `left_click_drag` on a handle can fail silently (looks like it worked, no edge created) — the reliable path is dispatching synthetic `pointerdown`/`pointermove`/`pointerup` `MouseEvent`/`PointerEvent`s directly on the handle DOM elements via `javascript_exec`, same as the established dropdown-selection technique.
- **Verifying a live-reload React UI change**: always perform the click and the result-check inside a single atomic `javascript_exec` script — splitting them across separate tool calls risks a false negative if Vite HMR remounts state in the gap between calls.
- **Print-safety check for the handout**: before publishing a content change, copy the file into `public/` in this repo, view it through the Vite dev server, and confirm every page's footer sits comfortably inside its sheet — then delete the copy again. It's a throwaway check, not something to commit.

## Files touched this session

- `src/App.jsx` — Add-store UI in the Manage Stores modal; `callWebhook` no longer throws on non-2xx responses
- `USER_GUIDE.md` — add-a-store and overwrite-confirmation documented
- `CLAUDE.md` — "Handout versioning" section added (version-number + date standard, print-safety check step)
- `TODO.md` — full session log
- `HANDOFF.md` — this file
- Handout artifact (external, not a repo file) — updated to v3
