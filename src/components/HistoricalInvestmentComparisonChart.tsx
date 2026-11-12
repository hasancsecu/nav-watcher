"use client";

import React, { useState, useMemo, useRef, useId } from "react";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
} from "lucide-react";

export interface SnapshotItem {
  id?: string;
  fundId: string;
  dateKey: string;
  displayDate: string;
  nav: number;
}

export interface InvestmentItem {
  id: string;
  userFundId: string;
  calendarMonth: string;
  investmentDate: string;
  cashInvested: number;
  executionNav: number;
  unitsAllotted: number;
  unitsCost: number;
  type: string;
}

export interface UserFundWithInvestments {
  id: string;
  fundId: string;
  name: string;
  shortName: string;
  fundManager: string;
  category: string;
  effectiveNav: number;
  totalUnitsHeld: number;
  totalInvested: number;
  averageBuyPrice: number;
  currentMarketValue: number;
  absoluteGainLoss: number;
  returnPct: number;
  investments?: InvestmentItem[];
}

interface HistoricalComparisonChartProps {
  funds: UserFundWithInvestments[];
  snapshots: SnapshotItem[];
}

type ChartMetric = "nav" | "growth" | "return";

const FUND_PALETTE = [
  "#33c6e4", // Brand Cyan
  "#10b981", // Emerald
  "#a855f7", // Violet
  "#f59e0b", // Amber
  "#06b6d4", // Teal
  "#ec4899", // Pink
  "#3b82f6", // Blue
];

