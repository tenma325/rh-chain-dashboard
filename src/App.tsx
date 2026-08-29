import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HoldingsTable } from "./components/HoldingsTable";
import { JudgmentList } from "./components/JudgmentList";
import { MarketChart } from "./components/MarketChart";
import { MetricCard } from "./components/MetricCard";
import { Pager } from "./components/Pager";
import { PerformanceChart } from "./components/PerformanceChart";
import { TradeTable } from "./components/TradeTable";
import {
  evaluateHeldPriceSurges,
  type PriceAlertState,
} from "./lib/alerts";
import { fomoFamilyUrl } from "./lib/chart";
import { formatAge, formatJst, formatQty, formatUsd, toneOf } from "./lib/format";
import { ACTION_LABELS, TABS, reasonJa, type TabId } from "./lib/labels";
import {
  chartHoldings,
  countLivePositions,
  countTrackedPositions,
  countsTowardHeader,
  performanceSeries,
  realizedUsd,
  tableHoldings,
  tradeStats,
  bookChainMismatch,
} from "./lib/ledger";
import {
  SNAPSHOT as BAKED_SNAPSHOT,
  fetchLiveOverlay,
  loadingOverlay,
} from "./lib/live";
import { fetchLatestSnapshot } from "./lib/snapshot";
import { assetsUsd, chipStatus, hasUnverifiedHeldBalance, overviewLine, walletLabel, walletUsd } from "./lib/sync";
import type { LiveOverlay, Snapshot } from "./lib/types";

const PRICE_ALERT_STORAGE = "ferris-price-alerts-v1";

function storedPriceAlerts(): PriceAlertState {
  try {
    const value = JSON.parse(window.localStorage.getItem(PRICE_ALERT_STORAGE) ?? "{}");
    return value && typeof value === "object" ? (value as PriceAlertState) : {};
  } catch {
    return {};
  }
}

