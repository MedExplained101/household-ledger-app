# Household Ledger — deployable app

This is a standalone Vite + React project — the same app you tested as a Claude artifact,
but packaged so it can run outside Claude's sandbox and actually reach your n8n webhook.

## Deploy in 2 minutes (no account needed to start)

1. `npm install`
2. `npm run build` — outputs a `dist/` folder with plain HTML/CSS/JS
3. Go to https://app.netlify.com/drop in a browser and drag the `dist` folder onto the page
4. Netlify gives you a live URL immediately (e.g. `random-name-123.netlify.app`)

That URL is a real domain — no Content-Security-Policy sandbox, so it can call
your n8n webhook directly. Open it on your phone and "Add to Home Screen" to use it
like an installed app.

## Alternative: Vercel CLI
```
npm install -g vercel
vercel --prod
```
Follow the prompts (one-time login via browser).

## Alternative: ask Claude Code to deploy it
If you're using Claude Code, just point it at this folder and ask it to run the
build and deploy steps above — it can run these commands directly in your terminal.

## Notes
- The webhook URL is hardcoded in `src/App.jsx` (`WEBHOOK_URL` near the top) — already
  set to your production n8n URL.
- `public/manifest.json` makes it installable as a home-screen PWA on iOS/Android.
