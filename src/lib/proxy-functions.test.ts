import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest as dexRequest } from '../../functions/api/dex-tokens'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('DEX market proxy', () => {
  it('rejects malformed token addresses without an upstream request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await dexRequest({
      request: new Request(
        'https://example.test/api/dex-tokens?addresses=not-a-token',
      ),
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows only GET requests', async () => {
    const response = await dexRequest({
      request: new Request('https://example.test/api/dex-tokens', {
        method: 'POST',
      }),
    })

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET')
  })
})