function formatBdt(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export default function HistoricalInvestmentComparisonChart({
  funds,
  snapshots,
}: HistoricalComparisonChartProps) {
  const chartId = useId();
  const [metric, setMetric] = useState<ChartMetric>("nav");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Assign a consistent distinct color to each user fund
  const fundColors = useMemo(() => {
    const map = new Map<string, string>();
    funds.forEach((f, idx) => {
      map.set(f.fundId || f.id, FUND_PALETTE[idx % FUND_PALETTE.length]);
    });
    return map;
  }, [funds]);

  // Aggregate unified historical time series data
  const chartData = useMemo(() => {
    if (!funds || funds.length === 0) return [];

    // Group snapshots by dateKey
    const dateMap = new Map<string, { displayDate: string; navs: Record<string, number> }>();

    // 1. Gather all unique dateKeys from snapshots
    snapshots.forEach((s) => {
      if (!dateMap.has(s.dateKey)) {
        dateMap.set(s.dateKey, { displayDate: s.displayDate, navs: {} });
      }
      dateMap.get(s.dateKey)!.navs[s.fundId] = s.nav;
    });

    // 2. Also gather any investment dates
    funds.forEach((f) => {
      (f.investments || []).forEach((inv) => {
        const dKey = inv.investmentDate ? inv.investmentDate.slice(0, 10) : "";
        if (dKey && !dateMap.has(dKey)) {
          dateMap.set(dKey, { displayDate: inv.calendarMonth || dKey, navs: {} });
        }
      });
    });

    // If no historical snapshots, create at least current point
    if (dateMap.size === 0) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayDisplay = "Today";
      const navs: Record<string, number> = {};
      funds.forEach((f) => {
        navs[f.fundId || f.id] = f.effectiveNav || 10.0;
      });
      dateMap.set(todayKey, { displayDate: todayDisplay, navs });
    }

    // Sort dates chronologically
    const sortedDates = Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // Calculate progression metrics for each timeline node
    let runningInvestedTotal = 0;
    let runningUnitsMap: Record<string, number> = {};
    funds.forEach((f) => {
      runningUnitsMap[f.fundId || f.id] = f.totalUnitsHeld || 0;
    });

    return sortedDates.map(([dateKey, data]) => {
      const fundValues: Record<string, { nav: number; marketVal: number; returnPct: number }> = {};
      let totalPortfolioVal = 0;
      let totalPortfolioInv = 0;

      funds.forEach((f) => {
        const fKey = f.fundId || f.id;
        const nav = data.navs[fKey] ?? f.effectiveNav ?? 10.0;
        const units = f.totalUnitsHeld || 0;
        const invested = f.totalInvested || 0;
        const marketVal = units * nav;
        const ret = invested > 0 ? ((marketVal - invested) / invested) * 100 : 0;

        fundValues[fKey] = {
          nav,
          marketVal,
          returnPct: ret,
        };

        totalPortfolioVal += marketVal;
        totalPortfolioInv += invested;
      });

      const totalReturn =
        totalPortfolioInv > 0
          ? ((totalPortfolioVal - totalPortfolioInv) / totalPortfolioInv) * 100
          : 0;

      return {
        dateKey,
        displayDate: data.displayDate,
        totalPortfolioVal,
        totalPortfolioInv,
        totalReturn,
        fundValues,
      };
    });
  }, [funds, snapshots]);

  if (!funds || funds.length === 0) {
    return null;
  }

  // Determine bounds for plotting
  const width = 840;
  const height = 300;
  const padL = 60;
  const padR = 24;
  const padT = 20;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Extract values based on active metric
  let allMetricValues: number[] = [];
  if (metric === "nav") {
    chartData.forEach((d) => {
      funds.forEach((f) => {
        const val = d.fundValues[f.fundId || f.id]?.nav;
        if (typeof val === "number" && !isNaN(val)) allMetricValues.push(val);
      });
    });
  } else if (metric === "growth") {
    chartData.forEach((d) => {
      allMetricValues.push(d.totalPortfolioInv);
      allMetricValues.push(d.totalPortfolioVal);
    });
  } else if (metric === "return") {
    chartData.forEach((d) => {
      funds.forEach((f) => {
        const r = d.fundValues[f.fundId || f.id]?.returnPct;
        if (typeof r === "number" && !isNaN(r)) allMetricValues.push(r);
      });
      allMetricValues.push(d.totalReturn);
    });
  }

  if (allMetricValues.length === 0) allMetricValues = [10];

  const rawMin = Math.min(...allMetricValues);
  const rawMax = Math.max(...allMetricValues);
  const spread = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.08, 1);
  const minVal = metric === "return" ? Math.floor(rawMin - 2) : Math.max(0, rawMin - spread * 0.15);
  const maxVal = rawMax + spread * 0.15;

  const getX = (idx: number) => {
    if (chartData.length <= 1) return padL + plotW / 2;
    return padL + (idx / (chartData.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return padT + plotH - ratio * plotH;
  };

  // Build SVG path strings for each fund / series
  const seriesPaths = useMemo(() => {
    if (metric === "growth") {
      // Line 1: Total Invested
      const invCoords = chartData.map((d, i) => `${getX(i)},${getY(d.totalPortfolioInv)}`);
      // Line 2: Market Value
      const valCoords = chartData.map((d, i) => `${getX(i)},${getY(d.totalPortfolioVal)}`);
      return [
        {
          key: "invested",
          name: "Total Invested Capital",
          color: "#94a3b8", // Slate
          dashed: true,
          d: `M ${invCoords.join(" L ")}`,
        },
        {
          key: "marketVal",
          name: "Portfolio Market Value",
          color: "#33c6e4", // Cyan
          dashed: false,
          d: `M ${valCoords.join(" L ")}`,
        },
      ];
    }

    // For NAV or Return %, build line for each fund
    return funds.map((f) => {
      const fKey = f.fundId || f.id;
      const color = fundColors.get(fKey) || "#33c6e4";
      const coords = chartData.map((d, i) => {
        const metricVal =
          metric === "nav"
            ? d.fundValues[fKey]?.nav ?? f.effectiveNav ?? 10
            : d.fundValues[fKey]?.returnPct ?? f.returnPct ?? 0;
        return `${getX(i)},${getY(metricVal)}`;
      });
      return {
        key: fKey,
        name: f.shortName || f.name,
        color,
        dashed: false,
        d: `M ${coords.join(" L ")}`,
      };
    });
  }, [metric, chartData, funds, fundColors]);

  const activeHover = hoverIndex !== null && chartData[hoverIndex] ? chartData[hoverIndex] : null;

  return (
    <section
      aria-labelledby="historical-chart-heading"
      className="theme-surface rounded-2xl border theme-border p-4 sm:p-6 shadow-sm space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3">
        <div>
          <h3
            id="historical-chart-heading"
            className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary flex items-center gap-2"
          >
            <BarChart3 className="h-5 w-5 text-[#33c6e4]" />
            <span>Historical Fund Performance &amp; Valuation Comparison</span>
          </h3>
          <p className="text-xs theme-text-secondary mt-0.5">
            Compare historical NAV trends, capital invested, and return progression across your funds
          </p>
        </div>

        {/* Metric Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {[
            { key: "nav", label: "NAV Price (৳)" },
            { key: "growth", label: "Invested vs Valuation" },
            { key: "return", label: "Return Rate (%)" },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMetric(m.key as ChartMetric);
                setHoverIndex(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition whitespace-nowrap min-h-[34px] ${
                metric === m.key
                  ? "bg-[#33c6e4] text-slate-950 shadow-sm"
                  : "theme-surface theme-text-secondary hover:theme-text-primary border theme-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Interactive Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
        {seriesPaths.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 font-medium theme-text-secondary">
            <span
              className="h-2.5 w-5 rounded-full inline-block shrink-0"
              style={{
                backgroundColor: s.color,
                borderStyle: s.dashed ? "dashed" : "solid",
              }}
            />
            <span className="truncate max-w-[200px]">{s.name}</span>
          </div>
        ))}
      </div>

      {/* SVG Chart Graphic */}
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border theme-border pt-2 pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[320px] select-none touch-pan-x"
          onMouseLeave={() => setHoverIndex(null)}
          onTouchEnd={() => setHoverIndex(null)}
        >
          {/* Subtle Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const yPos = padT + plotH * pct;
            const gridVal = maxVal - pct * (maxVal - minVal);
            return (
              <g key={i} opacity="0.45">
                <line
                  x1={padL}
                  y1={yPos}
                  x2={width - padR}
                  y2={yPos}
                  stroke="currentColor"
                  strokeDasharray="4 6"
                  className="theme-text-muted"
                  strokeWidth="1"
                />
                <text
                  x={padL - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-current theme-text-muted"
                >
                  {metric === "return"
                    ? `${gridVal.toFixed(1)}%`
                    : metric === "growth"
                    ? `৳${formatBdt(gridVal, 0)}`
                    : `৳${gridVal.toFixed(2)}`}
                </text>
              </g>
            );
          })}

          {/* Series Polyline Traces */}
          {seriesPaths.map((series) => (
            <path
              key={series.key}
              d={series.d}
              fill="none"
              stroke={series.color}
              strokeWidth="2.5"
              strokeDasharray={series.dashed ? "6 6" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Timeline Nodes & Interactive Hover Triggers */}
          {chartData.map((d, idx) => {
            const xPos = getX(idx);
            const isHovered = hoverIndex === idx;

            return (
              <g
                key={d.dateKey}
                onMouseEnter={() => setHoverIndex(idx)}
                onTouchStart={() => setHoverIndex(idx)}
                className="cursor-pointer"
              >
                {/* Touch hit area */}
                <rect
                  x={xPos - Math.max(16, plotW / chartData.length / 2)}
                  y={padT}
                  width={Math.max(32, plotW / chartData.length)}
                  height={plotH}
                  fill="transparent"
                />

                {/* X Axis Date Label */}
                {(idx === 0 ||
                  idx === chartData.length - 1 ||
                  (chartData.length > 4 && idx % Math.floor(chartData.length / 3) === 0)) && (
                  <text
                    x={xPos}
                    y={height - 12}
                    textAnchor="middle"
                    className="text-[10px] font-mono font-medium fill-current theme-text-muted"
                  >
                    {d.displayDate}
                  </text>
                )}

                {/* Vertical Cursor on hover */}
                {isHovered && (
                  <line
                    x1={xPos}
                    y1={padT}
                    x2={xPos}
                    y2={padT + plotH}
                    stroke="#33c6e4"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Information Floating Pill */}
        {activeHover && (
          <div className="mx-2 sm:mx-4 mt-2 mb-1 p-3 rounded-xl border theme-border theme-surface text-xs shadow-md space-y-1.5 transition-all animate-in fade-in">
            <div className="flex items-center justify-between border-b theme-border pb-1.5">
              <span className="font-bold text-[#155360] dark:text-[#33c6e4] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{activeHover.displayDate} ({activeHover.dateKey})</span>
              </span>
              {metric === "growth" && (
                <span className="font-mono font-bold theme-text-primary">
                  Market Value: ৳{formatBdt(activeHover.totalPortfolioVal, 2)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              {funds.map((f) => {
                const fKey = f.fundId || f.id;
                const dataObj = activeHover.fundValues[fKey];
                const color = fundColors.get(fKey) || "#33c6e4";

                return (
                  <div key={fKey} className="flex items-center justify-between gap-2 theme-elevated p-1.5 rounded-lg border theme-border">
                    <span className="font-medium theme-text-secondary truncate flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{f.shortName || f.name}</span>
                    </span>
                    <strong className="font-mono theme-text-primary shrink-0">
                      {metric === "nav" && `৳${(dataObj?.nav ?? f.effectiveNav ?? 10).toFixed(3)}`}
                      {metric === "return" && `${(dataObj?.returnPct ?? f.returnPct ?? 0).toFixed(2)}%`}
                      {metric === "growth" && `৳${formatBdt(dataObj?.marketVal ?? 0, 0)}`}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
