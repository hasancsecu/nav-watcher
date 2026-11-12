"use client";

import React, { useState, useMemo, useRef, useId } from "react";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  MoveHorizontal,
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
  // For mobile readability, we use a wide viewBox width so data points are generously spaced
  const width = Math.max(860, chartData.length * 36);
  const height = 300;
  const padL = 58;
  const padR = 30;
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
  }, [metric, chartData, funds, fundColors, hiddenFundIds, minVal, maxVal, width, baselineY]);

  const activeHover =
    hoverIndex !== null && chartData[hoverIndex] ? chartData[hoverIndex] : null;

  // Handle pointer / touch movement to track nearest date node
  const handlePointerMove = (clientX: number) => {
    if (!svgRef.current || chartData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const scale = width / rect.width;
    const svgX = relativeX * scale;

    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < chartData.length; i++) {
      const x = getX(i);
      const diff = Math.abs(x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  };

  const activeXPos = hoverIndex !== null ? getX(hoverIndex) : 0;
  const pctX = (activeXPos / width) * 100;

  return (
    <section
      aria-labelledby="historical-chart-heading"
      className="theme-surface rounded-3xl border theme-border p-3.5 sm:p-6 shadow-sm space-y-4"
    >
      {/* 1. Header & Fully Responsive Segmented Metric Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3
              id="historical-chart-heading"
              className="text-sm sm:text-base font-extrabold tracking-tight theme-text-primary"
            >
              Historical Investment &amp; Performance
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs theme-text-secondary mt-0.5">
            Multi-fund historical trajectory across official AMC NAV updates
          </p>
        </div>

        {/* 100% Mobile Responsive Metric Segmented Bar */}
        <div className="w-full sm:w-auto grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border theme-border">
          {[
            { key: "nav", label: "NAV Price" },
            { key: "growth", label: "Portfolio Value" },
            { key: "return", label: "Return Rate" },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMetric(m.key as ChartMetric);
                setHoverIndex(null);
              }}
              className={`py-1.5 px-2 text-center text-xs font-bold rounded-lg transition truncate ${
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

      {/* 2. Interactive Fund Legend with Toggle Eyes */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[10px] sm:text-[11px] font-bold theme-text-muted uppercase tracking-wider mr-1">
          Funds:
        </span>
        {metric === "growth" ? (
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border theme-border theme-elevated">
              <span className="h-2 w-3.5 rounded-full bg-[#33c6e4]" />
              <span className="font-semibold text-[11px] theme-text-primary">
                Portfolio Market Value
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border theme-border theme-elevated">
              <span className="h-0.5 w-3.5 border-t-2 border-dashed border-slate-400" />
              <span className="font-semibold text-[11px] theme-text-secondary">
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition ${
                  isHidden
                    ? "opacity-40 border-dashed theme-border theme-text-muted hover:opacity-75"
                    : "theme-border theme-elevated theme-text-primary shadow-xs"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: isHidden ? "#94a3b8" : color }}
                />
                <span className="truncate max-w-[130px] sm:max-w-[200px]">
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

      {/* Mobile Scroll Indicator */}
      <div className="flex items-center justify-between text-[11px] theme-text-muted sm:hidden px-1">
        <span className="flex items-center gap-1 font-medium">
          <MoveHorizontal className="h-3.5 w-3.5 text-[#33c6e4]" />
          <span>Swipe chart horizontally to inspect history</span>
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {chartData.length} entries
        </span>
      </div>

      {/* 3. Horizontally Scrollable Chart Graphic Container on Mobile */}
      <div
        ref={scrollContainerRef}
        className="relative w-full overflow-x-auto scrollbar-thin rounded-2xl bg-gradient-to-b from-slate-50/70 to-slate-100/40 dark:from-slate-900/60 dark:to-slate-950/60 border theme-border pt-3 pb-3 shadow-inner touch-pan-x"
      >
        <div
          className="relative min-w-[720px] sm:min-w-full w-full"
          style={{ width: `${width}px`, maxWidth: "100%" }}
        >
          {/* Floating Tooltip positioned directly above active crosshair */}
          {activeHover && (
            <div
              className="absolute z-30 pointer-events-none transition-all duration-75"
              style={{
                left: `${pctX}%`,
                top: "12px",
                transform:
                  pctX > 75
                    ? "translateX(-88%)"
                    : pctX < 25
                    ? "translateX(-12%)"
                    : "translateX(-50%)",
              }}
            >
              <div className="bg-slate-950/95 dark:bg-[#070b14]/95 text-white backdrop-blur-md rounded-xl p-2.5 shadow-2xl border border-[#33c6e4]/30 min-w-[190px] max-w-[260px] text-xs space-y-1.5 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[11px] font-bold text-[#33c6e4]">
                  <span>{activeHover.displayDate}</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {activeHover.dateKey}
                  </span>
                </div>

                {metric === "growth" ? (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">Market Value:</span>
                      <strong className="font-mono text-[#33c6e4]">
                        ৳{formatBdt(activeHover.totalPortfolioVal, 2)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Total Invested:</span>
                      <span className="font-mono text-slate-300">
                        ৳{formatBdt(activeHover.totalPortfolioInv, 2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-800">
                      <span className="text-slate-400">Net Gain:</span>
                      <span
                        className={`font-mono font-bold ${
                          activeHover.totalReturn >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {activeHover.totalReturn >= 0 ? "+" : ""}
                        {activeHover.totalReturn.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    {funds
                      .filter((f) => !hiddenFundIds.has(f.fundId || f.id))
                      .map((f) => {
                        const fKey = f.fundId || f.id;
                        const dataObj = activeHover.fundValues[fKey];
                        const color = fundColors.get(fKey) || "#33c6e4";
                        return (
                          <div
                            key={fKey}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-slate-300 truncate flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="truncate">{f.shortName || f.name}</span>
                            </span>
                            <strong className="font-mono text-white shrink-0 text-right">
                              {metric === "nav" &&
                                `৳${(
                                  dataObj?.nav ??
                                  f.effectiveNav ??
                                  10
                                ).toFixed(3)}`}
                              {metric === "return" &&
                                `${(
                                  dataObj?.returnPct ??
                                  f.returnPct ??
                                  0
                                ).toFixed(2)}%`}
                            </strong>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto max-h-[340px] select-none cursor-crosshair"
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
            }}
            onMouseLeave={() => setHoverIndex(null)}
            onTouchEnd={() => setHoverIndex(null)}
          >
            <defs>
              {/* Luminous Glow Filter */}
              <filter
                id={`${chartId}-glow`}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
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
                  <stop
                    offset="80%"
                    stopColor={series.color}
                    stopOpacity="0.04"
                  />
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
                >
                  {/* Touch / Mouse Hit Area */}
                  <rect
                    x={xPos - Math.max(16, plotW / chartData.length / 2)}
                    y={padT}
                    width={Math.max(32, plotW / chartData.length)}
                    height={plotH}
                    fill="transparent"
                  />

                  {/* X Axis Date Label (nicely spaced) */}
                  {(idx === 0 ||
                    idx === chartData.length - 1 ||
                    idx % Math.max(1, Math.floor(chartData.length / 7)) ===
                      0) && (
                    <text
                      x={xPos}
                      y={height - 14}
                      textAnchor="middle"
                      className={`text-[10px] font-mono fill-current transition ${
                        isHovered
                          ? "font-black text-[#155360] dark:text-[#33c6e4]"
                          : "font-semibold theme-text-muted"
                      }`}
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
                              strokeWidth="2.5"
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
        </div>
      </div>
    </section>
  );
}
