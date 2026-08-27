export const ACTION_LABELS: Record<string, string> = {
  trailing_stop: "追従ストップ",
  time_exit: "時間制限による決済",
  stop_loss: "損切り",
  stale_exit: "停滞ポジション決済",
  manual_close: "手動決済",
  orphan_reconciled: "孤立残高の照合",
  orphan_dust_audit: "ダスト残高監査",
  time_exit_force: "時間制限・強制決済",
};

export function reasonJa(reason: string): string {
  if (reason.includes("mandatory trailing_stop")) {
    return "必須の追従ストップ。反対票より安全ルールを優先。";
  }
  if (reason.includes("mandatory time_exit")) {
    return "必須の保有時間制限。反対票より安全ルールを優先。";
  }
  return reason || "理由の記録なし";
}

export const TABS = [
  { id: "performance", label: "損益推移", shortLabel: "推移" },
  { id: "chart", label: "Chart", shortLabel: "Chart" },
  { id: "holdings", label: "保有資産", shortLabel: "保有" },
  { id: "agents", label: "判断履歴", shortLabel: "判断" },
  { id: "ledger", label: "取引履歴", shortLabel: "取引" },
] as const;

export type TabId = (typeof TABS)[number]["id"];
