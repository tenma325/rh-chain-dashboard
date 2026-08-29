import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGI_ADDRESS } from './ledger'
import { SNAPSHOT, fetchLiveOverlay, loadingOverlay } from './live'
import type { Snapshot } from './types'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

function observedSnapshot(): Snapshot {
  return {
    ...SNAPSHOT,
    walletObserved: true,
    observedWalletEth: 0.004,
    observedWeth: 0,
    observedEthUsd: 2500,
    positions: SNAPSHOT.positions.map((position, index) => ({
      ...position,
      observedBalance: index === 0 ? 2 : 5e-7,
      balanceObserved: true,
      balanceObservedAt: '2026-08-29T03:00:00+00:00',
    })),
  }
}

describe('loadingOverlay', () => {
  it('does not invent balances for a legacy snapshot without observation provenance', () => {
    const overlay = loadingOverlay(SNAPSHOT)
    expect(overlay.weth).toBeNull()
    expect(overlay.walletEth).toBeNull()
    expect(overlay.ethUsd).toBeNull()
    expect(overlay.walletSource).toBe('unavailable')
    expect(overlay.marketsStatus).toBe('loading')
    expect(overlay.holdings.every((row) => row.balanceSource !== 'live')).toBe(true)
    expect(overlay.holdings.every((row) => row.balance === null)).toBe(true)
  })

  it('uses only provenance-marked local observations while market prices load', () => {
    const overlay = loadingOverlay(observedSnapshot())
    expect(overlay.walletEth).toBe(0.004)
    expect(overlay.ethUsd).toBe(2500)
    expect(overlay.walletSource).toBe('snapshot')
    expect(overlay.holdings.every((row) => row.balanceSource === 'snapshot')).toBe(true)
  })
})

describe('fetchLiveOverlay', () => {
  it('combines observed balances with live DEX prices without browser RPC', async () => {
    const snapshot = observedSnapshot()
    const first = snapshot.positions[0]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          {
            baseToken: { address: first.address },
            quoteToken: { symbol: 'WETH' },
            priceUsd: '0.2',
            liquidity: { usd: 1000 },
          },
        ]),
      ),
    )

    const overlay = await fetchLiveOverlay(snapshot)
    expect(overlay.walletSource).toBe('snapshot')
    expect(overlay.walletEth).toBe(0.004)
    expect(overlay.ethUsd).toBe(2500)
    expect(overlay.holdings[0].balanceSource).toBe('snapshot')
    expect(overlay.holdings[0].valueUsd).toBeCloseTo(0.4)
    expect(overlay.issues).toEqual([])
  })


  it('falls back to direct DEX Screener when the edge proxy is rate limited', async () => {
    const snapshot = observedSnapshot()
    const first = snapshot.positions[0]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, false, 429))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            baseToken: { address: first.address },
            priceUsd: '0.2',
            liquidity: { usd: 1000 },
          },
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const overlay = await fetchLiveOverlay(snapshot)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/dex-tokens')
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.dexscreener.com')
    expect(overlay.marketsStatus).toBe('ready')
    expect(overlay.holdings[0].priceUsd).toBe(0.2)
  })

  it('includes AGI in the DEX request but never invents its balance', async () => {
    let requested = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requested = String(input)
        return jsonResponse([])
      }),
    )

    const snapshot = observedSnapshot()
    snapshot.positions = snapshot.positions.filter(
      (position) => position.address.toLowerCase() !== AGI_ADDRESS.toLowerCase(),
    )
    const overlay = await fetchLiveOverlay(snapshot)
    expect(requested.toLowerCase()).toContain(AGI_ADDRESS.toLowerCase())
    const agi = overlay.holdings.find(
      (holding) => holding.address.toLowerCase() === AGI_ADDRESS.toLowerCase(),
    )
    expect(agi?.balance).toBeNull()
    expect(agi?.balanceSource).toBe('unknown')
  })
})