function notificationPermission(): NotificationPermission | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

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
  const [snapshot, setSnapshot] = useState<Snapshot>(BAKED_SNAPSHOT);
  const [overlay, setOverlay] = useState<LiveOverlay>(() =>
    loadingOverlay(BAKED_SNAPSHOT),
  );
  const [inFlight, setInFlight] = useState(true);
  const [alertPermission, setAlertPermission] = useState(notificationPermission);
  const [period, setPeriod] = useState(7);
  const [tab, setTab] = useState<TabId>(tabFromPath);
  const [selected, setSelected] = useState(() =>
    assetFromQuery(loadingOverlay(BAKED_SNAPSHOT)),
  );
  const [tradePage, setTradePage] = useState(0);
  const [agentPage, setAgentPage] = useState(0);
  const snapshotRef = useRef<Snapshot>(BAKED_SNAPSHOT);
  const priceAlertsRef = useRef<PriceAlertState>(storedPriceAlerts());

  const processPriceAlerts = useCallback((next: LiveOverlay) => {
    const result = evaluateHeldPriceSurges(
      priceAlertsRef.current,
      next.holdings,
    );
    priceAlertsRef.current = result.state;
    try {
      window.localStorage.setItem(
        PRICE_ALERT_STORAGE,
        JSON.stringify(result.state),
      );
    } catch {
      // Alerts still work for the current tab when storage is unavailable.
    }
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    for (const alert of result.alerts) {
      const notice = new Notification(
        alert.symbol + " 急騰 +" + alert.changePct.toFixed(1) + "%",
        {
          body: "保有銘柄が5分以内に上昇しました。FOMO.familyで確認できます。",
          tag: "held-surge-" + alert.address.toLowerCase(),
        },
      );
      notice.onclick = () => {
        const url = fomoFamilyUrl(alert.address);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      };
    }
  }, []);

  const resync = useCallback(async (showLoading = true) => {
    if (showLoading) setInFlight(true);
    const latest = await fetchLatestSnapshot(snapshotRef.current);
    const next = await fetchLiveOverlay(latest);
    snapshotRef.current = latest;
    setSnapshot(latest);
    setOverlay(next);
    processPriceAlerts(next);
    if (showLoading) setInFlight(false);
  }, [processPriceAlerts]);

  useEffect(() => {
    void resync(true);
  }, [resync]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void resync(false);
    }, 15_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [resync]);

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setAlertPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setAlertPermission(permission);
    if (permission === "granted") {
      new Notification("Ferris.GG 急騰通知を有効にしました", {
        body: "オンチェーンで保有確認済みの銘柄だけを監視します。",
        tag: "held-surge-enabled",
      });
    }
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

  const stats = useMemo(() => tradeStats(snapshot.trades), [snapshot.trades]);
  const wallet = walletUsd(overlay);
  const assets = assetsUsd(overlay.holdings);
  const liveCount = countLivePositions(overlay.holdings);
  const trackedCount = countTrackedPositions(overlay.holdings);
  const positionCount = hasUnverifiedHeldBalance(overlay.holdings) ? null : liveCount;
  const chartRows = chartHoldings(overlay.holdings);
  const tableRows = tableHoldings(overlay.holdings);
  const mismatchCount = tableRows.filter(bookChainMismatch).length;
  const overview = overviewLine({
    loading: inFlight,
    walletUsd: wallet,
    assetsUsd: assets,
    positionCount: inFlight ? null : positionCount,
    trackedCount: inFlight ? null : trackedCount,
  });
  const series = useMemo(
    () =>
      performanceSeries(
        snapshot.trades,
        snapshot.walletHistory,
        overlay.walletEth,
        overlay.ethUsd,
        period,
      ),
    [overlay.ethUsd, overlay.walletEth, period, snapshot.trades, snapshot.walletHistory],
  );
  const trades = useMemo(
    () =>
      [...snapshot.trades].sort(
        (a, b) =>
          new Date(b.exitTime || b.entryTime).getTime() -
          new Date(a.exitTime || a.entryTime).getTime(),
      ),
    [snapshot.trades],
  );
  const council = useMemo(() => [...snapshot.council].reverse(), [snapshot.council]);
  const latest = council[0];
  const tradePages = Math.max(1, Math.ceil(trades.length / 8));
  const agentPages = Math.max(1, Math.ceil(council.length / 4));
  const tradeSlice = trades.slice(tradePage * 8, (tradePage + 1) * 8);
  const agentSlice = council.slice(agentPage * 4, (agentPage + 1) * 4);
  const snapshotAge = formatAge(snapshot.generatedAt);
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
          <span title={snapshot.walletAddress}>
            {snapshot.walletAddress.slice(0, 6)}…{snapshot.walletAddress.slice(-4)}
          </span>
          {(snapshot.tradingMode || snapshot.activeRuleset) && (
            <span title="読み取り専用。公開サイトは注文しません">
              {(snapshot.tradingMode || "observe").toUpperCase()}
              {snapshot.activeRuleset ? ` · ${snapshot.activeRuleset}` : ""}
            </span>
          )}
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
            className={alertPermission === "granted" ? "alert-button active" : "alert-button"}
            type="button"
            onClick={() => void enableNotifications()}
            title="保有確認済み銘柄の5分以内+5%上昇をブラウザ通知"
          >
            {alertPermission === "granted"
              ? "急騰通知 ON"
              : alertPermission === "denied"
                ? "通知ブロック中"
                : alertPermission === "unsupported"
                  ? "通知非対応"
                  : "急騰通知"}
          </button>
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
          const pnl = realizedUsd(snapshot.trades, overlay.ethUsd, days);
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
              <span className="snapshot-chip">BOT DATA</span>
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
              <span>評議会ログ自動更新</span>
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
                  <span>BOT DATA</span>
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
                <span>
                  ライブ {inFlight ? "—" : liveCount} / 追跡 {inFlight ? "—" : trackedCount}
                </span>
                <span>{tableRows.filter((row) => row.liveRisk && countsTowardHeader(row)).length} live risk</span>
                {mismatchCount > 0 ? (
                  <span>残存率とオンチェーン数量が不一致 {mismatchCount}</span>
                ) : null}
                <span>価格: DEX Screener · 数量: 二重RPC一致時のみ</span>
              </div>
              <HoldingsTable holdings={tableRows} />
            </div>
          )}
          {tab === "agents" && (
            <JudgmentList entries={agentSlice} generatedAt={snapshot.generatedAt} />
          )}
          {tab === "ledger" && (
            <div className="ledger-panel">
              <div className="panel-summary">
                <span>全 {trades.length} 件</span>
                <span>1ページ 8 件</span>
                <span>実現損益は決済済み取引のみ · ボットデータを自動同期</span>
              </div>
              <TradeTable trades={tradeSlice} ethUsd={overlay.ethUsd} />
            </div>
          )}
        </div>
        <footer className="console-footer">
          <span>READ ONLY · NO PRIVATE KEY</span>
          <span>
            {(snapshot.tradingMode || "observe").toUpperCase()}
            {snapshot.activeRuleset ? ` · ${snapshot.activeRuleset}` : ""}
          </span>
          <span>最終同期 {formatJst(overlay.refreshedAt)}</span>
          <span>投資助言ではありません</span>
        </footer>
      </section>
    </main>
  );
}
