import type { ChipStatus, Holding, LiveOverlay } from "./types";
import { isFiniteNumber } from "./format";

export function chipStatus(input: {
  inFlight: boolean;
  issues: string[];
  ethUsd: number | null;
}): ChipStatus {
  if (input.inFlight) return "SYNCING";
  if (input.issues.length === 0 && isFiniteNumber(input.ethUsd)) return "LIVE";
  return "DEGRADED";
}

export function overviewLine(input: {
  loading: boolean;
  walletUsd: number | null;
  assetsUsd: number | null;
  positionCount: number | null;
}): { total: { value: number | null; loading: boolean }; detail: string } {
  const { loading, walletUsd, assetsUsd, positionCount } = input;
  if (loading) {
    return {
      total: { value: null, loading: true },
      detail: "Wallet 同期中 · Assets 同期中 · —",
    };
  }
  const wallet = walletUsd === null || !Number.isFinite(walletUsd) ? "取得不可" : formatPlainUsd(walletUsd);
  const assets = assetsUsd === null || !Number.isFinite(assetsUsd) ? "取得不可" : formatPlainUsd(assetsUsd);
  const count = positionCount === null ? "—" : `${positionCount} positions`;
  return {
    total: { value: sumKnown(walletUsd, assetsUsd), loading: false },
    detail: `Wallet ${wallet} · Assets ${assets} · ${count}`,
  };
}

function formatPlainUsd(value: number): string {
  const digits = Math.abs(value) < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function sumKnown(walletUsd: number | null, assetsUsd: number | null): number | null {
  if (!isFiniteNumber(walletUsd) || !isFiniteNumber(assetsUsd)) return null;
  return walletUsd + assetsUsd;
}

export function walletUsd(overlay: Pick<LiveOverlay, "walletEth" | "weth" | "ethUsd">): number | null {
  if (!isFiniteNumber(overlay.ethUsd) || !isFiniteNumber(overlay.walletEth) || !isFiniteNumber(overlay.weth)) {
    return null;
  }
  return (overlay.walletEth + overlay.weth) * overlay.ethUsd;
}

export function assetsUsd(holdings: Holding[]): number | null {
  const live = holdings.filter((row) => row.balanceSource === "live" && isFiniteNumber(row.balance));
  if (live.length === 0) return null;
  const unpriced = live.filter(
    (row) => isFiniteNumber(row.balance) && row.balance > 0 && !isFiniteNumber(row.priceUsd),
  );
  if (unpriced.length > 0) return null;
  return live.reduce((sum, row) => {
    if (!isFiniteNumber(row.balance) || !isFiniteNumber(row.priceUsd)) return sum;
    return sum + row.balance * row.priceUsd;
  }, 0);
}

export function walletLabel(source: LiveOverlay["walletSource"]): string {
  if (source === "rpc") return "Public RPC";
  if (source === "snapshot") return "SNAPSHOT";
  return "取得不可";
}
