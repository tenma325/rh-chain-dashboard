import { describe, expect, it } from "vitest";
import {
  isGeckoPoolId,
  ohlcvEmptyKind,
  ohlcvErrorMessage,
  ohlcvFooter,
  pairEmptyKind,
} from "./chart";

describe("chart empty states", () => {
  it("keeps 市場ペアを同期中 only while DexScreener is in flight", () => {
    expect(pairEmptyKind({ marketsStatus: "loading", pairAddress: null })).toBe("in-flight");
    expect(pairEmptyKind({ marketsStatus: "unavailable", pairAddress: null })).toBe(
      "unavailable",
    );
    expect(pairEmptyKind({ marketsStatus: "ready", pairAddress: null })).toBe("unavailable");
    expect(
      pairEmptyKind({ marketsStatus: "ready", pairAddress: "0xpair" }),
    ).toBe("ready");
  });

  it("stops spinning after GeckoTerminal Failed to fetch", () => {
    expect(
      ohlcvEmptyKind({ inFlight: true, candles: 0, error: null }),
    ).toBe("in-flight");
    expect(
      ohlcvEmptyKind({
        inFlight: false,
        candles: 0,
        error: "Failed to fetch",
      }),
    ).toBe("unavailable");
    expect(
      ohlcvEmptyKind({
        inFlight: true,
        candles: 0,
        error: "Failed to fetch",
      }),
    ).toBe("unavailable");
    expect(
      ohlcvEmptyKind({ inFlight: false, candles: 0, error: null }),
    ).toBe("unavailable");
    expect(
      ohlcvEmptyKind({ inFlight: false, candles: 3, error: null }),
    ).toBe("ready");
    expect(ohlcvErrorMessage(new TypeError("Failed to fetch"))).toBe("取得不可");
  });

  it("does not leave 市場履歴を同期中 after a finished failure", () => {
    expect(
      ohlcvFooter({ inFlight: false, lastUpdated: null, error: "Failed to fetch" }),
    ).toBe("取得不可");
    expect(
      ohlcvFooter({ inFlight: true, lastUpdated: null, error: null }),
    ).toBe("市場履歴を同期中");
    expect(
      ohlcvFooter({ inFlight: false, lastUpdated: null, error: null }),
    ).toBe("取得不可");
  });

  it("accepts 20-byte addresses and 32-byte GeckoTerminal pool hashes", () => {
    expect(isGeckoPoolId("0x056b42e26a9ffa9d09684ab2ed95f60a113d1528")).toBe(true);
    expect(
      isGeckoPoolId("0x056b42e26a9ffa9d09684ab2ed95f60a113d152881ac5b0c65e71205658a7ab9"),
    ).toBe(true);
    expect(isGeckoPoolId("WOOD")).toBe(false);
  });
});
