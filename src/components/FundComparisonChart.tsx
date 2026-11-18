"use client";

import React, { useState, useId, useRef } from "react";
import { FundValuationMetrics } from "@/lib/calculations";
import { PortfolioHistoryItem } from "./PortfolioHistoryChart";
import { BarChart3, LineChart, Calendar } from "lucide-react";

interface FundComparisonChartProps {
  funds: FundValuationMetrics[];
  history: PortfolioHistoryItem[];
}

type ChartMode = "bars" | "trajectory";
type TrajectoryMetric = "marketValue" | "unitNav" | "returnPct";

const FUND_STYLES: Record<
  string,
  {
    color: string;
    shortLabel: string;
  }
> = {
  "shanta-amanah": {
    color: "#059669", // High-contrast Emerald
    shortLabel: "Shanta Amanah",
  },
  "idlc-shariah": {
    color: "#0284c7", // High-contrast Sky Blue
    shortLabel: "IDLC Shariah",
  },
  "edge-alamin": {
    color: "#7c3aed", // High-contrast Violet
    shortLabel: "Edge Al-Amin",
  },
};

function formatBdt(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export default function FundComparisonChart({
  funds,
  history,
}: FundComparisonChartProps) {
  const svgTitleId = useId();
  const svgDescId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("bars");
  const [metric, setMetric] = useState<TrajectoryMetric>("marketValue");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!funds || funds.length === 0) return null;

  // Compute max values for grouped bar scaling
  const maxBarValue = Math.max(
    ...funds.flatMap((f) => [f.totalInvested, f.currentMarketValue]),
    1000,
  );
  const maxAbsReturn = Math.max(...funds.map((f) => Math.abs(f.returnPct)), 5);

  // Build multi-fund time-series points from history + each fund's units/invested
  const fundMap = new Map(funds.map((f) => [f.id, f]));
  const shantaFund = fundMap.get("shanta-amanah");
  const idlcFund = fundMap.get("idlc-shariah");
  const edgeFund = fundMap.get("edge-alamin");

  const seriesPoints = history.map((h) => {
    const sNav =
      h.shantaNav ??
      shantaFund?.effectiveNav ??
      shantaFund?.averageBuyPrice ??
      10;
    const iNav =
      h.idlcNav ?? idlcFund?.effectiveNav ?? idlcFund?.averageBuyPrice ?? 10;
    const eNav =
      h.edgeNav ?? edgeFund?.effectiveNav ?? edgeFund?.averageBuyPrice ?? 10;

    const sUnits = shantaFund?.totalUnitsHeld ?? 0;
    const iUnits = idlcFund?.totalUnitsHeld ?? 0;
    const eUnits = edgeFund?.totalUnitsHeld ?? 0;

    const sInv = shantaFund?.totalInvested ?? 0;
    const iInv = idlcFund?.totalInvested ?? 0;
    const eInv = edgeFund?.totalInvested ?? 0;

    const sVal = sUnits * sNav;
    const iVal = iUnits * iNav;
    const eVal = eUnits * eNav;

    const sRet = sInv > 0 ? ((sVal - sInv) / sInv) * 100 : 0;
    const iRet = iInv > 0 ? ((iVal - iInv) / iInv) * 100 : 0;
    const eRet = eInv > 0 ? ((eVal - eInv) / eInv) * 100 : 0;

    return {
      dateKey: h.dateKey,
      displayDate: h.displayDate,
      "shanta-amanah": {
        marketValue: sVal,
        unitNav: sNav,
        returnPct: sRet,
      },
      "idlc-shariah": {
        marketValue: iVal,
        unitNav: iNav,
        returnPct: iRet,
      },
      "edge-alamin": {
        marketValue: eVal,
        unitNav: eNav,
        returnPct: eRet,
      },
    };
  });

  // SVG dimensions for multi-line trajectory chart
  const width = 860;
  const height = 310;
  const padLeft = 74;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allTrajectoryVals = seriesPoints.flatMap((pt) => [
    pt["shanta-amanah"][metric],
    pt["idlc-shariah"][metric],
    pt["edge-alamin"][metric],
  ]);

  const rawMin =
    allTrajectoryVals.length > 0 ? Math.min(...allTrajectoryVals) : 0;
  const rawMax =
    allTrajectoryVals.length > 0 ? Math.max(...allTrajectoryVals) : 100;
  const spread = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.05, 0.25);
  const minVal = rawMin - spread * 0.2;
  const maxVal = rawMax + spread * 0.2;

  const getX = (idx: number) => {
    if (seriesPoints.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (seriesPoints.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return padTop + plotH - ratio * plotH;
  };

  const buildPath = (
    fundKey: "shanta-amanah" | "idlc-shariah" | "edge-alamin",
  ) =>
    seriesPoints
      .map((pt, i) => {
        const x = getX(i).toFixed(2);
        const y = getY(pt[fundKey][metric]).toFixed(2);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minVal + t * (maxVal - minVal);
    return { val, y: getY(val) };
  });

  const handleTouchScrub = (e: React.TouchEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || seriesPoints.length === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((touch.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (relX - padLeft) / (plotW || 1)));
    const idx = Math.round(ratio * (seriesPoints.length - 1));
    setHoverIdx(idx);
  };

  const activeIdx =
    hoverIdx !== null && hoverIdx < seriesPoints.length
      ? hoverIdx
      : Math.max(0, seriesPoints.length - 1);
  const activePt = seriesPoints[activeIdx];

  const formatMetricVal = (val: number) => {
    if (metric === "marketValue") return `৳${formatBdt(val, 2)}`;
    if (metric === "unitNav") return `৳${val.toFixed(2)}`;
    return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
  };

  return (
    <section
      aria-labelledby="comparison-chart-heading"
      className="theme-surface rounded-2xl border p-4 sm:p-6"
    >
      {/* Header & Mode Switcher */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3
              className="h-5 w-5 status-gain-text shrink-0"
              aria-hidden="true"
            />
            <h2
              id="comparison-chart-heading"
              className="section-title-fluid font-bold theme-text-primary"
            >
              3-Fund Investment Performance Comparison
            </h2>
          </div>
          <p className="text-xs sm:text-sm theme-text-secondary mt-0.5">
            Compare Invested Capital, Current Market Value, Return %, and
            Historical NAV Trajectory across Shanta, IDLC, and Edge
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setChartMode("bars")}
            className={`inline-flex justify-center min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition border ${
              chartMode === "bars"
                ? "btn-primary border-transparent shadow-sm"
                : "theme-elevated theme-text-secondary hover:opacity-90"
            }`}
          >
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Valuation &amp; Return Bars</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode("trajectory")}
            className={`inline-flex justify-center min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition border ${
              chartMode === "trajectory"
                ? "btn-primary border-transparent shadow-sm"
                : "theme-elevated theme-text-secondary hover:opacity-90"
            }`}
          >
            <LineChart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>3-Fund Trajectory</span>
          </button>
        </div>
      </div>

      {chartMode === "bars" ? (
        <div className="space-y-5">
          {/* 1. Grouped Comparison Bars: Invested vs. Current Market Value per Fund */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {funds.map((fund) => {
              const style =
                FUND_STYLES[fund.id] || FUND_STYLES["shanta-amanah"];
              const investedWidthPct = Math.min(
                100,
                Math.max(8, (fund.totalInvested / maxBarValue) * 100),
              );
              const marketWidthPct = Math.min(
                100,
                Math.max(8, (fund.currentMarketValue / maxBarValue) * 100),
              );
              const returnBarWidthPct = Math.min(
                100,
                Math.max(6, (Math.abs(fund.returnPct) / maxAbsReturn) * 100),
              );
              const isGain = fund.absoluteGainLoss >= 0;
              const navSpread = fund.effectiveNav - fund.averageBuyPrice;

              return (
                <div
                  key={fund.id}
                  className="theme-elevated rounded-xl border p-4 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3.5 w-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: style.color }}
                      />
                      <div>
                        <h3 className="text-sm font-bold theme-text-primary">
                          {fund.shortName || fund.name}
                        </h3>
                        <span className="text-xs theme-text-muted font-medium">
                          Weight: {fund.portfolioWeightPct.toFixed(2)}% of
                          portfolio
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                        isGain ? "status-gain-badge" : "status-loss-badge"
                      }`}
                    >
                      {isGain ? "▲ +" : "▼ "}
                      {fund.returnPct.toFixed(2)}%
                    </span>
                  </div>

                  {/* Bar 1: Total Invested */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="theme-text-secondary font-medium">
                        Invested Capital
                      </span>
                      <span className="font-mono font-bold theme-text-primary">
                        ৳{formatBdt(fund.totalInvested, 2)}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full theme-subtle-bg overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-500 transition-all duration-500"
                        style={{ width: `${investedWidthPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Bar 2: Current Market Value */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="theme-text-secondary font-medium">
                        Current Market Value
                      </span>
                      <span className="font-mono font-bold theme-text-primary">
                        ৳{formatBdt(fund.currentMarketValue, 2)}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full theme-subtle-bg overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${marketWidthPct}%`,
                          backgroundColor: style.color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Bar 3: Relative Return % Magnitude */}
                  <div className="space-y-1.5 pt-2 border-t theme-border">
                    <div className="flex justify-between text-xs">
                      <span className="theme-text-secondary font-medium">
                        Net Gain / Loss
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          isGain ? "status-gain-text" : "status-loss-text"
                        }`}
                      >
                        {isGain ? "+" : "-"}৳
                        {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full theme-subtle-bg overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${returnBarWidthPct}%`,
                          backgroundColor: isGain
                            ? "var(--gain-text)"
                            : "var(--loss-text)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Cost NAV vs Scraped NAV Spread Footer */}
                  <div className="flex items-center justify-between text-xs theme-text-secondary pt-1">
                    <span>
                      Cost NAV:{" "}
                      <strong className="font-mono font-bold theme-text-primary">
                        ৳{fund.averageBuyPrice.toFixed(2)}
                      </strong>
                    </span>
                    <span className="theme-text-muted">→</span>
                    <span>
                      Live NAV:{" "}
                      <strong className="font-mono font-bold theme-text-primary">
                        ৳{fund.effectiveNav.toFixed(2)}
                      </strong>{" "}
                      <span
                        className={`font-mono font-semibold ${
                          navSpread >= 0
                            ? "status-gain-text"
                            : "status-loss-text"
                        }`}
                      >
                        ({navSpread >= 0 ? "+" : ""}
                        {navSpread.toFixed(2)})
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Portfolio Allocation Stacked Distribution Bar */}
          <div className="theme-elevated rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs">
              <span className="font-bold theme-text-primary">
                Portfolio Market Value Allocation Share
              </span>
              <div className="flex flex-wrap items-center gap-4">
                {funds.map((f) => {
                  const style =
                    FUND_STYLES[f.id] || FUND_STYLES["shanta-amanah"];
                  return (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 theme-text-secondary font-medium"
                    >
                      <span
                        className="h-3 w-3 rounded-full inline-block"
                        style={{ backgroundColor: style.color }}
                      />
                      <span>{style.shortLabel}:</span>
                      <strong className="font-mono font-bold theme-text-primary">
                        {f.portfolioWeightPct.toFixed(2)}%
                      </strong>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full theme-subtle-bg">
              {funds.map((f) => {
                const style = FUND_STYLES[f.id] || FUND_STYLES["shanta-amanah"];
                return (
                  <div
                    key={f.id}
                    style={{
                      width: `${Math.max(0, f.portfolioWeightPct)}%`,
                      backgroundColor: style.color,
                    }}
                    title={`${f.name}: ${f.portfolioWeightPct.toFixed(2)}%`}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: 3-Fund Multi-Line Historical Trajectory Comparison */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Single-Row Metric Tabs */}
            <div
              role="tablist"
              aria-label="Comparison trajectory metric"
              className="app-tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={metric === "marketValue"}
                onClick={() => setMetric("marketValue")}
                className="app-tab text-xs"
              >
                Market Value (BDT)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={metric === "unitNav"}
                onClick={() => setMetric("unitNav")}
                className="app-tab text-xs"
              >
                Unit NAV (BDT)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={metric === "returnPct"}
                onClick={() => setMetric("returnPct")}
                className="app-tab text-xs"
              >
                Return (%)
              </button>
            </div>

            {/* Active Date Hover Readout for All 3 Funds */}
            {activePt && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border theme-border theme-elevated px-3.5 py-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold theme-text-primary">
                  <Calendar
                    className="h-3.5 w-3.5 status-info-text"
                    aria-hidden="true"
                  />
                  <span>{activePt.displayDate}</span>
                </span>
                {(
                  ["shanta-amanah", "idlc-shariah", "edge-alamin"] as const
                ).map((fid) => {
                  const st = FUND_STYLES[fid];
                  return (
                    <span
                      key={fid}
                      className="inline-flex items-center gap-1.5 font-mono"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full inline-block"
                        style={{ backgroundColor: st.color }}
                      />
                      <span className="theme-text-secondary font-medium">
                        {st.shortLabel}:
                      </span>
                      <strong className="theme-text-primary font-bold">
                        {formatMetricVal(activePt[fid][metric])}
                      </strong>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] theme-text-muted mb-1.5 sm:hidden px-0.5">
            <span>← Swipe horizontally to explore timeline →</span>
            <span className="font-mono">
              {seriesPoints.length} trading days
            </span>
          </div>

          <div className="w-full max-w-full overflow-x-auto touch-pan-x overscroll-contain pb-2 scrollbar-thin">
            <div className="min-w-[560px] sm:min-w-full">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-labelledby={`${svgTitleId} ${svgDescId}`}
                className="w-full h-auto select-none"
                onMouseLeave={() => setHoverIdx(null)}
                onTouchStart={handleTouchScrub}
                onTouchMove={handleTouchScrub}
              >
                <title id={svgTitleId}>
                  Multi-line historical comparison of Shanta Amanah, IDLC
                  Shariah, and Edge Al-Amin funds
                </title>
                <desc id={svgDescId}>
                  Compares {metric} across all 3 funds over{" "}
                  {seriesPoints.length} trading days.
                </desc>

                {/* Y-axis gridlines */}
                {yTicks.map((t, idx) => (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={t.y}
                      x2={width - padRight}
                      y2={t.y}
                      stroke="var(--chart-grid)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={t.y + 4}
                      textAnchor="end"
                      fill="var(--text-secondary)"
                      className="text-[11px] font-mono font-medium"
                    >
                      {metric === "returnPct"
                        ? `${t.val.toFixed(2)}%`
                        : metric === "unitNav"
                          ? `৳${t.val.toFixed(2)}`
                          : `৳${formatBdt(t.val, 0)}`}
                    </text>
                  </g>
                ))}

                {/* 3 Fund Lines */}
                {(
                  ["shanta-amanah", "idlc-shariah", "edge-alamin"] as const
                ).map((fid) => (
                  <path
                    key={fid}
                    d={buildPath(fid)}
                    fill="none"
                    stroke={FUND_STYLES[fid].color}
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {/* X-axis dates */}
                {seriesPoints.map((pt, i) => {
                  const step = Math.max(1, Math.ceil(seriesPoints.length / 6));
                  if (
                    i !== 0 &&
                    i !== seriesPoints.length - 1 &&
                    i % step !== 0
                  ) {
                    return null;
                  }
                  return (
                    <text
                      key={pt.dateKey}
                      x={getX(i)}
                      y={height - 12}
                      textAnchor="middle"
                      fill="var(--text-secondary)"
                      className="text-[11px] font-mono font-medium"
                    >
                      {pt.displayDate.replace(/\s+\d{4}$/, "")}
                    </text>
                  );
                })}

                {/* Active Vertical Crosshair & 3 Dots */}
                {activePt && (
                  <g>
                    <line
                      x1={getX(activeIdx)}
                      y1={padTop}
                      x2={getX(activeIdx)}
                      y2={padTop + plotH}
                      stroke="var(--border-strong)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    {(
                      ["shanta-amanah", "idlc-shariah", "edge-alamin"] as const
                    ).map((fid) => (
                      <circle
                        key={fid}
                        cx={getX(activeIdx)}
                        cy={getY(activePt[fid][metric])}
                        r="5.5"
                        fill={FUND_STYLES[fid].color}
                        stroke="var(--bg-surface)"
                        strokeWidth="2.5"
                      />
                    ))}
                  </g>
                )}

                {/* Hover Hit Columns */}
                {seriesPoints.map((pt, i) => {
                  const colW = plotW / Math.max(1, seriesPoints.length);
                  return (
                    <rect
                      key={pt.dateKey}
                      x={Math.max(padLeft, getX(i) - colW / 2)}
                      y={padTop}
                      width={colW}
                      height={plotH}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoverIdx(i)}
                      onClick={() => setHoverIdx(i)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
