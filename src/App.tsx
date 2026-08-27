import { useCallback, useEffect, useMemo, useState } from "react";
import { HoldingsTable } from "./components/HoldingsTable";
import { JudgmentList } from "./components/JudgmentList";
import { MarketChart } from "./components/MarketChart";
import { MetricCard } from "./components/MetricCard";
import { Pager } from "./components/Pager";
import { PerformanceChart } from "./components/PerformanceChart";
import { TradeTable } from "./components/TradeTable";
import { formatAge, formatJst, formatQty, formatUsd, toneOf } from "./lib/format";
import { ACTION_LABELS, TABS, reasonJa, type TabId } from "./lib/labels";
import {
  chartHoldings,
  countLivePositions,
  countsTowardHeader,
  performanceSeries,
  realizedUsd,
  tableHoldings,
  tradeStats,
} from "./lib/ledger";
import { SNAPSHOT, fetchLiveOverlay, loadingOverlay } from "./lib/live";
import { assetsUsd, chipStatus, overviewLine, walletLabel, walletUsd } from "./lib/sync";
import type { LiveOverlay } from "./lib/types";

function tabFromPath(): TabId {
  return window.location.pathname.replace(/\/+$/, "") === "/chart" ? "chart" : "performance";
}

function assetFromQuery(overlay: LiveOverlay): string {
  const symbol = new URLSearchParams(window.location.search).get("asset");
  const shown = chartHoldings(overlay.holdings);
  return (
    shown.find((row) => row.symbol.toLowerCase() === symbol?.toLowerCase())?.address ??
    shown[0]?.address ??
    ""
  );
}

