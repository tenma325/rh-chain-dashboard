import { describe, expect, it } from "vitest";
import { THIS_CYCLE_COUNCIL, thisCycleVoteCopy } from "./desk";
import { chipStatus } from "./sync";

describe("desk judgments", () => {
  it("keeps this cycle's council empty and does not invent votes", () => {
    expect(THIS_CYCLE_COUNCIL).toEqual([]);
    expect(thisCycleVoteCopy()).toBe("今サイクル票なし");
    expect(thisCycleVoteCopy([])).toBe("今サイクル票なし");
  });

  it("does not let council emptiness drive LIVE/DEGRADED", () => {
    expect(chipStatus({ inFlight: false, issues: [], ethUsd: 2500 })).toBe("LIVE");
    expect(chipStatus({ inFlight: false, issues: ["Dex failed"], ethUsd: 2500 })).toBe(
      "DEGRADED",
    );
    expect(THIS_CYCLE_COUNCIL).toHaveLength(0);
  });
});
