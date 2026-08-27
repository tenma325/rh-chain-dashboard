import type { ChartEmptyKind } from "./types";

/** GeckoTerminal pool ids are 20-byte addresses or 32-byte hashes. */
export const GECKO_POOL_ID_RE = /^0x[a-f\d]{40}([a-f\d]{24})?$/i;

export function isGeckoPoolId(value: string): boolean {
  return GECKO_POOL_ID_RE.test(value);
}

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
  if (input.inFlight) return "in-flight";
  if (input.error) return "unavailable";
  return "in-flight";
}

export function ohlcvFooter(input: {
  inFlight: boolean;
  lastUpdated: Date | null;
  error: string | null;
}): string {
  if (input.inFlight && !input.lastUpdated) return "市場履歴を同期中";
  if (input.error && !input.lastUpdated) return "取得不可";
  if (input.lastUpdated) {
    return `最終更新 ${input.lastUpdated.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  }
  return "市場履歴を同期中";
}
