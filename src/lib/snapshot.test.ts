import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from './types'
import { fetchLatestSnapshot, isSnapshot } from './snapshot'

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
    expect(fetchMock).toHaveBeenCalledWith('/snapshot.json?ts=123', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  })

  it('keeps the last good snapshot when the endpoint is HTML or unavailable', async () => {
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
