import type { Holding, SnapshotPosition, TradeOutcome, SnapshotTrade } from "./types";
import { isFiniteNumber } from "./format";

export const DUST_USD = 0.01;
export const DUST_QTY = 1e-6;

export const AGI_ADDRESS = "0x5a8625d314fDd298101d87932A784b756A401e18";

export const AGI_SPEC: SnapshotPosition = {
  address: AGI_ADDRESS,
  symbol: "AGI",
  ethSpent: null,
  remainingPct: null,
  observedBalance: null,
  entryPriceUsd: null,
  entryTime: null,
  liveRisk: false,
};

export function allowlist(positions: SnapshotPosition[]): SnapshotPosition[] {
  const hasAgi = positions.some(
    (row) => row.address.toLowerCase() === AGI_ADDRESS.toLowerCase(),
  );
  return hasAgi ? positions : [...positions, AGI_SPEC];
}

export function countsTowardHeader(
  holding: Pick<Holding, "balance" | "priceUsd" | "valueUsd" | "balanceSource">,
): boolean {
  if (holding.balanceSource !== "live" || !isFiniteNumber(holding.balance)) return false;
  const value = isFiniteNumber(holding.priceUsd)
    ? holding.balance * holding.priceUsd
    : holding.valueUsd;
  if (isFiniteNumber(value)) return value >= DUST_USD;
  return holding.balance > DUST_QTY;
}

export function isDust(
  holding: Pick<Holding, "balance" | "priceUsd" | "valueUsd" | "balanceSource">,
): boolean {
  return isFiniteNumber(holding.balance) && holding.balance > 0 && !countsTowardHeader(holding);
}

export function isDustRow(holding: Holding): boolean {
  return holding.balanceSource === "live" && isDust(holding);
}

export function countLivePositions(holdings: Holding[]): number {
  return holdings.filter(countsTowardHeader).length;
}

/** Chart / header selection: live-valued rows plus RPC-unavailable qty. Dust stays off the rail. */
export function chartHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter((row) => row.balance === null || countsTowardHeader(row));
}

/** Holdings table: live-valued, leftover dust, RPC-unavailable, and explicit SNAPSHOT rows. */
export function tableHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter((row) => {
    if (row.balance === null) return true;
    if (row.balanceSource === "snapshot") return true;
    return countsTowardHeader(row) || isDustRow(row);
  });
}

export function visibleHoldings(holdings: Holding[]): Holding[] {
  return chartHoldings(holdings);
}

export function tradeOutcome(trade: SnapshotTrade): TradeOutcome {
  if (!trade.exitTime) return "open";
  if (trade.pnlEth > 0) return "win";
  if (trade.pnlEth < 0) return "loss";
  return "flat";
}

export function tradeUsd(
  pnlEth: number,
  ethUsd: number | null,
): number | null {
  if (!isFiniteNumber(ethUsd)) return null;
  return pnlEth * ethUsd;
}

export function tradeStats(trades: SnapshotTrade[]): {
  closed: number;
  open: number;
  wins: number;
  losses: number;
  flats: number;
  winRate: number;
  realizedEth: number;
  profitFactor: number | null;
} {
  const closedTrades = trades.filter((row) => !!row.exitTime);
  const wins = closedTrades.filter((row) => row.pnlEth > 0);
  const losses = closedTrades.filter((row) => row.pnlEth < 0);
  const flats = closedTrades.filter((row) => row.pnlEth === 0);
  const grossProfit = closedTrades.reduce((sum, row) => sum + Math.max(0, row.pnlEth), 0);
  const grossLoss = Math.abs(
    closedTrades.reduce((sum, row) => sum + Math.min(0, row.pnlEth), 0),
  );
  const decided = wins.length + losses.length;
  return {
    closed: closedTrades.length,
    open: trades.length - closedTrades.length,
    wins: wins.length,
    losses: losses.length,
    flats: flats.length,
    winRate: decided ? (wins.length / decided) * 100 : 0,
    realizedEth: closedTrades.reduce((sum, row) => sum + row.pnlEth, 0),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
  };
}

export function realizedUsd(
  trades: SnapshotTrade[],
  ethUsd: number | null,
  days: number,
  now = Date.now(),
): number | null {
  if (!isFiniteNumber(ethUsd)) return null;
  const start = now - days * 86_400_000;
  const eth = trades.reduce((sum, row) => {
    const exit = new Date(row.exitTime).getTime();
    return row.exitTime && exit >= start && exit <= now ? sum + row.pnlEth : sum;
  }, 0);
  return eth * ethUsd;
}

export function performanceSeries(
  trades: SnapshotTrade[],
  walletHistory: { time: string; totalEth: number }[],
  liveWalletEth: number | null,
  ethUsd: number | null,
  days: number,
  now = Date.now(),
): { key: string; label: string; pnlUsd: number | null; walletUsd: number | null }[] {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(now - (days - index - 1) * 86_400_000);
    const key = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    const pnlEth = trades.reduce((sum, trade) => {
      if (!trade.exitTime) return sum;
      const day = new Date(trade.exitTime).toLocaleDateString("sv-SE", {
        timeZone: "Asia/Tokyo",
      });
      return day === key ? sum + trade.pnlEth : sum;
    }, 0);
    const history = walletHistory
      .filter(
        (point) =>
          new Date(point.time).toLocaleDateString("sv-SE", {
            timeZone: "Asia/Tokyo",
          }) === key,
      )
      .at(-1);
    return {
      key,
      label: formatter.format(date),
      pnlUsd: isFiniteNumber(ethUsd) ? pnlEth * ethUsd : null,
      walletUsd:
        history && isFiniteNumber(ethUsd) ? history.totalEth * ethUsd : null,
    };
  });
  const last = points.at(-1);
  if (last && isFiniteNumber(ethUsd) && isFiniteNumber(liveWalletEth)) {
    last.walletUsd = liveWalletEth * ethUsd;
  }
  return points;
}

export function pnlBarKind(pnlUsd: number | null): "up" | "down" | "flat" {
  if (!isFiniteNumber(pnlUsd) || pnlUsd === 0) return "flat";
  return pnlUsd > 0 ? "up" : "down";
}
