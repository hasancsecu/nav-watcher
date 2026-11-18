"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  Coins,
  Award,
  Layers,
  ArrowUpDown,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Table,
  LayoutGrid,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  Percent,
  Scale,
  ArrowRight,
  Filter,
  DollarSign,
} from "lucide-react";

export interface FundItem {
  id: string;
  fundId?: string;
  name: string;
  shortName: string;
  fundManager: string;
  category: string;
  effectiveNav: number;
  latestNav?: number;
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
    monthKey?: string;
    investmentDate: string;
    cashInvested: number;
    cashBufferUsed?: number;
    executionNav: number;
    unitsAllotted: number;
    unitsCost?: number;
    cashRemainder?: number;
    type: string;
    notes?: string | null;
  }>;
}

interface FundComparisonSectionProps {
  funds: FundItem[];
  totalPortfolioInvested: number;
  totalPortfolioValue: number;
}

type SortField =
  | "return"
  | "invested"
  | "marketValue"
  | "gain"
  | "tenure"
  | "avgBuy"
  | "units";

type ViewMode = "cards" | "table" | "bars";

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
  // ---------------------------------------------------------------------------
  // 1. State: Selection, Sorting, and View Modes
  // ---------------------------------------------------------------------------
  const [selectedFundIds, setSelectedFundIds] = useState<Set<string>>(() => {
    return new Set(funds.map((f) => f.id));
  });

  const [sortBy, setSortBy] = useState<SortField>("return");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [headToHeadFundIds, setHeadToHeadFundIds] = useState<
    [string, string] | null
  >(null);

  // Toggle fund selection
  const toggleFundSelection = (fundId: string) => {
    setSelectedFundIds((prev) => {
      const next = new Set(prev);
      if (next.has(fundId)) {
        if (next.size > 1) {
          next.delete(fundId);
        }
      } else {
        next.add(fundId);
      }
      return next;
    });
  };

  const selectAllFunds = () => {
    setSelectedFundIds(new Set(funds.map((f) => f.id)));
  };

  // ---------------------------------------------------------------------------
  // 2. Dynamic Metric Calculations per Fund based on Invested Values
  // ---------------------------------------------------------------------------
  const enrichedFunds = useMemo(() => {
    return funds.map((f) => {
      const invs = Array.isArray(f.investments) ? f.investments : [];
      const totalInstallments = invs.length;

      // Breakdown by investment type
      let sipTotal = 0;
      let lumpsumTotal = 0;
      let cipTotal = 0;
      let sipCount = 0;
      let lumpsumCount = 0;
      let cipCount = 0;

      invs.forEach((inv) => {
        const typeUpper = (inv.type || "SIP").toUpperCase();
        const cash = Number(inv.cashInvested) || 0;
        if (typeUpper === "SIP") {
          sipTotal += cash;
          sipCount++;
        } else if (typeUpper === "LUMPSUM") {
          lumpsumTotal += cash;
          lumpsumCount++;
        } else if (typeUpper === "CIP") {
          cipTotal += cash;
          cipCount++;
        }
      });

      // Calculate investment tenure (time active)
      let firstDate: Date | null = null;
      let lastDate: Date | null = null;
      if (invs.length > 0) {
        const sorted = [...invs].sort(
          (a, b) =>
            new Date(a.investmentDate).getTime() -
            new Date(b.investmentDate).getTime(),
        );
        firstDate = new Date(sorted[0].investmentDate);
        lastDate = new Date(sorted[sorted.length - 1].investmentDate);
      }

      let activeMonths = totalInstallments;
      if (firstDate && lastDate) {
        const diffMs = Math.max(0, lastDate.getTime() - firstDate.getTime());
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        activeMonths = Math.max(
          1,
          Math.round(diffDays / 30.4) || totalInstallments,
        );
      }

      // NAV spread: difference between Current NAV and Average Buy Price
      const navAppreciation =
        f.averageBuyPrice > 0
          ? ((f.effectiveNav - f.averageBuyPrice) / f.averageBuyPrice) * 100
          : 0;

      // Overall portfolio weight
      const portfolioWeightPct =
        totalPortfolioInvested > 0
          ? (f.totalInvested / totalPortfolioInvested) * 100
          : 0;

      // Monthly velocity
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
        navAppreciation,
        sipTotal,
        lumpsumTotal,
        cipTotal,
        sipCount,
        lumpsumCount,
        cipCount,
      };
    });
  }, [funds, totalPortfolioInvested]);

  // Selected funds subset
  const activeComparedFunds = useMemo(() => {
    return enrichedFunds.filter((f) => selectedFundIds.has(f.id));
  }, [enrichedFunds, selectedFundIds]);

  // Dynamic Selected Aggregate Totals
  const selectedAggregate = useMemo(() => {
    let totalInv = 0;
    let totalVal = 0;
    let totalUnits = 0;
    let totalBuf = 0;

    activeComparedFunds.forEach((f) => {
      totalInv += f.totalInvested;
      totalVal += f.currentMarketValue;
      totalUnits += f.totalUnitsHeld;
      totalBuf += f.fractionalCashBalance;
    });

    const netGain = totalVal - totalInv;
    const returnPct = totalInv > 0 ? (netGain / totalInv) * 100 : 0;

    return {
      totalInvested: totalInv,
      totalMarketValue: totalVal,
      totalUnits,
      totalCashBuffer: totalBuf,
      netGain,
      returnPct,
      count: activeComparedFunds.length,
    };
  }, [activeComparedFunds]);

  // Dynamic relative weight within the selected comparison group
  const fundsWithRelativeWeights = useMemo(() => {
    return activeComparedFunds.map((f) => {
      const relativeWeightPct =
        selectedAggregate.totalInvested > 0
          ? (f.totalInvested / selectedAggregate.totalInvested) * 100
          : 0;
      return {
        ...f,
        relativeWeightPct,
      };
    });
  }, [activeComparedFunds, selectedAggregate.totalInvested]);

  // Sorted compared funds
  const sortedFunds = useMemo(() => {
    const list = [...fundsWithRelativeWeights];
    const multiplier = sortOrder === "desc" ? 1 : -1;

    list.sort((a, b) => {
      if (sortBy === "return") {
        return (b.returnPct - a.returnPct) * multiplier;
      }
      if (sortBy === "invested") {
        return (b.totalInvested - a.totalInvested) * multiplier;
      }
      if (sortBy === "marketValue") {
        return (b.currentMarketValue - a.currentMarketValue) * multiplier;
      }
      if (sortBy === "gain") {
        return (b.absoluteGainLoss - a.absoluteGainLoss) * multiplier;
      }
      if (sortBy === "tenure") {
        return (b.activeMonths - a.activeMonths) * multiplier;
      }
      if (sortBy === "avgBuy") {
        return (a.averageBuyPrice - b.averageBuyPrice) * multiplier;
      }
      if (sortBy === "units") {
        return (b.totalUnitsHeld - a.totalUnitsHeld) * multiplier;
      }
      return 0;
    });

    return list;
  }, [fundsWithRelativeWeights, sortBy, sortOrder]);

  if (funds.length === 0) {
    return null;
  }

  // Top performers in active set
  const bestReturnFund = [...fundsWithRelativeWeights].sort(
    (a, b) => b.returnPct - a.returnPct,
  )[0];

  const highestCapitalFund = [...fundsWithRelativeWeights].sort(
    (a, b) => b.totalInvested - a.totalInvested,
  )[0];

  const highestGainFund = [...fundsWithRelativeWeights].sort(
    (a, b) => b.absoluteGainLoss - a.absoluteGainLoss,
  )[0];

  const maxInvestedInSet = Math.max(
    ...fundsWithRelativeWeights.map((f) => f.totalInvested),
    1,
  );
  const maxMarketValInSet = Math.max(
    ...fundsWithRelativeWeights.map((f) => f.currentMarketValue),
    1,
  );
  const maxReturnInSet = Math.max(
    ...fundsWithRelativeWeights.map((f) => Math.abs(f.returnPct)),
    1,
  );

  return (
    <section
      aria-labelledby="comparison-heading"
      className="space-y-4 sm:space-y-5"
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. Header & Dynamic Selection Controls                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-3 border-b theme-border pb-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                id="comparison-heading"
                className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary flex items-center gap-2"
              >
                <Layers className="h-5 w-5 text-[#248da2] dark:text-[#33c6e4] shrink-0" />
                <span>Dynamic Fund Comparison</span>
              </h3>
              <span className="rounded-full bg-[#33c6e4]/15 px-2.5 py-0.5 text-xs font-bold text-[#155360] dark:text-[#33c6e4]">
                {selectedFundIds.size} of {funds.length} Selected
              </span>
            </div>
            <p className="text-xs theme-text-secondary mt-0.5 leading-relaxed">
              Dynamically compare invested capital, return rates, unit
              efficiency, and cash buffers.
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-900 border theme-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "cards"
                  ? "bg-[#33c6e4] text-slate-950 shadow-xs"
                  : "theme-text-secondary hover:theme-text-primary"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "table"
                  ? "bg-[#33c6e4] text-slate-950 shadow-xs"
                  : "theme-text-secondary hover:theme-text-primary"
              }`}
              title="Side-by-Side Table Matrix"
            >
              <Table className="h-3.5 w-3.5" />
              <span>Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("bars")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "bars"
                  ? "bg-[#33c6e4] text-slate-950 shadow-xs"
                  : "theme-text-secondary hover:theme-text-primary"
              }`}
              title="Comparative Bar Graphs"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Bars</span>
            </button>
          </div>
        </div>

        {/* Dynamic Multi-Fund Selection Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold theme-text-muted uppercase tracking-wider mr-1">
            Compare:
          </span>

          <button
            type="button"
            onClick={selectAllFunds}
            className={`text-xs px-2.5 py-1 rounded-full border transition font-semibold ${
              selectedFundIds.size === funds.length
                ? "bg-[#33c6e4]/20 border-[#33c6e4] text-[#155360] dark:text-[#33c6e4] font-bold"
                : "theme-border theme-surface text-slate-500 hover:theme-text-primary"
            }`}
          >
            All Funds ({funds.length})
          </button>

          {funds.map((f) => {
            const isSelected = selectedFundIds.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFundSelection(f.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
                  isSelected
                    ? "bg-[#33c6e4]/15 border-[#33c6e4]/60 text-[#155360] dark:text-[#33c6e4] font-bold shadow-2xs"
                    : "theme-border theme-surface text-slate-400 opacity-60 hover:opacity-100"
                }`}
              >
                {isSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-[#33c6e4]" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>{f.shortName || f.name}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t theme-border">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5">
            <span className="text-[11px] font-bold theme-text-muted flex items-center gap-1 shrink-0 mr-1">
              <ArrowUpDown className="h-3 w-3" /> Sort:
            </span>
            {[
              { key: "return", label: "Return %" },
              { key: "invested", label: "Capital" },
              { key: "marketValue", label: "Market Val" },
              { key: "gain", label: "Net Gain" },
              { key: "tenure", label: "Tenure" },
              { key: "units", label: "Units" },
              { key: "avgBuy", label: "Avg Cost" },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  if (sortBy === s.key) {
                    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                  } else {
                    setSortBy(s.key as SortField);
                    setSortOrder("desc");
                  }
                }}
                className={`rounded-full px-3 py-1 text-xs font-bold transition whitespace-nowrap min-h-[30px] flex items-center gap-1 ${
                  sortBy === s.key
                    ? "bg-[#33c6e4] text-slate-950 shadow-sm"
                    : "theme-surface theme-text-secondary hover:theme-text-primary border theme-border"
                }`}
              >
                <span>{s.label}</span>
                {sortBy === s.key && (
                  <span className="text-[10px] opacity-80">
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </span>
                )}
              </button>
            ))}
          </div>

          <span className="text-[11px] theme-text-muted font-mono shrink-0">
            Selected Net:{" "}
            <strong
              className={
                selectedAggregate.netGain >= 0
                  ? "status-gain-text font-bold"
                  : "status-loss-text font-bold"
              }
            >
              {selectedAggregate.netGain >= 0 ? "+" : ""}৳
              {formatBdt(selectedAggregate.netGain, 0)} (
              {selectedAggregate.returnPct.toFixed(2)}%)
            </strong>
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Dynamic Highlights Banner (Dynamically updates with selection) */}
      {/* ------------------------------------------------------------- */}
      {activeComparedFunds.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {bestReturnFund && (
            <div className="theme-surface rounded-xl border theme-border p-3 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <Award className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                    Top Return Rate
                  </span>
                  <span className="font-mono font-bold status-gain-text">
                    +{bestReturnFund.returnPct.toFixed(2)}%
                  </span>
                </div>
                <p className="font-bold theme-text-primary truncate">
                  {bestReturnFund.shortName || bestReturnFund.name}
                </p>
                <p className="text-[11px] theme-text-muted">
                  +৳{formatBdt(bestReturnFund.absoluteGainLoss, 0)} on ৳
                  {formatBdt(bestReturnFund.totalInvested, 0)}
                </p>
              </div>
            </div>
          )}

          {highestCapitalFund && (
            <div className="theme-surface rounded-xl border theme-border p-3 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] border border-[#33c6e4]/30">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#155360] dark:text-[#33c6e4]">
                    Largest Allocation
                  </span>
                  <span className="font-mono font-bold text-[#155360] dark:text-[#33c6e4]">
                    {highestCapitalFund.relativeWeightPct.toFixed(2)}%
                  </span>
                </div>
                <p className="font-bold theme-text-primary truncate">
                  {highestCapitalFund.shortName || highestCapitalFund.name}
                </p>
                <p className="text-[11px] theme-text-muted">
                  ৳{formatBdt(highestCapitalFund.totalInvested, 0)} (
                  {highestCapitalFund.totalUnitsHeld} units)
                </p>
              </div>
            </div>
          )}

          {highestGainFund && (
            <div className="theme-surface rounded-xl border theme-border p-3 flex items-center gap-3 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">
                    Highest Absolute Profit
                  </span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                    +৳{formatBdt(highestGainFund.absoluteGainLoss, 0)}
                  </span>
                </div>
                <p className="font-bold theme-text-primary truncate">
                  {highestGainFund.shortName || highestGainFund.name}
                </p>
                <p className="text-[11px] theme-text-muted">
                  Current: ৳{formatBdt(highestGainFund.currentMarketValue, 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3A. VIEW MODE: Card Grid View                                */}
      {/* ------------------------------------------------------------- */}
      {viewMode === "cards" && (
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
                    <h4
                      className="text-sm font-extrabold theme-text-primary truncate"
                      title={fund.name}
                    >
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

                {/* Relative Allocation Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="theme-text-muted font-medium">
                      Selected Capital Share
                    </span>
                    <span className="font-mono font-bold text-[#155360] dark:text-[#33c6e4]">
                      {fund.relativeWeightPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#33c6e4] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(4, fund.relativeWeightPct))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Key Comparative Matrix */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Capital Invested */}
                  <div className="theme-surface rounded-xl border theme-border p-2.5">
                    <span className="text-[10px] uppercase font-bold theme-text-muted block">
                      Capital Invested
                    </span>
                    <span className="font-mono text-xs font-bold theme-text-primary block mt-0.5">
                      ৳{formatBdt(fund.totalInvested, 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      SIP: ৳{formatBdt(fund.sipTotal, 0)}
                    </span>
                  </div>

                  {/* Market Value & Net Return */}
                  <div className="theme-surface rounded-xl border theme-border p-2.5">
                    <span className="text-[10px] uppercase font-bold theme-text-muted block">
                      Market Value
                    </span>
                    <span className="font-mono text-xs font-bold theme-text-primary block mt-0.5">
                      ৳{formatBdt(fund.currentMarketValue, 0)}
                    </span>
                    <span
                      className={`text-[10px] font-bold block mt-0.5 ${
                        isGain ? "status-gain-text" : "status-loss-text"
                      }`}
                    >
                      {isGain ? "+" : "-"}৳
                      {formatBdt(Math.abs(fund.absoluteGainLoss), 0)}
                    </span>
                  </div>

                  {/* Investment Tenure & Installments */}
                  <div className="theme-surface rounded-xl border theme-border p-2.5">
                    <span className="text-[10px] uppercase font-bold theme-text-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Tenure
                    </span>
                    <span className="font-mono text-xs font-bold theme-text-primary block mt-0.5">
                      {fund.activeMonths}{" "}
                      {fund.activeMonths === 1 ? "mo" : "mos"}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {fund.totalInstallments} total entries
                    </span>
                  </div>

                  {/* Avg Buy NAV vs Current NAV */}
                  <div className="theme-surface rounded-xl border theme-border p-2.5">
                    <span className="text-[10px] uppercase font-bold theme-text-muted block">
                      Avg Buy → NAV
                    </span>
                    <span className="font-mono text-[11px] font-bold theme-text-secondary block mt-0.5">
                      ৳{fund.averageBuyPrice.toFixed(2)} →{" "}
                      <span className="status-gain-text">
                        ৳{fund.effectiveNav.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono">
                      {fund.navAppreciation >= 0 ? "+" : ""}
                      {fund.navAppreciation.toFixed(2)}% spread
                    </span>
                  </div>
                </div>

                {/* Units & Cash Buffer Footer */}
                <div className="flex items-center justify-between text-[11px] border-t theme-border pt-2.5">
                  <div className="flex items-center gap-1 theme-text-muted">
                    <Coins className="h-3 w-3 text-[#33c6e4]" />
                    <span>Units:</span>
                    <strong className="theme-text-primary font-mono">
                      {fund.totalUnitsHeld.toLocaleString("en-BD")}
                    </strong>
                  </div>
                  <div className="theme-text-muted">
                    <span>Buffer: </span>
                    <strong className="text-amber-600 dark:text-amber-400 font-mono">
                      ৳{formatBdt(fund.fractionalCashBalance, 2)}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3B. VIEW MODE: Side-by-Side Table Matrix                      */}
      {/* ------------------------------------------------------------- */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-2xl border theme-border theme-surface">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b theme-border bg-slate-100/70 dark:bg-slate-800/60 font-bold theme-text-secondary">
                <th className="py-3 px-3.5 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800">
                  Comparison Metric
                </th>
                {sortedFunds.map((f, i) => (
                  <th key={f.id} className="py-3 px-3.5 min-w-[150px]">
                    <span className="text-[10px] theme-text-muted block">
                      #{i + 1}
                    </span>
                    <span
                      className="font-extrabold theme-text-primary truncate block"
                      title={f.name}
                    >
                      {f.shortName || f.name}
                    </span>
                    <span className="text-[10px] text-[#155360] dark:text-[#33c6e4] block">
                      {f.fundManager}
                    </span>
                  </th>
                ))}
                <th className="py-3 px-3.5 min-w-[130px] bg-slate-200/40 dark:bg-slate-800/40 font-black">
                  Combined Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {/* Row 1: Net Return % */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Net Return %
                </td>
                {sortedFunds.map((f) => {
                  const isTop = f.id === bestReturnFund?.id;
                  const isGain = f.returnPct >= 0;
                  return (
                    <td
                      key={f.id}
                      className="py-2.5 px-3.5 font-mono font-bold whitespace-nowrap"
                    >
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                          isGain ? "status-gain-badge" : "status-loss-badge"
                        }`}
                      >
                        {isTop && <Award className="h-3 w-3 text-amber-500" />}
                        {isGain ? "+" : ""}
                        {f.returnPct.toFixed(2)}%
                      </span>
                    </td>
                  );
                })}
                <td className="py-2.5 px-3.5 font-mono font-black status-gain-text bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  {selectedAggregate.returnPct >= 0 ? "+" : ""}
                  {selectedAggregate.returnPct.toFixed(2)}%
                </td>
              </tr>

              {/* Row 2: Capital Invested */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Capital Invested
                </td>
                {sortedFunds.map((f) => (
                  <td
                    key={f.id}
                    className="py-2.5 px-3.5 font-mono font-bold theme-text-primary whitespace-nowrap"
                  >
                    ৳{formatBdt(f.totalInvested, 0)}
                    <span className="text-[10px] text-slate-400 block font-normal">
                      {f.relativeWeightPct.toFixed(2)}% share
                    </span>
                  </td>
                ))}
                <td className="py-2.5 px-3.5 font-mono font-black theme-text-primary bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  ৳{formatBdt(selectedAggregate.totalInvested, 0)}
                </td>
              </tr>

              {/* Row 3: Current Market Value */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Current Market Value
                </td>
                {sortedFunds.map((f) => (
                  <td
                    key={f.id}
                    className="py-2.5 px-3.5 font-mono font-bold theme-text-primary whitespace-nowrap"
                  >
                    ৳{formatBdt(f.currentMarketValue, 0)}
                  </td>
                ))}
                <td className="py-2.5 px-3.5 font-mono font-black text-[#155360] dark:text-[#33c6e4] bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  ৳{formatBdt(selectedAggregate.totalMarketValue, 0)}
                </td>
              </tr>

              {/* Row 4: Net Gain / Loss */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Net Gain / Loss
                </td>
                {sortedFunds.map((f) => {
                  const isGain = f.absoluteGainLoss >= 0;
                  return (
                    <td
                      key={f.id}
                      className={`py-2.5 px-3.5 font-mono font-bold whitespace-nowrap ${
                        isGain ? "status-gain-text" : "status-loss-text"
                      }`}
                    >
                      {isGain ? "+" : "-"}৳
                      {formatBdt(Math.abs(f.absoluteGainLoss), 0)}
                    </td>
                  );
                })}
                <td
                  className={`py-2.5 px-3.5 font-mono font-black bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap ${
                    selectedAggregate.netGain >= 0
                      ? "status-gain-text"
                      : "status-loss-text"
                  }`}
                >
                  {selectedAggregate.netGain >= 0 ? "+" : "-"}৳
                  {formatBdt(Math.abs(selectedAggregate.netGain), 0)}
                </td>
              </tr>

              {/* Row 5: Units Held */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Units Held
                </td>
                {sortedFunds.map((f) => (
                  <td
                    key={f.id}
                    className="py-2.5 px-3.5 font-mono font-bold text-[#155360] dark:text-[#33c6e4] whitespace-nowrap"
                  >
                    +{f.totalUnitsHeld.toLocaleString("en-BD")}
                  </td>
                ))}
                <td className="py-2.5 px-3.5 font-mono font-black text-[#155360] dark:text-[#33c6e4] bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  +{selectedAggregate.totalUnits.toLocaleString("en-BD")}
                </td>
              </tr>

              {/* Row 6: Avg Buy Price vs Current NAV */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Avg Buy vs NAV
                </td>
                {sortedFunds.map((f) => (
                  <td
                    key={f.id}
                    className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    ৳{f.averageBuyPrice.toFixed(2)} →{" "}
                    <strong className="status-gain-text">
                      ৳{f.effectiveNav.toFixed(2)}
                    </strong>
                  </td>
                ))}
                <td className="py-2.5 px-3.5 font-mono text-slate-400 bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  —
                </td>
              </tr>

              {/* Row 7: Tenure & Installments */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Tenure &amp; Velocity
                </td>
                {sortedFunds.map((f) => (
                  <td
                    key={f.id}
                    className="py-2.5 px-3.5 font-mono text-xs whitespace-nowrap"
                  >
                    {f.activeMonths} mos ({f.totalInstallments} invs)
                    <span className="text-[10px] text-slate-400 block font-normal">
                      ~৳{formatBdt(f.monthlyPace, 0)}/mo
                    </span>
                  </td>
                ))}
                <td className="py-2.5 px-3.5 font-mono text-slate-400 bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  —
                </td>
              </tr>

              {/* Row 8: Cash Buffer Remainder */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3.5 font-bold theme-text-primary sticky left-0 z-10 theme-surface whitespace-nowrap">
                  Fractional Cash Buffer
                </td>
                {sortedFunds.map((f) => (
                  <td
                    key={f.id}
                    className="py-2.5 px-3.5 font-mono font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap"
                  >
                    ৳{formatBdt(f.fractionalCashBalance, 2)}
                  </td>
                ))}
                <td className="py-2.5 px-3.5 font-mono font-black text-amber-600 dark:text-amber-400 bg-slate-200/20 dark:bg-slate-800/20 whitespace-nowrap">
                  ৳{formatBdt(selectedAggregate.totalCashBuffer, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3C. VIEW MODE: Visual Bar Graphs Comparison                  */}
      {/* ------------------------------------------------------------- */}
      {viewMode === "bars" && (
        <div className="rounded-2xl border theme-border theme-surface p-4 sm:p-5 space-y-5">
          {/* A. Capital Invested vs Market Value Horizontal Comparison */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-extrabold theme-text-primary flex items-center justify-between">
              <span>Capital Invested vs. Current Market Value</span>
              <span className="text-[11px] font-normal theme-text-muted">
                BDT (৳)
              </span>
            </h4>

            <div className="space-y-3">
              {sortedFunds.map((f) => {
                const invPct = (f.totalInvested / maxMarketValInSet) * 100;
                const valPct = (f.currentMarketValue / maxMarketValInSet) * 100;
                const isGain = f.absoluteGainLoss >= 0;

                return (
                  <div key={f.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className="font-bold theme-text-primary truncate max-w-[200px]"
                        title={f.name}
                      >
                        {f.shortName || f.name}
                      </span>
                      <span className="font-mono text-[11px]">
                        ৳{formatBdt(f.totalInvested, 0)} →{" "}
                        <strong
                          className={
                            isGain ? "status-gain-text" : "status-loss-text"
                          }
                        >
                          ৳{formatBdt(f.currentMarketValue, 0)}
                        </strong>
                      </span>
                    </div>

                    <div className="h-4 w-full rounded-lg bg-slate-100 dark:bg-slate-800/80 overflow-hidden flex relative">
                      {/* Capital Invested Bar */}
                      <div
                        className="h-full bg-slate-400/60 dark:bg-slate-600/60 rounded-l-lg transition-all duration-500"
                        style={{ width: `${Math.max(2, invPct)}%` }}
                        title={`Invested: ৳${formatBdt(f.totalInvested, 0)}`}
                      />
                      {/* Gain or Loss Extension Bar */}
                      {isGain && (
                        <div
                          className="h-full bg-emerald-500 rounded-r-lg transition-all duration-500"
                          style={{ width: `${Math.max(0, valPct - invPct)}%` }}
                          title={`Gain: +৳${formatBdt(f.absoluteGainLoss, 0)}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-[11px] theme-text-muted pt-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-slate-400 dark:bg-slate-600" />{" "}
                Capital Invested
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-emerald-500" /> Value
                Gain
              </span>
            </div>
          </div>

          {/* B. Return Rates Comparative Ranking Bar */}
          <div className="space-y-3 pt-3 border-t theme-border">
            <h4 className="text-xs sm:text-sm font-extrabold theme-text-primary flex items-center justify-between">
              <span>Return Rate Ranking</span>
              <span className="text-[11px] font-normal theme-text-muted">
                Percentage (%)
              </span>
            </h4>

            <div className="space-y-2.5">
              {sortedFunds.map((f) => {
                const barWidth = (Math.abs(f.returnPct) / maxReturnInSet) * 100;
                const isGain = f.returnPct >= 0;

                return (
                  <div key={f.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold theme-text-primary truncate max-w-[200px]">
                        {f.shortName || f.name}
                      </span>
                      <strong
                        className={`font-mono text-xs ${isGain ? "status-gain-text" : "status-loss-text"}`}
                      >
                        {isGain ? "+" : ""}
                        {f.returnPct.toFixed(2)}%
                      </strong>
                    </div>

                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isGain ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.max(3, barWidth)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
