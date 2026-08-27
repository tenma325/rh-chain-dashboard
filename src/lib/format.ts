const UNAVAILABLE = "取得不可";
const LOADING = "同期中";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatUsd(
  value: number | null | undefined,
  options: { precise?: boolean; sign?: boolean; loading?: boolean } = {},
): string {
  if (options.loading) return `${LOADING}…`;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNAVAILABLE;
  }
  const digits = options.precise && Math.abs(value) < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: options.sign ? "always" : "auto",
  }).format(value);
}

export function formatQty(value: number | null | undefined, loading = false): string {
  if (loading) return LOADING;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNAVAILABLE;
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 1 ? 6 : 3,
  }).format(value);
}

export function formatPct(
  value: number | null | undefined,
  signed = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatJst(value: string | null | undefined): string {
  if (!value) return "保有中";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export function formatAge(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function toneOf(value: number | null | undefined): "positive" | "negative" | "neutral" {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}

export function formatPrice(value: number): string {
  const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : value >= 1e-4 ? 6 : 8;
  return `$${value.toFixed(digits)}`;
}

export const COPY = {
  unavailable: UNAVAILABLE,
  loading: LOADING,
} as const;
