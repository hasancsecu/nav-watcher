"use client";

import React, { useState, useId, useRef } from "react";
import { TrendingUp, Calendar } from "lucide-react";

export interface PortfolioHistoryItem {
  id: string;
  dateKey: string;
  displayDate: string;
  totalInvested: number;
  currentMarketValue: number;
  absoluteGainLoss: number;
  returnPct: number;
  shantaNav: number | null;
  idlcNav: number | null;
  edgeNav: number | null;
}

interface PortfolioHistoryChartProps {
  history: PortfolioHistoryItem[];
}

function formatBdt(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export default function PortfolioHistoryChart({
  history,
}: PortfolioHistoryChartProps) {
  const titleId = useId();
  const descId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="theme-surface rounded-2xl border p-6 text-center theme-text-secondary">
        No historical NAV snapshots recorded yet. Tap &ldquo;Sync NAV Now&rdquo; to populate daily snapshots.
      </div>
    );
  }

  const width = 860;
  const height = 310;
  const padLeft = 74;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = history.flatMap((d) => [
    d.totalInvested,
    d.currentMarketValue,
  ]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const spread = Math.max(rawMax - rawMin, rawMax * 0.04, 1000);
  const minVal = Math.max(0, rawMin - spread * 0.25);
  const maxVal = rawMax + spread * 0.2;

  const getX = (idx: number) => {
    if (history.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (history.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return padTop + plotH - ratio * plotH;
  };

  const marketPoints = history.map((d, i) => ({
    x: getX(i),
    y: getY(d.currentMarketValue),
  }));

  const investedPoints = history.map((d, i) => ({
    x: getX(i),
    y: getY(d.totalInvested),
  }));

  const marketPath = marketPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const investedPath = investedPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    marketPoints.length > 1
      ? `${marketPath} L ${marketPoints[marketPoints.length - 1].x.toFixed(1)} ${(
          padTop + plotH
        ).toFixed(1)} L ${marketPoints[0].x.toFixed(1)} ${(
          padTop + plotH
        ).toFixed(1)} Z`
      : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minVal + t * (maxVal - minVal);
    return {
      val,
      y: getY(val),
    };
  });

  const handleTouchScrub = (e: React.TouchEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || history.length === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((touch.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (relX - padLeft) / (plotW || 1)));
    const idx = Math.round(ratio * (history.length - 1));
    setHoverIdx(idx);
  };

  const activeIndex = hoverIdx !== null ? hoverIdx : history.length - 1;
  const activePoint = history[activeIndex] || history[history.length - 1];
  const activeIsPositive = activePoint.absoluteGainLoss >= 0;

  return (
    <section
      aria-labelledby="chart-section-heading"
      className="theme-surface rounded-2xl border p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp
              className="h-5 w-5 status-gain-text shrink-0"
              aria-hidden="true"
            />
            <h2
              id="chart-section-heading"
              className="section-title-fluid font-bold theme-text-primary"
            >
              Portfolio Value vs. Total Invested Over Time
            </h2>
          </div>
          <p className="text-xs sm:text-sm theme-text-secondary mt-0.5">
            Historical daily trajectory from scraped NAV snapshots ({history.length} trading days · drag or tap chart to inspect)
          </p>
        </div>

        {/* Active Day Inspection Pill */}
        <div className="theme-elevated flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 theme-text-primary font-bold">
            <Calendar className="h-4 w-4 status-info-text" aria-hidden="true" />
            <span>{activePoint.displayDate}</span>
          </div>
          <div className="h-4 w-px bg-slate-500/25 hidden sm:block" />
          <div>
            <span className="theme-text-secondary mr-1">Value:</span>
            <span className="font-mono font-bold status-gain-text">
              ৳{formatBdt(activePoint.currentMarketValue, 2)}
            </span>
          </div>
          <div>
            <span className="theme-text-secondary mr-1">Invested:</span>
            <span className="font-mono font-bold status-info-text">
              ৳{formatBdt(activePoint.totalInvested, 0)}
            </span>
          </div>
          <div>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                activeIsPositive ? "status-gain-badge" : "status-loss-badge"
              }`}
            >
              {activeIsPositive ? "▲ +" : "▼ "}
              {activePoint.returnPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs theme-text-secondary">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full inline-block"
              style={{ backgroundColor: "var(--gain-text)" }}
            />
            <span className="theme-text-primary font-semibold">
              Current Market Value (BDT)
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-0.5 w-4 border-t-2 border-dashed inline-block"
              style={{ borderColor: "var(--info-text)" }}
            />
            <span className="theme-text-secondary font-medium">
              Total Invested Baseline (BDT)
            </span>
          </span>
        </div>
        <div className="font-mono text-[11px] sm:text-xs theme-text-secondary">
          NAVs ({activePoint.displayDate}):{" "}
          <strong className="theme-text-primary">
            Shanta {activePoint.shantaNav?.toFixed(3) ?? "—"}
          </strong>{" "}
          ·{" "}
          <strong className="theme-text-primary">
            IDLC {activePoint.idlcNav?.toFixed(2) ?? "—"}
          </strong>{" "}
          ·{" "}
          <strong className="theme-text-primary">
            Edge {activePoint.edgeNav?.toFixed(2) ?? "—"}
          </strong>
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <div className="flex items-center justify-between text-[11px] theme-text-muted mb-1.5 sm:hidden px-0.5">
        <span>← Swipe horizontally to scrub daily timeline →</span>
        <span className="font-mono">{history.length} snapshots</span>
      </div>

      {/* Responsive Touch-Enabled SVG Chart with Isolated Horizontal Overflow */}
      <div className="w-full max-w-full overflow-x-auto touch-pan-x overscroll-contain pb-2 scrollbar-thin">
        <div className="min-w-[560px] sm:min-w-full">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
            className="w-full h-auto select-none"
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={handleTouchScrub}
            onTouchMove={handleTouchScrub}
          >
          <title id={titleId}>
            Line chart of Daily Portfolio Market Value versus Total Invested Amount in BDT
          </title>
          <desc id={descId}>
            Tracks {history.length} daily NAV snapshots from{" "}
            {history[0]?.displayDate} to{" "}
            {history[history.length - 1]?.displayDate}. Latest market value is{" "}
            {formatBdt(history[history.length - 1]?.currentMarketValue, 2)} BDT
            against {formatBdt(history[history.length - 1]?.totalInvested, 2)}{" "}
            BDT invested.
          </desc>

          <defs>
            <linearGradient id="marketAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Y gridlines & labels */}
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
                ৳{formatBdt(t.val, 0)}
              </text>
            </g>
          ))}

          {/* Area under Market Value */}
          {areaPath && <path d={areaPath} fill="url(#marketAreaGrad)" />}

          {/* Total Invested Baseline Line */}
          <path
            d={investedPath}
            fill="none"
            stroke="var(--info-text)"
            strokeWidth="2.25"
            strokeDasharray="6 4"
          />

          {/* Portfolio Market Value Line */}
          <path
            d={marketPath}
            fill="none"
            stroke="var(--gain-text)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis Date Ticks */}
          {history.map((d, i) => {
            const step = Math.max(1, Math.ceil(history.length / 6));
            const showLabel =
              i === 0 || i === history.length - 1 || i % step === 0;
            if (!showLabel) return null;
            const x = getX(i);
            return (
              <text
                key={d.dateKey}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-secondary)"
                className="text-[11px] font-mono font-medium"
              >
                {d.displayDate.replace(/\s+\d{4}$/, "")}
              </text>
            );
          })}

          {/* Active Hover Vertical Guide & Points */}
          {marketPoints[activeIndex] && (
            <g>
              <line
                x1={marketPoints[activeIndex].x}
                y1={padTop}
                x2={marketPoints[activeIndex].x}
                y2={padTop + plotH}
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={investedPoints[activeIndex].x}
                cy={investedPoints[activeIndex].y}
                r="5"
                fill="var(--bg-surface)"
                stroke="var(--info-text)"
                strokeWidth="2.5"
              />
              <circle
                cx={marketPoints[activeIndex].x}
                cy={marketPoints[activeIndex].y}
                r="6"
                fill="var(--gain-text)"
                stroke="var(--bg-surface)"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Invisible interactive hit columns for smooth mouse hover */}
          {history.map((d, i) => {
            const colWidth = plotW / Math.max(1, history.length);
            const x = getX(i) - colWidth / 2;
            return (
              <rect
                key={d.dateKey}
                x={Math.max(padLeft, x)}
                y={padTop}
                width={colWidth}
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
    </section>
  );
}
