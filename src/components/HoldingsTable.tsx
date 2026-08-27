import { formatPct, formatQty, formatUsd, shortAddress, toneOf } from "../lib/format";
import { isDustRow } from "../lib/ledger";
import type { Holding } from "../lib/types";

type Props = {
  holdings: Holding[];
};

export function HoldingsTable({ holdings }: Props) {
  if (holdings.length === 0) {
    return <p className="empty-state">現在の保有資産はありません。</p>;
  }

  return (
    <div className="table-frame">
      <table className="holdings-table">
        <thead>
          <tr>
            <th scope="col">銘柄</th>
            <th scope="col">数量</th>
            <th scope="col">価格</th>
            <th scope="col">評価額</th>
            <th scope="col">24H</th>
            <th scope="col">取得価格</th>
            <th scope="col">残存</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((row) => (
            <tr key={row.address}>
              <td>
                <div className="asset-cell">
                  <span className="asset-mark">{row.symbol.slice(0, 1)}</span>
                  <span>
                    <strong>
                      {row.symbol}
                      {isDustRow(row) ? <span className="dust-chip">ダスト</span> : null}
                    </strong>
                    <small>
                      {shortAddress(row.address)}
                      {row.balanceSource === "snapshot" ? " · SNAPSHOT" : ""}
                    </small>
                  </span>
                </div>
              </td>
              <td>
                {formatQty(row.balance)}
                <small className="source-label">
                  {row.balanceSource === "live"
                    ? isDustRow(row)
                      ? "ダスト"
                      : "RPC"
                    : row.balanceSource === "snapshot"
                      ? "SNAPSHOT"
                      : "取得不可"}
                </small>
              </td>
              <td>{formatUsd(row.priceUsd, { precise: true })}</td>
              <td>
                <strong>{formatUsd(row.valueUsd, { precise: true })}</strong>
              </td>
              <td className={`value--${toneOf(row.change24h)}`}>{formatPct(row.change24h, true)}</td>
              <td>{formatUsd(row.entryPriceUsd, { precise: true })}</td>
              <td>
                <span className="remaining-value">
                  {row.remainingPct === null ? "—" : formatPct(row.remainingPct)}
                </span>
                {row.remainingPct !== null && (
                  <span className="remaining-track" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, row.remainingPct)}%` }} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
