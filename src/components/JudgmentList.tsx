import { thisCycleVoteCopy } from "../lib/desk";
import { formatAge, formatJst } from "../lib/format";
import { ACTION_LABELS, reasonJa } from "../lib/labels";
import type { SnapshotCouncil } from "../lib/types";

type Props = {
  entries: SnapshotCouncil[];
  generatedAt: string;
};

export function JudgmentList({ entries, generatedAt }: Props) {
  const age = formatAge(generatedAt);
  return (
    <div className="agent-list-wrap">
      <div className="agent-cycle" role="status">
        <span className="snapshot-chip">SNAPSHOT</span>
        <span>{age}</span>
        <span>{thisCycleVoteCopy()}</span>
      </div>
      <div className="agent-list">
        {entries.map((entry) => (
          <details className="agent-entry" key={`${entry.time}-${entry.symbol}`}>
            <summary>
              <time dateTime={entry.time}>{formatJst(entry.time)}</time>
              <span
                className={`decision-badge ${entry.allow ? "decision-badge--allow" : "decision-badge--block"}`}
              >
                {entry.allow ? "ALLOW" : "BLOCK"}
              </span>
              <strong>{entry.symbol}</strong>
              <span>{ACTION_LABELS[entry.action] ?? entry.action}</span>
              <i aria-hidden="true">＋</i>
            </summary>
            <div className="agent-body">
              <p>
                <span>FINAL REASON · SNAPSHOT</span>
                {reasonJa(entry.reason)}
              </p>
              <p>
                <span>
                  AGENT CONVERSATION · SNAPSHOT {age} · {thisCycleVoteCopy()}
                </span>
                {entry.votes}
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
