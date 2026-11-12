"use client";

import React, { useState, useId } from "react";
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 text-center text-slate-400">
        No historical NAV snapshots recorded yet. Click &ldquo;Sync NAV Now&rdquo; to populate daily snapshots.
      </div>
    );
  }

  const width = 860;
  const height = 310;
  const padLeft = 72;
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

  const activeIndex = hoverIdx !== null ? hoverIdx : history.length - 1;
  const activePoint = history[activeIndex] || history[history.length - 1];
  const activeIsPositive = activePoint.absoluteGainLoss >= 0;

  return (
    <section
      aria-labelledby="chart-section-heading"
      className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 sm:p-6 shadow-xl"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp
              className="h-5 w-5 text-emerald-400"
              aria-hidden="true"
            />
            <h2
              id="chart-section-heading"
              className="text-lg font-semibold text-white"
            >
              Portfolio Value vs. Total Invested Over Time
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Historical daily trajectory computed from scraped mutual fund NAV snapshots ({history.length} trading days tracked)
          </p>
        </div>

        {/* Active Day Inspection Pill */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Calendar className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <span>{activePoint.displayDate}</span>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-400 mr-1.5">Market Value:</span>
            <span className="font-mono font-semibold text-emerald-400">
              ৳{formatBdt(activePoint.currentMarketValue, 2)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-1.5">Invested:</span>
            <span className="font-mono font-semibold text-sky-400">
              ৳{formatBdt(activePoint.totalInvested, 0)}
            </span>
          </div>
          <div>
            <span
              className={`font-mono font-semibold px-2 py-0.5 rounded-md ${
                activeIsPositive
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {activeIsPositive ? "+" : ""}
              {activePoint.returnPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-slate-400">
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-slate-200 font-medium">
              Current Market Value (BDT)
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-sky-400 inline-block" />
            <span className="text-slate-300">Total Invested Baseline (BDT)</span>
          </span>
        </div>
        <div className="font-mono text-slate-400">
          NAVs on {activePoint.displayDate}:{" "}
          <span className="text-slate-200">
            Shanta {activePoint.shantaNav?.toFixed(3) ?? "—"}
          </span>{" "}
          ·{" "}
          <span className="text-slate-200">
            IDLC {activePoint.idlcNav?.toFixed(2) ?? "—"}
          </span>{" "}
          ·{" "}
          <span className="text-slate-200">
            Edge {activePoint.edgeNav?.toFixed(2) ?? "—"}
          </span>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="w-full h-auto min-w-[540px] select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <title id={titleId}>
            Line chart of Daily Portfolio Market Value versus Total Invested Amount in BDT
          </title>
          <desc id={descId}>
            Tracks {history.length} daily NAV snapshots from{" "}
            {history[0]?.displayDate} to{" "}
            {history[history.length - 1]?.displayDate}. Latest market value is{" "}
            {formatBdt(history[history.length - 1]?.currentMarketValue, 2)} BDT
            against {formatBdt(history[history.length - 1]?.totalInvested, 2)} BDT
            invested.
          </desc>

          <defs>
            <linearGradient id="marketAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
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
                stroke="#1e293b"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={t.y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px] font-mono"
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
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          {/* Portfolio Market Value Line */}
          <path
            d={marketPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis Date Ticks */}
          {history.map((d, i) => {
            const step = Math.max(1, Math.ceil(history.length / 7));
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
                className="fill-slate-400 text-[11px] font-mono"
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
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={investedPoints[activeIndex].x}
                cy={investedPoints[activeIndex].y}
                r="4.5"
                fill="#090d16"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              <circle
                cx={marketPoints[activeIndex].x}
                cy={marketPoints[activeIndex].y}
                r="5.5"
                fill="#10b981"
                stroke="#090d16"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Invisible interactive hit columns for smooth scrub hover */}
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
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}

