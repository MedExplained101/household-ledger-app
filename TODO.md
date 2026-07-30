# TODO

This file tracks outstanding work for the Household Ledger app so it can be followed here on GitHub (issues can link back to items below) instead of living only in chat history.

## Status

A search of this repo (2026-07-30) found **no existing plans, strategy docs, work logs, or `TODO`/`FIXME` comments** at the time — only `README.md`, with no inline TODO markers in code. A follow-up Google Drive sweep found a related, not-yet-connected backend workflow, and the user has since supplied the project's actual `CLAUDE.md` primer, sheets schema, n8n workflow JSON, full architecture doc, and the 162-line-item `purchase_history.csv` directly — all now checked into this repo. That's the complete file set `CLAUDE.md` and the export guide describe as "non-negotiable for the repo." This file is the actionable summary; `CLAUDE.md` and `household-ledger-architecture.md` are the fuller project context.

## Backend n8n workflow fleet — only 1 of 5 pieces exists

Per `CLAUDE.md`, the intended architecture is a fleet of n8n workflows modeled on the existing Beautiful Nature Scenes / ME101 automations. Only the first is built:

- [x] List/Budget Webhook Agent — implemented (`Household_Ledger_List_Budget_Webhook_Agent.json`, now in this repo). Still needs: a real Google Sheet built from `household-ledger-sheets-schema.md` (the workflow's `documentId` is a `REPLACE_WITH_SHEET_ID` placeholder), a Google Sheets credential connected (currently references a credential ID copied from the BNS workflows — confirm this is the intended account), the workflow activated in n8n and imported (it's saved to Drive/this repo but not deployed), and the resulting production webhook URL wired into `WEBHOOK_URL` in `src/App.jsx`.
- [ ] Price Refresh Agent — scheduled, detects stale `Catalog` prices, re-scrapes, updates the sheet. Not started. Open design question: hit known store URLs directly, or search generally (see Open Decisions below). Per `household-ledger-architecture.md` Section 5, build these reliability constraints in from day one rather than retrofitting:
  - 24–48h freshness gate before trusting a newly scraped price
  - Structured JSON schema for every price extraction — never free text
  - Budget for extraction failures — ME101's equivalent agent saw ~38.5% early on; needs retry/validation logic, not a bare scrape-and-trust path
  - Watch the n8n plan's monthly execution cap — refreshing ~55 catalog items × 2 stores adds up fast if scheduled too often
- [ ] Budget Alert Listener — Telegram alert when a list goes over budget. Not started.
- [ ] Check-In Agent — scheduled (default every 2 days) Telegram check-in on inventory status (`stocked`/`low`/`finished`). Not started.
- [ ] Recommendation Agent — bulk-trip economics (is a farther bulk-price store worth the trip, based on `Inventory.avg_days_to_finish` × price gap vs. `est_trip_cost`). Not started; gated behind 8 completed purchase cycles per item before being called "reliable" rather than "provisional."

## Open decisions (from `CLAUDE.md`, not yet finalized)

- [ ] Does the Price Refresh Agent hit known store URLs, or search generally?
- [ ] New dedicated spreadsheet, or new tabs in an existing one?
- [ ] One shared Telegram bot for budget alerts + inventory check-ins, or two separate bots?
- [ ] Check-in cadence: every 2 days (current default), daily, or every 3?
- [ ] Store distances: manual entry to start, or auto-geocoding right away?

## Data quality next steps (from `CLAUDE.md`)

- [ ] Seed the `Catalog` sheet tab from `purchase_history.csv` (now both in this repo) — one row per item/store pair, per the schema doc's instruction.
- [ ] Resolve a handful of receipt-scan artifacts in `purchase_history.csv` before seeding `Catalog` from it: `UNCLEAR - ORG item (obscured by pen mark)` (category `Other`, 2026-06-13 Costco), `KS BATH (tissue, partially obscured)`, and `HBO W/ALMNDS (unclear brand)` — these need the actual product identified (or a follow-up receipt photo) rather than being seeded with placeholder names.
- [ ] Capture pack size/weight on future receipts (or via product photos) to fill in unit pricing — priority: meat (ground beef, ribs), where dollar swings are biggest. Currently only Eggs and Potato Chips have a confirmed, size-verified cross-store price match; this is intentional caution-icon behavior, not a bug to "fix" by faking a match.
- [ ] Add Publix and Amazon once sample orders exist for those stores.
- [ ] Get real usage feedback from both users (Graham and Rutendo — this tool is meant for both, not just Graham) and iterate based on what's actually annoying or missing in practice.

## Suggested next steps

Based on gaps visible in the current README and project setup:

- [ ] Move `WEBHOOK_URL` out of `src/App.jsx` and into an environment variable — it's currently hardcoded in source, which makes rotating the n8n webhook or open-sourcing the repo harder than it needs to be.
- [ ] Add a basic CI check (lint/build) so a broken `npm run build` is caught before Netlify/Vercel deploy rather than at drag-and-drop time.
- [ ] Add at least a smoke test for the app's core ledger flow — there is currently no test setup in `package.json`.
- [ ] Decide on and document one canonical deploy path (Netlify vs Vercel) — the README currently presents both as equally valid, which can lead to drift between two live deployments.

---
*Add new items here as they come up, and check them off (or link a GitHub issue) as they're resolved — this keeps the doc useful instead of stale.*
