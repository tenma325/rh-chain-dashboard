import { formatUsd } from "../lib/format";
import { pnlBarKind } from "../lib/ledger";
import type { DayPoint } from "../lib/types";

type Props = {
  series: DayPoint[];
  period: number;
};

export function PerformanceChart({ series, period }: Props) {
  const x = (index: number) => (series.length <= 1 ? 500 : 48 + (index / (series.length - 1)) * 928);
  const maxPnl = Math.max(...series.map((row) => Math.abs(row.pnlUsd ?? 0)), 0.01);
  const yPnl = (value: number) => 158 - (value / maxPnl) * 48;
  const wallets = series.flatMap((row) => (row.walletUsd === null ? [] : [row.walletUsd]));
  const minWallet = Math.min(...wallets, 0);
  const maxWallet = Math.max(...wallets, 1);
  const span = maxWallet === minWallet ? 1 : maxWallet - minWallet;
  const yWallet = (value: number) => 94 - ((value - minWallet) / span) * 52;
  const line = series
    .map((row, index) => (row.walletUsd === null ? null : `${x(index)},${yWallet(row.walletUsd)}`))
    .filter((point): point is string => point !== null);
  const barWidth = Math.min(30, Math.max(8, 928 / Math.max(series.length, 1) - 8));
  const labelEvery = period === 30 ? 5 : 1;

  return (
    <div className="chart-shell">
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="legend-line" />
          残高
        </span>
        <span>
          <i className="legend-bar legend-bar--up" />
          利益
        </span>
        <span>
          <i className="legend-bar legend-bar--down" />
          損失
        </span>
      </div>
      <svg
        viewBox="0 0 1000 230"
        role="img"
        aria-labelledby="performance-chart-title performance-chart-desc"
      >
        <title id="performance-chart-title">{period}日間のウォレット残高と日次実現損益</title>
        <desc id="performance-chart-desc">
          白い線がウォレット残高、縦棒が日ごとの実現損益です。緑は利益、赤は損失です。損益ゼロの日は棒を描きません。
        </desc>
        {[42, 94, 158, 206].map((y) => (
          <line key={y} x1={48} x2={976} y1={y} y2={y} className="chart-grid" />
        ))}
        <text x={48} y="21" className="chart-axis-title">
          WALLET / USD
        </text>
        <text x={48} y="120" className="chart-axis-title">
          REALIZED P&L / USD
        </text>
        <line x1={48} x2={976} y1={158} y2={158} className="chart-zero" />
        {series.map((row, index) => {
          const kind = pnlBarKind(row.pnlUsd);
          const value = row.pnlUsd ?? 0;
          const top = Math.min(158, yPnl(value));
          const height = Math.abs(158 - yPnl(value));
          return (
            <g key={row.key}>
              {kind !== "flat" && (
                <rect
                  x={x(index) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={Math.max(height, 2)}
                  rx="2"
                  className={`chart-bar chart-bar--${kind}`}
                >
                  <title>
                    {row.label}: {formatUsd(row.pnlUsd, { sign: true, precise: true })}
                  </title>
                </rect>
              )}
              {(index % labelEvery === 0 || index === series.length - 1) && (
                <text x={x(index)} y="222" textAnchor="middle" className="chart-label">
                  {row.label}
                </text>
              )}
            </g>
          );
        })}
        {line.length > 1 && (
          <polyline points={line.join(" ")} fill="none" className="chart-wallet-line" />
        )}
        {series.map((row, index) =>
          row.walletUsd === null ? null : (
            <circle
              key={`wallet-${row.key}`}
              cx={x(index)}
              cy={yWallet(row.walletUsd)}
              r="4"
              className="chart-wallet-point"
            >
              <title>
                {row.label}: {formatUsd(row.walletUsd)}
              </title>
            </circle>
          ),
        )}
      </svg>
    </div>
  );
}
