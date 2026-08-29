import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from './types'
import {
  fetchLatestSnapshot,
  isSnapshot,
  RAW_SNAPSHOT_ENDPOINT,
} from './snapshot'

const fallback: Snapshot = {
  generatedAt: '2026-08-25T12:55:12+09:00',
  walletAddress: '0xa4C7596C56a7d76a61d032F43d4DE6CB19319D6d',
  lastObservedWalletEth: 0.01,
  positions: [],
  trades: [],
  council: [],
  walletHistory: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isSnapshot', () => {
  it('rejects the SPA HTML fallback and malformed JSON shapes', () => {
    expect(isSnapshot('<!doctype html>')).toBe(false)
    expect(isSnapshot({ generatedAt: 'now' })).toBe(false)
    expect(isSnapshot(fallback)).toBe(true)
  })
})

describe('fetchLatestSnapshot', () => {
  it('loads the no-store public snapshot', async () => {
    const fresh = { ...fallback, generatedAt: '2026-08-29T02:00:00+00:00' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => fresh,
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchLatestSnapshot(fallback, 123)).resolves.toEqual(fresh)
    expect(fetchMock).toHaveBeenCalledWith(RAW_SNAPSHOT_ENDPOINT + '?ts=123', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  })


  it('chooses the newest valid snapshot when GitHub raw cache is stale', async () => {
    const staleRaw = { ...fallback, generatedAt: '2026-08-29T02:00:00+00:00' }
    const freshDeployed = {
      ...fallback,
      generatedAt: '2026-08-29T03:00:00+00:00',
      walletObserved: true,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => staleRaw })
      .mockResolvedValueOnce({ ok: true, json: async () => freshDeployed })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchLatestSnapshot(fallback, 123)).resolves.toEqual(freshDeployed)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to the deployed snapshot when GitHub raw is unavailable', async () => {
    const deployed = { ...fallback, generatedAt: '2026-08-29T02:05:00+00:00' }
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => deployed,
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchLatestSnapshot(fallback, 123)).resolves.toEqual(deployed)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/snapshot.json?ts=123', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  })

  it('keeps the last good snapshot when every endpoint is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      })),
    )

    await expect(fetchLatestSnapshot(fallback, 123)).resolves.toBe(fallback)
  })
})
