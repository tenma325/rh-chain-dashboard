# Ferris.GG Trade Desk

Public, read-only Robinhood Chain (4663) portfolio dashboard for wallet
`0xa4C7596C56a7d76a61d032F43d4DE6CB19319D6d`.

This is a Vite + React SPA. There is **no same-origin API**. Baked snapshot
data (`generatedAt: 2026-08-25T12:55:12+09:00`) is overlaid in the browser with:

- Robinhood public RPC (wallet ETH, WETH, token `balanceOf`)
- CoinGecko ETH/USD
- DexScreener token prices
- GeckoTerminal OHLCV

Trades and council judgments stay **SNAPSHOT**. CSP `connect-src` has no journal
host, and no same-origin `journal.json` / `council.json` exists, so this app
does not fetch or invent fills or votes.

```bash
npm install
npm test
npm run dev
```

Build output is static (`dist/`) and is intended for Cloudflare Pages at
https://trade.ferrisgg.vip/ (`public/_headers` + `public/_redirects`).

**Not in this repo:** live orders, wallet sends, or anything in
`tenma325/rh-chain-trader`.
