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
  Sparkles,
  Sun,
  Moon,
  BarChart3,
  Terminal,
  Download,
  Share2,
  X,
  PlusCircle,
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

type MobileTab = "portfolio" | "compare" | "history" | "logs";

const FUND_BRAND_CONFIG: Record<
  string,
  {
    initials: string;
    badgeBg: string;
    badgeText: string;
    color: string;
  }
> = {
  "shanta-amanah": {
    initials: "SA",
    badgeBg: "bg-emerald-500/15 border-emerald-500/30",
    badgeText: "status-gain-text",
    color: "#059669",
  },
  "idlc-shariah": {
    initials: "ID",
    badgeBg: "bg-sky-500/15 border-sky-500/30",
    badgeText: "status-info-text",
    color: "#0284c7",
  },
  "edge-alamin": {
    initials: "EA",
    badgeBg: "bg-violet-500/15 border-violet-500/30",
    badgeText: "text-violet-600 dark:text-violet-300",
    color: "#7c3aed",
  },
};

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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
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

  // Active navigation tab (Mobile & Desktop)
  const [activeTab, setActiveTab] = useState<MobileTab>("portfolio");

  // Mobile breakdown display toggle (Cards vs Table)
  const [mobileBreakdownMode, setMobileBreakdownMode] =
    useState<"cards" | "table">("cards");

  // Sync state & notifications
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  // Holdings update modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFocusFundId, setModalFocusFundId] = useState<string | null>(null);

  // PWA install prompt state
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // Theme state synced with <meta name="color-scheme">, data-theme, and localStorage
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Detect if running as standalone PWA
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator &&
          (window.navigator as unknown as { standalone: boolean }).standalone ===
            true);
      setIsStandalone(standalone);

      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAppleDevice =
        /iphone|ipad|ipod/.test(userAgent) ||
        (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));
      setIsIos(isAppleDevice);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

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

    window.addEventListener("storage", handleStorage);
    mql.addEventListener("change", syncThemeFromDom);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("storage", handleStorage);
      mql.removeEventListener("change", syncThemeFromDom);
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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      setShowPwaGuide(true);
    }
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
              ? `Synced all ${okCount} funds (${fallbackCount} via fallback): ` +
                results.map((r) => `${r.fundName}: ৳${r.nav}`).join(" · ")
              : `Live NAVs synced: ` +
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
      text: "Baseline SIP holdings updated and live valuation recalculated.",
    });
  };

  const openHoldingsModal = (fundId: string | null = null) => {
    setModalFocusFundId(fundId);
    setIsModalOpen(true);
  };

  const netPositive = summary.absoluteGainLoss >= 0;

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip flex flex-col pb-28 sm:pb-8">
      {/* Top App Bar (Sleek single-row mobile & desktop header) */}
      <header className="theme-header sticky top-0 z-40 border-b backdrop-blur-md w-full max-w-full">
        <div className="mx-auto flex max-w-7xl w-full items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3.5 lg:px-8 min-w-0">
          {/* Logo & App Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="status-gain-badge flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
              <ShieldCheck
                className="h-5 w-5 status-gain-text"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary truncate">
                  NAV Watcher
                </h1>
                <span className="status-gain-badge hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-bold">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>SIP Tracker</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-xs theme-text-secondary truncate flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full inline-block animate-pulse shrink-0"
                  style={{
                    backgroundColor: scheduler.active
                      ? "var(--gain-text)"
                      : "var(--warn-text)",
                  }}
                />
                <span className="truncate">Daily 9:05 AM (Dhaka UTC+6)</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* PWA Install Button (if not already running standalone) */}
            {!isStandalone && (
              <button
                type="button"
                onClick={handleInstallClick}
                title="Download or install app on your phone"
                aria-label="Install app on your phone"
                className="status-info-badge inline-flex min-h-[38px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition hover:opacity-90"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="theme-elevated inline-flex min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-xl border p-2 text-xs font-semibold theme-text-primary hover:opacity-90 transition shrink-0"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 status-info-text" aria-hidden="true" />
              )}
            </button>

            {/* Desktop Only: Update Holdings Button */}
            <button
              type="button"
              onClick={() => openHoldingsModal(null)}
              className="theme-elevated hidden md:inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold theme-text-primary hover:opacity-90 transition shrink-0"
            >
              <SlidersHorizontal
                className="h-3.5 w-3.5 status-info-text"
                aria-hidden="true"
              />
              <span>Update Holdings</span>
            </button>

            {/* Live Sync NAV Now Button */}
            <button
              type="button"
              onClick={() => handleSyncNavNow()}
              disabled={isSyncing}
              aria-label="Sync latest NAV from AMC portals"
              className="btn-primary inline-flex min-h-[38px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-1.5 text-xs font-bold disabled:opacity-60 transition shadow-sm shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 shrink-0 ${
                  isSyncing ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isSyncing ? "Syncing..." : "Sync NAV"}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop View Selector (Hidden on mobile where bottom nav controls the view) */}
        <div className="hidden sm:block mx-auto max-w-7xl px-6 lg:px-8 border-t theme-border">
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="app-tablist text-xs sm:text-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "portfolio"}
              onClick={() => setActiveTab("portfolio")}
              className="app-tab"
            >
              Portfolio &amp; Holdings ({funds.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "compare"}
              onClick={() => setActiveTab("compare")}
              className="app-tab"
            >
              3-Fund Comparison
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              className="app-tab"
            >
              Historical Valuation Chart
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

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 space-y-5 px-3 py-3.5 sm:px-6 sm:py-6 lg:px-8 overflow-x-clip">
        {/* Status Notification Banner */}
        {syncBanner && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium ${
              syncBanner.type === "success"
                ? "status-gain-badge"
                : syncBanner.type === "warning"
                ? "status-warn-badge"
                : "status-loss-badge"
            }`}
          >
            <div className="flex items-center gap-2">
              {syncBanner.type === "success" ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 status-gain-text"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="h-4 w-4 shrink-0 status-warn-text"
                  aria-hidden="true"
                />
              )}
              <span>{syncBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncBanner(null)}
              className="text-xs font-bold underline shrink-0 p-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 1: PORTFOLIO & FUND HOLDINGS                                    */}
        {/* ==================================================================== */}
        {activeTab === "portfolio" && (
          <div className="space-y-4 sm:space-y-6">
            {/* 1. Pro Mobile Hero Portfolio Card */}
            <section
              aria-labelledby="hero-portfolio-heading"
              className="theme-surface rounded-2xl border p-4 sm:p-6 shadow-md relative overflow-hidden"
            >
              {/* Subtle background glow */}
              <div
                className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{
                  backgroundColor: netPositive ? "#10b981" : "#f43f5e",
                }}
              />

              <div className="flex flex-col gap-3.5 sm:gap-5">
                {/* Eyebrow & Last Synced Timestamp */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider theme-text-secondary">
                    <Wallet
                      className="h-4 w-4 status-gain-text"
                      aria-hidden="true"
                    />
                    <span id="hero-portfolio-heading">
                      Total Portfolio Valuation
                    </span>
                  </div>
                  <div className="text-[11px] theme-text-muted flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{formatDhakaTimestamp(summary.lastUpdatedAt)}</span>
                  </div>
                </div>

                {/* Massive Current Valuation & Return Badge */}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-mono text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight theme-text-primary">
                      ৳{formatBdt(summary.currentMarketValue, 2)}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-xl px-3 py-1 font-mono text-xs sm:text-sm font-extrabold shadow-sm ${
                        netPositive
                          ? "status-gain-badge"
                          : "status-loss-badge"
                      }`}
                    >
                      {netPositive ? "▲ +" : "▼ "}৳
                      {formatBdt(Math.abs(summary.absoluteGainLoss), 2)} (
                      {netPositive ? "+" : ""}
                      {summary.returnPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* Sub-metrics summary row */}
                <div className="theme-elevated grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl border p-3 text-xs">
                  <div>
                    <span className="theme-text-muted block text-[11px]">
                      Invested Capital
                    </span>
                    <strong className="font-mono text-sm font-bold theme-text-primary">
                      ৳{formatBdt(summary.totalInvested, 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="theme-text-muted block text-[11px]">
                      Monthly SIP Target
                    </span>
                    <strong className="font-mono text-sm font-bold status-info-text">
                      ৳{formatBdt(summary.totalMonthlySip, 0)}/mo
                    </strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0 theme-border">
                    <span className="theme-text-muted block text-[11px]">
                      Total Units Held
                    </span>
                    <strong className="font-mono text-sm font-bold theme-text-primary">
                      {funds
                        .reduce((acc, f) => acc + f.totalUnitsHeld, 0)
                        .toLocaleString("en-BD", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                      units
                    </strong>
                  </div>
                </div>

                {/* Mobile Quick Action Buttons on Hero Card */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openHoldingsModal(null)}
                    className="btn-primary flex-1 inline-flex justify-center min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-sm"
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    <span>+ Record Monthly SIP / Edit Holdings</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 2. Pro Mobile Asset Cards (3 Mutual Funds) */}
            <section aria-labelledby="mobile-funds-heading" className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2
                  id="mobile-funds-heading"
                  className="text-sm sm:text-base font-bold theme-text-primary"
                >
                  Mutual Fund Holdings ({funds.length})
                </h2>
                <span className="text-xs theme-text-muted font-medium">
                  Previous Trading Day NAV
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
                {funds.map((fund) => {
                  const isGain = fund.absoluteGainLoss >= 0;
                  const brand =
                    FUND_BRAND_CONFIG[fund.id] ||
                    FUND_BRAND_CONFIG["shanta-amanah"];
                  const navSpread = fund.effectiveNav - fund.averageBuyPrice;

                  return (
                    <article
                      key={fund.id}
                      className="theme-surface rounded-2xl border p-4 sm:p-5 shadow-sm transition flex flex-col justify-between gap-3.5"
                    >
                      {/* Fund Header Row */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Brand Initials Avatar */}
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold font-mono text-sm border ${brand.badgeBg} ${brand.badgeText}`}
                          >
                            {brand.initials}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold theme-text-primary truncate leading-snug">
                              {fund.name}
                            </h3>
                            <p className="text-[11px] theme-text-muted truncate">
                              {fund.fundManager}
                            </p>
                          </div>
                        </div>

                        {/* Return Badge */}
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${
                            isGain
                              ? "status-gain-badge"
                              : "status-loss-badge"
                          }`}
                        >
                          {isGain ? "▲ +" : "▼ "}
                          {fund.returnPct.toFixed(2)}%
                        </span>
                      </div>

                      {/* NAV & Market Value Banner */}
                      <div className="theme-elevated grid grid-cols-2 gap-2 rounded-xl border p-3">
                        <div>
                          <span className="text-[11px] theme-text-muted block">
                            Latest Scraped NAV
                          </span>
                          <span className="font-mono text-lg font-extrabold status-gain-text">
                            ৳{fund.effectiveNav.toFixed(3)}
                          </span>
                          <span className="block text-[10px] theme-text-muted mt-0.5">
                            {fund.navEffectiveDate || "Latest Day"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] theme-text-muted block">
                            Current Market Value
                          </span>
                          <span className="font-mono text-lg font-extrabold theme-text-primary">
                            ৳{formatBdt(fund.currentMarketValue, 2)}
                          </span>
                          <span
                            className={`block font-mono text-[11px] font-bold mt-0.5 ${
                              isGain ? "status-gain-text" : "status-loss-text"
                            }`}
                          >
                            {isGain ? "+" : "-"}৳
                            {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}
                          </span>
                        </div>
                      </div>

                      {/* Portfolio Weight Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] theme-text-secondary">
                          <span>Portfolio Share</span>
                          <span className="font-mono font-bold">
                            {fund.portfolioWeightPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full theme-subtle-bg overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(4, fund.portfolioWeightPct)}%`,
                              backgroundColor: brand.color,
                            }}
                          />
                        </div>
                      </div>

                      {/* 4 Financial Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs border-t theme-border pt-2.5">
                        <div>
                          <span className="text-[11px] theme-text-muted block">
                            Invested Capital
                          </span>
                          <strong className="font-mono font-bold theme-text-primary">
                            ৳{formatBdt(fund.totalInvested, 0)}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] theme-text-muted block">
                            Total Units Held
                          </span>
                          <strong className="font-mono font-bold status-info-text">
                            {fund.totalUnitsHeld.toFixed(4)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[11px] theme-text-muted block">
                            Avg Buy Cost
                          </span>
                          <strong className="font-mono font-bold theme-text-primary">
                            ৳{fund.averageBuyPrice.toFixed(3)}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] theme-text-muted block">
                            NAV Spread
                          </span>
                          <strong
                            className={`font-mono font-bold ${
                              navSpread >= 0
                                ? "status-gain-text"
                                : "status-loss-text"
                            }`}
                          >
                            {navSpread >= 0 ? "+" : ""}
                            {navSpread.toFixed(3)}
                          </strong>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between gap-2 border-t theme-border pt-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={fund.primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold theme-text-secondary hover:underline"
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
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold theme-text-secondary hover:underline"
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
                          className="theme-elevated min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold theme-text-primary hover:opacity-85 transition"
                        >
                          Edit Holding
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* 3. Detailed SIP Valuation & Formula Breakdown Section */}
            <section
              aria-labelledby="fund-breakdown-heading"
              className="theme-surface rounded-2xl border p-4 sm:p-6 shadow-sm overflow-hidden space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2
                    id="fund-breakdown-heading"
                    className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary"
                  >
                    Detailed SIP Valuation &amp; Formula Breakdown
                  </h2>
                  <p className="text-xs sm:text-sm theme-text-secondary mt-0.5 leading-relaxed">
                    Units = Invested ÷ Avg Buy Price · Market Value = Units × Latest NAV · Return (%) = (Gain/Loss ÷ Invested) × 100
                  </p>
                </div>

                {/* Mobile View Toggle: Cards View vs Wide Table */}
                <div className="flex sm:hidden items-center p-1 rounded-xl theme-elevated border theme-border shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setMobileBreakdownMode("cards")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      mobileBreakdownMode === "cards"
                        ? "btn-primary shadow-sm"
                        : "theme-text-secondary hover:theme-text-primary"
                    }`}
                  >
                    Mobile Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileBreakdownMode("table")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      mobileBreakdownMode === "table"
                        ? "btn-primary shadow-sm"
                        : "theme-text-secondary hover:theme-text-primary"
                    }`}
                  >
                    Wide Table
                  </button>
                </div>
              </div>

              {/* 1. Mobile-Optimized Formula Breakdown Cards (Default on Mobile) */}
              <div
                className={`${
                  mobileBreakdownMode === "cards"
                    ? "flex flex-col gap-3.5 sm:hidden"
                    : "hidden"
                }`}
              >
                {funds.map((fund) => {
                  const isGain = fund.absoluteGainLoss >= 0;
                  const brand =
                    FUND_BRAND_CONFIG[fund.id] ||
                    FUND_BRAND_CONFIG["shanta-amanah"];
                  return (
                    <article
                      key={fund.id}
                      className="theme-elevated rounded-xl border p-3.5 space-y-3"
                    >
                      {/* Fund Title & Edit Action */}
                      <div className="flex items-center justify-between gap-2 border-b theme-border pb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: brand.color }}
                          />
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold theme-text-primary truncate">
                              {fund.name}
                            </h3>
                            <p className="text-[11px] theme-text-muted">
                              NAV Date: {fund.navEffectiveDate || "Latest Day"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openHoldingsModal(fund.id)}
                          className="theme-surface min-h-[34px] rounded-lg border px-3 py-1 text-xs font-bold theme-text-primary hover:opacity-80 transition shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      {/* 4-Item Math Formula Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="theme-surface rounded-lg border p-2.5">
                          <span className="text-[10px] theme-text-muted uppercase font-bold block">
                            Invested Capital
                          </span>
                          <span className="font-mono text-sm font-bold theme-text-primary">
                            ৳{formatBdt(fund.totalInvested, 2)}
                          </span>
                        </div>
                        <div className="theme-surface rounded-lg border p-2.5">
                          <span className="text-[10px] theme-text-muted uppercase font-bold block">
                            Avg Buy Cost
                          </span>
                          <span className="font-mono text-sm font-bold theme-text-primary">
                            ৳{fund.averageBuyPrice.toFixed(4)}
                          </span>
                        </div>
                        <div className="theme-surface rounded-lg border p-2.5">
                          <span className="text-[10px] theme-text-muted uppercase font-bold block">
                            Calculated Units Held
                          </span>
                          <span className="font-mono text-sm font-bold status-info-text">
                            {fund.totalUnitsHeld.toFixed(4)}
                          </span>
                          <span className="block text-[9px] theme-text-muted mt-0.5">
                            Invested ÷ Avg Price
                          </span>
                        </div>
                        <div className="theme-surface rounded-lg border p-2.5">
                          <span className="text-[10px] theme-text-muted uppercase font-bold block">
                            Current Scraped NAV
                          </span>
                          <span className="font-mono text-sm font-bold status-gain-text">
                            ৳{fund.effectiveNav.toFixed(3)}
                          </span>
                          <span className="block text-[9px] theme-text-muted mt-0.5">
                            Live AMC Portal
                          </span>
                        </div>
                      </div>

                      {/* Current Valuation & Return Banner */}
                      <div className="theme-surface flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <span className="text-[10px] theme-text-muted uppercase font-bold block">
                            Current Market Value
                          </span>
                          <span className="font-mono text-base font-black theme-text-primary">
                            ৳{formatBdt(fund.currentMarketValue, 2)}
                          </span>
                          <span className="block text-[9px] theme-text-muted mt-0.5">
                            Units × Current NAV
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] theme-text-muted uppercase font-bold block">
                            Net Gain / Loss
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold mt-0.5 ${
                              isGain ? "status-gain-badge" : "status-loss-badge"
                            }`}
                          >
                            {isGain ? "+" : "-"}৳
                            {formatBdt(Math.abs(fund.absoluteGainLoss), 2)} (
                            {isGain ? "+" : ""}
                            {fund.returnPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* 2. Full Wide Data Table (Shown on Desktop, or when mobile user selects "Wide Table") */}
              <div
                className={`${
                  mobileBreakdownMode === "table" ? "block" : "hidden sm:block"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] theme-text-muted mb-2 sm:hidden">
                  <span>← Swipe horizontally to see all columns →</span>
                </div>
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="fund-breakdown-heading"
                  className="table-wrapper scrollbar-thin rounded-xl border theme-border"
                >
                  <table className="responsive-fund-table text-left text-xs sm:text-sm min-w-[760px] w-full">
                    <caption className="sr-only">
                      Detailed SIP Valuation and Formula Breakdown Table
                    </caption>
                    <thead>
                      <tr className="theme-elevated border-b theme-border text-xs uppercase tracking-wider theme-text-secondary">
                        <th scope="col" className="py-3 px-3.5 font-bold">
                          Mutual Fund
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
                          Current NAV
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
                          Avg Buy Price
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
                          Units Held
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
                          Invested (BDT)
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
                          Current Value
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
                          Gain / Loss
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-bold text-right">
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
                              className="py-3 px-3.5 font-bold theme-text-primary whitespace-nowrap"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      FUND_BRAND_CONFIG[fund.id]?.color ||
                                      "#059669",
                                  }}
                                />
                                <span>{fund.name}</span>
                              </div>
                              <div className="text-[11px] font-medium theme-text-muted mt-0.5">
                                NAV Date: {fund.navEffectiveDate || "Latest Day"}
                              </div>
                            </th>
                            <td className="py-3 px-3.5 font-mono text-right status-gain-text font-bold whitespace-nowrap">
                              ৳{fund.effectiveNav.toFixed(3)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right font-semibold theme-text-primary whitespace-nowrap">
                              ৳{fund.averageBuyPrice.toFixed(4)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right font-bold status-info-text whitespace-nowrap">
                              {fund.totalUnitsHeld.toFixed(4)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right font-semibold theme-text-primary whitespace-nowrap">
                              ৳{formatBdt(fund.totalInvested, 2)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right font-extrabold theme-text-primary whitespace-nowrap">
                              ৳{formatBdt(fund.currentMarketValue, 2)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono ${
                                  isGain ? "status-gain-badge" : "status-loss-badge"
                                }`}
                              >
                                {isGain ? "+" : "-"}৳
                                {formatBdt(Math.abs(fund.absoluteGainLoss), 2)} (
                                {isGain ? "+" : ""}
                                {fund.returnPct.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openHoldingsModal(fund.id)}
                                className="theme-elevated min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-semibold theme-text-primary hover:opacity-80 transition"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: 3-FUND COMPARISON                                            */}
        {/* ==================================================================== */}
        {activeTab === "compare" && (
          <div className="space-y-4 sm:space-y-6">
            <FundComparisonChart funds={funds} history={history} />
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: HISTORICAL VALUATION CHART                                   */}
        {/* ==================================================================== */}
        {activeTab === "history" && (
          <div className="space-y-4 sm:space-y-6">
            <PortfolioHistoryChart history={history} />
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 4: SCRAPER TELEMETRY LOGS                                       */}
        {/* ==================================================================== */}
        {activeTab === "logs" && (
          <section
            aria-labelledby="scraper-telemetry-heading"
            className="theme-surface rounded-2xl border p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2
                  id="scraper-telemetry-heading"
                  className="section-title-fluid font-bold theme-text-primary"
                >
                  Scraper Resilience &amp; Daily Cron Telemetry
                </h2>
                <p className="text-xs sm:text-sm theme-text-secondary mt-0.5">
                  Daily cron at 9:05 AM Asia/Dhaka. Primary AMC portals are scraped first with automatic fallback to bini.com.bd.
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
                className="status-warn-badge min-h-[40px] rounded-xl px-3 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition shrink-0"
              >
                Test Fallback Scraper (bini.com.bd)
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs theme-text-secondary">
                No scrape events logged yet. Tap &ldquo;Sync NAV&rdquo; above to run the scraper.
              </p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {logs.slice(0, 10).map((log) => (
                  <li
                    key={log.id}
                    className="theme-elevated flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
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
                      <strong className="theme-text-primary">
                        {log.fundId}
                      </strong>
                      <span className="theme-text-muted">·</span>
                      <span className="theme-text-secondary">
                        {log.message}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] theme-text-muted">
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

      {/* Desktop Footer */}
      <footer className="theme-elevated hidden sm:block border-t py-4 text-center text-xs font-medium theme-text-secondary">
        <div className="mx-auto max-w-7xl px-4">
          NAV Watcher · Bangladesh Shariah Mutual Fund &amp; SIP Valuation Engine · Automated Daily Cron at 9:05 AM Asia/Dhaka
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* PRO MOBILE BOTTOM NAVIGATION DOCK (Flawless touch & safe-area)        */}
      {/* ==================================================================== */}
      <nav
        aria-label="Mobile app navigation bar"
        className="mobile-bottom-dock sm:hidden"
      >
        <div className="grid grid-cols-4 items-center px-2 pt-1.5">
          {/* Tab 1: Portfolio */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("portfolio");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition relative ${
              activeTab === "portfolio"
                ? "status-gain-text"
                : "theme-text-muted hover:opacity-80"
            }`}
          >
            <Wallet className="h-5 w-5 mb-0.5 shrink-0" aria-hidden="true" />
            <span>Portfolio</span>
            {activeTab === "portfolio" && (
              <span
                className="absolute bottom-0 h-1 w-6 rounded-full"
                style={{ backgroundColor: "var(--gain-text)" }}
              />
            )}
          </button>

          {/* Tab 2: Compare */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("compare");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition relative ${
              activeTab === "compare"
                ? "status-gain-text"
                : "theme-text-muted hover:opacity-80"
            }`}
          >
            <BarChart3 className="h-5 w-5 mb-0.5 shrink-0" aria-hidden="true" />
            <span>Compare</span>
            {activeTab === "compare" && (
              <span
                className="absolute bottom-0 h-1 w-6 rounded-full"
                style={{ backgroundColor: "var(--gain-text)" }}
              />
            )}
          </button>

          {/* Tab 3: History */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition relative ${
              activeTab === "history"
                ? "status-gain-text"
                : "theme-text-muted hover:opacity-80"
            }`}
          >
            <TrendingUp
              className="h-5 w-5 mb-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>History</span>
            {activeTab === "history" && (
              <span
                className="absolute bottom-0 h-1 w-6 rounded-full"
                style={{ backgroundColor: "var(--gain-text)" }}
              />
            )}
          </button>

          {/* Tab 4: Logs */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("logs");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl py-1 text-[11px] font-bold transition relative ${
              activeTab === "logs"
                ? "status-gain-text"
                : "theme-text-muted hover:opacity-80"
            }`}
          >
            <Terminal className="h-5 w-5 mb-0.5 shrink-0" aria-hidden="true" />
            <span>Logs</span>
            {activeTab === "logs" && (
              <span
                className="absolute bottom-0 h-1 w-6 rounded-full"
                style={{ backgroundColor: "var(--gain-text)" }}
              />
            )}
          </button>
        </div>
      </nav>

      {/* PWA Install Guide Modal (for iOS & Android users) */}
      {showPwaGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm"
        >
          <div className="theme-surface w-full max-w-md rounded-3xl border p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="status-gain-badge flex h-9 w-9 items-center justify-center rounded-xl font-bold">
                  <Download className="h-5 w-5 status-gain-text" />
                </div>
                <h3
                  id="pwa-install-title"
                  className="font-extrabold text-base theme-text-primary"
                >
                  Download NAV Watcher App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPwaGuide(false)}
                className="theme-elevated p-1.5 rounded-lg border theme-text-muted hover:opacity-80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm theme-text-secondary leading-relaxed">
              Install NAV Watcher onto your home screen for quick 1-tap access, full-screen standalone mode, and offline capability.
            </p>

            <div className="theme-elevated rounded-2xl border p-3.5 space-y-2.5 text-xs">
              {isIos ? (
                <>
                  <div className="font-bold theme-text-primary flex items-center gap-1.5">
                    <Share2 className="h-4 w-4 status-info-text" />
                    <span>How to install on iPhone (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 theme-text-secondary">
                    <li>
                      Tap the <strong className="theme-text-primary">Share</strong> button at the bottom of Safari.
                    </li>
                    <li>
                      Scroll down and tap <strong className="theme-text-primary">&ldquo;Add to Home Screen&rdquo;</strong>.
                    </li>
                    <li>
                      Tap <strong className="status-gain-text">&ldquo;Add&rdquo;</strong> in the top-right corner.
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <div className="font-bold theme-text-primary flex items-center gap-1.5">
                    <Download className="h-4 w-4 status-gain-text" />
                    <span>How to install on Android (Chrome):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 theme-text-secondary">
                    <li>
                      Tap the <strong className="theme-text-primary">⋮ (menu)</strong> button in Chrome.
                    </li>
                    <li>
                      Select <strong className="status-gain-text">&ldquo;Install app&rdquo;</strong> or <strong className="theme-text-primary">&ldquo;Add to Home screen&rdquo;</strong>.
                    </li>
                  </ol>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPwaGuide(false)}
              className="btn-primary w-full min-h-[44px] rounded-xl font-bold text-xs"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

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
