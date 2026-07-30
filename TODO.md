# TODO

This file tracks outstanding work for the Household Ledger app so it can be followed here on GitHub (issues can link back to items below) instead of living only in chat history.

## Status

A search of this repo (2026-07-30) found **no existing plans, strategy docs, work logs, or `TODO`/`FIXME` comments** — the only documentation is `README.md`, and the codebase (`src/App.jsx`, `src/main.jsx`, etc.) has no inline TODO markers. A follow-up search of Google Drive (2026-07-30) found a related, **not-yet-connected backend workflow** — see below. This file is a fresh starting point, not a consolidation of prior notes.

## Backend n8n workflow — found in Drive, not wired up

A `Household_Ledger_List_Budget_Webhook_Agent.json` n8n workflow (created 2026-07-28, Drive root, alongside the BNS project files) implements a shopping-list/budget backend intended for this app — Google Sheets-backed `get`/`upsert`/`remove` actions for a shopping list, plus a running total against a budget. Its own in-workflow setup notes list what's still needed:

- [ ] Create the actual Google Sheet (the workflow's `documentId` is a placeholder ID that doesn't resolve to a real spreadsheet yet) with a `ShoppingList` tab (`item, category, store, price, qty, cadence, added_date`) and a `Settings` tab (`budget, cadence`).
- [ ] Write `household-ledger-sheets-schema.md` — referenced by the workflow's setup notes as the schema reference, but doesn't exist anywhere in Drive or this repo yet.
- [ ] Connect a Google Sheets credential in n8n (the workflow currently references a personal-account credential ID copied from the BNS workflows — confirm whether that's the intended account).
- [ ] Activate the workflow and get the production webhook URL, then update `WEBHOOK_URL` in `src/App.jsx` to point at it (currently pointed at a different/placeholder n8n webhook per the README).
- [ ] Import the workflow JSON into the live n8n instance — it doesn't appear to be deployed yet, only saved to Drive.

## Suggested next steps

Based on gaps visible in the current README and project setup:

- [ ] Move `WEBHOOK_URL` out of `src/App.jsx` and into an environment variable — it's currently hardcoded in source, which makes rotating the n8n webhook or open-sourcing the repo harder than it needs to be.
- [ ] Add a basic CI check (lint/build) so a broken `npm run build` is caught before Netlify/Vercel deploy rather than at drag-and-drop time.
- [ ] Add at least a smoke test for the app's core ledger flow — there is currently no test setup in `package.json`.
- [ ] Decide on and document one canonical deploy path (Netlify vs Vercel) — the README currently presents both as equally valid, which can lead to drift between two live deployments.

---
*Add new items here as they come up, and check them off (or link a GitHub issue) as they're resolved — this keeps the doc useful instead of stale.*