export function App() {
  const [overlay, setOverlay] = useState<LiveOverlay>(() => loadingOverlay(SNAPSHOT));
  const [inFlight, setInFlight] = useState(true);
  const [period, setPeriod] = useState(7);
  const [tab, setTab] = useState<TabId>(tabFromPath);
  const [selected, setSelected] = useState(() => assetFromQuery(loadingOverlay(SNAPSHOT)));
  const [tradePage, setTradePage] = useState(0);
  const [agentPage, setAgentPage] = useState(0);

  const resync = useCallback(async () => {
    setInFlight(true);
    const next = await fetchLiveOverlay(SNAPSHOT);
    setOverlay(next);
    setInFlight(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLiveOverlay(SNAPSHOT).then((next) => {
      if (cancelled) return;
      setOverlay(next);
      setInFlight(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      setTab(tabFromPath());
      setSelected(assetFromQuery(overlay));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [overlay]);

  useEffect(() => {
    const shown = chartHoldings(overlay.holdings);
    if (shown.length === 0) return;
    if (!shown.some((row) => row.address.toLowerCase() === selected.toLowerCase())) {
      setSelected(shown[0].address);
    }
  }, [overlay.holdings, selected]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setInterval(() => {
      fetchLiveOverlay(SNAPSHOT).then((next) => {
        if (!cancelled) setOverlay(next);
      });
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const stats = useMemo(() => tradeStats(SNAPSHOT.trades), []);
  const wallet = walletUsd(overlay);
  const assets = assetsUsd(overlay.holdings);
  const liveCount = countLivePositions(overlay.holdings);
  const chartRows = chartHoldings(overlay.holdings);
  const tableRows = tableHoldings(overlay.holdings);
  const overview = overviewLine({
    loading: inFlight,
    walletUsd: wallet,
    assetsUsd: assets,
    positionCount: inFlight ? null : liveCount,
  });
  const series = useMemo(
    () =>
      performanceSeries(
        SNAPSHOT.trades,
        SNAPSHOT.walletHistory,
        overlay.walletEth,
        overlay.ethUsd,
        period,
      ),
    [overlay.ethUsd, overlay.walletEth, period],
  );
  const trades = useMemo(
    () =>
      [...SNAPSHOT.trades].sort(
        (a, b) =>
          new Date(b.exitTime || b.entryTime).getTime() -
          new Date(a.exitTime || a.entryTime).getTime(),
      ),
    [],
  );
  const council = useMemo(() => [...SNAPSHOT.council].reverse(), []);
  const latest = council[0];
  const tradePages = Math.max(1, Math.ceil(trades.length / 8));
  const agentPages = Math.max(1, Math.ceil(council.length / 4));
  const tradeSlice = trades.slice(tradePage * 8, (tradePage + 1) * 8);
  const agentSlice = council.slice(agentPage * 4, (agentPage + 1) * 4);
  const snapshotAge = formatAge(SNAPSHOT.generatedAt);
  const title = TABS.find((item) => item.id === tab)?.label ?? "";
  const chip = chipStatus({
    inFlight,
    issues: overlay.issues,
    ethUsd: overlay.ethUsd,
  });
  const liveWalletQty =
    overlay.walletEth === null || overlay.weth === null
      ? null
      : overlay.walletEth + overlay.weth;

  const openTab = (next: TabId) => {
    setTab(next);
    if (next === "chart") {
      const symbol =
        chartRows.find((row) => row.address === selected)?.symbol ?? chartRows[0]?.symbol;
      window.history.pushState(
        {},
        "",
        `/chart${symbol ? `?asset=${encodeURIComponent(symbol)}` : ""}`,
      );
      return;
    }
    window.history.pushState({}, "", "/");
  };

  return (
    <main className="trade-console" id="dashboard">
      <h1 className="visually-hidden">Ferris.GG AI Trade Portfolio Dashboard</h1>
      <header className="console-header">
        <div className="brand" aria-label="Ferris.GG Trade Desk">
          <span className="brand-mark">F</span>
          <span>
            Ferris.GG <small>TRADE DESK</small>
          </span>
        </div>
        <div className="network-meta">
          <span>ROBINHOOD CHAIN · 4663</span>
          <span title={SNAPSHOT.walletAddress}>
            {SNAPSHOT.walletAddress.slice(0, 6)}…{SNAPSHOT.walletAddress.slice(-4)}
          </span>
        </div>
        <div className="sync-cluster">
          <span className={`live-status${chip === "DEGRADED" ? " live-status--degraded" : ""}`}>
            <i
              className={
                chip === "SYNCING"
                  ? "status-dot status-dot--loading"
                  : chip === "DEGRADED"
                    ? "status-dot status-dot--degraded"
                    : "status-dot"
              }
            />
            {chip}
          </span>
          <button
            className="refresh-button"
            type="button"
            onClick={() => void resync()}
            disabled={inFlight}
          >
            <span
              className={inFlight ? "refresh-icon refresh-icon--loading" : "refresh-icon"}
              aria-hidden="true"
            >
              ↻
            </span>
            <span className="refresh-label">再同期</span>
          </button>
        </div>
      </header>
      {overlay.issues.length > 0 && !inFlight && (
        <div className="data-warning" role="status">
          一部データを取得できませんでした
          <span>{overlay.issues.join(" / ")}</span>
        </div>
      )}
      <section className="overview-grid" aria-label="常時表示する主要指標">
        <MetricCard
          label="推定総資産"
          value={formatUsd(overview.total.value, { loading: overview.total.loading })}
          detail={overview.detail}
          featured
        />
        {[1, 7, 30].map((days) => {
          const pnl = realizedUsd(SNAPSHOT.trades, overlay.ethUsd, days);
          return (
            <MetricCard
              key={days}
              label={days === 1 ? "日次実現損益" : days === 7 ? "週次実現損益" : "月次実現損益"}
              value={formatUsd(pnl, { sign: true, precise: true })}
              detail={`過去${days}日`}
              tone={toneOf(pnl)}
            />
          );
        })}
        <MetricCard
          label="勝率"
          value={`${stats.winRate.toFixed(1)}%`}
          detail={`${stats.wins}W / ${stats.losses}L`}
        />
        {latest && (
          <article className="signal-card">
            <div className="signal-card__topline">
              <p>最新エージェント判断</p>
              <span className="snapshot-chip">SNAPSHOT</span>
              <span
                className={`decision-badge ${latest.allow ? "decision-badge--allow" : "decision-badge--block"}`}
              >
                {latest.allow ? "ALLOW" : "BLOCK"}
              </span>
            </div>
            <div className="signal-card__decision">
              <strong>{latest.symbol}</strong>
              <span>{ACTION_LABELS[latest.action] ?? latest.action}</span>
            </div>
            <p className="signal-card__reason">{reasonJa(latest.reason)}</p>
            <div className="signal-card__meta">
              <time dateTime={latest.time}>{formatJst(latest.time)}</time>
              <span>{snapshotAge}</span>
            </div>
          </article>
        )}
      </section>
      <section className="workspace" id="workspace" aria-labelledby="workspace-title">
        <header className="workspace-toolbar">
          <div className="workspace-title">
            <span>PORTFOLIO VIEW</span>
            <strong id="workspace-title">{title}</strong>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="ダッシュボード表示">
            {TABS.map((item) => (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                className={tab === item.id ? "active" : ""}
                onClick={() => openTab(item.id)}
              >
                <span className="tab-label-long">{item.label}</span>
                <span className="tab-label-short">{item.shortLabel}</span>
              </button>
            ))}
          </div>
          <div className="workspace-actions">
            {tab === "performance" && (
              <div className="period-switch" aria-label="表示期間">
                {[1, 7, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={period === days ? "active" : ""}
                    aria-pressed={period === days}
                    onClick={() => setPeriod(days)}
                  >
                    {days === 1 ? "1D" : days === 7 ? "1W" : "1M"}
                  </button>
                ))}
              </div>
            )}
            {tab === "chart" && (
              <span className="auto-sync">
                <i />
                AUTO 15S
              </span>
            )}
            {tab === "agents" && (
              <Pager page={agentPage} pages={agentPages} onChange={setAgentPage} label="判断履歴ページ" />
            )}
            {tab === "ledger" && (
              <Pager page={tradePage} pages={tradePages} onChange={setTradePage} label="取引履歴ページ" />
            )}
          </div>
        </header>
        <div
          className="workspace-panel"
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {tab === "chart" && (
            <MarketChart
              holdings={chartRows}
              selectedAddress={selected}
              marketsStatus={overlay.marketsStatus}
              onSelect={(row) => {
                setSelected(row.address);
                window.history.replaceState(
                  {},
                  "",
                  `/chart?asset=${encodeURIComponent(row.symbol)}`,
                );
              }}
            />
          )}
          {tab === "performance" && (
            <div className="performance-layout">
              <PerformanceChart series={series} period={period} />
              <div className="integrity-grid" aria-label="データ健全性">
                <div>
                  <span>LIVE WALLET</span>
                  <strong>
                    {liveWalletQty === null ? "取得不可" : `${formatQty(liveWalletQty)} ETH`}
                  </strong>
                  <small>{walletLabel(overlay.walletSource)}</small>
                </div>
                <div>
                  <span>ETH / USD</span>
                  <strong>{formatUsd(overlay.ethUsd)}</strong>
                  <small>CoinGecko</small>
                </div>
                <div>
                  <span>SNAPSHOT</span>
                  <strong>{snapshotAge}</strong>
                  <small>判断・履歴</small>
                </div>
                <div>
                  <span>PROFIT FACTOR</span>
                  <strong>{stats.profitFactor?.toFixed(2) ?? "—"}</strong>
                  <small>{stats.closed} closed</small>
                </div>
              </div>
            </div>
          )}
          {tab === "holdings" && (
            <div className="holdings-panel">
              <div className="panel-summary">
                <span>
                  保有評価額 <strong>{formatUsd(assets, { loading: inFlight })}</strong>
                </span>
                <span>{tableRows.filter((row) => row.liveRisk && countsTowardHeader(row)).length} live risk</span>
                <span>価格: DEX Screener · 数量: ライブRPCのみ</span>
              </div>
              <HoldingsTable holdings={tableRows} />
            </div>
          )}
          {tab === "agents" && (
            <JudgmentList entries={agentSlice} generatedAt={SNAPSHOT.generatedAt} />
          )}
          {tab === "ledger" && (
            <div className="ledger-panel">
              <div className="panel-summary">
                <span>全 {trades.length} 件</span>
                <span>1ページ 8 件</span>
                <span>実現損益は決済済み取引のみ · ジャーナルは SNAPSHOT</span>
              </div>
              <TradeTable trades={tradeSlice} ethUsd={overlay.ethUsd} />
            </div>
          )}
        </div>
        <footer className="console-footer">
          <span>READ ONLY · NO PRIVATE KEY</span>
          <span>最終同期 {formatJst(overlay.refreshedAt)}</span>
          <span>投資助言ではありません</span>
        </footer>
      </section>
    </main>
  );
}
