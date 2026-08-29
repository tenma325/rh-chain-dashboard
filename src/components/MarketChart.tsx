import { useEffect, useMemo, useState } from "react";
import {
  fomoFamilyUrl,
  isGeckoPoolId,
  ohlcvEmptyKind,
  ohlcvErrorMessage,
  ohlcvFooter,
  pairEmptyKind,
} from "../lib/chart";
import {
  formatCompactUsd,
  formatPct,
  formatPrice,
  formatUsd,
  formatQty,
  toneOf,
} from "../lib/format";
import type { Candle, Holding, LiveOverlay } from "../lib/types";

const INTERVALS = {
  "5m": { timeframe: "minute", aggregate: "5", limit: "100" },
  "1h": { timeframe: "hour", aggregate: "1", limit: "100" },
  "1d": { timeframe: "day", aggregate: "1", limit: "90" },
} as const;

type Interval = keyof typeof INTERVALS;

function ohlcvUrl(pair: string, interval: Interval): string | null {
  if (!isGeckoPoolId(pair)) return null;
  const spec = INTERVALS[interval];
  const url = new URL(
    `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${pair}/ohlcv/${spec.timeframe}`,
  );
  url.searchParams.set("aggregate", spec.aggregate);
  url.searchParams.set("limit", spec.limit);
  url.searchParams.set("currency", "usd");
  return url.toString();
}

function parseCandles(payload: { data?: { attributes?: { ohlcv_list?: unknown } } }): Candle[] {
  const list = payload?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) return [];
  return list
    .flatMap((row) => {
      if (!Array.isArray(row) || row.length < 6) return [];
      const nums = row.slice(0, 6).map(Number);
      const [time, open, high, low, close, volumeUsd] = nums;
      if (
        nums.some((value) => !Number.isFinite(value)) ||
        time <= 0 ||
        open <= 0 ||
        high <= 0 ||
        low <= 0 ||
        close <= 0 ||
        volumeUsd < 0
      ) {
        return [];
      }
      return [{ time, open, high, low, close, volumeUsd }];
    })
    .sort((a, b) => a.time - b.time);
}

