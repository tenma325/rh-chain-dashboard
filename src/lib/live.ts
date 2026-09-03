import snapshotJson from "../data/snapshot.json";
import { AGI_ADDRESS, allowlist, isOpenBookPosition, resolveHeldBalance } from "./ledger";
import type { Holding, LiveOverlay, Snapshot, SnapshotPosition } from "./types";
import { isFiniteNumber } from "./format";

export const SNAPSHOT = snapshotJson as Snapshot;

export const DEXSCREENER_TOKENS = '/api/dex-tokens?addresses=';
export const DEXSCREENER_DIRECT =
  'https://api.dexscreener.com/tokens/v1/robinhood/';

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

export async function fetchDexPairs(tokens: SnapshotPosition[]): Promise<DexPair[]> {
  const addresses = tokens.map((row) => row.address).join(",");
  const endpoints = [
    `${DEXSCREENER_TOKENS}${addresses}`,
    `${DEXSCREENER_DIRECT}${addresses}`,
  ];
  let lastError: unknown = new Error("DEX Screener unavailable");
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`DEX Screener HTTP ${response.status}`);
      return (await response.json()) as DexPair[];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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
      liveQty !== null && livePrice !== null && source !== "unknown"
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
    walletEth:
      snapshot.walletObserved && isFiniteNumber(snapshot.observedWalletEth)
        ? snapshot.observedWalletEth
        : null,
    weth:
      snapshot.walletObserved && isFiniteNumber(snapshot.observedWeth)
        ? snapshot.observedWeth
        : null,
    ethUsd: isFiniteNumber(snapshot.observedEthUsd) ? snapshot.observedEthUsd : null,
    holdings: allowlist(snapshot.positions).map((spec) => {
      const held = resolveHeldBalance({
        remainingPct: spec.remainingPct,
        ethSpent: spec.ethSpent,
        bookBalance: spec.bookBalance,
        observedBalance: spec.balanceObserved ? spec.observedBalance : null,
      });
      return toHolding(spec, held.balance, undefined, held.source);
    }),
    refreshedAt: snapshot.generatedAt,
    issues: [],
    walletSource: snapshot.walletObserved ? "snapshot" : "unavailable",
    marketsStatus: "loading",
  };
}

export async function fetchLiveOverlay(snapshot: Snapshot = SNAPSHOT): Promise<LiveOverlay> {
  const issues: string[] = [];
  const tokens = allowlist(snapshot.positions);
  const dexResult = await Promise.resolve(fetchDexPairs(tokens)).then(
    (value) => ({ status: "fulfilled" as const, value }),
    () => ({ status: "rejected" as const }),
  );

  const ethUsd = isFiniteNumber(snapshot.observedEthUsd)
    ? snapshot.observedEthUsd
    : null;
  const walletEth =
    snapshot.walletObserved && isFiniteNumber(snapshot.observedWalletEth)
      ? snapshot.observedWalletEth
      : null;
  const weth =
    snapshot.walletObserved && isFiniteNumber(snapshot.observedWeth)
      ? snapshot.observedWeth
      : null;
  const pairs = dexResult.status === "fulfilled" ? dexResult.value : [];

  if (ethUsd === null) issues.push("ETH/USD価格を取得できませんでした");
  if (walletEth === null || weth === null) issues.push("ウォレット残高を取得できませんでした");
  if (dexResult.status === "rejected") issues.push("トークン市場価格を取得できませんでした");

  const holdings = tokens.map((spec) => {
    const held = resolveHeldBalance({
      remainingPct: spec.remainingPct,
      ethSpent: spec.ethSpent,
      bookBalance: spec.bookBalance,
      observedBalance: spec.balanceObserved ? spec.observedBalance : null,
    });
    const isAgi = spec.address.toLowerCase() === AGI_ADDRESS.toLowerCase();
    if (held.source === "unknown" && isOpenBookPosition(spec) && !isAgi) {
      issues.push(`${spec.symbol}の保有数量を取得できませんでした`);
    }
    return toHolding(spec, held.balance, bestPair(pairs, spec.address), held.source);
  });

  return {
    walletEth,
    weth,
    ethUsd,
    holdings,
    refreshedAt: new Date().toISOString(),
    issues,
    walletSource: snapshot.walletObserved ? "snapshot" : "unavailable",
    marketsStatus: dexResult.status === "fulfilled" ? "ready" : "unavailable",
  };
}

export { AGI_ADDRESS };
