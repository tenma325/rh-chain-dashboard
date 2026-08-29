import { describe, expect, it } from "vitest";
import { assetsUsd, chipStatus, overviewLine, walletLabel, walletUsd } from "./sync";
import type { Holding } from "./types";

const holding = (partial: Partial<Holding>): Holding => ({
  address: "0x1",
  symbol: "TEST",
  ethSpent: 0,
  remainingPct: 100,
  observedBalance: 10,
  entryPriceUsd: 1,
  entryTime: null,
  liveRisk: false,
  balance: 10,
  priceUsd: 1,
  valueUsd: 10,
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

describe("chipStatus", () => {
  it("is SYNCING only while an explicit cycle is in flight", () => {
    expect(chipStatus({ inFlight: true, issues: [], ethUsd: 2500 })).toBe("SYNCING");
    expect(
      chipStatus({ inFlight: false, issues: ["Dex failed"], ethUsd: 2500 }),
    ).toBe("DEGRADED");
    expect(chipStatus({ inFlight: false, issues: [], ethUsd: 2500 })).toBe("LIVE");
    expect(chipStatus({ inFlight: false, issues: [], ethUsd: null })).toBe("DEGRADED");
  });
});

describe("overviewLine", () => {
  it("does not format Wallet/Assets as 取得不可 during loading", () => {
    const line = overviewLine({
      loading: true,
      walletUsd: null,
      assetsUsd: null,
      positionCount: 5,
    });
    expect(line.total.loading).toBe(true);
    expect(line.detail).toContain("Wallet 同期中");
    expect(line.detail).not.toContain("取得不可");
  });

  it("keeps $0.00 distinct from 取得不可 after a finished cycle", () => {
    const zero = overviewLine({
      loading: false,
      walletUsd: 13.42,
      assetsUsd: 0,
      positionCount: 0,
    });
    expect(zero.total.value).toBeCloseTo(13.42);
    expect(zero.detail).toContain("Assets $0.00");
    expect(zero.detail).toContain("0 positions");

    const missing = overviewLine({
      loading: false,
      walletUsd: 13.42,
      assetsUsd: null,
      positionCount: 0,
    });
    expect(missing.total.value).toBeNull();
    expect(missing.detail).toContain("Assets 取得不可");
  });
});

describe("walletUsd / assetsUsd", () => {
  it("does not treat WETH null as 0 in a LIVE wallet figure", () => {
    expect(walletUsd({ walletEth: 0.005, weth: null, ethUsd: 2500 })).toBeNull();
    expect(walletUsd({ walletEth: 0.005, weth: 0, ethUsd: 2500 })).toBeCloseTo(12.5);
  });

  it("values provenance-marked snapshot qty with the current DEX price", () => {
    expect(
      assetsUsd([
        holding({
          balanceSource: "snapshot",
          balance: 95,
          priceUsd: 0.01,
          valueUsd: 0.95,
        }),
      ]),
    ).toBeCloseTo(0.95);
  });

  it("sums browser-live and locally observed quantities", () => {
    expect(
      assetsUsd([
        holding({ balanceSource: "live", balance: 10, priceUsd: 2 }),
        holding({ balanceSource: "snapshot", balance: 95, priceUsd: 1 }),
      ]),
    ).toBe(115);
  });

  it("does not report a partial asset total when a previously held balance is unverified", () => {
    expect(
      assetsUsd([
        holding({ balanceSource: "snapshot", balance: 10, priceUsd: 2 }),
        holding({
          balanceSource: "unknown",
          balance: null,
          observedBalance: 95,
          priceUsd: 1,
          valueUsd: null,
        }),
      ]),
    ).toBeNull();
  });

});

describe("walletLabel", () => {
  it("does not label snapshot ETH as Public RPC", () => {
    expect(walletLabel("rpc")).toBe("Public RPC");
    expect(walletLabel("snapshot")).toBe("SNAPSHOT");
    expect(walletLabel("unavailable")).toBe("取得不可");
  });
});
