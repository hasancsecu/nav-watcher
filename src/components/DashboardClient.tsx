"use client";

import React, { useState, useEffect } from "react";
import {
  FundValuationMetrics,
  PortfolioSummaryMetrics,
} from "@/lib/calculations";
import PortfolioHistoryChart, {
  PortfolioHistoryItem,
} from "./PortfolioHistoryChart";
import FundComparisonChart from "./FundComparisonChart";
import UpdateHoldingsDialog from "./UpdateHoldingsDialog";
import {
  RefreshCw,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Sparkles,
  Sun,
  Moon,
  LayoutDashboard,
  Layers,
  BarChart3,
  Terminal,
} from "lucide-react";

export interface ScrapeLogItem {
  id: string;
  fundId: string | null;
  trigger: string;
  sourceUsed: string;
  urlAttempted: string;
  status: string;
  extractedNav: number | null;
  effectiveDate: string | null;
  durationMs: number | null;
  message: string | null;
  createdAt: string;
}

export interface SchedulerInfo {
  active: boolean;
  schedule: string;
  description?: string;
  timezone: string;
  startedAt?: string | null;
  lastCronRunAt?: string | null;
}

interface DashboardClientProps {
  initialSummary: PortfolioSummaryMetrics;
  initialFunds: FundValuationMetrics[];
  initialHistory: PortfolioHistoryItem[];
  initialLogs: ScrapeLogItem[];
  initialScheduler: SchedulerInfo;
}

type MobileSectionTab = "all" | "overview" | "holdings" | "analytics" | "logs";

