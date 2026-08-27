import { describe, expect, it } from "vitest";
import {
  AGI_ADDRESS,
  allowlist,
  chartHoldings,
  countLivePositions,
  isDust,
  pnlBarKind,
  tableHoldings,
  tradeOutcome,
  tradeStats,
  tradeUsd,
} from "./ledger";
import { SNAPSHOT } from "./live";
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
    expect(agi?.remainingPct).toBeNull();
    expect(agi?.entryPriceUsd).toBeNull();
    expect(agi?.observedBalance).toBeNull();
  });
});

describe("position counting", () => {
  it("does not count STONKBROKER dust or baked list length", () => {
    const rows = [
      holding({ symbol: "WOOD", balance: 0, priceUsd: 0.01, valueUsd: 0, balanceSource: "live" }),
      holding({
        symbol: "STONKBROKER",
        balance: 5.67890828982e-7,
        priceUsd: 0.01786,
        valueUsd: 5.67890828982e-7 * 0.01786,
        balanceSource: "live",
      }),
      holding({
        symbol: "AGI",
        address: AGI_ADDRESS,
        balance: 1135,
        priceUsd: 0.002,
        valueUsd: 2.27,
        balanceSource: "live",
      }),
      holding({
        symbol: "WOOD",
        balance: 95,
        priceUsd: 0.01,
        valueUsd: 0.95,
        balanceSource: "snapshot",
      }),
    ];
    expect(isDust(rows[1])).toBe(true);
    expect(countLivePositions(rows)).toBe(1);
    expect(chartHoldings(rows).map((row) => row.symbol)).toEqual(["AGI"]);
    expect(tableHoldings(rows).map((row) => row.symbol)).toEqual(["STONKBROKER", "AGI", "WOOD"]);
  });

  it("counts an unpriced live qty above 1e-6, and not RPC-null", () => {
    expect(
      countLivePositions([
        holding({ balance: 1135, priceUsd: null, valueUsd: null, balanceSource: "live" }),
        holding({ balance: null, priceUsd: 0.002, valueUsd: null, balanceSource: "unknown" }),
      ]),
    ).toBe(1);
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

  it("excludes baked zero-PnL closes from the old 18L and does not mint a WOOD fill", () => {
    const stats = tradeStats(SNAPSHOT.trades);
    expect(stats.wins).toBe(8);
    expect(stats.losses).toBe(12);
    expect(stats.flats).toBe(6);
    expect(stats.winRate).toBe(40);
    expect(SNAPSHOT.trades.some((row) => row.symbol === "WOOD")).toBe(false);
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
