import { describe, expect, it } from "vitest";
import { formatAge, formatJst, formatQty, formatUsd } from "./format";

describe("formatUsd", () => {
  it("keeps numeric zero distinct from null", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0, { sign: true, precise: true })).toBe("+$0.0000");
    expect(formatUsd(null)).toBe("取得不可");
    expect(formatUsd(Number.NaN)).toBe("取得不可");
  });

  it("does not paint 取得不可 while loading", () => {
    expect(formatUsd(null, { loading: true })).toBe("同期中…");
    expect(formatUsd(13.42, { loading: true })).toBe("同期中…");
  });
});

describe("formatQty", () => {
  it("does not coerce null to 0", () => {
    expect(formatQty(null)).toBe("取得不可");
    expect(formatQty(0)).toBe("0");
    expect(formatQty(4.13e-7)).toBe("<0.000001");
    expect(formatQty(null, true)).toBe("同期中");
  });
});

describe("formatJst", () => {
  it("labels an empty SNAPSHOT exit as 保有中, not Invalid Date", () => {
    expect(formatJst("")).toBe("保有中");
    expect(formatJst(null)).toBe("保有中");
    expect(formatJst(undefined)).toBe("保有中");
  });
});

describe("formatAge", () => {
  it("labels snapshot age in whole days after 24 hours", () => {
    const generated = "2026-08-25T12:55:12+09:00";
    const now = Date.parse("2026-08-27T19:22:00+09:00");
    expect(formatAge(generated, now)).toBe("2日前");
  });
});
