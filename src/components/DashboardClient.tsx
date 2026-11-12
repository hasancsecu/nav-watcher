"use client";

import React, { useState } from "react";
import {
  FundValuationMetrics,
  PortfolioSummaryMetrics,
} from "@/lib/calculations";
import PortfolioHistoryChart, {
  PortfolioHistoryItem,
} from "./PortfolioHistoryChart";
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

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFocusFundId, setModalFocusFundId] = useState<string | null>(null);

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
          text: `Synced ${okCount}/${results.length} funds. Check scraper logs below for details.`,
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/25 to-sky-500/20 border border-emerald-500/40 shadow-inner">
              <ShieldCheck
                className="h-6 w-6 text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  NAV Watcher
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>BD Shariah SIP Tracker</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated Daily NAV Valuation · Shanta Amanah · IDLC Shariah · Edge Al-Amin
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  scheduler.active
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              <span>
                Cron: <strong>9:05 AM</strong> ({scheduler.timezone})
              </span>
            </div>

            <button
              type="button"
              onClick={() => openHoldingsModal(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-100 hover:bg-slate-700/80 hover:border-slate-600 transition"
            >
              <SlidersHorizontal className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <span>Update Holdings</span>
            </button>

            <button
              type="button"
              onClick={() => handleSyncNavNow()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw
                className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>{isSyncing ? "Syncing Live NAVs..." : "Sync NAV Now"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Live Sync Status Notification Banner */}
        <div role="status" aria-live="polite">
          {syncBanner && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                syncBanner.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : syncBanner.type === "warning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {syncBanner.type === "success" ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                )}
                <span>{syncBanner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncBanner(null)}
                className="text-xs underline opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* 1. Portfolio Summary Cards */}
        <section aria-labelledby="portfolio-summary-heading">
          <h2 id="portfolio-summary-heading" className="sr-only">
            Portfolio Valuation Summary
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Overall Total Invested */}
            <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
                <span>Overall Total Invested</span>
                <Wallet className="h-4 w-4 text-sky-400" aria-hidden="true" />
              </div>
              <p className="mt-3 font-mono text-2xl sm:text-3xl font-bold text-white">
                ৳{formatBdt(summary.totalInvested, 2)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Target Monthly SIP:{" "}
                <span className="font-mono text-slate-200">
                  ৳{formatBdt(summary.totalMonthlySip, 0)}/mo
                </span>{" "}
                across {summary.fundsCount} funds
              </p>
            </article>

            {/* Overall Current Market Value */}
            <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
                <span>Current Market Value</span>
                <Activity
                  className="h-4 w-4 text-emerald-400"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 font-mono text-2xl sm:text-3xl font-bold text-white">
                ৳{formatBdt(summary.currentMarketValue, 2)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Total Units Held:{" "}
                <span className="font-mono text-slate-200">
                  {funds
                    .reduce((acc, f) => acc + f.totalUnitsHeld, 0)
                    .toLocaleString("en-BD", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                </span>{" "}
                units
              </p>
            </article>

            {/* Net Gain / Loss (BDT & %) */}
            <article
              className={`rounded-2xl border p-5 shadow-lg ${
                netPositive
                  ? "border-emerald-500/30 bg-gradient-to-br from-slate-900/90 to-emerald-950/25"
                  : "border-rose-500/30 bg-gradient-to-br from-slate-900/90 to-rose-950/25"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
                <span>Net Gain / Loss</span>
                {netPositive ? (
                  <TrendingUp
                    className="h-4 w-4 text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <TrendingDown
                    className="h-4 w-4 text-rose-400"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
                <p
                  className={`font-mono text-2xl sm:text-3xl font-bold ${
                    netPositive ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {netPositive ? "+" : "-"}৳
                  {formatBdt(Math.abs(summary.absoluteGainLoss), 2)}
                </p>
                <span
                  className={`inline-flex items-center rounded-lg px-2 py-0.5 font-mono text-xs font-semibold ${
                    netPositive
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {netPositive ? "▲ +" : "▼ "}
                  {summary.returnPct.toFixed(2)}%
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Computed dynamically from latest scraped NAVs
              </p>
            </article>

            {/* Last Updated Timestamp */}
            <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
                <span>Last Updated (UTC+6)</span>
                <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
              </div>
              <p className="mt-3 text-lg sm:text-xl font-semibold text-white">
                {formatDhakaTimestamp(summary.lastUpdatedAt)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Daily auto-scrape: <strong>9:05 AM Asia/Dhaka</strong> (previous trading day&apos;s NAV)
              </p>
            </article>
          </div>
        </section>

        {/* 2. Fund Breakdown Cards */}
        <section aria-labelledby="fund-cards-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="fund-cards-heading"
                className="text-lg font-semibold text-white"
              >
                Mutual Fund SIP Holdings Breakdown
              </h2>
              <p className="text-sm text-slate-400">
                Live valuation per fund using Scraped NAV, Total Units Held, and Weighted Average Cost NAV
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {funds.map((fund) => {
              const isGain = fund.absoluteGainLoss >= 0;
              return (
                <article
                  key={fund.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg hover:border-slate-700/90 transition"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                          {fund.fundManager}
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          {fund.name}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-semibold ${
                          isGain
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {isGain ? "▲ +" : "▼ "}
                        {fund.returnPct.toFixed(2)}%
                      </span>
                    </div>

                    {/* Highlighted NAV & Market Value Banner */}
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                      <div>
                        <span className="text-[11px] text-slate-400 block">
                          Latest Scraped NAV
                        </span>
                        <span className="font-mono text-xl font-bold text-emerald-400">
                          ৳{fund.effectiveNav.toFixed(3)}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          As of {fund.navEffectiveDate || "Prev. Trading Day"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">
                          Current Market Value
                        </span>
                        <span className="font-mono text-xl font-bold text-white">
                          ৳{formatBdt(fund.currentMarketValue, 2)}
                        </span>
                        <span
                          className={`block font-mono text-xs font-medium mt-0.5 ${
                            isGain ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isGain ? "+" : "-"}৳
                          {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <dl className="mt-4 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <dt className="text-slate-400">Total Invested</dt>
                        <dd className="font-mono font-medium text-slate-200">
                          ৳{formatBdt(fund.totalInvested, 2)}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <dt className="text-slate-400">Avg Buy NAV</dt>
                        <dd className="font-mono font-medium text-slate-200">
                          ৳{fund.averageBuyPrice.toFixed(4)}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <dt className="text-slate-400">Total Units Held</dt>
                        <dd className="font-mono font-medium text-sky-300">
                          {fund.totalUnitsHeld.toFixed(4)}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                        <dt className="text-slate-400">Portfolio Weight</dt>
                        <dd className="font-mono font-medium text-slate-200">
                          {fund.portfolioWeightPct.toFixed(1)}%
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Card Footer: Source Status & Edit Button */}
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          fund.lastScrapeSource === "FALLBACK"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
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
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
                      >
                        <span>AMC</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                      <a
                        href={fund.fallbackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
                      >
                        <span>Bini</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => openHoldingsModal(fund.id)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
                    >
                      Edit Holding
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 3. Responsive Tabular Comparison (modern-web-guidance: responsive-table) */}
        <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 sm:p-6 shadow-xl">
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="fund-breakdown-caption"
            className="table-wrapper"
          >
            <table className="responsive-fund-table text-left text-sm">
              <caption
                id="fund-breakdown-caption"
                className="text-left text-base font-semibold text-white mb-4"
              >
                Detailed SIP Valuation &amp; Formula Breakdown Table
                <span className="block text-xs font-normal text-slate-400 mt-0.5">
                  Units = Invested ÷ Avg Buy Price · Market Value = Units × Latest NAV · Return (%) = (Gain/Loss ÷ Invested) × 100
                </span>
              </caption>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 text-xs uppercase tracking-wider text-slate-400">
                  <th scope="col" className="py-3.5 px-4 font-semibold">
                    Mutual Fund
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Current NAV
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Avg Buy Price
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Units Held
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Invested (BDT)
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Current Value
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Gain / Loss
                  </th>
                  <th scope="col" className="py-3.5 px-4 font-semibold text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {funds.map((fund) => {
                  const isGain = fund.absoluteGainLoss >= 0;
                  return (
                    <tr
                      key={fund.id}
                      className="hover:bg-slate-800/30 transition"
                    >
                      <th
                        scope="row"
                        className="py-3.5 px-4 font-semibold text-white whitespace-nowrap"
                      >
                        <div>{fund.name}</div>
                        <div className="text-xs font-normal text-slate-400">
                          NAV Date: {fund.navEffectiveDate || "Latest"}
                        </div>
                      </th>
                      <td className="py-3.5 px-4 font-mono text-right text-emerald-400 font-semibold">
                        ৳{fund.effectiveNav.toFixed(3)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right text-slate-200">
                        ৳{fund.averageBuyPrice.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right text-sky-300">
                        {fund.totalUnitsHeld.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right text-slate-200">
                        ৳{formatBdt(fund.totalInvested, 2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right font-semibold text-white">
                        ৳{formatBdt(fund.currentMarketValue, 2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right">
                        <div
                          className={`font-semibold ${
                            isGain ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isGain ? "+" : "-"}৳
                          {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}
                        </div>
                        <div
                          className={`text-xs ${
                            isGain ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          ({isGain ? "+" : ""}
                          {fund.returnPct.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openHoldingsModal(fund.id)}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
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

        {/* 4. Historical Chart */}
        <PortfolioHistoryChart history={history} />

        {/* 5. Scraper Resilience & Fallback Telemetry Panel */}
        <section
          aria-labelledby="scraper-telemetry-heading"
          className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 sm:p-6 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2
                id="scraper-telemetry-heading"
                className="text-base font-semibold text-white"
              >
                Scraper Resilience &amp; Fallback Verification Log
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Primary AMC pages are scraped first; if any site fails to load or parse, the scraper automatically falls back to its specific{" "}
                <code className="text-sky-300">bini.com.bd</code> fund URL.
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
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition"
            >
              Test Fallback Scraper (bini.com.bd)
            </button>
          </div>

          {logs.length === 0 ? (
            <p className="text-xs text-slate-400">
              No scrape events logged yet.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {logs.slice(0, 6).map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : log.status === "FALLBACK_SUCCESS"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {log.sourceUsed}
                    </span>
                    <span className="font-medium text-slate-200">
                      {log.fundId}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                  <div className="font-mono text-slate-400">
                    {log.durationMs ? `${log.durationMs}ms · ` : ""}
                    {formatDhakaTimestamp(log.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-5 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4">
          NAV Watcher · Built with Next.js App Router, TypeScript, Tailwind CSS, Prisma &amp; SQLite · Automated Cron at 9:05 AM Asia/Dhaka (UTC+6)
        </div>
      </footer>

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

