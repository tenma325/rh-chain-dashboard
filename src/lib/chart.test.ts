import { describe, expect, it } from "vitest";
import {
  defaultChartAddress,
  fomoFamilyUrl,
  fomoOhlcvUrl,
  geckoPoolAddress,
  isGeckoPoolId,
  ohlcvEmptyKind,
  ohlcvErrorMessage,
  ohlcvFooter,
  pairEmptyKind,
  parseFomoCandles,
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

  it("maps STONKBROKER to the known GeckoTerminal pool even if Dex pair differs", () => {
    expect(
      geckoPoolAddress(
        "0xe934e36A439C94017B64a3FecE66AF12099aBF50",
        "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead",
      ),
    ).toBe("0x9cd74d5980A4BF60408B9bA2B0F6a3d368EBf594");
    expect(
      geckoPoolAddress(
        "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
        "0x056b42e26a9ffa9d09684ab2ed95f60a113d1528",
      ),
    ).toBe("0x056b42e26a9ffa9d09684ab2ed95f60a113d1528");
    expect(geckoPoolAddress("0x020bfC650A365f8BB26819deAAbF3E21291018b4", null)).toBeNull();
  });

  it("accepts 20-byte addresses and 32-byte GeckoTerminal pool hashes", () => {
    expect(isGeckoPoolId("0x056b42e26a9ffa9d09684ab2ed95f60a113d1528")).toBe(true);
    expect(
      isGeckoPoolId("0x056b42e26a9ffa9d09684ab2ed95f60a113d152881ac5b0c65e71205658a7ab9"),
    ).toBe(true);
    expect(isGeckoPoolId("WOOD")).toBe(false);
  });

  it("builds the canonical FOMO.family chart URL for a holding", () => {
    expect(
      fomoFamilyUrl("0x020bfC650A365f8BB26819deAAbF3E21291018b4"),
    ).toBe(
      "https://fomo.family/tokens/robinhood/0x020bfc650a365f8bb26819deaabf3e21291018b4",
    );
  });

  it("prefers CASHCAT as the default held chart", () => {
    expect(
      defaultChartAddress([
        { address: "0x39dBED3a2bd333467115dE45665cC57F813C4571" },
        { address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4" },
      ]),
    ).toBe("0x020bfC650A365f8BB26819deAAbF3E21291018b4");
  });

  it("builds the FOMO Mobula OHLCV proxy URL for a held token", () => {
    expect(
      fomoOhlcvUrl("0x020bfC650A365f8BB26819deAAbF3E21291018b4", "5m", 100),
    ).toBe(
      "/api/fomo-ohlcv?address=0x020bfc650a365f8bb26819deaabf3e21291018b4&period=5m&amount=100",
    );
    expect(fomoOhlcvUrl("WOOD", "5m")).toBeNull();
  });

  it("parses FOMO Mobula millisecond candles into the desk series", () => {
    const candles = parseFomoCandles({
      data: [
        { t: 1_756_453_200_000, o: 0.18, h: 0.2, l: 0.17, c: 0.19, v: 1200 },
        { t: 1_756_453_500_000, o: 0.19, h: 0.21, l: 0.18, c: 0.2, v: 800 },
      ],
    });
    expect(candles).toHaveLength(2);
    expect(candles[0]?.time).toBe(1_756_453_200);
    expect(candles[1]?.close).toBe(0.2);
  });
});
