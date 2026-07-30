# Household Ledger — Mobile App Architecture
Modeled directly on your existing ME101 and Beautiful Nature Scenes n8n workflows.

## 1. Why this pattern
Both existing projects share a shape that fits price tracking well:
- A Google Sheet as the single source of truth (no separate database)
- A scheduled workflow that detects *staleness/gaps* and refills only what's needed (BNS's "Check Buffer & Prepare Generator Input")
- HTTP polling for slow async jobs (BNS's Generate Asset → Wait → Check Status loop)
- An always-on listener workflow using n8n's pause/resume-webhook trick for human-in-the-loop decisions (BNS's Telegram Approval Listener)
- A "clear + append" tally pattern for keeping a sheet in sync with current state (Tally Sorter)

We reuse all five for the household ledger instead of inventing a new shape.

## 2. Data layer — Google Sheets
One spreadsheet, tabs mirroring the BNS Calendar/Tally split:

| Tab | Columns | Mirrors |
|---|---|---|
| `Catalog` | item, category, store, price, unit_price, size, unit_label, last_updated, confidence | BNS `Calendar` |
| `ShoppingList` | item, qty, store, cadence, added_date | — new |
| `Settings` | budget, cadence | — new |
| `PriceLog` | item, store, price, date | BNS `Tally` (historical trend log) |

## 3. n8n workflow fleet

**Price Refresh Agent** (scheduled, daily/weekly)
Mirrors the Calendar Generator: reads `Catalog`, computes which items are stale (same gap-detection logic as `daysOfBufferRemaining` / `gaps`), then for each stale item → web search/fetch → LLM extraction to structured JSON (`{store, item, price, unit_price, size, confidence}`) → validate → clear+update `Catalog` (Tally Sorter pattern).

**List/Budget Webhook Agent** (triggered by the app)
Receives POST from the mobile app on add/remove/qty/store-change → reads/writes `ShoppingList` → returns updated totals as JSON. This is what the app actually talks to — it never touches Sheets directly.

**Budget Alert Listener** (always-on, mirrors the Telegram Approval Listener)
After each list update, if over budget, message Graham/Rutendo via Telegram. Could optionally support a reply like the existing YES/NO approval loop — e.g. "OK, keep going over" vs "trim it" — using the same resumeUrl pause/resume mechanism.

## 4. Mobile app layer
Two paths, same UI code either way — only the data source changes from a hardcoded array (current artifact) to live calls against the Webhook Agent:

- **PWA** (fast): today's React UI, calling n8n webhook URLs instead of the static `CATALOG`. Installable to the home screen, no app store needed, usable this week.
- **Native** (bigger): Expo/React Native shell hitting the same webhooks, buildable toward real App Store/Play Store listings later.

Recommendation: build the PWA against the webhooks first — it validates the whole pipeline before investing in a native build.

## 5. Reliability notes carried over from ME101
- 24–48h **freshness gate** before trusting a scraped price (same rule ME101 uses)
- Structured JSON schema for every price extraction — never free text
- Budget for extraction failures — ME101 saw ~38.5% early on; build retry/validation in from day one
- Watch your n8n plan's monthly execution cap — refreshing ~55 catalog items × 2 stores adds up if scheduled too often

## 6. Inventory module (added after review)
Reuses the exact shape of the Telegram Approval Listener — a scheduled check-in instead of an event-triggered approval, but the same trigger → parse reply → update Sheet → branch loop.

| Tab | Columns | Purpose |
|---|---|---|
| `Inventory` | item, status (`stocked`/`low`/`finished`), last_purchased_date, last_finished_date, avg_days_to_finish | Current state + running consumption rate per item |

