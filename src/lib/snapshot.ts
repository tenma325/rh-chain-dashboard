import type { Snapshot } from './types'

export const SNAPSHOT_ENDPOINT = '/snapshot.json'

export function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<Snapshot>
  return (
    typeof row.generatedAt === 'string' &&
    typeof row.walletAddress === 'string' &&
    typeof row.lastObservedWalletEth === 'number' &&
    Array.isArray(row.positions) &&
    Array.isArray(row.trades) &&
    Array.isArray(row.council) &&
    Array.isArray(row.walletHistory)
  )
}

export async function fetchLatestSnapshot(
  fallback: Snapshot,
  timestamp = Date.now(),
): Promise<Snapshot> {
  try {
    const response = await fetch(SNAPSHOT_ENDPOINT + '?ts=' + timestamp, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return fallback
    const payload: unknown = await response.json()
    return isSnapshot(payload) ? payload : fallback
  } catch {
    return fallback
  }
}
