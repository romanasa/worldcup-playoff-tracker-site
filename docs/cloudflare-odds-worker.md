# Cloudflare odds worker

This optional Worker refreshes odds on demand without exposing `THE_ODDS_API_KEY` in the browser.

## Free hosting setup

1. Install/login:

   ```bash
   npx wrangler login
   ```

2. Create KV:

   ```bash
   npx wrangler kv namespace create ODDS_CACHE
   ```

3. Copy config and paste the returned KV id:

   ```bash
   cp wrangler.example.toml wrangler.toml
   # edit wrangler.toml: replace REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID
   ```

4. Store the Odds API key as a Cloudflare secret:

   ```bash
   npx wrangler secret put THE_ODDS_API_KEY
   ```

5. Deploy:

   ```bash
   npx wrangler deploy
   ```

6. Test:

   ```bash
   curl 'https://worldcup-odds-worker.<account>.workers.dev/odds'
   ```

## Frontend switch

After deploy, set `ODDS_WORKER_URL` in `src/odds.js` to the Worker `/odds` URL. The app should keep `./src/odds.json` as fallback so GitHub Pages continues to work if Cloudflare is down.

## Runtime behavior

- First user after 60 seconds triggers a real The Odds API refresh.
- Other users inside the same minute get KV cache.
- Concurrent users during refresh get stale cache (`stale-while-refresh`) instead of causing duplicate API calls.
- If The Odds API fails, the Worker returns stale cache (`stale-on-error`) when available.
