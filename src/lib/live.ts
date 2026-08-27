import snapshotJson from "../data/snapshot.json";
import { AGI_ADDRESS, allowlist } from "./ledger";
import type { Holding, LiveOverlay, Snapshot, SnapshotPosition } from "./types";
import { isFiniteNumber } from "./format";

export const SNAPSHOT = snapshotJson as Snapshot;

export const RH_RPC = "https://rpc.mainnet.chain.robinhood.com";
export const COINGECKO_ETH =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_last_updated_at=true";
export const DEXSCREENER_TOKENS = "https://api.dexscreener.com/tokens/v1/robinhood/";
export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

type DexPair = {
  baseToken?: { address?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  priceChange?: { h1?: number; h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  pairAddress?: string;
  dexId?: string;
  url?: string;
};

async function rpc(method: string, params: unknown[]): Promise<string> {
  const response = await fetch(RH_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = (await response.json()) as {
    error?: { message?: string };
    result?: string;
  };
  if (body.error || body.result === undefined) {
    throw new Error(body.error?.message ?? "RPC result missing");
  }
  return body.result;
}

function hexToQty(hex: string, decimals: number): number {
  return Number(BigInt(hex)) / 10 ** decimals;
}

function balanceOfData(wallet: string): string {
  return `0x70a08231${wallet.toLowerCase().replace("0x", "").padStart(64, "0")}`;
}

export async function fetchWalletEth(wallet: string): Promise<number> {
  return hexToQty(await rpc("eth_getBalance", [wallet, "latest"]), 18);
}

export async function fetchTokenQty(token: string, wallet: string): Promise<number> {
  const [balanceHex, decimalsHex] = await Promise.all([
    rpc("eth_call", [{ to: token, data: balanceOfData(wallet) }, "latest"]),
    rpc("eth_call", [{ to: token, data: "0x313ce567" }, "latest"]),
  ]);
  return hexToQty(balanceHex, Number(BigInt(decimalsHex)));
}

export async function fetchEthUsd(): Promise<number> {
  const response = await fetch(COINGECKO_ETH, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const usd = (await response.json()).ethereum?.usd;
  if (!isFiniteNumber(usd)) throw new Error("ETH/USD price missing");
  return usd;
}

export async function fetchDexPairs(tokens: SnapshotPosition[]): Promise<DexPair[]> {
  const addresses = tokens.map((row) => row.address).join(",");
  const response = await fetch(`${DEXSCREENER_TOKENS}${addresses}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`DEX Screener HTTP ${response.status}`);
  return (await response.json()) as DexPair[];
}

export function bestPair(pairs: DexPair[], token: string): DexPair | undefined {
  return pairs
    .filter((row) => row.baseToken?.address?.toLowerCase() === token.toLowerCase())
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

export function toHolding(
  spec: SnapshotPosition,
  balance: number | null,
  pair: DexPair | undefined,
  source: Holding["balanceSource"],
): Holding {
  const price = pair?.priceUsd ? Number(pair.priceUsd) : null;
  const livePrice = isFiniteNumber(price) ? price : null;
  const liveQty = isFiniteNumber(balance) ? balance : null;
  return {
    ...spec,
    balance: liveQty,
    priceUsd: livePrice,
    valueUsd:
      liveQty !== null && livePrice !== null && source === "live"
        ? liveQty * livePrice
        : null,
    change1h: isFiniteNumber(pair?.priceChange?.h1) ? (pair?.priceChange?.h1 ?? null) : null,
    change24h: isFiniteNumber(pair?.priceChange?.h24) ? (pair?.priceChange?.h24 ?? null) : null,
    liquidityUsd: isFiniteNumber(pair?.liquidity?.usd) ? (pair?.liquidity?.usd ?? null) : null,
    volume24hUsd: isFiniteNumber(pair?.volume?.h24) ? (pair?.volume?.h24 ?? null) : null,
    pairAddress: pair?.pairAddress ?? null,
    dexId: pair?.dexId ?? null,
    quoteSymbol: pair?.quoteToken?.symbol ?? null,
    marketUrl: pair?.url ?? null,
    balanceSource: source,
  };
}

export function loadingOverlay(snapshot: Snapshot = SNAPSHOT): LiveOverlay {
  return {
    walletEth: null,
    weth: null,
    ethUsd: null,
    holdings: allowlist(snapshot.positions).map((spec) =>
      toHolding(spec, null, undefined, "unknown"),
    ),
    refreshedAt: snapshot.generatedAt,
    issues: [],
    walletSource: "unavailable",
    marketsStatus: "loading",
  };
}

export async function fetchLiveOverlay(snapshot: Snapshot = SNAPSHOT): Promise<LiveOverlay> {
  const issues: string[] = [];
  const tokens = allowlist(snapshot.positions);
  const core = Promise.allSettled([
    fetchEthUsd(),
    fetchWalletEth(snapshot.walletAddress),
    fetchTokenQty(WETH, snapshot.walletAddress),
    fetchDexPairs(tokens),
  ]);
  const qtyFetches = Promise.allSettled(
    tokens.map((token) => fetchTokenQty(token.address, snapshot.walletAddress)),
  );
  const [[ethUsdResult, walletResult, wethResult, dexResult], qtyResults] =
    await Promise.all([core, qtyFetches]);

  const ethUsd = ethUsdResult.status === "fulfilled" ? ethUsdResult.value : null;
  const walletEth = walletResult.status === "fulfilled" ? walletResult.value : null;
  const weth = wethResult.status === "fulfilled" ? wethResult.value : null;
  const pairs = dexResult.status === "fulfilled" ? dexResult.value : [];

  if (ethUsdResult.status === "rejected") issues.push("ETH/USD価格を取得できませんでした");
  if (walletResult.status === "rejected" || wethResult.status === "rejected") {
    issues.push("ウォレット残高の一部を再取得できませんでした");
  }
  if (dexResult.status === "rejected") issues.push("トークン市場価格を取得できませんでした");

  const holdings = tokens.map((spec, index) => {
    const qty = qtyResults[index];
    const live = qty?.status === "fulfilled";
    if (!live) issues.push(`${spec.symbol}の保有数量を取得できませんでした`);
    return toHolding(
      spec,
      live ? qty.value : null,
      bestPair(pairs, spec.address),
      live ? "live" : "unknown",
    );
  });

  return {
    walletEth,
    weth,
    ethUsd,
    holdings,
    refreshedAt: new Date().toISOString(),
    issues,
    walletSource: walletResult.status === "fulfilled" ? "rpc" : "unavailable",
    marketsStatus: dexResult.status === "fulfilled" ? "ready" : "unavailable",
  };
}

export { AGI_ADDRESS };