async function fetchCandles(pair: string, interval: Interval, signal: AbortSignal): Promise<Candle[]> {
  const url = ohlcvUrl(pair, interval);
  if (!url) throw new Error("有効な市場ペアがありません");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        throw response.status === 429
          ? new Error("市場履歴APIが混雑しています。自動的に再試行します")
          : new Error(`市場履歴を取得できませんでした (${response.status})`);
      }
      const candles = parseCandles(await response.json());
      if (candles.length === 0) throw new Error("この時間軸の市場履歴はまだありません");
      return candles;
    } catch (error) {
      if (signal.aborted || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw new Error("市場履歴を取得できませんでした");
}

function maPath(
  candles: Candle[],
  window: number,
  xOf: (index: number) => number,
  yOf: (price: number) => number,
): string {
  const points = candles.flatMap((_, index) => {
    if (index < window - 1) return [];
    const avg =
      candles.slice(index - window + 1, index + 1).reduce((sum, row) => sum + row.close, 0) /
      window;
    return [`${xOf(index)},${yOf(avg)}`];
  });
  return points.length > 1 ? `M${points.join(" L")}` : "";
}

function Candles({ candles, interval, symbol }: { candles: Candle[]; interval: Interval; symbol: string }) {
  const plot = { left: 18, right: 1118, top: 52, bottom: 348 };
  const volume = { top: 374, bottom: 452 };
  const highsLows = candles.flatMap((row) => [row.high, row.low]);
  const min = Math.min(...highsLows);
  const max = Math.max(...highsLows);
  const pad = Math.max((max - min) * 0.08, max * 0.002);
  const lo = min - pad;
  const hi = max + pad;
  const span = Math.max(hi - lo, Number.EPSILON);
  const maxVol = Math.max(...candles.map((row) => row.volumeUsd), 1);
  const step = (plot.right - plot.left) / Math.max(candles.length, 1);
  const width = Math.max(2, Math.min(8, step * 0.64));
  const xOf = (index: number) => plot.left + step * index + step / 2;
  const yOf = (price: number) => plot.top + ((hi - price) / span) * (plot.bottom - plot.top);
  const last = candles.at(-1);
  const lastY = last ? yOf(last.close) : 0;
  const timeFmt = new Intl.DateTimeFormat(
    "ja-JP",
    interval === "1d"
      ? { month: "numeric", day: "numeric" }
      : interval === "1h"
        ? { month: "numeric", day: "numeric", hour: "2-digit" }
        : { hour: "2-digit", minute: "2-digit" },
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.min(candles.length - 1, Math.round((candles.length - 1) * ratio)),
  );
  const ma7 = maPath(candles, 7, xOf, yOf);
  const ma25 = maPath(candles, 25, xOf, yOf);

  return (
    <svg className="candlestick-chart" viewBox="0 0 1200 480" preserveAspectRatio="none" role="img">
      <title>{symbol}のリアルタイムローソク足チャート</title>
      <desc>GeckoTerminalから取得した実市場のOHLCVデータです。緑は上昇、赤は下落、下段は出来高を表します。</desc>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = plot.top + (plot.bottom - plot.top) * ratio;
        const price = hi - span * ratio;
        return (
          <g key={`price-grid-${ratio}`}>
            <line className="candle-grid" x1={plot.left} x2={plot.right} y1={y} y2={y} />
            <text className="candle-axis" x={1130} y={y + 3}>
              {formatPrice(price)}
            </text>
          </g>
        );
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const x = plot.left + (plot.right - plot.left) * ratio;
        return (
          <line
            key={`time-grid-${ratio}`}
            className="candle-grid candle-grid--vertical"
            x1={x}
            x2={x}
            y1={plot.top}
            y2={volume.bottom}
          />
        );
      })}
      <line className="candle-divider" x1={plot.left} x2={plot.right} y1={365} y2={365} />
      {candles.map((candle, index) => {
        const x = xOf(index);
        const up = candle.close >= candle.open;
        const bodyTop = yOf(Math.max(candle.open, candle.close));
        const bodyH = Math.max(1.5, Math.abs(yOf(candle.open) - yOf(candle.close)));
        const volH = (candle.volumeUsd / maxVol) * (volume.bottom - volume.top);
        return (
          <g key={candle.time} className={up ? "candle candle--up" : "candle candle--down"}>
            <line className="candle-wick" x1={x} x2={x} y1={yOf(candle.high)} y2={yOf(candle.low)} />
            <rect className="candle-body" x={x - width / 2} y={bodyTop} width={width} height={bodyH} rx={0.6} />
            <rect
              className="candle-volume"
              x={x - width / 2}
              y={volume.bottom - volH}
              width={width}
              height={Math.max(1, volH)}
            />
          </g>
        );
      })}
      {ma7 && <path className="candle-ma candle-ma--7" d={ma7} />}
      {ma25 && <path className="candle-ma candle-ma--25" d={ma25} />}
      {last && (
        <g>
          <line className="candle-current" x1={plot.left} x2={plot.right} y1={lastY} y2={lastY} />
          <rect className="candle-current-label" x={1124} y={lastY - 10} width={72} height={20} rx={3} />
          <text className="candle-current-text" x={1160} y={lastY + 3}>
            {formatPrice(last.close)}
          </text>
        </g>
      )}
      {ticks.map((index, tickIndex) => {
        const candle = candles[index];
        return candle ? (
          <text
            key={`time-${candle.time}`}
            className="candle-axis candle-axis--time"
            x={xOf(index)}
            y={472}
            textAnchor={tickIndex === 0 ? "start" : tickIndex === ticks.length - 1 ? "end" : "middle"}
          >
            {timeFmt.format(new Date(candle.time * 1000))}
          </text>
        ) : null;
      })}
      <text className="candle-volume-label" x={plot.left} y={388}>
        VOL (USD)
      </text>
    </svg>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="market-stat">
      <span>{label}</span>
      <strong className={`value--${tone}`}>{value}</strong>
    </div>
  );
}

