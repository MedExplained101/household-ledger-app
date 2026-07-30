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

- [x] ~~Seed the `Catalog` sheet tab from `purchase_history.csv`~~ — **`catalog_seed.csv` generated 2026-07-30**, ready to paste in once the real spreadsheet exists (still blocked on that — see the Webhook Agent's `REPLACE_WITH_SHEET_ID` placeholder above). Per the schema doc's own instruction ("same as the current CATALOG array in the app"), this was generated from the already-curated 65-item `CATALOG` array in `src/App.jsx` — deduped and with sizes/unit prices already resolved — rather than re-deriving from the rawer 162-line `purchase_history.csv`, matching the exact 9-column schema (`item, category, store, price, unit_price, size, unit_label, last_updated, confidence`), 78 rows (one per item/store pair). `last_updated` is set per-store from the receipt date ranges in `CLAUDE.md` (Costco: 2026-06-21, last of 7 receipts; Walmart: 2026-07-19, last of 3 orders) — an approximation, not a per-item observation date, since the app's `CATALOG` array doesn't track that. `confidence` is `receipt` throughout, since every row comes from an actual purchase, not a web search or estimate.
- [ ] Resolve a handful of receipt-scan artifacts in `purchase_history.csv` before seeding `Catalog` from it: `UNCLEAR - ORG item (obscured by pen mark)` (category `Other`, 2026-06-13 Costco), `KS BATH (tissue, partially obscured)`, and `HBO W/ALMNDS (unclear brand)` — these need the actual product identified (or a follow-up receipt photo) rather than being seeded with placeholder names.
- [ ] Capture pack size/weight on future receipts (or via product photos) to fill in unit pricing — priority: meat (ground beef, ribs), where dollar swings are biggest. Currently only Eggs and Potato Chips have a confirmed, size-verified cross-store price match; this is intentional caution-icon behavior, not a bug to "fix" by faking a match.
- [ ] Add Publix and Amazon once sample orders exist for those stores.
- [ ] Get real usage feedback from both users (Graham and Rutendo — this tool is meant for both, not just Graham) and iterate based on what's actually annoying or missing in practice.

## Suggested next steps

Based on gaps visible in the current README and project setup:

- [x] ~~Move `WEBHOOK_URL` out of `src/App.jsx` and into an environment variable~~ — done 2026-07-30: reads `VITE_WEBHOOK_URL` with a fallback to the current production URL, `.env.example` added, `.gitignore` added (didn't exist before — also now protects against ever committing a real `.env`).
- [x] ~~Add a basic CI check (lint/build)~~ — done 2026-07-30: `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm run build` on every push/PR. Added a standard flat ESLint config (matching Vite's own React template) and fixed the pre-existing lint errors it surfaced (unused imports/vars, unescaped JSX apostrophes) so lint actually passes clean. One harmless warning remains (a `useCallback` exhaustive-deps notice) — left alone deliberately since a mechanical fix risked an infinite-effect-loop regression; warnings don't fail the CI job.
- [x] ~~Add at least a smoke test for the app's core ledger flow~~ — done 2026-07-30: added Vitest + React Testing Library (`src/App.test.jsx`, `src/setupTests.js`, `test` config block in `vite.config.js`). The test mocks the webhook (`global`/`fetch`), renders the app, clicks a catalog item, and asserts it lands in the list with the subtotal updated — covering the real add-item round trip through `callWebhook`/`applyServerState`, not just a render smoke check. `npm test` now also runs in CI (`.github/workflows/ci.yml`), before the build step.
- [x] ~~Fix Node version drift between CI and the Netlify build~~ — done 2026-07-30: `netlify.toml` pinned `NODE_VERSION = "18"` while `.github/workflows/ci.yml` (and the actual `npm ci` lockfile install CI verifies) runs Node 22 — bumped Netlify to match, so a passing CI run and a passing Netlify build are now testing the same runtime instead of silently diverging.
- [x] ~~Decide on and document one canonical deploy path (Netlify vs Vercel)~~ — **confirmed 2026-07-30: Netlify.** README rewritten to describe the actual current setup (git-connected via `netlify.toml`, auto-build + PR previews, production deploys from `main`) instead of the stale drag-and-drop `netlify.app/drop` instructions it had before; Vercel section removed rather than left to drift.

---
*Add new items here as they come up, and check them off (or link a GitHub issue) as they're resolved — this keeps the doc useful instead of stale.*
