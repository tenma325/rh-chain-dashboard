const UPSTREAM_DEX = 'https://api.dexscreener.com/tokens/v1/robinhood/'
const TOKEN_ADDRESS = /^0x[a-fA-F0-9]{40}$/

export const onRequestGet = async (context: {
  request: Request
}): Promise<Response> => {
  const url = new URL(context.request.url)
  const addresses = (url.searchParams.get('addresses') ?? '')
    .split(',')
    .filter(Boolean)

  if (
    addresses.length === 0 ||
    addresses.length > 20 ||
    addresses.some((address) => !TOKEN_ADDRESS.test(address))
  ) {
    return Response.json({ error: 'invalid token addresses' }, { status: 400 })
  }

  try {
    const upstream = await fetch(UPSTREAM_DEX + addresses.join(','), {
      headers: { Accept: 'application/json' },
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=15',
        'Content-Type': 'application/json',
      },
    })
  } catch {
    return Response.json({ error: 'token market unavailable' }, { status: 502 })
  }
}

export const onRequest = async (context: {
  request: Request
}): Promise<Response> => {
  if (context.request.method === 'GET') return onRequestGet(context)
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET' },
  })
}
