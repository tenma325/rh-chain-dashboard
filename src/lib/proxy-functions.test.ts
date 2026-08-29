import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest as dexRequest } from '../../functions/api/dex-tokens'
import { onRequest as fomoRequest } from '../../functions/api/fomo-ohlcv'

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

describe('FOMO OHLCV proxy', () => {
  it('rejects a non-token without calling Mobula', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await fomoRequest({
      request: new Request(
        'https://example.test/api/fomo-ohlcv?address=WOOD&period=5m',
      ),
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requests CASHCAT candles from the FOMO Mobula token API', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const response = await fomoRequest({
      request: new Request(
        'https://example.test/api/fomo-ohlcv?address=0x020bfC650A365f8BB26819deAAbF3E21291018b4&period=5m&amount=100',
      ),
      env: { FOMO_MOBULA_API_KEY: 'test-key' },
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [called, init] = fetchMock.mock.calls[0]
    expect(String(called)).toContain('https://fomo-api.mobula.io/api/2/token/ohlcv-history')
    expect(String(called)).toContain('address=0x020bfC650A365f8BB26819deAAbF3E21291018b4')
    expect(String(called)).toContain('chainId=evm%3A4663')
    expect(String(called)).toContain('period=5m')
    expect(new Headers(init?.headers).get('Authorization')).toBe('test-key')
  })

  it('forwards the visitor IP so Mobula can rate-limit Worker fetches', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await fomoRequest({
      request: new Request(
        'https://example.test/api/fomo-ohlcv?address=0x020bfC650A365f8BB26819deAAbF3E21291018b4&period=5m&amount=100',
        { headers: { 'CF-Connecting-IP': '203.0.113.10' } },
      ),
      env: { FOMO_MOBULA_API_KEY: 'test-key' },
    })

    const init = fetchMock.mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(headers.get('X-Forwarded-For')).toBe('203.0.113.10')
    expect(headers.get('True-Client-IP')).toBe('203.0.113.10')
  })
})
