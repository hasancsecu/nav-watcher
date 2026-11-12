"use client";

import React, { useState, useMemo, useId } from "react";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Percent,
  Coins,
  ChevronRight,
  Eye,
  EyeOff,
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

/**
 * Converts a sequence of points to a smooth cubic Bézier SVG path.
 */
function getCurvedPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    // Catmull-Rom to Cubic Bézier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function HistoricalInvestmentComparisonChart({
  funds,
  snapshots,
}: HistoricalComparisonChartProps) {
  const chartId = useId();
  const [metric, setMetric] = useState<ChartMetric>("nav");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hiddenFundIds, setHiddenFundIds] = useState<Set<string>>(new Set());

  // Assign a consistent distinct color to each user fund
  const fundColors = useMemo(() => {
    const map = new Map<string, string>();
    funds.forEach((f, idx) => {
      map.set(f.fundId || f.id, FUND_PALETTE[idx % FUND_PALETTE.length]);
    });
    return map;
  }, [funds]);

  const toggleFundVisibility = (fundKey: string) => {
    setHiddenFundIds((prev) => {
      const next = new Set(prev);
      if (next.has(fundKey)) {
        next.delete(fundKey);
      } else {
        // Keep at least one visible
        if (next.size < funds.length - 1) {
          next.add(fundKey);
        }
      }
      return next;
    });
  };

  // Aggregate unified historical time series data
  const chartData = useMemo(() => {
    if (!funds || funds.length === 0) return [];

    const dateMap = new Map<string, { displayDate: string; navs: Record<string, number> }>();

    // 1. Gather all unique dateKeys from snapshots
    snapshots.forEach((snap) => {
      if (!dateMap.has(snap.dateKey)) {
        dateMap.set(snap.dateKey, {
          displayDate: snap.displayDate || snap.dateKey,
          navs: {},
        });
      }
      dateMap.get(snap.dateKey)!.navs[snap.fundId] = snap.nav;
    });

    // 2. Add current date as latest point if not present
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayDisplay = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });

    if (!dateMap.has(todayKey)) {
      dateMap.set(todayKey, {
        displayDate: todayDisplay,
        navs: {},
      });
    }

    // Ensure all current fund NAVs exist on today's entry
    funds.forEach((f) => {
      dateMap.get(todayKey)!.navs[f.fundId || f.id] = f.effectiveNav;
    });

    // Sort date keys chronologically
    const sortedKeys = Array.from(dateMap.keys()).sort();

    // Cumulative investment progression per fund
    const fundCumulativeMap = new Map<
      string,
      { totalUnits: number; totalInvested: number; avgCost: number }
    >();
    funds.forEach((f) => {
      fundCumulativeMap.set(f.fundId || f.id, {
        totalUnits: 0,
        totalInvested: 0,
        avgCost: 10.0,
      });
    });

    // Build timeline points with simulated progression
    const timeline = sortedKeys.map((k) => {
      const entry = dateMap.get(k)!;

      let totalPortfolioVal = 0;
      let totalPortfolioInv = 0;
      const fundValues: Record<
        string,
        {
          nav: number;
          units: number;
          invested: number;
          marketVal: number;
          returnPct: number;
        }
      > = {};

      funds.forEach((f) => {
        const fKey = f.fundId || f.id;
        const nav = entry.navs[fKey] ?? f.effectiveNav ?? 10.0;
        const units = f.totalUnitsHeld;
        const invested = f.totalInvested;
        const marketVal = units > 0 ? units * nav : invested;
        const returnPct =
          invested > 0 ? ((marketVal - invested) / invested) * 100 : 0;

        fundValues[fKey] = {
          nav,
          units,
          invested,
          marketVal,
          returnPct,
        };

        totalPortfolioVal += marketVal;
        totalPortfolioInv += invested;
      });

      const totalReturn =
        totalPortfolioInv > 0
          ? ((totalPortfolioVal - totalPortfolioInv) / totalPortfolioInv) * 100
          : 0;

      return {
        dateKey: k,
        displayDate: entry.displayDate,
        fundValues,
        totalPortfolioVal,
        totalPortfolioInv,
        totalReturn,
      };
    });

    return timeline;
  }, [funds, snapshots]);

  // Chart Dimensions & Coordinate Geometry
  const width = 840;
  const height = 300;
  const padL = 56;
  const padR = 24;
  const padT = 24;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const baselineY = padT + plotH;

  // Extract values based on active metric
  let allMetricValues: number[] = [];
  if (metric === "nav") {
    chartData.forEach((d) => {
      funds.forEach((f) => {
        const fKey = f.fundId || f.id;
        if (!hiddenFundIds.has(fKey)) {
          const val = d.fundValues[fKey]?.nav;
          if (typeof val === "number" && !isNaN(val)) allMetricValues.push(val);
        }
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
        const fKey = f.fundId || f.id;
        if (!hiddenFundIds.has(fKey)) {
          const r = d.fundValues[fKey]?.returnPct;
          if (typeof r === "number" && !isNaN(r)) allMetricValues.push(r);
        }
      });
      allMetricValues.push(d.totalReturn);
    });
  }

  if (allMetricValues.length === 0) allMetricValues = [10];

  const rawMin = Math.min(...allMetricValues);
  const rawMax = Math.max(...allMetricValues);
  const spread = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.08, 1);
  const minVal =
    metric === "return"
      ? Math.floor(rawMin - 2)
      : Math.max(0, rawMin - spread * 0.12);
  const maxVal = rawMax + spread * 0.12;

  const getX = (idx: number) => {
    if (chartData.length <= 1) return padL + plotW / 2;
    return padL + (idx / (chartData.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return padT + plotH - ratio * plotH;
  };

  // Build smooth cubic Bézier SVG paths and glowing area fills
  const seriesPaths = useMemo(() => {
    if (metric === "growth") {
      const invPoints = chartData.map((d, i) => ({
        x: getX(i),
        y: getY(d.totalPortfolioInv),
      }));
      const valPoints = chartData.map((d, i) => ({
        x: getX(i),
        y: getY(d.totalPortfolioVal),
      }));

      const invCurve = getCurvedPath(invPoints);
      const valCurve = getCurvedPath(valPoints);

      // Area under market value curve down to baseline
      const lastX = valPoints[valPoints.length - 1]?.x ?? width - padR;
      const firstX = valPoints[0]?.x ?? padL;
      const areaD = `${valCurve} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;

      return [
        {
          key: "invested",
          name: "Total Invested Capital",
          color: "#94a3b8",
          dashed: true,
          curveD: invCurve,
          areaD: "",
          points: invPoints,
        },
        {
          key: "marketVal",
          name: "Portfolio Market Value",
          color: "#33c6e4",
          dashed: false,
          curveD: valCurve,
          areaD,
          points: valPoints,
        },
      ];
    }

    // NAV or Return % per fund
    return funds
      .filter((f) => !hiddenFundIds.has(f.fundId || f.id))
      .map((f) => {
        const fKey = f.fundId || f.id;
        const color = fundColors.get(fKey) || "#33c6e4";
        const points = chartData.map((d, i) => {
          const metricVal =
            metric === "nav"
              ? d.fundValues[fKey]?.nav ?? f.effectiveNav ?? 10
              : d.fundValues[fKey]?.returnPct ?? f.returnPct ?? 0;
          return {
            x: getX(i),
            y: getY(metricVal),
          };
        });

        const curveD = getCurvedPath(points);
        const lastX = points[points.length - 1]?.x ?? width - padR;
        const firstX = points[0]?.x ?? padL;
        const areaD = `${curveD} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;

        return {
          key: fKey,
          name: f.shortName || f.name,
          color,
          dashed: false,
          curveD,
          areaD,
          points,
        };
      });
  }, [metric, chartData, funds, fundColors, hiddenFundIds, minVal, maxVal]);

  const activeHover =
    hoverIndex !== null && chartData[hoverIndex] ? chartData[hoverIndex] : null;

  return (
    <section
      aria-labelledby="historical-chart-heading"
      className="theme-surface rounded-3xl border theme-border p-4 sm:p-6 shadow-sm space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b theme-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3
              id="historical-chart-heading"
              className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary"
            >
              Historical Investment &amp; Performance
            </h3>
          </div>
          <p className="text-xs theme-text-secondary mt-1">
            Smooth multi-fund trajectory across official AMC NAV updates and SIP purchases
          </p>
        </div>

        {/* Metric Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border theme-border self-start lg:self-auto overflow-x-auto scrollbar-thin">
          {[
            { key: "nav", label: "NAV Price (৳)" },
            { key: "growth", label: "Portfolio Value" },
            { key: "return", label: "Return Rate (%)" },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMetric(m.key as ChartMetric);
                setHoverIndex(null);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap min-h-[34px] ${
                metric === m.key
                  ? "bg-[#33c6e4] text-slate-950 shadow-sm"
                  : "theme-text-secondary hover:theme-text-primary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Interactive Legend with Visibility Toggles */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-bold theme-text-muted uppercase tracking-wider mr-1">
          Funds:
        </span>
        {metric === "growth" ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border theme-border theme-elevated">
              <span className="h-2.5 w-4 rounded-full bg-[#33c6e4]" />
              <span className="font-semibold text-xs theme-text-primary">
                Portfolio Market Value
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border theme-border theme-elevated">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400" />
              <span className="font-semibold text-xs theme-text-secondary">
                Total Invested Capital
              </span>
            </div>
          </>
        ) : (
          funds.map((f) => {
            const fKey = f.fundId || f.id;
            const isHidden = hiddenFundIds.has(fKey);
            const color = fundColors.get(fKey) || "#33c6e4";
            return (
              <button
                key={fKey}
                type="button"
                onClick={() => toggleFundVisibility(fKey)}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold transition ${
                  isHidden
                    ? "opacity-40 border-dashed theme-border theme-text-muted hover:opacity-75"
                    : "theme-border theme-elevated theme-text-primary shadow-xs"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isHidden ? "#94a3b8" : color }}
                />
                <span className="truncate max-w-[150px] sm:max-w-[200px]">
                  {f.shortName || f.name}
                </span>
                {isHidden ? (
                  <EyeOff className="h-3 w-3 text-slate-400" />
                ) : (
                  <Eye className="h-3 w-3 text-[#33c6e4]" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* SVG Chart Graphic with Spline Curves & Gradient Glow */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50/70 to-slate-100/40 dark:from-slate-900/60 dark:to-slate-950/60 border theme-border pt-3 pb-2 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[340px] select-none touch-pan-x"
          onMouseLeave={() => setHoverIndex(null)}
          onTouchEnd={() => setHoverIndex(null)}
        >
          <defs>
            {/* Luminous Glow Filter */}
            <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Area Gradients for each series */}
            {seriesPaths.map((series) => (
              <linearGradient
                key={`grad-${series.key}`}
                id={`${chartId}-grad-${series.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={series.color} stopOpacity="0.25" />
                <stop offset="80%" stopColor={series.color} stopOpacity="0.04" />
                <stop offset="100%" stopColor={series.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Subtle Horizontal Grid lines & Y-Axis Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const yPos = padT + plotH * pct;
            const gridVal = maxVal - pct * (maxVal - minVal);
            return (
              <g key={i} opacity="0.4">
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
                  x={padL - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  className="text-[10px] font-mono font-medium fill-current theme-text-muted"
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

          {/* 1. Luminous Area Fills Under Curves */}
          {seriesPaths.map(
            (series) =>
              series.areaD && (
                <path
                  key={`area-${series.key}`}
                  d={series.areaD}
                  fill={`url(#${chartId}-grad-${series.key})`}
                />
              )
          )}

          {/* 2. Smooth Cubic Bézier Spline Traces */}
          {seriesPaths.map((series) => (
            <path
              key={`stroke-${series.key}`}
              d={series.curveD}
              fill="none"
              stroke={series.color}
              strokeWidth={series.dashed ? "2" : "3"}
              strokeDasharray={series.dashed ? "6 6" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={series.dashed ? undefined : `url(#${chartId}-glow)`}
            />
          ))}

          {/* 3. Interactive Nodes & Crosshair Triggers */}
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
                {/* Touch Hit Area */}
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
                  (chartData.length > 5 &&
                    idx % Math.floor(chartData.length / 4) === 0)) && (
                  <text
                    x={xPos}
                    y={height - 14}
                    textAnchor="middle"
                    className="text-[10px] font-mono font-bold fill-current theme-text-muted"
                  >
                    {d.displayDate}
                  </text>
                )}

                {/* Glowing Vertical Cursor on hover */}
                {isHovered && (
                  <>
                    <line
                      x1={xPos}
                      y1={padT}
                      x2={xPos}
                      y2={baselineY}
                      stroke="#33c6e4"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />

                    {/* Circular Glowing Anchor Dots on each curve */}
                    {seriesPaths.map((s) => {
                      const pt = s.points[idx];
                      if (!pt) return null;
                      return (
                        <g key={`dot-${s.key}`}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="6"
                            fill={s.color}
                            opacity="0.35"
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="3.5"
                            fill="#ffffff"
                            stroke={s.color}
                            strokeWidth="2"
                          />
                        </g>
                      );
                    })}
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Information Floating Glass Card */}
        {activeHover && (
          <div className="mx-2 sm:mx-4 mt-3 mb-1 p-3.5 rounded-2xl border theme-border theme-elevated text-xs shadow-lg space-y-2.5 transition-all">
            <div className="flex items-center justify-between border-b theme-border pb-2">
              <span className="font-extrabold text-[#155360] dark:text-[#33c6e4] flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {activeHover.displayDate} ({activeHover.dateKey})
                </span>
              </span>
              {metric === "growth" && (
                <span className="font-mono font-bold text-xs theme-text-primary">
                  Market Value: ৳{formatBdt(activeHover.totalPortfolioVal, 2)}
                </span>
              )}
              {metric === "return" && (
                <span className="font-mono font-bold text-xs status-gain-text">
                  Portfolio Return: +{activeHover.totalReturn.toFixed(2)}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {funds
                .filter((f) => !hiddenFundIds.has(f.fundId || f.id))
                .map((f) => {
                  const fKey = f.fundId || f.id;
                  const dataObj = activeHover.fundValues[fKey];
                  const color = fundColors.get(fKey) || "#33c6e4";

                  return (
                    <div
                      key={fKey}
                      className="flex items-center justify-between gap-3 theme-surface p-2 rounded-xl border theme-border"
                    >
                      <span className="font-semibold theme-text-secondary truncate flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{f.shortName || f.name}</span>
                      </span>
                      <strong className="font-mono theme-text-primary shrink-0 text-right">
                        {metric === "nav" &&
                          `৳${(dataObj?.nav ?? f.effectiveNav ?? 10).toFixed(3)}`}
                        {metric === "return" &&
                          `${(dataObj?.returnPct ?? f.returnPct ?? 0).toFixed(2)}%`}
                        {metric === "growth" &&
                          `৳${formatBdt(dataObj?.marketVal ?? 0, 0)}`}
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
