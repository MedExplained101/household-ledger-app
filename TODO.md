# TODO

This file tracks outstanding work for the Household Ledger app so it can be followed here on GitHub (issues can link back to items below) instead of living only in chat history.

## Status

A search of this repo (2026-07-30) found **no existing plans, strategy docs, work logs, or `TODO`/`FIXME` comments** — the only documentation is `README.md`, and the codebase (`src/App.jsx`, `src/main.jsx`, etc.) has no inline TODO markers. This file is a fresh starting point, not a consolidation of prior notes.

## Suggested next steps

Based on gaps visible in the current README and project setup:

- [ ] Move `WEBHOOK_URL` out of `src/App.jsx` and into an environment variable — it's currently hardcoded in source, which makes rotating the n8n webhook or open-sourcing the repo harder than it needs to be.
- [ ] Add a basic CI check (lint/build) so a broken `npm run build` is caught before Netlify/Vercel deploy rather than at drag-and-drop time.
- [ ] Add at least a smoke test for the app's core ledger flow — there is currently no test setup in `package.json`.
- [ ] Decide on and document one canonical deploy path (Netlify vs Vercel) — the README currently presents both as equally valid, which can lead to drift between two live deployments.

---
*Add new items here as they come up, and check them off (or link a GitHub issue) as they're resolved — this keeps the doc useful instead of stale.*
