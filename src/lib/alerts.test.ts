import { describe, expect, it } from 'vitest'
import type { Holding } from './types'
import { evaluateHeldPriceSurges, type PriceAlertState } from './alerts'

function holding(partial: Partial<Holding>): Holding {
  return {
    address: '0x020bfC650A365f8BB26819deAAbF3E21291018b4',
    symbol: 'CASHCAT',
    ethSpent: 0.0002,
    remainingPct: 100,
    observedBalance: 2,
    entryPriceUsd: 0.18,
    entryTime: null,
    liveRisk: true,
    balance: 2,
    priceUsd: 0.2,
    valueUsd: 0.4,
    change1h: null,
    change24h: null,
    liquidityUsd: null,
    volume24hUsd: null,
    pairAddress: null,
    dexId: null,
    quoteSymbol: null,
    marketUrl: null,
    balanceSource: 'live',
    ...partial,
  }
}

describe('evaluateHeldPriceSurges', () => {
  it('alerts once when a confirmed holding rises five percent inside five minutes', () => {
    const initial = evaluateHeldPriceSurges({}, [holding({ priceUsd: 0.2 })], 1_000)
    expect(initial.alerts).toEqual([])

    const jumped = evaluateHeldPriceSurges(
      initial.state,
      [holding({ priceUsd: 0.211, balanceSource: 'snapshot' })],
      61_000,
    )
    expect(jumped.alerts).toHaveLength(1)
    expect(jumped.alerts[0]?.symbol).toBe('CASHCAT')
    expect(jumped.alerts[0]?.changePct).toBeCloseTo(5.5)

    const duplicate = evaluateHeldPriceSurges(
      jumped.state,
      [holding({ priceUsd: 0.212 })],
      91_000,
    )
    expect(duplicate.alerts).toEqual([])
  })

  it('never alerts for an unconfirmed, zero, or no-longer-held token', () => {
    const state: PriceAlertState = {
      '0xold': {
        samples: [{ at: 1_000, price: 1 }],
        lastAlertAt: null,
      },
    }
    const result = evaluateHeldPriceSurges(
      state,
      [
        holding({ balance: null, balanceSource: 'unknown', priceUsd: 2 }),
        holding({ address: '0xzero', balance: 0, priceUsd: 2 }),
      ],
      61_000,
    )
    expect(result.alerts).toEqual([])
    expect(result.state).toEqual({})
  })
})
