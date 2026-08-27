import { formatJst, formatPct, formatUsd, toneOf } from "../lib/format";
import { ACTION_LABELS } from "../lib/labels";
import { tradeOutcome, tradeUsd } from "../lib/ledger";
import type { SnapshotTrade } from "../lib/types";

type Props = {
  trades: SnapshotTrade[];
  ethUsd: number | null;
};

const OUTCOME_LABEL = {
  open: "OPEN",
  win: "WIN",
  loss: "LOSS",
  flat: "FLAT",
} as const;

export function TradeTable({ trades, ethUsd }: Props) {
  return (
    <div className="table-frame">
      <table className="ledger-table">
        <thead>
          <tr>
            <th scope="col">状態</th>
            <th scope="col">銘柄</th>
            <th scope="col">エントリー</th>
            <th scope="col">決済</th>
            <th scope="col">損益 USD</th>
            <th scope="col">損益率</th>
            <th scope="col">判断</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const outcome = tradeOutcome(trade);
            const usd = trade.exitTime ? tradeUsd(trade.pnlEth, ethUsd) : null;
            return (
              <tr key={`${trade.symbol}-${trade.entryTime}`}>
                <td>
                  <span className={`trade-state trade-state--${outcome}`}>
                    {OUTCOME_LABEL[outcome]}
                  </span>
                </td>
                <td>
                  <strong>{trade.symbol}</strong>
                </td>
                <td>{formatJst(trade.entryTime)}</td>
                <td>{formatJst(trade.exitTime)}</td>
                <td className={`value--${toneOf(outcome === "open" ? null : usd)}`}>
                  {trade.exitTime ? formatUsd(usd, { sign: true, precise: true }) : "—"}
                </td>
                <td className={`value--${toneOf(trade.exitTime ? trade.pnlEth : null)}`}>
                  {trade.exitTime ? formatPct(trade.pnlPct, true) : "—"}
                </td>
                <td>
                  {ACTION_LABELS[trade.exitReason] ??
                    (trade.exitReason.replaceAll("_", " ") || "保有継続")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