**Flow, end to end:**
1. **Stock-in on purchase** — when an item on `ShoppingList` is marked purchased/approved, the List/Budget Webhook Agent also writes/updates `Inventory`: sets status to `stocked`, records `last_purchased_date`. This is the moment the "consumption clock" starts for that item.
2. **Check-In Agent** (scheduled, default every 2 days — matches what you floated, easy to change to daily or every 3) — mirrors `Listen for Approval Reply` → `Parse Reply`, but as an outbound query first: sends a Telegram message asking which items are running low and which are finished, listing current `stocked` items. Waits for the reply (same pause/resume-webhook mechanism as the approval loop).
3. **Parse & update** — reply is parsed (comma-separated item list, same style as the existing `YES 1,3` variant-parsing code node) → items marked "low" get status `low` (the yellow zone); items marked "finished" get status `finished`, and `last_finished_date` is set.
4. **Consumption rate** — the moment an item flips to `finished`, a code node computes `days_elapsed = last_finished_date − last_purchased_date` and rolls it into `avg_days_to_finish` (simple running average, same style as BNS's recency-window logic). Over time this gives you a per-item "this usually lasts ~N days" figure — useful later for *predicting* low stock before you even have to report it.
5. **Auto-add to list** — any item newly marked `finished` (and, optionally, `low`) gets appended to `ShoppingList` automatically, so it shows up in the app on its own without you re-typing it.

This means the check-in Telegram query and the budget-alert Telegram message from Section 3 can likely run on the *same* bot/chat, just different message types — worth confirming in decision #3 below.

## 7. Bulk-trip economics module (added after review)
Ties `Catalog` price data + `Inventory` consumption rate together with store location, so the app can recommend when a longer drive to a bulk-price store actually pays off.

| Tab | Columns | Purpose |
|---|---|---|
| `Stores` | store, address, lat, long, distance_from_home_mi, est_trip_cost | One row per physical location (Costco Alpharetta ≠ a farther bulk warehouse, etc.) |

**Flow:**
1. **Store setup** — each store gets an address; distance can start as a manually entered number (simplest, no new dependency) or be auto-computed later via a geocoding/distance-matrix HTTP node, same pattern as the existing HTTP-polling nodes in Content Generation.
2. **Consumption basis** — for any item with enough history, the Inventory module's `avg_days_to_finish` converts to an annual quantity (e.g., rice lasting ~40 days → ~9 purchases/year).
3. **Recommendation Agent** (scheduled — weekly or monthly is plenty, this doesn't need daily) — for items available in both a normal-price nearby store and a bulk-price farther store: computes `annual_savings = (price_per_unit_near − price_per_unit_bulk) × annual_qty`, compares it against `est_trip_cost` for the farther store (amortized if the bulk buy covers several months of supply). If savings clearly exceed trip cost, it flags a recommendation.
4. **Surfacing it** — recommendations can push via the same Telegram bot ("Worth a Costco-far run for rice — ~$X/yr saved") and/or show as a badge in the app next to that item, alongside the existing "lowest price" store tag.

**Confidence gate (build now, trust later):**
The function ships active from day one rather than waiting — but every recommendation carries a confidence flag driven by data volume, not a hidden feature switch.

- `Inventory` gains a `cycle_count` column per item — incremented each time that item completes a full purchase → finished cycle (i.e., each time `avg_days_to_finish` gets a new data point).
- Threshold: **8 completed cycles** for an item before its bulk-trip recommendation is treated as reliable.
- Below 8 cycles, the Recommendation Agent still computes and surfaces the recommendation, but every output is prefixed with a standing caveat, e.g.:
  > ⚠️ *Provisional — based on 3 of 8 purchase cycles. Confidence improves as more data comes in.*
- At 8+ cycles, the caveat drops and the recommendation is presented as reliable.
- This mirrors the existing caution-icon convention already in the shopping list app (the ⚠️ flag used today for items with unconfirmed pack sizes) — same visual treatment, same "don't hide the gap, label it" philosophy, just applied to data maturity instead of missing size data.



## 8. Open decisions before build
1. **Price sources**: does the Price Refresh Agent hit specific store URLs you already know, or search generally per item?
2. **Spreadsheet**: new sheet dedicated to the ledger, or new tabs added somewhere existing?
3. **Telegram bot**: reuse the existing "Beautiful Nature Scenes Approval" bot/chat for budget alerts *and* inventory check-ins, or set up a separate bot for household purchases?
4. **Check-in cadence**: defaulting to every 2 days — daily or every 3 preferred instead?
5. **Store distances**: manually enter distance/trip cost per store to start, or wire up auto-geocoding from address right away?
