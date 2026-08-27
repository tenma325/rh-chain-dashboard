import { describe, expect, it, vi, afterEach } from "vitest";
import { SNAPSHOT, fetchLiveOverlay, loadingOverlay, WETH } from "./live";
import { AGI_ADDRESS } from "./ledger";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("loadingOverlay", () => {
  it("does not coerce missing WETH to 0 or paint snapshot qty as live", () => {
    const overlay = loadingOverlay(SNAPSHOT);
    expect(overlay.weth).toBeNull();
    expect(overlay.walletEth).toBeNull();
    expect(overlay.ethUsd).toBeNull();
    expect(overlay.walletSource).toBe("unavailable");
    expect(overlay.marketsStatus).toBe("loading");
    expect(overlay.holdings.every((row) => row.balanceSource !== "live")).toBe(true);
    expect(overlay.holdings.every((row) => row.balance === null)).toBe(true);
  });
});

describe("fetchLiveOverlay", () => {
  it("treats WETH RPC failure as null and does not fall back snapshot qty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = typeof init?.body === "string" ? init.body : "";
        if (url.includes("coingecko")) {
          return jsonResponse({ ethereum: { usd: 2500 } });
        }
        if (url.includes("dexscreener")) {
          return jsonResponse([]);
        }
        if (url.includes("robinhood.com") && body.includes("eth_getBalance")) {
          return jsonResponse({ jsonrpc: "2.0", id: 1, result: "0x0" });
        }
        if (body.includes(WETH.toLowerCase().slice(2)) || body.includes(WETH)) {
          return jsonResponse({ jsonrpc: "2.0", id: 1, error: { message: "weth fail" } });
        }
        return jsonResponse({ jsonrpc: "2.0", id: 1, error: { message: "token fail" } });
      }),
    );

    const overlay = await fetchLiveOverlay(SNAPSHOT);
    expect(overlay.weth).toBeNull();
    expect(overlay.walletSource).toBe("rpc");
    expect(overlay.holdings.every((row) => row.balance === null)).toBe(true);
    expect(overlay.holdings.some((row) => row.balanceSource === "snapshot")).toBe(false);
    expect(overlay.issues.some((issue) => issue.includes("ウォレット残高"))).toBe(true);
  });

  it("balanceOfs AGI on the allowlist", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = typeof init?.body === "string" ? init.body : "";
        if (url.includes("coingecko")) return jsonResponse({ ethereum: { usd: 2500 } });
        if (url.includes("dexscreener")) {
          seen.push(url);
          return jsonResponse([]);
        }
        if (body.includes("eth_getBalance")) {
          return jsonResponse({ jsonrpc: "2.0", id: 1, result: "0x0" });
        }
        const match = body.match(/0x[a-fA-F0-9]{40}/);
        if (match) seen.push(match[0].toLowerCase());
        return jsonResponse({
          jsonrpc: "2.0",
          id: 1,
          result: "0x0000000000000000000000000000000000000000000000000000000000000000",
        });
      }),
    );

    await fetchLiveOverlay(SNAPSHOT);
    expect(seen.some((item) => item.includes(AGI_ADDRESS.toLowerCase()))).toBe(true);
  });
});
