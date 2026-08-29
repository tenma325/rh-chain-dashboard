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
  const candidates = await Promise.all(
    SNAPSHOT_ENDPOINTS.map(async (endpoint): Promise<Snapshot | null> => {
      try {
        const response = await fetch(endpoint + '?ts=' + timestamp, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8_000),
        })
        if (!response.ok) return null
        const payload: unknown = await response.json()
        return isSnapshot(payload) ? payload : null
      } catch {
        return null
      }
    }),
  )

  return candidates.reduce<Snapshot>((newest, candidate) => {
    if (!candidate) return newest
    const candidateTime = Date.parse(candidate.generatedAt)
    const newestTime = Date.parse(newest.generatedAt)
    if (!Number.isFinite(candidateTime)) return newest
    if (!Number.isFinite(newestTime) || candidateTime > newestTime) return candidate
    return newest
  }, fallback)
}

