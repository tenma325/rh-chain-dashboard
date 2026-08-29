import type { Snapshot } from './types'

export const SNAPSHOT_ENDPOINT = '/snapshot.json'
export const RAW_SNAPSHOT_ENDPOINT =
  'https://raw.githubusercontent.com/tenma325/rh-chain-dashboard/main/snapshot.json'

const SNAPSHOT_ENDPOINTS = [RAW_SNAPSHOT_ENDPOINT, SNAPSHOT_ENDPOINT]

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
  for (const endpoint of SNAPSHOT_ENDPOINTS) {
    try {
      const response = await fetch(endpoint + '?ts=' + timestamp, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) continue
      const payload: unknown = await response.json()
      if (isSnapshot(payload)) return payload
    } catch {
      continue
    }
  }

  return fallback
}