function formatBdt(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

function formatDhakaTimestamp(iso?: string | Date | null): string {
  if (!iso) return "Not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not synced yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(d);
}

function applyThemeToDocument(effective: "light" | "dark", metaValue: string) {
  const meta = document.querySelector(
    'meta[name="color-scheme"]'
  ) as HTMLMetaElement | null;
  if (meta) {
    meta.content = metaValue;
  }
  const root = document.documentElement;
  root.dataset.theme = effective;
  if (effective === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

export default function DashboardClient({
  initialSummary,
  initialFunds,
  initialHistory,
  initialLogs,
  initialScheduler,
}: DashboardClientProps) {
  const [summary, setSummary] =
    useState<PortfolioSummaryMetrics>(initialSummary);
  const [funds, setFunds] = useState<FundValuationMetrics[]>(initialFunds);
  const [history, setHistory] =
    useState<PortfolioHistoryItem[]>(initialHistory);
  const [logs, setLogs] = useState<ScrapeLogItem[]>(initialLogs);
  const [scheduler, setScheduler] = useState<SchedulerInfo>(initialScheduler);

  const [activeTab, setActiveTab] = useState<MobileSectionTab>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFocusFundId, setModalFocusFundId] = useState<string | null>(null);

  // Theme state synced with <meta name="color-scheme">, data-theme, and localStorage (modern-web-guidance: dark-mode-toggle)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const syncThemeFromDom = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("color-scheme");
      } catch {}
      const effective: "light" | "dark" =
        stored === "light" || stored === "dark"
          ? stored
          : mql.matches
          ? "dark"
          : "light";
      applyThemeToDocument(effective, stored ?? "light dark");
      setResolvedTheme(effective);
    };

    syncThemeFromDom();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "color-scheme") {
        syncThemeFromDom();
      }
    };

    const handleMediaChange = () => {
      // Do NOT remove stored value when OS preference changes (modern-web-guidance: dark-mode-toggle)
      syncThemeFromDom();
    };

    window.addEventListener("storage", handleStorage);
    mql.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      mql.removeEventListener("change", handleMediaChange);
    };
  }, []);

  const handleToggleTheme = () => {
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const systemScheme: "light" | "dark" = sysDark ? "dark" : "light";

    let stored: string | null = null;
    try {
      stored = localStorage.getItem("color-scheme");
    } catch {}

    const currentRendered: "light" | "dark" =
      stored === "light" || stored === "dark" ? stored : systemScheme;
    const targetScheme: "light" | "dark" =
      currentRendered === "dark" ? "light" : "dark";

    const metaValue =
      targetScheme !== systemScheme ? targetScheme : "light dark";

    try {
      if (targetScheme !== systemScheme) {
        localStorage.setItem("color-scheme", targetScheme);
      } else {
        localStorage.removeItem("color-scheme");
      }
    } catch {}

    applyThemeToDocument(targetScheme, metaValue);
    setResolvedTheme(targetScheme);
  };

  const handleSyncNavNow = async (forceFallbackFor?: string[]) => {
    setIsSyncing(true);
    setSyncBanner(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          forceFallbackFor ? { forceFallbackFor } : {}
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync NAVs");
      }

      setSummary(data.summary);
      setFunds(data.funds);
      setHistory(data.history);
      setLogs(data.recentLogs || []);
      if (data.scheduler) setScheduler(data.scheduler);

      const results: Array<{
        fundName: string;
        status: string;
        nav: number | null;
        sourceUsed: string;
      }> = data.syncOutcome?.results || [];

      const okCount = results.filter((r) => r.status !== "ERROR").length;
      const fallbackCount = results.filter(
        (r) => r.sourceUsed === "FALLBACK"
      ).length;

      if (okCount === results.length) {
        setSyncBanner({
          type: "success",
          text:
            fallbackCount > 0
              ? `Synced all ${okCount} funds (${fallbackCount} via Bini.com.bd fallback URL): ` +
                results.map((r) => `${r.fundName}: ৳${r.nav}`).join(" · ")
              : `Live NAVs synced from primary AMC portals: ` +
                results.map((r) => `${r.fundName}: ৳${r.nav}`).join(" · "),
        });
      } else {
        setSyncBanner({
          type: "warning",
          text: `Synced ${okCount}/${results.length} funds. Check scraper logs for details.`,
        });
      }
    } catch (err) {
      setSyncBanner({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while syncing NAVs.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveHoldings = async (
    updates: Array<{
      fundId: string;
      totalInvested: number;
      averageBuyPrice: number;
      monthlySipTarget: number;
    }>
  ) => {
    const res = await fetch("/api/funds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings: updates }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update holdings");
    }
    setSummary(data.summary);
    setFunds(data.funds);
    setHistory(data.history);
    setSyncBanner({
      type: "success",
      text: "Baseline SIP holdings updated and live portfolio valuation recalculated.",
    });
  };

  const openHoldingsModal = (fundId: string | null = null) => {
    setModalFocusFundId(fundId);
    setIsModalOpen(true);
  };

  const netPositive = summary.absoluteGainLoss >= 0;

  const showOverview = activeTab === "all" || activeTab === "overview";
  const showHoldings = activeTab === "all" || activeTab === "holdings";
  const showAnalytics =
    activeTab === "all" || activeTab === "overview" || activeTab === "analytics";
  const showLogs = activeTab === "all" || activeTab === "logs";

  return (
    <div className="min-h-[100dvh] flex flex-col pb-20 sm:pb-0">
      {/* Top App Bar */}
      <header className="theme-header sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3.5 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="status-gain-badge flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl shadow-sm">
              <ShieldCheck
                className="h-5 w-5 sm:h-6 sm:w-6 status-gain-text"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-extrabold tracking-tight theme-text-primary truncate">
                  NAV Watcher
                </h1>
                <span className="status-gain-badge hidden xs:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>Shariah SIP</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs theme-text-secondary truncate">
                Shanta Amanah · IDLC Shariah · Edge Al-Amin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="theme-elevated hidden lg:flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium theme-text-secondary">
              <span
                className="h-2.5 w-2.5 rounded-full animate-pulse"
                style={{
                  backgroundColor: scheduler.active
                    ? "var(--gain-text)"
                    : "var(--warn-text)",
                }}
              />
              <span>
                Auto-Sync: <strong>9:05 AM</strong> ({scheduler.timezone})
              </span>
            </div>

            {/* Light / Dark Theme Toggle Button */}
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="theme-elevated inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold theme-text-primary hover:opacity-90 transition"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <span className="hidden md:inline">Light Theme</span>
                </>
              ) : (
                <>
                  <Moon
                    className="h-4 w-4 status-info-text"
                    aria-hidden="true"
                  />
                  <span className="hidden md:inline">Dark Theme</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => openHoldingsModal(null)}
              className="theme-elevated hidden sm:inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold theme-text-primary hover:opacity-90 transition"
            >
              <SlidersHorizontal
                className="h-4 w-4 status-info-text"
                aria-hidden="true"
              />
              <span>Update Holdings</span>
            </button>

            <button
              type="button"
              onClick={() => handleSyncNavNow()}
              disabled={isSyncing}
              className="btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold disabled:opacity-60 transition shadow-sm"
            >
              <RefreshCw
                className={`h-4 w-4 shrink-0 ${
                  isSyncing ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              <span className="hidden xs:inline">
                {isSyncing ? "Syncing..." : "Sync NAV Now"}
              </span>
            </button>
          </div>
        </div>

        {/* Single-Row Scrollable App View Tabs (modern-web-guidance: tabs) */}
        <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8">
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="app-tablist text-xs sm:text-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              className="app-tab"
            >
              All Sections
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              className="app-tab"
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "holdings"}
              onClick={() => setActiveTab("holdings")}
              className="app-tab"
            >
              Fund Holdings ({funds.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "analytics"}
              onClick={() => setActiveTab("analytics")}
              className="app-tab"
            >
              Compare &amp; Charts
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "logs"}
              onClick={() => setActiveTab("logs")}
              className="app-tab"
            >
              Scraper Logs
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 sm:space-y-8 px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Live Sync Status Notification Banner */}
        <div role="status" aria-live="polite">
          {syncBanner && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium ${
                syncBanner.type === "success"
                  ? "status-gain-badge"
                  : syncBanner.type === "warning"
                  ? "status-warn-badge"
                  : "status-loss-badge"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {syncBanner.type === "success" ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{syncBanner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncBanner(null)}
                className="text-xs font-bold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* 1. Portfolio Summary Cards (2x2 compact grid on mobile, 4-col on desktop) */}
        {showOverview && (
          <section aria-labelledby="portfolio-summary-heading">
            <h2 id="portfolio-summary-heading" className="sr-only">
              Portfolio Valuation Summary
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {/* Overall Total Invested */}
              <article className="theme-surface rounded-2xl border p-3.5 sm:p-5">
                <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold uppercase tracking-wider theme-text-secondary">
                  <span className="truncate">Total Invested</span>
                  <Wallet
                    className="h-4 w-4 status-info-text shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 sm:mt-3 font-mono kpi-value-fluid font-extrabold theme-text-primary">
                  ৳{formatBdt(summary.totalInvested, 0)}
                </p>
                <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs theme-text-muted">
                  SIP Target:{" "}
                  <strong className="font-mono theme-text-secondary">
                    ৳{formatBdt(summary.totalMonthlySip, 0)}/mo
                  </strong>
                </p>
              </article>

              {/* Overall Current Market Value */}
              <article className="theme-surface rounded-2xl border p-3.5 sm:p-5">
                <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold uppercase tracking-wider theme-text-secondary">
                  <span className="truncate">Market Value</span>
                  <Activity
                    className="h-4 w-4 status-gain-text shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 sm:mt-3 font-mono kpi-value-fluid font-extrabold theme-text-primary">
                  ৳{formatBdt(summary.currentMarketValue, 0)}
                </p>
                <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs theme-text-muted">
                  Units:{" "}
                  <strong className="font-mono theme-text-secondary">
                    {funds
                      .reduce((acc, f) => acc + f.totalUnitsHeld, 0)
                      .toLocaleString("en-BD", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </strong>
                </p>
              </article>

              {/* Net Gain / Loss (BDT & %) */}
              <article className="theme-surface rounded-2xl border p-3.5 sm:p-5">
                <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold uppercase tracking-wider theme-text-secondary">
                  <span className="truncate">Net Gain / Loss</span>
                  {netPositive ? (
                    <TrendingUp
                      className="h-4 w-4 status-gain-text shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <TrendingDown
                      className="h-4 w-4 status-loss-text shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                  <p
                    className={`font-mono kpi-value-fluid font-extrabold ${
                      netPositive ? "status-gain-text" : "status-loss-text"
                    }`}
                  >
                    {netPositive ? "+" : "-"}৳
                    {formatBdt(Math.abs(summary.absoluteGainLoss), 0)}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-lg px-2 py-0.5 font-mono text-[11px] sm:text-xs font-bold ${
                      netPositive ? "status-gain-badge" : "status-loss-badge"
                    }`}
                  >
                    {netPositive ? "▲ +" : "▼ "}
                    {summary.returnPct.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs theme-text-muted">
                  Live from scraped NAVs
                </p>
              </article>

              {/* Last Updated Timestamp */}
              <article className="theme-surface rounded-2xl border p-3.5 sm:p-5">
                <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold uppercase tracking-wider theme-text-secondary">
                  <span className="truncate">Last Synced</span>
                  <Clock
                    className="h-4 w-4 status-warn-text shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 sm:mt-3 text-sm sm:text-lg font-extrabold theme-text-primary leading-snug">
                  {formatDhakaTimestamp(summary.lastUpdatedAt)}
                </p>
                <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs theme-text-muted">
                  Daily cron: <strong>9:05 AM</strong> (UTC+6)
                </p>
              </article>
            </div>
          </section>
        )}

        {/* 2. Fund Breakdown Cards */}
        {showHoldings && (
          <section aria-labelledby="fund-cards-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2
                  id="fund-cards-heading"
                  className="section-title-fluid font-bold theme-text-primary"
                >
                  Mutual Fund SIP Holdings Breakdown
                </h2>
                <p className="text-xs sm:text-sm theme-text-secondary">
                  Live valuation per fund using Scraped NAV, Total Units Held, and Weighted Average Cost NAV
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
              {funds.map((fund) => {
                const isGain = fund.absoluteGainLoss >= 0;
                return (
                  <article
                    key={fund.id}
                    className="theme-surface flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider theme-text-muted">
                            {fund.fundManager}
                          </span>
                          <h3 className="text-base font-extrabold theme-text-primary mt-0.5">
                            {fund.name}
                          </h3>
                        </div>
                        <span
                          className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                            isGain ? "status-gain-badge" : "status-loss-badge"
                          }`}
                        >
                          {isGain ? "▲ +" : "▼ "}
                          {fund.returnPct.toFixed(2)}%
                        </span>
                      </div>

                      {/* Highlighted NAV & Market Value Banner */}
                      <div className="theme-elevated mt-4 grid grid-cols-2 gap-3 rounded-xl border p-3.5">
                        <div>
                          <span className="text-xs font-medium theme-text-secondary block">
                            Latest Scraped NAV
                          </span>
                          <span className="font-mono text-xl font-extrabold status-gain-text">
                            ৳{fund.effectiveNav.toFixed(3)}
                          </span>
                          <span className="block text-[11px] font-medium theme-text-muted mt-0.5">
                            As of {fund.navEffectiveDate || "Prev. Trading Day"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium theme-text-secondary block">
                            Current Market Value
                          </span>
                          <span className="font-mono text-xl font-extrabold theme-text-primary">
                            ৳{formatBdt(fund.currentMarketValue, 2)}
                          </span>
                          <span
                            className={`block font-mono text-xs font-bold mt-0.5 ${
                              isGain ? "status-gain-text" : "status-loss-text"
                            }`}
                          >
                            {isGain ? "+" : "-"}৳
                            {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}
                          </span>
                        </div>
                      </div>

                      {/* Key Metrics Grid */}
                      <dl className="mt-4 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                        <div className="flex justify-between border-b theme-border pb-1.5">
                          <dt className="theme-text-secondary font-medium">
                            Total Invested
                          </dt>
                          <dd className="font-mono font-bold theme-text-primary">
                            ৳{formatBdt(fund.totalInvested, 2)}
                          </dd>
                        </div>
                        <div className="flex justify-between border-b theme-border pb-1.5">
                          <dt className="theme-text-secondary font-medium">
                            Avg Buy NAV
                          </dt>
                          <dd className="font-mono font-bold theme-text-primary">
                            ৳{fund.averageBuyPrice.toFixed(4)}
                          </dd>
                        </div>
                        <div className="flex justify-between border-b theme-border pb-1.5">
                          <dt className="theme-text-secondary font-medium">
                            Total Units Held
                          </dt>
                          <dd className="font-mono font-bold status-info-text">
                            {fund.totalUnitsHeld.toFixed(4)}
                          </dd>
                        </div>
                        <div className="flex justify-between border-b theme-border pb-1.5">
                          <dt className="theme-text-secondary font-medium">
                            Portfolio Weight
                          </dt>
                          <dd className="font-mono font-bold theme-text-primary">
                            {fund.portfolioWeightPct.toFixed(1)}%
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Card Footer: Source Status & Edit Button */}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t theme-border pt-3.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            fund.lastScrapeSource === "FALLBACK"
                              ? "status-warn-badge"
                              : "status-info-badge"
                          }`}
                        >
                          {fund.lastScrapeSource === "FALLBACK"
                            ? "Bini Fallback"
                            : "Primary AMC"}
                        </span>
                        <a
                          href={fund.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold theme-text-secondary hover:underline"
                        >
                          <span>AMC</span>
                          <ExternalLink
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                        </a>
                        <a
                          href={fund.fallbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold theme-text-secondary hover:underline"
                        >
                          <span>Bini</span>
                          <ExternalLink
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => openHoldingsModal(fund.id)}
                        className="theme-elevated min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-bold theme-text-primary hover:opacity-85 transition"
                      >
                        Edit Holding
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Side-by-Side 3-Fund Investment Comparison Chart */}
        {showAnalytics && (
          <FundComparisonChart funds={funds} history={history} />
        )}

        {/* 4. Responsive Tabular Comparison (modern-web-guidance: responsive-table) */}
        {showHoldings && (
          <section className="theme-surface rounded-2xl border p-4 sm:p-6">
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="fund-breakdown-caption"
              className="table-wrapper"
            >
              <table className="responsive-fund-table text-left text-sm">
                <caption
                  id="fund-breakdown-caption"
                  className="text-left section-title-fluid font-bold theme-text-primary mb-4"
                >
                  Detailed SIP Valuation &amp; Formula Breakdown Table
                  <span className="block text-xs font-normal theme-text-secondary mt-0.5">
                    Units = Invested ÷ Avg Buy Price · Market Value = Units × Latest NAV · Return (%) = (Gain/Loss ÷ Invested) × 100
                  </span>
                </caption>
                <thead>
                  <tr className="theme-elevated border-b theme-border text-xs uppercase tracking-wider theme-text-secondary">
                    <th scope="col" className="py-3.5 px-4 font-bold">
                      Mutual Fund
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Current NAV
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Avg Buy Price
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Units Held
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Invested (BDT)
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Current Value
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Gain / Loss
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 font-bold text-right"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-500/15">
                  {funds.map((fund) => {
                    const isGain = fund.absoluteGainLoss >= 0;
                    return (
                      <tr
                        key={fund.id}
                        className="hover:bg-slate-500/5 transition"
                      >
                        <th
                          scope="row"
                          className="py-3.5 px-4 font-bold theme-text-primary whitespace-nowrap"
                        >
                          <div>{fund.name}</div>
                          <div className="text-xs font-medium theme-text-muted">
                            NAV Date: {fund.navEffectiveDate || "Latest"}
                          </div>
                        </th>
                        <td className="py-3.5 px-4 font-mono text-right status-gain-text font-bold">
                          ৳{fund.effectiveNav.toFixed(3)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right font-semibold theme-text-primary">
                          ৳{fund.averageBuyPrice.toFixed(4)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right font-bold status-info-text">
                          {fund.totalUnitsHeld.toFixed(4)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right font-semibold theme-text-primary">
                          ৳{formatBdt(fund.totalInvested, 2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right font-extrabold theme-text-primary">
                          ৳{formatBdt(fund.currentMarketValue, 2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right">
                          <div
                            className={`font-bold ${
                              isGain ? "status-gain-text" : "status-loss-text"
                            }`}
                          >
                            {isGain ? "+" : "-"}৳
                            {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}
                          </div>
                          <div
                            className={`text-xs font-bold ${
                              isGain ? "status-gain-text" : "status-loss-text"
                            }`}
                          >
                            ({isGain ? "▲ +" : "▼ "}
                            {fund.returnPct.toFixed(2)}%)
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openHoldingsModal(fund.id)}
                            className="theme-elevated min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-bold theme-text-primary hover:opacity-85 transition"
                          >
                            Update SIP
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. Historical Portfolio Total Chart */}
        {showAnalytics && <PortfolioHistoryChart history={history} />}

        {/* 6. Scraper Resilience & Fallback Telemetry Panel */}
        {showLogs && (
          <section
            aria-labelledby="scraper-telemetry-heading"
            className="theme-surface rounded-2xl border p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2
                  id="scraper-telemetry-heading"
                  className="section-title-fluid font-bold theme-text-primary"
                >
                  Scraper Resilience &amp; Fallback Verification Log
                </h2>
                <p className="text-xs sm:text-sm theme-text-secondary mt-0.5">
                  Primary AMC pages are scraped first; if any site fails to load or parse, the scraper automatically falls back to its specific{" "}
                  <code className="status-info-text font-mono font-bold">
                    bini.com.bd
                  </code>{" "}
                  fund URL.
                </p>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() =>
                  handleSyncNavNow([
                    "shanta-amanah",
                    "idlc-shariah",
                    "edge-alamin",
                  ])
                }
                className="status-warn-badge min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition"
              >
                Test Fallback Scraper (bini.com.bd)
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs theme-text-secondary">
                No scrape events logged yet.
              </p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {logs.slice(0, 6).map((log) => (
                  <li
                    key={log.id}
                    className="theme-elevated flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "status-gain-badge"
                            : log.status === "FALLBACK_SUCCESS"
                            ? "status-warn-badge"
                            : "status-loss-badge"
                        }`}
                      >
                        {log.sourceUsed}
                      </span>
                      <span className="font-bold theme-text-primary">
                        {log.fundId}
                      </span>
                      <span className="theme-text-muted">·</span>
                      <span className="theme-text-secondary font-medium">
                        {log.message}
                      </span>
                    </div>
                    <div className="font-mono font-medium theme-text-muted">
                      {log.durationMs ? `${log.durationMs}ms · ` : ""}
                      {formatDhakaTimestamp(log.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <footer className="theme-elevated hidden sm:block border-t py-5 text-center text-xs font-medium theme-text-secondary">
        <div className="mx-auto max-w-7xl px-4">
          NAV Watcher · Built with Next.js App Router, TypeScript, Tailwind CSS, Prisma &amp; SQLite · Automated Cron at 9:05 AM Asia/Dhaka (UTC+6)
        </div>
      </footer>

      {/* Fixed Mobile Bottom Navigation Bar (Pro Mobile App Experience) */}
      <nav
        aria-label="Mobile app bottom navigation"
        className="theme-header sm:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-lg pb-safe-bottom"
      >
        <div className="grid grid-cols-5 items-center px-1 pt-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition ${
              activeTab === "all" || activeTab === "overview"
                ? "status-gain-text"
                : "theme-text-muted"
            }`}
          >
            <LayoutDashboard className="h-5 w-5 mb-0.5" aria-hidden="true" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("holdings");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition ${
              activeTab === "holdings"
                ? "status-gain-text"
                : "theme-text-muted"
            }`}
          >
            <Layers className="h-5 w-5 mb-0.5" aria-hidden="true" />
            <span>Funds</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("analytics");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition ${
              activeTab === "analytics"
                ? "status-gain-text"
                : "theme-text-muted"
            }`}
          >
            <BarChart3 className="h-5 w-5 mb-0.5" aria-hidden="true" />
            <span>Compare</span>
          </button>

          <button
            type="button"
            onClick={() => openHoldingsModal(null)}
            className="flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold status-info-text transition"
          >
            <SlidersHorizontal className="h-5 w-5 mb-0.5" aria-hidden="true" />
            <span>Edit SIP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("logs");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition ${
              activeTab === "logs" ? "status-gain-text" : "theme-text-muted"
            }`}
          >
            <Terminal className="h-5 w-5 mb-0.5" aria-hidden="true" />
            <span>Logs</span>
          </button>
        </div>
      </nav>

      {/* Update Holdings Modal Dialog */}
      <UpdateHoldingsDialog
        isOpen={isModalOpen}
        initialFocusFundId={modalFocusFundId}
        funds={funds}
        onClose={() => setIsModalOpen(false)}
        onSaveHoldings={handleSaveHoldings}
      />
    </div>
  );
}
