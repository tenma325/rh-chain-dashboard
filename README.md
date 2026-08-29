# Ferris.GG Trade Desk

Public, read-only Robinhood Chain (4663) portfolio dashboard for wallet
`0xa4C7596C56a7d76a61d032F43d4DE6CB19319D6d`.

This is a Vite + React SPA. Baked `snapshot.json` is overlaid in the browser
with DexScreener prices. Held-bag candles come from the FOMO.family Mobula
API via the Pages Function `/api/fomo-ohlcv` (set `FOMO_MOBULA_API_KEY` or
`MOBULA_API_KEY` as a Pages secret; without it OHLCV 429s). Wallet ETH /
token qty on the public contract come from the trader's dual-RPC observation
(`python dashboard_server.py --publish`), not from a browser-signed wallet.
NAV uses journal `bookBalance` when remaining is still open so RPC dust does
not wipe the bag. Charts are limited to currently held bags.

Trades and council judgments stay **SNAPSHOT**. This app does not fetch or
invent fills or votes.

```bash
pnpm install
pnpm test
pnpm run build
npx wrangler pages deploy dist --project-name ferris-trade-dashboard
```

Cloudflare Pages project: `ferris-trade-dashboard` at
https://trade.ferrisgg.vip/ (`public/_headers` + `public/_redirects`).
Source of truth for the SPA is this repo's `main`.

**Not in this repo:** live orders, wallet sends, or anything in
`tenma325/rh-chain-trader`.
