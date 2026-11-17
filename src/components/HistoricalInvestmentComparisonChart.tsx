"use client";

import React, { useState, useMemo, useRef, useId } from "react";
import {
  TrendingUp,
  Eye,
  EyeOff,
  MoveHorizontal,
  Calendar,
  Sparkles,
  Award,
  Maximize2,
  Pin,
  X,
  Target,
  Clock,
  Layers,
  Coins,
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
  cashRemainder?: number;
  type: string;
  notes?: string | null;
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
type TimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

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

  // ---------------------------------------------------------------------------
  // 1. Interactive Controls State
  // ---------------------------------------------------------------------------
  const [metric, setMetric] = useState<ChartMetric>("nav");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [hiddenFundIds, setHiddenFundIds] = useState<Set<string>>(new Set());
  const [focusedFundId, setFocusedFundId] = useState<string | null>(null);
  const [showMilestones, setShowMilestones] = useState<boolean>(true);
  const [activeMilestone, setActiveMilestone] = useState<{
    dateKey: string;
    fundName: string;
    type: string;
    amount: number;
    units: number;
    nav: number;
  } | null>(null);

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
        if (next.size < funds.length - 1) {
          next.add(fundKey);
        }
      }
      return next;
    });
  };

  const handleFundSoloToggle = (fundKey: string) => {
    setFocusedFundId((prev) => (prev === fundKey ? null : fundKey));
  };

  // ---------------------------------------------------------------------------
  // 2. Timeline Aggregation with Cumulative Holdings & Investment Events
  // ---------------------------------------------------------------------------
  const fullTimeline = useMemo(() => {
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
    const todayDisplay = today.toLocaleDateString("en-BD", {
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

    // Collect all logged investment events across funds
    const milestoneEventsByDate = new Map<
      string,
      Array<{
        fundId: string;
        fundName: string;
        type: string;
        amount: number;
        units: number;
        nav: number;
      }>
    >();

    funds.forEach((f) => {
      const invs = f.investments || [];
      invs.forEach((inv) => {
        const invDateObj = new Date(inv.investmentDate);
        if (!isNaN(invDateObj.getTime())) {
          const invKey = `${invDateObj.getFullYear()}-${String(invDateObj.getMonth() + 1).padStart(2, "0")}-${String(invDateObj.getDate()).padStart(2, "0")}`;
          if (!milestoneEventsByDate.has(invKey)) {
            milestoneEventsByDate.set(invKey, []);
          }
          milestoneEventsByDate.get(invKey)!.push({
            fundId: f.fundId || f.id,
            fundName: f.shortName || f.name,
            type: inv.type || "SIP",
            amount: inv.cashInvested,
            units: inv.unitsAllotted,
            nav: inv.executionNav,
          });
        }
      });
    });

    // Build timeline points with exact cumulative progression
    const timeline = sortedKeys.map((k) => {
      const entry = dateMap.get(k)!;
      const kDate = new Date(k);

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

        // Calculate cumulative units and invested up to this date
        const invs = f.investments || [];
        let cumUnits = 0;
        let cumInvested = 0;

        invs.forEach((inv) => {
          const invD = new Date(inv.investmentDate);
          if (invD <= kDate) {
            cumUnits += inv.unitsAllotted;
            cumInvested += inv.unitsCost || inv.cashInvested;
          }
        });

        // If no prior investments or tracking all holdings
        const units = cumUnits > 0 ? cumUnits : f.totalUnitsHeld;
        const invested = cumInvested > 0 ? cumInvested : f.totalInvested;
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

      const milestones = milestoneEventsByDate.get(k) || [];

      return {
        dateKey: k,
        displayDate: entry.displayDate,
        fundValues,
        totalPortfolioVal,
        totalPortfolioInv,
        totalReturn,
        milestones,
      };
    });

    return timeline;
  }, [funds, snapshots]);

  // ---------------------------------------------------------------------------
  // 3. Filter Timeline based on Active Time Range
  // ---------------------------------------------------------------------------
  const chartData = useMemo(() => {
    if (fullTimeline.length <= 2 || timeRange === "ALL") {
      return fullTimeline;
    }

    const latestDateKey = fullTimeline[fullTimeline.length - 1].dateKey;
    const latestDate = new Date(latestDateKey);

    let daysToSubtract = 30;
    if (timeRange === "1M") daysToSubtract = 30;
    else if (timeRange === "3M") daysToSubtract = 90;
    else if (timeRange === "6M") daysToSubtract = 180;
    else if (timeRange === "1Y") daysToSubtract = 365;

    const cutoffDate = new Date(latestDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);

    const filtered = fullTimeline.filter((d) => new Date(d.dateKey) >= cutoffDate);
    return filtered.length >= 2 ? filtered : fullTimeline.slice(-5);
  }, [fullTimeline, timeRange]);

  // ---------------------------------------------------------------------------
  // 4. Chart Geometry & Coordinate Mapping
  // ---------------------------------------------------------------------------
  const width = Math.max(860, chartData.length * 38);
  const height = 310;
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

  // Build series paths
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
          isDimmed: false,
        },
        {
          key: "marketVal",
          name: "Portfolio Market Value",
          color: "#33c6e4",
          dashed: false,
          curveD: valCurve,
          areaD,
          points: valPoints,
          isDimmed: false,
        },
      ];
    }

    // NAV or Return % per fund
    return funds
      .filter((f) => !hiddenFundIds.has(f.fundId || f.id))
      .map((f) => {
        const fKey = f.fundId || f.id;
        const color = fundColors.get(fKey) || "#33c6e4";
        const isDimmed = focusedFundId !== null && focusedFundId !== fKey;

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
          isDimmed,
        };
      });
  }, [
    metric,
    chartData,
    funds,
    fundColors,
    hiddenFundIds,
    focusedFundId,
    minVal,
    maxVal,
    width,
    baselineY,
  ]);

  // Determine active inspect node (pinned node takes precedence over hover)
  const activeInspectIndex = pinnedIndex !== null ? pinnedIndex : hoverIndex;
  const activeInspect =
    activeInspectIndex !== null && chartData[activeInspectIndex]
      ? chartData[activeInspectIndex]
      : null;

  // Handle pointer / touch movement to track nearest date node
  const handlePointerMove = (clientX: number) => {
    if (!svgRef.current || chartData.length === 0 || pinnedIndex !== null) return;
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

  // Click/tap to pin or unpin
  const handleSvgClick = (clientX: number) => {
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

    if (pinnedIndex === closestIdx) {
      setPinnedIndex(null);
    } else {
      setPinnedIndex(closestIdx);
    }
  };

  const activeXPos = activeInspectIndex !== null ? getX(activeInspectIndex) : 0;
  const pctX = (activeXPos / width) * 100;

  // ---------------------------------------------------------------------------
  // 5. Dynamic Period Summary Metrics
  // ---------------------------------------------------------------------------
  const periodStats = useMemo(() => {
    if (chartData.length === 0) return null;
    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];

    let startVal = 0;
    let endVal = 0;

    if (metric === "growth") {
      startVal = firstPoint.totalPortfolioVal;
      endVal = lastPoint.totalPortfolioVal;
    } else {
      let fCount = 0;
      funds.forEach((f) => {
        const fKey = f.fundId || f.id;
        if (!hiddenFundIds.has(fKey)) {
          startVal += firstPoint.fundValues[fKey]?.nav ?? f.effectiveNav ?? 10;
          endVal += lastPoint.fundValues[fKey]?.nav ?? f.effectiveNav ?? 10;
          fCount++;
        }
      });
      if (fCount > 0) {
        startVal /= fCount;
        endVal /= fCount;
      }
    }

    const netChange = endVal - startVal;
    const pctChange = startVal > 0 ? (netChange / startVal) * 100 : 0;

    return {
      startDate: firstPoint.displayDate,
      endDate: lastPoint.displayDate,
      startVal,
      endVal,
      netChange,
      pctChange,
      highVal: rawMax,
      lowVal: rawMin,
    };
  }, [chartData, metric, funds, hiddenFundIds, rawMax, rawMin]);

  return (
    <section
      aria-labelledby="historical-chart-heading"
      className="theme-surface rounded-2xl sm:rounded-3xl border theme-border p-3.5 sm:p-6 shadow-sm space-y-4"
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. Header & Metric Controls                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-3 border-b theme-border pb-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3
                id="historical-chart-heading"
                className="text-sm sm:text-base font-extrabold tracking-tight theme-text-primary"
              >
                Interactive Investment &amp; NAV Trajectory
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs theme-text-secondary mt-0.5">
              Scrub, zoom time horizons, and inspect official AMC NAVs alongside logged investment buys.
            </p>
          </div>

          {/* Metric Selector Bar */}
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
                  setPinnedIndex(null);
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

        {/* Dynamic Period Horizon Filter & Investment Buys Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          {/* Time Range Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider mr-1">
              Period:
            </span>
            {(["1M", "3M", "6M", "1Y", "ALL"] as TimeRange[]).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => {
                  setTimeRange(tr);
                  setPinnedIndex(null);
                  setHoverIndex(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition min-h-[30px] ${
                  timeRange === tr
                    ? "bg-[#33c6e4] text-slate-950 shadow-xs font-black"
                    : "theme-surface theme-border border text-slate-500 hover:theme-text-primary"
                }`}
              >
                {tr}
              </button>
            ))}
          </div>

          {/* Show Buys Toggle */}
          <button
            type="button"
            onClick={() => setShowMilestones((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
              showMilestones
                ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400"
                : "theme-surface theme-border text-slate-400"
            }`}
            title="Toggle historical investment buy points on the chart"
          >
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span>Show Buys ({funds.reduce((acc, f) => acc + (f.investments?.length || 0), 0)})</span>
          </button>
        </div>

        {/* Dynamic Range Statistics Summary Strip */}
        {periodStats && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t theme-border text-[11px] font-mono">
            <span className="text-slate-500 dark:text-slate-400">
              {periodStats.startDate} → {periodStats.endDate}
            </span>
            <div className="flex items-center gap-3">
              <span>
                Range:{" "}
                <strong className="theme-text-primary font-bold">
                  {metric === "growth" ? `৳${formatBdt(periodStats.lowVal, 0)}` : `৳${periodStats.lowVal.toFixed(2)}`}
                </strong>{" "}
                –{" "}
                <strong className="theme-text-primary font-bold">
                  {metric === "growth" ? `৳${formatBdt(periodStats.highVal, 0)}` : `৳${periodStats.highVal.toFixed(2)}`}
                </strong>
              </span>
              <span>·</span>
              <span>
                Change:{" "}
                <strong
                  className={
                    periodStats.pctChange >= 0
                      ? "status-gain-text font-bold"
                      : "status-loss-text font-bold"
                  }
                >
                  {periodStats.pctChange >= 0 ? "+" : ""}
                  {periodStats.pctChange.toFixed(2)}%
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Interactive Fund Legend with Solo & Visibility             */}
      {/* ------------------------------------------------------------- */}
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
            const isSolo = focusedFundId === fKey;
            const color = fundColors.get(fKey) || "#33c6e4";
            return (
              <div
                key={fKey}
                className={`inline-flex items-center rounded-full border text-[11px] font-semibold transition ${
                  isHidden
                    ? "opacity-40 border-dashed theme-border theme-text-muted"
                    : isSolo
                    ? "ring-2 ring-[#33c6e4] border-[#33c6e4] bg-[#33c6e4]/10 theme-text-primary"
                    : "theme-border theme-elevated theme-text-primary shadow-xs"
                }`}
              >
                {/* Clicking name solos/focuses this fund */}
                <button
                  type="button"
                  onClick={() => handleFundSoloToggle(fKey)}
                  className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-1.5"
                  title="Click to solo / focus this fund's line"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: isHidden ? "#94a3b8" : color }}
                  />
                  <span className="truncate max-w-[120px] sm:max-w-[180px]">
                    {f.shortName || f.name}
                  </span>
                </button>

                {/* Visibility Eye button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFundVisibility(fKey);
                  }}
                  className="py-1 pr-2 pl-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={isHidden ? "Show fund" : "Hide fund"}
                >
                  {isHidden ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3 text-[#33c6e4]" />
                  )}
                </button>
              </div>
            );
          })
        )}

        {focusedFundId && (
          <button
            type="button"
            onClick={() => setFocusedFundId(null)}
            className="text-[10px] font-bold text-[#33c6e4] hover:underline ml-1"
          >
            Show All Funds
          </button>
        )}
      </div>

      {/* Mobile Scroll & Pin Hint */}
      <div className="flex items-center justify-between text-[11px] theme-text-muted px-1">
        <span className="flex items-center gap-1 font-medium">
          <MoveHorizontal className="h-3.5 w-3.5 text-[#33c6e4]" />
          <span>Swipe horizontally. Tap anywhere to pin inspection.</span>
        </span>
        {pinnedIndex !== null && (
          <button
            type="button"
            onClick={() => setPinnedIndex(null)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-600"
          >
            <Pin className="h-3 w-3" /> Pinned (Click to Unpin)
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Horizontally Scrollable Chart Graphic                      */}
      {/* ------------------------------------------------------------- */}
      <div
        ref={scrollContainerRef}
        className="relative w-full overflow-x-auto scrollbar-thin rounded-2xl bg-gradient-to-b from-slate-50/70 to-slate-100/40 dark:from-slate-900/60 dark:to-slate-950/60 border theme-border pt-3 pb-3 shadow-inner touch-pan-x"
      >
        <div
          className="relative min-w-[720px] sm:min-w-full w-full"
          style={{ width: `${width}px`, maxWidth: "100%" }}
        >
          {/* Floating / Pinned Inspection Tooltip */}
          {activeInspect && (
            <div
              className="absolute z-30 pointer-events-none transition-all duration-75"
              style={{
                left: `${pctX}%`,
                top: "10px",
                transform:
                  pctX > 75
                    ? "translateX(-90%)"
                    : pctX < 25
                    ? "translateX(-10%)"
                    : "translateX(-50%)",
              }}
            >
              <div className="bg-slate-950/95 dark:bg-[#070b14]/95 text-white backdrop-blur-md rounded-xl p-2.5 shadow-2xl border border-[#33c6e4]/40 min-w-[200px] max-w-[270px] text-xs space-y-1.5 animate-in fade-in zoom-in-95 pointer-events-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[11px] font-bold text-[#33c6e4]">
                  <span>{activeInspect.displayDate}</span>
                  <div className="flex items-center gap-1.5">
                    {pinnedIndex !== null && (
                      <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-black text-amber-400">
                        PINNED
                      </span>
                    )}
                    <span className="text-slate-400 font-mono text-[10px]">
                      {activeInspect.dateKey}
                    </span>
                  </div>
                </div>

                {/* Milestone events at this date (if any) */}
                {activeInspect.milestones && activeInspect.milestones.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-1.5 space-y-1 text-[10px]">
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <Coins className="h-3 w-3" />
                      <span>Investment Recorded on this Date:</span>
                    </div>
                    {activeInspect.milestones.map((m, mi) => (
                      <div key={mi} className="text-slate-200 font-mono">
                        <strong className="text-white">{m.type}</strong>: ৳{formatBdt(m.amount, 0)} → +{m.units} units @ ৳{m.nav.toFixed(3)}
                      </div>
                    ))}
                  </div>
                )}

                {metric === "growth" ? (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">Market Value:</span>
                      <strong className="font-mono text-[#33c6e4]">
                        ৳{formatBdt(activeInspect.totalPortfolioVal, 2)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Total Invested:</span>
                      <span className="font-mono text-slate-300">
                        ৳{formatBdt(activeInspect.totalPortfolioInv, 2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-800">
                      <span className="text-slate-400">Net Gain:</span>
                      <span
                        className={`font-mono font-bold ${
                          activeInspect.totalReturn >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {activeInspect.totalReturn >= 0 ? "+" : ""}
                        {activeInspect.totalReturn.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    {funds
                      .filter((f) => !hiddenFundIds.has(f.fundId || f.id))
                      .map((f) => {
                        const fKey = f.fundId || f.id;
                        const dataObj = activeInspect.fundValues[fKey];
                        const color = fundColors.get(fKey) || "#33c6e4";
                        const isDimmed = focusedFundId !== null && focusedFundId !== fKey;

                        return (
                          <div
                            key={fKey}
                            className={`flex items-center justify-between gap-2 transition ${
                              isDimmed ? "opacity-30" : "opacity-100"
                            }`}
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
            onClick={(e) => handleSvgClick(e.clientX)}
            onMouseLeave={() => {
              if (pinnedIndex === null) setHoverIndex(null);
            }}
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

            {/* Render Series Areas & Curves */}
            {seriesPaths.map((series) => {
              const opacity = series.isDimmed ? 0.15 : 1;
              const strokeWidth = series.isDimmed ? 1.5 : focusedFundId === series.key ? 3.5 : 2.5;

              return (
                <g key={series.key} opacity={opacity} className="transition-opacity duration-200">
                  {series.areaD && (
                    <path
                      d={series.areaD}
                      fill={`url(#${chartId}-grad-${series.key})`}
                      className="pointer-events-none"
                    />
                  )}
                  <path
                    d={series.curveD}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={series.dashed ? "5 5" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={focusedFundId === series.key ? `url(#${chartId}-glow)` : undefined}
                  />
                </g>
              );
            })}

            {/* Investment Milestone Buy Markers (if enabled) */}
            {showMilestones &&
              chartData.map((d, i) => {
                if (!d.milestones || d.milestones.length === 0) return null;
                const xPos = getX(i);
                return (
                  <g key={`milestone-${i}`} className="cursor-pointer">
                    <line
                      x1={xPos}
                      y1={padT}
                      x2={xPos}
                      y2={baselineY}
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.6"
                    />
                    <polygon
                      points={`${xPos},${padT - 6} ${xPos + 5},${padT} ${xPos},${padT + 6} ${xPos - 5},${padT}`}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="transition-transform hover:scale-125"
                    />
                  </g>
                );
              })}

            {/* Active Crosshair Guideline & Node Highlights */}
            {activeInspectIndex !== null && (
              <g className="pointer-events-none">
                <line
                  x1={activeXPos}
                  y1={padT}
                  x2={activeXPos}
                  y2={baselineY}
                  stroke={pinnedIndex !== null ? "#f59e0b" : "#33c6e4"}
                  strokeWidth={pinnedIndex !== null ? 2 : 1.5}
                  strokeDasharray="3 3"
                />

                {/* Highlight circles on each series intersection */}
                {seriesPaths.map((series) => {
                  if (series.isDimmed) return null;
                  const pt = series.points[activeInspectIndex];
                  if (!pt) return null;
                  return (
                    <g key={`node-${series.key}`}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="6"
                        fill={series.color}
                        opacity="0.3"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill={series.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* X-Axis Date Ticks */}
            {chartData.map((d, i) => {
              // Choose a step so tick labels don't collide
              const step = Math.max(1, Math.floor(chartData.length / 8));
              const isFirst = i === 0;
              const isLast = i === chartData.length - 1;
              const isEveryN = i % step === 0;

              if (!isFirst && !isLast && !isEveryN) return null;

              const xPos = getX(i);
              return (
                <text
                  key={`date-${i}`}
                  x={xPos}
                  y={height - 12}
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-current theme-text-muted select-none"
                >
                  {d.displayDate}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
