import type { SnapshotCouncil } from "./types";

/**
 * This overlay cycle has no council fetch. CSP connect-src has no journal,
 * so live votes stay an empty list — never invent them, never drive the chip.
 */
export const THIS_CYCLE_COUNCIL: readonly SnapshotCouncil[] = [];

export function thisCycleVoteCopy(
  votes: readonly SnapshotCouncil[] = THIS_CYCLE_COUNCIL,
): string {
  return votes.length === 0 ? "今サイクル票なし" : `${votes.length}票`;
}