type Props = {
  holdings: Holding[];
  selectedAddress: string;
  onSelect: (holding: Holding) => void;
  marketsStatus: LiveOverlay["marketsStatus"];
};

export function MarketChart({ holdings, selectedAddress, onSelect, marketsStatus }: Props) {
  const selected = holdings.find((row) => row.address === selectedAddress) ?? holdings[0];
  const [interval, setInterval] = useState<Interval>("5m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const last = candles.at(-1);
  const pairKind = pairEmptyKind({
    marketsStatus,
    pairAddress: selected?.pairAddress ?? null,
  });

  useEffect(() => {
    if (!selected?.pairAddress) {
      setCandles([]);
      setError(null);
      setInFlight(false);
      setUpdatedAt(null);
      return;
    }
    const controller = new AbortController();
    const load = async (showLoader: boolean) => {
      if (showLoader) setInFlight(true);
      try {
        const next = await fetchCandles(selected.pairAddress as string, interval, controller.signal);
        setCandles(next);
        setError(null);
        setUpdatedAt(new Date());
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(ohlcvErrorMessage(caught));
      } finally {
        if (!controller.signal.aborted) setInFlight(false);
      }
    };
    void load(true);
    const timer = window.setInterval(() => void load(false), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [interval, selected?.pairAddress]);

  const change = useMemo(() => {
    const first = candles[0];
    if (!first || !last || first.open === 0) return null;
    return ((last.close - first.open) / first.open) * 100;
  }, [candles, last]);

  if (!selected) {
    return (
      <div className="chart-empty" role="status">
        <strong>チャート対象がありません</strong>
        <span>保有銘柄の同期後に市場チャートを表示します。</span>
      </div>
    );
  }

  const ohlcvKind = ohlcvEmptyKind({ inFlight, candles: candles.length, error });
  const ohlcvLive = ohlcvKind === "ready";
  const fomoUrl = fomoFamilyUrl(selected.address);

  return (
    <div className="market-chart-layout">
      <nav className="asset-rail" aria-label="チャート対象の保有銘柄">
        <div className="asset-rail__heading">
          <span>HELD ASSETS</span>
          <strong>{holdings.length}</strong>
        </div>
        <div className="asset-rail__list">
          {holdings.map((row) => {
            const active = row.address === selected.address;
            return (
              <button
                key={row.address}
                type="button"
                className={active ? "asset-quote active" : "asset-quote"}
                aria-pressed={active}
                onClick={() => onSelect(row)}
              >
                <span className="asset-quote__identity">
                  <i>{row.symbol.slice(0, 1)}</i>
                  <strong>{row.symbol}</strong>
                </span>
                <span className="asset-quote__market">
                  <b>{formatUsd(row.priceUsd, { precise: true })}</b>
                  <small className={`value--${toneOf(row.change24h)}`}>{formatPct(row.change24h, true)}</small>
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      <section className="market-stage" aria-labelledby="market-chart-heading">
        <header className="market-stage__header">
          <div className="market-pair">
            <span className="market-pair__mark">{selected.symbol.slice(0, 1)}</span>
            <div>
              <p>
                <strong id="market-chart-heading">{selected.symbol}</strong>
                <span>/ {selected.quoteSymbol ?? "WETH"}</span>
                {ohlcvLive ? <i>OHLCV</i> : <i className="pair-status-muted">取得不可</i>}
              </p>
              <small>
                {selected.dexId?.toUpperCase() ?? "DEX"} · ROBINHOOD CHAIN
              </small>
            </div>
          </div>
          <div className="market-price">
            <strong>{formatUsd(selected.priceUsd, { precise: true })}</strong>
            <span className={`value--${toneOf(selected.change24h)}`}>
              {formatPct(selected.change24h, true)} 24H
            </span>
          </div>
          <div className="market-links">
            {fomoUrl && (
              <a
                className="market-external market-external--primary"
                href={fomoUrl}
                target="_blank"
                rel="noreferrer"
              >
                FOMO.family Chart <span aria-hidden="true">↗</span>
              </a>
            )}
            {selected.marketUrl && (
              <a
                className="market-external"
                href={selected.marketUrl}
                target="_blank"
                rel="noreferrer"
              >
                DEX Screener <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </header>
        <div className="market-stats" aria-label={`${selected.symbol}の市場・保有指標`}>
          <Stat label="保有評価額" value={formatUsd(selected.valueUsd, { precise: true })} />
          <Stat label="保有数量" value={formatQty(selected.balance)} />
          <Stat label="1H" value={formatPct(selected.change1h, true)} tone={toneOf(selected.change1h)} />
          <Stat label="24H出来高" value={formatCompactUsd(selected.volume24hUsd)} />
          <Stat label="流動性" value={formatCompactUsd(selected.liquidityUsd)} />
        </div>
        <div className="market-frame">
          <div className="candlestick-toolbar">
            <div className="market-intervals" role="group" aria-label="チャート時間軸">
              {(["5m", "1h", "1d"] as Interval[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={interval === item ? "active" : ""}
                  aria-pressed={interval === item}
                  onClick={() => {
                    if (item !== interval) {
                      setCandles([]);
                      setError(null);
                      setInterval(item);
                    }
                  }}
                >
                  {item === "5m" ? "5分" : item === "1h" ? "1時間" : "1日"}
                </button>
              ))}
            </div>
            {last && (
              <div className="candle-ohlc" aria-label="最新ローソク足">
                <span>
                  O <b>{formatPrice(last.open)}</b>
                </span>
                <span>
                  H <b>{formatPrice(last.high)}</b>
                </span>
                <span>
                  L <b>{formatPrice(last.low)}</b>
                </span>
                <span>
                  C{" "}
                  <b className={`value--${toneOf(change)}`}>{formatPrice(last.close)}</b>
                </span>
              </div>
            )}
            <div className="candle-legend" aria-label="移動平均線">
              <span>
                <i className="ma-7" />
                MA(7)
              </span>
              <span>
                <i className="ma-25" />
                MA(25)
              </span>
            </div>
          </div>
          {pairKind === "in-flight" && (
            <div className="chart-empty" role="status">
              <span className="chart-loader" aria-hidden="true" />
              <strong>{selected.symbol}の市場ペアを同期中</strong>
              <span>ライブ価格を取得でき次第、実市場のローソク足を表示します。</span>
            </div>
          )}
          {pairKind === "unavailable" && (
            <div className="chart-empty chart-empty--error" role="status">
              <strong>取得不可</strong>
              <span>{selected.symbol}の市場ペアを取得できませんでした。</span>
            </div>
          )}
          {pairKind === "ready" && ohlcvKind === "ready" && (
            <Candles candles={candles} interval={interval} symbol={selected.symbol} />
          )}
          {pairKind === "ready" && ohlcvKind === "in-flight" && (
            <div className="chart-empty" role="status">
              <span className="chart-loader" aria-hidden="true" />
              <strong>実市場のローソク足を取得中</strong>
              <span>GeckoTerminal OHLCV · Robinhood Chain</span>
            </div>
          )}
          {pairKind === "ready" && ohlcvKind === "unavailable" && (
            <div className="chart-empty chart-empty--error" role="status">
              <strong>取得不可</strong>
              <span>{error && error !== "取得不可" ? error : "市場履歴を取得できませんでした。"}</span>
            </div>
          )}
          {error && candles.length > 0 && (
            <div className="chart-stale" role="status">
              {error}
            </div>
          )}
        </div>
        <div className="market-disclosure">
          <span>主チャート: FOMO.family（外部表示）</span>
          <span>
            <i />
            保有評価額 15秒 / OHLCV 30秒更新
          </span>
          <span>実市場ローソク足・出来高: GeckoTerminal</span>
          <span>
            {ohlcvFooter({
              inFlight,
              lastUpdated: updatedAt,
              error,
            })}
          </span>
          <span>公開市場データであり、約定価格を保証しません</span>
        </div>
      </section>
    </div>
  );
}
