import snapshotJson from "../data/snapshot.json";
import { AGI_ADDRESS, allowlist } from "./ledger";
import type { Holding, LiveOverlay, Snapshot, SnapshotPosition } from "./types";
import { isFiniteNumber } from "./format";

export const SNAPSHOT = snapshotJson as Snapshot;

export const DEXSCREENER_TOKENS = '/api/dex-tokens?addresses=';

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
      const observed = spec.balanceObserved && isFiniteNumber(spec.observedBalance);
      return toHolding(
        spec,
        observed ? spec.observedBalance : null,
        undefined,
        observed ? "snapshot" : "unknown",
      );
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
    const observed = spec.balanceObserved && isFiniteNumber(spec.observedBalance);
    if (!observed) issues.push(`${spec.symbol}の保有数量を取得できませんでした`);
    return toHolding(
      spec,
      observed ? spec.observedBalance : null,
      bestPair(pairs, spec.address),
      observed ? "snapshot" : "unknown",
    );
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
