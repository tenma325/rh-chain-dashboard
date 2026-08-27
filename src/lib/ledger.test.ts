import { describe, expect, it } from "vitest";
import {
  AGI_ADDRESS,
  allowlist,
  countLivePositions,
  isDust,
  pnlBarKind,
  tradeOutcome,
  tradeStats,
  tradeUsd,
  visibleHoldings,
} from "./ledger";
import type { Holding, SnapshotPosition, SnapshotTrade } from "./types";

const trade = (partial: Partial<SnapshotTrade>): SnapshotTrade => ({
  symbol: "X",
  entryTime: "2026-08-21T00:00:00+09:00",
  exitTime: "2026-08-21T01:00:00+09:00",
  pnlEth: 0,
  pnlPct: 0,
  exitReason: "time_exit",
  isWin: false,
  ...partial,
});

const holding = (partial: Partial<Holding>): Holding => ({
  address: "0x1",
  symbol: "TEST",
  ethSpent: 0,
  remainingPct: 100,
  observedBalance: 1,
  entryPriceUsd: 1,
  entryTime: null,
  liveRisk: false,
  balance: 1,
  priceUsd: 1,
  valueUsd: 1,
  change1h: null,
  change24h: null,
  liquidityUsd: null,
  volume24hUsd: null,
  pairAddress: null,
  dexId: null,
  quoteSymbol: null,
  marketUrl: null,
  balanceSource: "live",
  ...partial,
});

describe("allowlist", () => {
  it("adds AGI without inventing entry ETH or time", () => {
    const listed = allowlist([] as SnapshotPosition[]);
    const agi = listed.find((row) => row.address.toLowerCase() === AGI_ADDRESS.toLowerCase());
    expect(agi).toBeDefined();
    expect(agi?.ethSpent).toBeNull();
    expect(agi?.entryTime).toBeNull();
    expect(agi?.observedBalance).toBeNull();
  });
});

describe("position counting", () => {
  it("does not count STONKBROKER dust or baked list length", () => {
    const rows = [
      holding({ symbol: "WOOD", balance: 0, priceUsd: 0.01, balanceSource: "live" }),
      holding({
        symbol: "STONKBROKER",
        balance: 5.67890828982e-7,
        priceUsd: 0.01786,
        balanceSource: "live",
      }),
      holding({
        symbol: "AGI",
        address: AGI_ADDRESS,
        balance: 1135,
        priceUsd: 0.002,
        balanceSource: "live",
      }),
      holding({
        symbol: "WOOD",
        balance: 95,
        priceUsd: 0.01,
        balanceSource: "snapshot",
      }),
    ];
    expect(isDust(rows[1])).toBe(true);
    expect(countLivePositions(rows)).toBe(1);
    expect(visibleHoldings(rows).map((row) => row.symbol)).toEqual(["AGI", "WOOD"]);
  });
});

describe("trade outcomes", () => {
  it("uses pnlEth, not isWin, so zero PnL is FLAT", () => {
    expect(tradeOutcome(trade({ pnlEth: 0, pnlPct: -90.28, isWin: false }))).toBe("flat");
    expect(tradeOutcome(trade({ pnlEth: 0.001, isWin: true }))).toBe("win");
    expect(tradeOutcome(trade({ pnlEth: -0.001, isWin: false }))).toBe("loss");
    expect(tradeOutcome(trade({ exitTime: "", pnlEth: 0 }))).toBe("open");
  });

  it("does not put zero-PnL trades into losses", () => {
    const stats = tradeStats([
      trade({ pnlEth: 0.001, isWin: true }),
      trade({ pnlEth: -0.001, isWin: false }),
      trade({ pnlEth: 0, pnlPct: -90.28, isWin: false }),
    ]);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.flats).toBe(1);
    expect(stats.winRate).toBe(50);
  });

  it("does not back out USD from a percent when ethUsd is missing", () => {
    expect(tradeUsd(0, 2500)).toBe(0);
    expect(tradeUsd(0, null)).toBeNull();
    expect(tradeUsd(-0.001, 2500)).toBeCloseTo(-2.5);
  });
});

describe("pnlBarKind", () => {
  it("does not paint a zero bar as profit or loss", () => {
    expect(pnlBarKind(0)).toBe("flat");
    expect(pnlBarKind(1)).toBe("up");
    expect(pnlBarKind(-1)).toBe("down");
    expect(pnlBarKind(null)).toBe("flat");
  });
});
