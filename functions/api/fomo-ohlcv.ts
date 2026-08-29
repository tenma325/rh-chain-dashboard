const FOMO_OHLCV = "https://fomo-api.mobula.io/api/2/token/ohlcv-history";
const TOKEN_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const PERIODS = new Set(["5m", "1h", "1d"]);
const FOMO_CHAIN_ID = "evm:4663";

function apiKey(env: Record<string, unknown> | undefined): string {
  const raw = env?.FOMO_MOBULA_API_KEY ?? env?.MOBULA_API_KEY ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function clientIp(request: Request): string {
  const forwarded = (request.headers.get("X-Forwarded-For") ?? "").split(",")[0]?.trim();
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("True-Client-IP") ||
    forwarded ||
    ""
  ).trim();
}

export const onRequestGet = async (context: {
  request: Request;
  env?: Record<string, unknown>;
}): Promise<Response> => {
  const url = new URL(context.request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  const period = (url.searchParams.get("period") ?? "5m").trim();
  const amount = Number(url.searchParams.get("amount") ?? "100");

  if (!TOKEN_ADDRESS.test(address) || !PERIODS.has(period)) {
    return Response.json({ error: "invalid fomo chart query" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 200) {
    return Response.json({ error: "invalid fomo chart query" }, { status: 400 });
  }

  const upstream = new URL(FOMO_OHLCV);
  upstream.searchParams.set("address", address);
  upstream.searchParams.set("chainId", FOMO_CHAIN_ID);
  upstream.searchParams.set("period", period);
  upstream.searchParams.set("amount", String(Math.floor(amount)));
  upstream.searchParams.set("usd", "true");

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = apiKey(context.env);
  if (key) headers.Authorization = key;
  const ip = clientIp(context.request);
  if (ip) {
    headers["True-Client-IP"] = ip;
    headers["X-Real-IP"] = ip;
    headers["X-Forwarded-For"] = ip;
  }

  try {
    const response = await fetch(upstream.toString(), { headers });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "public, max-age=10, s-maxage=15",
        "Content-Type": "application/json",
      },
    });
  } catch {
    return Response.json({ error: "fomo chart unavailable" }, { status: 502 });
  }
};

export const onRequest = async (context: {
  request: Request;
  env?: Record<string, unknown>;
}): Promise<Response> => {
  if (context.request.method === "GET") return onRequestGet(context);
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET" },
  });
};
