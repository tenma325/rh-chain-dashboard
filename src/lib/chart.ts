import { CASHCAT_ADDRESS } from "./ledger";
import type { Candle, ChartEmptyKind } from "./types";

/** GeckoTerminal pool ids are 20-byte addresses or 32-byte hashes. */
export const GECKO_POOL_ID_RE = /^0x[a-f\d]{40}([a-f\d]{24})?$/i;
export const EVM_ADDRESS_RE = /^0x[a-f\d]{40}$/i;
export const FOMO_OHLCV_PATH = "/api/fomo-ohlcv";
export const FOMO_PERIODS = ["5m", "1h", "1d"] as const;

export function fomoFamilyUrl(address: string): string | null {
  if (!EVM_ADDRESS_RE.test(address)) return null;
  return "https://fomo.family/tokens/robinhood/" + address.toLowerCase();
}

export function defaultChartAddress(holdings: { address: string }[]): string {
  const cashcat = holdings.find(
    (row) => row.address.toLowerCase() === CASHCAT_ADDRESS.toLowerCase(),
  );
  return cashcat?.address ?? holdings[0]?.address ?? "";
}

export function fomoOhlcvUrl(
  address: string,
  period: string,
  amount = 100,
): string | null {
  if (!EVM_ADDRESS_RE.test(address)) return null;
  if (!(FOMO_PERIODS as readonly string[]).includes(period)) return null;
  if (!Number.isFinite(amount) || amount < 1 || amount > 200) return null;
  return (
    `${FOMO_OHLCV_PATH}?address=${address.toLowerCase()}` +
    `&period=${period}&amount=${Math.floor(amount)}`
  );
}

export function parseFomoCandles(payload: unknown): Candle[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data
    .flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      const nums = [item.t, item.o, item.h, item.l, item.c, item.v].map(Number);
      const [time, open, high, low, close, volumeUsd] = nums;
      if (
        nums.some((value) => !Number.isFinite(value)) ||
        time <= 0 ||
        open <= 0 ||
        high <= 0 ||
        low <= 0 ||
        close <= 0 ||
        volumeUsd < 0
      ) {
        return [];
      }
      return [
        {
          time: time > 1e12 ? time / 1000 : time,
          open,
          high,
          low,
          close,
          volumeUsd,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}

export function isGeckoPoolId(value: string): boolean {
  return GECKO_POOL_ID_RE.test(value);
}

export function geckoPoolAddress(token: string, pairAddress: string | null): string | null {
  const mapped = GECKO_POOL_BY_TOKEN[token.toLowerCase()];
  if (mapped) return mapped;
  if (pairAddress && isGeckoPoolId(pairAddress)) return pairAddress;
  return null;
}

/** Known GeckoTerminal pools when DexScreener pair IDs are not OHLCV-ready. */
export const GECKO_POOL_BY_TOKEN: Record<string, string> = {
  "0xe934e36a439c94017b64a3fece66af12099abf50":
    "0x9cd74d5980A4BF60408B9bA2B0F6a3d368EBf594",
};

export function pairEmptyKind(input: {
  marketsStatus: "loading" | "ready" | "unavailable";
  pairAddress: string | null;
}): ChartEmptyKind {
  if (input.pairAddress) return "ready";
  if (input.marketsStatus === "loading") return "in-flight";
  return "unavailable";
}

export function ohlcvEmptyKind(input: {
  inFlight: boolean;
  candles: number;
  error: string | null;
}): ChartEmptyKind {
  if (input.candles > 0) return "ready";
  if (input.error) return "unavailable";
  if (input.inFlight) return "in-flight";
  return "unavailable";
}

export function ohlcvFooter(input: {
  inFlight: boolean;
  lastUpdated: Date | null;
  error: string | null;
}): string {
  if (input.error && !input.lastUpdated) return "取得不可";
  if (input.inFlight && !input.lastUpdated) return "市場履歴を同期中";
  if (input.lastUpdated) {
    return `最終更新 ${input.lastUpdated.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  }
  return "取得不可";
}

export function ohlcvErrorMessage(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : "";
  if (
    caught instanceof TypeError ||
    /failed to fetch|networkerror|load failed/i.test(message)
  ) {
    return "取得不可";
  }
  return message || "市場履歴を取得できませんでした";
}
