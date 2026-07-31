# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install       # install dependencies
npm run dev       # start Vite dev server
npm run build     # production build -> dist/
npm run preview   # preview the production build locally
```

There are no tests, linter, or type checker configured in this project.

## Deployment

This is a static Vite build deployed as a standalone site (not a Claude artifact), specifically so it
can escape the artifact sandbox's CSP and call an external webhook directly. `netlify.toml` builds with
`npm run build` and publishes `dist/`, with a catch-all redirect to `index.html` (SPA routing). It's also
deployable via Netlify Drop or Vercel CLI — see README.md for the exact steps if asked to deploy.

## Architecture

The entire app is one component: `src/App.jsx` (`HouseholdLedger`), rendered by `src/main.jsx`. Everything
else (`src/index.css`, `tailwind.config.js`, `postcss.config.js`) is standard Tailwind/Vite scaffolding.

**No local persistence or backend in this repo.** All state lives in an external n8n workflow, reached via
a single hardcoded webhook (`WEBHOOK_URL` at the top of `App.jsx`) backed by Google Sheets (a `ShoppingList`
sheet and a `Settings` sheet). The React app is a thin client: every mutation posts an `action` to the
webhook and replaces local state with whatever the webhook echoes back (see `applyServerState`). Actions in
use: `get`, `upsert`, `remove`. There is currently no action to write the budget back to `Settings` — the
budget input is local-only and reloaded from the server on next `get`.

**`CATALOG` is a hardcoded product list**, built manually from parsed Costco/Walmart receipts (Alpharetta/
Milton, GA prices). Each entry has per-store pricing that's either a plain number (pack size wasn't printed
on the receipt, so no per-unit price is possible) or `{ price, size, unitPrice, unitLabel }` when a real
$/lb or $/ct could be computed. The `sizeUnknown` flag marks items where store prices exist for more than
one store but aren't really comparable yet because at least one side's size is unknown — `bestStore()`
still picks the cheapest by absolute price in that case, unit price only when *all* stores for that item
have one. When updating prices, preserve this shape and the `note`/`sizeUnknown` conventions — the UI
surfaces them as caution icons and tooltips explaining why a comparison isn't trustworthy.

When the webhook returns a `ShoppingList` row, `rowToListItem` re-attaches the full `CATALOG` entry (for
`stores`/`note`/`sizeUnknown`) by matching on item name — so an item's name in the sheet must match its
`CATALOG` name exactly, or it falls back to a single-store entry built from just that row's price.
