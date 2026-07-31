# Household Ledger — deployable app

This is a standalone Vite + React project — the same app you tested as a Claude artifact,
but packaged so it can run outside Claude's sandbox and actually reach your n8n webhook.

## Deploy — Netlify (canonical)

Netlify is the canonical, current deploy path — `netlify.toml` is already wired up as a
git-connected site: every push and PR gets an automatic build (`npm run build`, config
in `netlify.toml`) and its own preview URL with a deploy-status comment on the PR. No
manual build-and-drag step needed for day-to-day use; pushing to `main` is what deploys
production.

To connect a fresh Netlify site to this repo from scratch (e.g. if it's ever recreated):
1. In Netlify: **Add new site → Import an existing project** → pick this repo.
2. Build settings are already correct via `netlify.toml` (`npm run build`, publishes `dist`).
3. Set `VITE_WEBHOOK_URL` in the site's environment variables if you need to override the
   default n8n webhook URL (see `.env.example`).

That gives you a real domain — no Content-Security-Policy sandbox, so it can call your
n8n webhook directly. Open it on your phone and "Add to Home Screen" to use it like an
installed app.

## Notes
- Vercel isn't used for this project — an earlier version of this README presented it as
  an equally valid alternative, but Netlify is what's actually connected and deploying.
  Not documented further here to avoid two competing "how to deploy" paths drifting out
  of sync with each other.
- The webhook URL defaults to the current production n8n URL, but can be overridden
  without a code change via a `VITE_WEBHOOK_URL` environment variable — see
  `.env.example`. Set it in Netlify's dashboard (or a local `.env` file) if you ever need
  to rotate the webhook.
- `public/manifest.json` makes it installable as a home-screen PWA on iOS/Android.
