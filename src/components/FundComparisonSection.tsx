"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Coins,
  ShieldCheck,
  Award,
  Layers,
  ArrowUpDown,
  Building2,
  Calendar,
  Wallet,
} from "lucide-react";

interface FundItem {
  id: string;
  name: string;
  shortName: string;
  fundManager: string;
  category: string;
  effectiveNav: number;
  totalInvested: number;
  currentMarketValue: number;
  totalUnitsHeld: number;
  averageBuyPrice: number;
  fractionalCashBalance: number;
  absoluteGainLoss: number;
  returnPct: number;
  navEffectiveDate?: string | null;
  investments?: Array<{
    id: string;
    calendarMonth: string;
    investmentDate: string;
    cashInvested: number;
    executionNav: number;
    unitsAllotted: number;
    type: string;
  }>;
}

interface FundComparisonSectionProps {
  funds: FundItem[];
  totalPortfolioInvested: number;
  totalPortfolioValue: number;
}

function formatBdt(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export default function FundComparisonSection({
  funds,
  totalPortfolioInvested,
  totalPortfolioValue,
}: FundComparisonSectionProps) {
  const [sortBy, setSortBy] = useState<"return" | "invested" | "gain" | "tenure">("return");

  // Calculate detailed comparison metrics for each invested fund
  const comparisonData = useMemo(() => {
    return funds.map((f) => {
      const invs = f.investments || [];
      const totalInstallments = invs.length;

      // Calculate investment tenure (time active)
      let firstDate: Date | null = null;
      let lastDate: Date | null = null;
      if (invs.length > 0) {
        const sorted = [...invs].sort(
          (a, b) => new Date(a.investmentDate).getTime() - new Date(b.investmentDate).getTime(),
        );
        firstDate = new Date(sorted[0].investmentDate);
        lastDate = new Date(sorted[sorted.length - 1].investmentDate);
      }

      // Calculate active tenure in months
      let activeMonths = totalInstallments;
      if (firstDate && lastDate) {
        const diffMs = Math.max(0, lastDate.getTime() - firstDate.getTime());
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        activeMonths = Math.max(1, Math.round(diffDays / 30.4) || totalInstallments);
      }

      const portfolioWeightPct =
        totalPortfolioInvested > 0
          ? (f.totalInvested / totalPortfolioInvested) * 100
          : 0;

      const monthlyPace =
        activeMonths > 0 ? f.totalInvested / activeMonths : f.totalInvested;

      return {
        ...f,
        totalInstallments,
        firstDate,
        lastDate,
        activeMonths,
        portfolioWeightPct,
        monthlyPace,
      };
    });
  }, [funds, totalPortfolioInvested]);

  // Sort funds based on user selection
  const sortedFunds = useMemo(() => {
    const list = [...comparisonData];
    if (sortBy === "return") {
      list.sort((a, b) => b.returnPct - a.returnPct);
    } else if (sortBy === "invested") {
      list.sort((a, b) => b.totalInvested - a.totalInvested);
    } else if (sortBy === "gain") {
      list.sort((a, b) => b.absoluteGainLoss - a.absoluteGainLoss);
    } else if (sortBy === "tenure") {
      list.sort((a, b) => b.activeMonths - a.activeMonths);
    }
    return list;
  }, [comparisonData, sortBy]);

  if (funds.length === 0) {
    return null;
  }

  // Top performer
  const bestPerformer = [...comparisonData].sort((a, b) => b.returnPct - a.returnPct)[0];
  const highestAllocation = [...comparisonData].sort((a, b) => b.totalInvested - a.totalInvested)[0];

  return (
    <section aria-labelledby="comparison-heading" className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3">
        <div>
          <h3
            id="comparison-heading"
            className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary flex items-center gap-2"
          >
            <Layers className="h-5 w-5 text-[#33c6e4]" />
            <span>Invested Funds Comparison</span>
          </h3>
          <p className="text-xs theme-text-secondary mt-0.5">
            Compare active holdings side-by-side by capital invested, tenure, and net return
          </p>
        </div>

        {/* Sort Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-[11px] font-bold theme-text-muted mr-1 flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" /> Sort:
          </span>
          {[
            { key: "return", label: "Return %" },
            { key: "invested", label: "Capital" },
            { key: "gain", label: "Net Gain" },
            { key: "tenure", label: "Tenure" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSortBy(s.key as any)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition whitespace-nowrap min-h-[34px] ${
                sortBy === s.key
                  ? "bg-[#33c6e4] text-slate-950 shadow-sm"
                  : "theme-surface theme-text-secondary hover:theme-text-primary border theme-border"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Highlights Banner */}
      {funds.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {bestPerformer && (
            <div className="theme-surface rounded-xl border theme-border p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <Award className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                    Highest Return Performer
                  </span>
                  <span className="font-mono font-bold status-gain-text">
                    +{bestPerformer.returnPct.toFixed(2)}%
                  </span>
                </div>
                <p className="font-bold theme-text-primary truncate">{bestPerformer.name}</p>
                <p className="text-[11px] theme-text-muted">
                  Gain: +৳{formatBdt(bestPerformer.absoluteGainLoss, 2)} on ৳{formatBdt(bestPerformer.totalInvested, 0)}
                </p>
              </div>
            </div>
          )}

          {highestAllocation && (
            <div className="theme-surface rounded-xl border theme-border p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] border border-[#33c6e4]/30">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#155360] dark:text-[#33c6e4]">
                    Largest Portfolio Weight
                  </span>
                  <span className="font-mono font-bold text-[#155360] dark:text-[#33c6e4]">
                    {highestAllocation.portfolioWeightPct.toFixed(1)}%
                  </span>
                </div>
                <p className="font-bold theme-text-primary truncate">{highestAllocation.name}</p>
                <p className="text-[11px] theme-text-muted">
                  Capital: ৳{formatBdt(highestAllocation.totalInvested, 0)} · {highestAllocation.totalUnitsHeld} integer units
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comparison Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFunds.map((fund, index) => {
          const isGain = fund.absoluteGainLoss >= 0;
          return (
            <article
              key={fund.id}
              className="theme-elevated rounded-2xl border theme-border p-4 space-y-3.5 shadow-sm transition hover:border-[#33c6e4]/50"
            >
              {/* Header with Rank & AMC */}
              <div className="flex items-start justify-between gap-2 border-b theme-border pb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-black theme-text-primary">
                      #{index + 1}
                    </span>
                    <span className="text-[11px] font-semibold text-[#155360] dark:text-[#33c6e4]">
                      {fund.fundManager}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold theme-text-primary truncate">
                    {fund.name}
                  </h4>
                </div>

                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    isGain ? "status-gain-badge" : "status-loss-badge"
                  }`}
                >
                  {isGain ? "+" : ""}
                  {fund.returnPct.toFixed(2)}%
                </span>
              </div>

              {/* Portfolio Allocation Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="theme-text-muted font-medium">Portfolio Share</span>
                  <span className="font-mono font-bold text-[#155360] dark:text-[#33c6e4]">
                    {fund.portfolioWeightPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#33c6e4] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(4, fund.portfolioWeightPct))}%` }}
                  />
                </div>
              </div>

              {/* Key Comparative Matrix */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Invested Capital */}
                <div className="theme-surface rounded-xl border theme-border p-2.5">
                  <span className="text-[10px] uppercase font-bold theme-text-muted block">
                    Capital Invested
                  </span>
                  <span className="font-mono text-xs font-bold theme-text-primary block mt-0.5">
                    ৳{formatBdt(fund.totalInvested, 0)}
                  </span>
                </div>

                {/* Net Gain/Loss */}
                <div className="theme-surface rounded-xl border theme-border p-2.5">
                  <span className="text-[10px] uppercase font-bold theme-text-muted block">
                    Net Return
                  </span>
                  <span
                    className={`font-mono text-xs font-bold block mt-0.5 ${
                      isGain ? "status-gain-text" : "status-loss-text"
                    }`}
                  >
                    {isGain ? "+" : "-"}৳{formatBdt(Math.abs(fund.absoluteGainLoss), 0)}
                  </span>
                </div>

                {/* Investment Tenure */}
                <div className="theme-surface rounded-xl border theme-border p-2.5">
                  <span className="text-[10px] uppercase font-bold theme-text-muted block flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Tenure
                  </span>
                  <span className="font-mono text-xs font-bold theme-text-primary block mt-0.5">
                    {fund.activeMonths} {fund.activeMonths === 1 ? "mo" : "mos"} ({fund.totalInstallments} {fund.totalInstallments === 1 ? "inv" : "invs"})
                  </span>
                </div>

                {/* Cost vs Latest NAV */}
                <div className="theme-surface rounded-xl border theme-border p-2.5">
                  <span className="text-[10px] uppercase font-bold theme-text-muted block">
                    Avg Buy vs NAV
                  </span>
                  <span className="font-mono text-[11px] font-bold theme-text-secondary block mt-0.5">
                    ৳{fund.averageBuyPrice.toFixed(2)} → <span className="status-gain-text">৳{fund.effectiveNav.toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Units & Cash Buffer Footer */}
              <div className="flex items-center justify-between text-[11px] border-t theme-border pt-2.5">
                <div className="flex items-center gap-1 theme-text-muted">
                  <Coins className="h-3 w-3 text-[#33c6e4]" />
                  <span>Integer Units:</span>
                  <strong className="theme-text-primary font-mono">{fund.totalUnitsHeld}</strong>
                </div>
                <div className="theme-text-muted">
                  <span>Cash buffer: </span>
                  <strong className="text-amber-600 dark:text-amber-400 font-mono">
                    ৳{formatBdt(fund.fractionalCashBalance, 2)}
                  </strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
