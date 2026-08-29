import { isFiniteNumber } from './format'
import { countsTowardHeader } from './ledger'
import type { Holding } from './types'

export const PRICE_ALERT_THRESHOLD_PCT = 5
export const PRICE_ALERT_WINDOW_MS = 5 * 60_000
export const PRICE_ALERT_COOLDOWN_MS = 30 * 60_000

export type PriceSample = {
  at: number
  price: number
}

export type PriceAlertState = Record<
  string,
  {
    samples: PriceSample[]
    lastAlertAt: number | null
  }
>

export type HeldPriceSurge = {
  address: string
  symbol: string
  fromPrice: number
  price: number
  changePct: number
}

export function evaluateHeldPriceSurges(
  previous: PriceAlertState,
  holdings: Holding[],
  now = Date.now(),
  thresholdPct = PRICE_ALERT_THRESHOLD_PCT,
): { state: PriceAlertState; alerts: HeldPriceSurge[] } {
  const state: PriceAlertState = {}
  const alerts: HeldPriceSurge[] = []

  for (const holding of holdings) {
    if (
      !countsTowardHeader(holding) ||
      !isFiniteNumber(holding.priceUsd) ||
      holding.priceUsd <= 0
    ) {
      continue
    }

    const key = holding.address.toLowerCase()
    const old = previous[key]
    const samples = (old?.samples ?? [])
      .filter((sample) => now - sample.at <= PRICE_ALERT_WINDOW_MS)
      .filter((sample) => sample.price > 0)
    const current = { at: now, price: holding.priceUsd }
    const baseline = samples[0]
    samples.push(current)
    let lastAlertAt = old?.lastAlertAt ?? null

    if (baseline && baseline.at < now) {
      const changePct = ((current.price - baseline.price) / baseline.price) * 100
      const cooledDown =
        lastAlertAt === null || now - lastAlertAt >= PRICE_ALERT_COOLDOWN_MS
      if (changePct >= thresholdPct && cooledDown) {
        alerts.push({
          address: holding.address,
          symbol: holding.symbol,
          fromPrice: baseline.price,
          price: current.price,
          changePct,
        })
        lastAlertAt = now
        state[key] = { samples: [current], lastAlertAt }
        continue
      }
    }

    state[key] = { samples, lastAlertAt }
  }

  return { state, alerts }
}
