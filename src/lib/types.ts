export type BalanceSource = "live" | "snapshot" | "unknown";

export type SnapshotPosition = {
  address: string;
  symbol: string;
  ethSpent: number | null;
  remainingPct: number | null;
  bookBalance?: number | null;
  observedBalance: number | null;
  balanceObserved?: boolean;
  balanceObservedAt?: string | null;
  entryPriceUsd: number | null;
  entryTime: string | null;
  liveRisk: boolean;
};

export type SnapshotTrade = {
  symbol: string;
  entryTime: string;
  exitTime: string;
  pnlEth: number;
  pnlPct: number;
  exitReason: string;
  isWin: boolean;
};

export type SnapshotCouncil = {
  time: string;
  allow: boolean;
  side: string;
  action: string;
  symbol: string;
  reason: string;
  votes: string;
};

export type SnapshotWalletPoint = {
  time: string;
  totalEth: number;
};

export type Snapshot = {
  generatedAt: string;
  walletAddress: string;
  lastObservedWalletEth: number;
  walletObserved?: boolean;
  observedWalletEth?: number | null;
  observedWeth?: number | null;
  observedEthUsd?: number | null;
  walletObservedAt?: string | null;
  tradingMode?: string | null;
  activeRuleset?: string | null;
  positions: SnapshotPosition[];
  trades: SnapshotTrade[];
  council: SnapshotCouncil[];
  walletHistory: SnapshotWalletPoint[];
};

export type Holding = SnapshotPosition & {
  balance: number | null;
  priceUsd: number | null;
  valueUsd: number | null;
  change1h: number | null;
  change24h: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairAddress: string | null;
  dexId: string | null;
  quoteSymbol: string | null;
  marketUrl: string | null;
  balanceSource: BalanceSource;
};

export type LiveOverlay = {
  walletEth: number | null;
  weth: number | null;
  ethUsd: number | null;
  holdings: Holding[];
  refreshedAt: string;
  issues: string[];
  walletSource: "rpc" | "snapshot" | "unavailable";
  marketsStatus: "loading" | "ready" | "unavailable";
};

export type ChipStatus = "SYNCING" | "LIVE" | "DEGRADED";

export type TradeOutcome = "open" | "win" | "loss" | "flat";

export type DayPoint = {
  key: string;
  label: string;
  pnlUsd: number | null;
  walletUsd: number | null;
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};

export type ChartEmptyKind = "in-flight" | "unavailable" | "ready";
