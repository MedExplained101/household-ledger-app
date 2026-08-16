# Tally — User Guide

**Tally** (formerly "Household Ledger") is your family's shopping list and budget planner. It tracks prices across Costco and Walmart (with Publix and Amazon coming once we have sample data), builds a running total against your budget, and remembers what you buy so next week's list is faster to put together.

Open it any time at: **[tally-mutandi.netlify.app](https://tally-mutandi.netlify.app)**

No install needed — it works in your phone or computer's browser. On a phone, you can add it to your home screen (Share → Add to Home Screen) so it opens like an app.

---

## Getting around

- **Cadence** (Day / Week / Month) — tags new items with how often you buy them. Doesn't change your budget, just labels the item.
- **Budget** — your spending target for the current cadence. Type a new number and tap/click away — it saves automatically.
- **Find an item** — search box that filters the catalog as you type.
- **Browse catalog** — tap a category to expand it, then tap any item to add it to your list.
- **Shows up every trip** — quick-add buttons for your recurring items.

## Adding items — four ways

1. **Tap to add** — browse or search the catalog and tap an item.
2. **🎤 Speak** — tap the pill, say something like *"add milk"*, *"remove eggs"*, *"clear the list"*, *"save the list"*, or *"what's the price of eggs?"*. The app listens once per tap and shows what it heard.
3. **📷 Receipt** — snap a photo or upload a PDF of a Costco/Walmart receipt. It reads the items and prices and logs them straight into the catalog — no typing.
4. **📷 Barcode** — scan a product's barcode with your camera. Tapping the button first asks what you're doing:
   - **Add to list** — the original behavior. If it's something already in your catalog, you get an instant, trusted price comparison across stores. If not, the app tries a quick web lookup and clearly labels that result as unverified (see "What it can't do" below). Either way, this is just a lookup — it doesn't add anything to your list for you.
   - **Log price only** — for standing in the aisle and recording what something actually costs *right now* at *this* store, without touching your current list. Scan the barcode, confirm the item name (prefilled if it matches something you've scanned before, but the price is always left blank — you type in exactly what's on the shelf), pick the store, and save. That price goes straight into the catalog as a fresh, human-confirmed reading, which future price comparisons treat as more trustworthy than an old receipt scan.

## Setting up store locations

**Manage stores** (green button, left sidebar, under your budget) lets you save each store's exact location. Open it, find the store, and tap **Use my location** while you're standing there (or near there) — the app uses your phone's GPS to save that store's coordinates and, where possible, its street address. This is a one-time setup per store, not something you do every trip; it just makes the app's distance-based math (is a farther bulk-price store actually worth the drive) more accurate over time.

If your browser blocks location access, it'll tell you so — go into your browser's settings and allow location for this site, then try again.

## Managing your list

- **Store dropdown** (per item) — if an item is priced at more than one store, pick which one; the cheapest option is marked "(lowest)".
- **+ / −** — adjust quantity. Dropping to 0 removes the item.
- **✕** — remove an item directly.
- **Clear all** — empties the whole list (asks you to confirm first).
- **Load last list** — brings back everything from the last list you saved, merged into whatever's currently there.
- **Save list** — finalizes the list, sends a summary (items + total) to the household Telegram chat, and snapshots it so "Load last list" can pull it back later.

## Reading the totals

- **Subtotal** — sum of every item × quantity.
- **Delivery** — added once per online store (Costco Same-Day, Walmart Delivery, etc.) you're using this trip, since each has its own flat delivery fee.
- **Remaining** — budget minus subtotal minus delivery. Turns red if you're over.

## The ⚠️ caution icon

Some items show a small warning triangle next to the price. That means the two stores' prices aren't a true apples-to-apples comparison yet — usually because one receipt didn't print a pack size or weight, so we can't compute a real $/lb or $/ct match. **Only Eggs and Potato Chips currently have a fully confirmed, size-verified match.** Everything else with a caution icon is a *directional* estimate, not a guarantee — hover or tap the icon for the specific reason.

Catalog prices also refresh automatically in the background roughly once a week, so day-to-day prices should stay reasonably current, but a store's actual price at checkout can always differ slightly from what's shown.

---

## What it can't do (and why)

- **It can't add items to your Costco/Walmart/Amazon cart or check out for you.** None of these stores offer a way for an app like this to do that safely — the only way to fake it would be a bot logging into your real store account and clicking through checkout, which breaks most stores' terms of service and would mean handling your actual login and payment details. We won't build that. The app's job stops at "here's your list and the total" — you still do the actual online order yourself.
- **It won't ever guess a price.** If an item can't be matched with real data (from your catalog, a scanned receipt, or a barcode lookup), the app says so plainly instead of making one up.
- **Barcode lookups outside your catalog aren't fully trustworthy.** That fallback hits a free public product database, not the actual store — coverage is inconsistent and it's clearly marked "live web result" so it's never confused with your verified catalog prices.
- **It doesn't place phone/delivery orders or talk to a real person at any store.** Everything here is planning and tracking, not ordering.

---

*Questions, something look wrong, or want a feature? Just ask — Graham and Rutendo both drive what this app does next.*
