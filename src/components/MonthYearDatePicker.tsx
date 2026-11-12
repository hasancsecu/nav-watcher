"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Calendar, ChevronLeft, ChevronRight, Check } from "lucide-react";

export interface MonthYearValue {
  monthIndex: number; // 0-11
  year: number;
  label: string; // "November 2026"
  date: Date;
}

interface MonthYearDatePickerProps {
  value: { monthIndex: number; year: number } | string;
  onChange: (val: MonthYearValue) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
  helperText?: string;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MonthYearDatePicker({
  value,
  onChange,
  minYear = 2020,
  maxYear = new Date().getFullYear(),
  label = "Calendar Month of Investment",
  helperText = "Select month & year for this installment",
}: MonthYearDatePickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Parse initial value
  const parseVal = (): { monthIndex: number; year: number } => {
    if (typeof value === "string") {
      const parts = value.trim().split(" ");
      const mIdx = MONTHS_FULL.indexOf(parts[0]);
      const yVal = parseInt(parts[1], 10);
      return {
        monthIndex: mIdx !== -1 ? mIdx : currentMonth,
        year: !isNaN(yVal) ? yVal : currentYear,
      };
    }
    return {
      monthIndex: value?.monthIndex ?? currentMonth,
      year: value?.year ?? currentYear,
    };
  };

  const parsed = parseVal();
  const [selectedMonth, setSelectedMonth] = useState<number>(parsed.monthIndex);
  const [selectedYear, setSelectedYear] = useState<number>(parsed.year);
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [isOpen, setIsOpen] = useState(false);

  // Sync state if external value changes
  useEffect(() => {
    const p = parseVal();
    setSelectedMonth(p.monthIndex);
    setSelectedYear(p.year);
    setViewYear(p.year);
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (mIndex: number, yVal: number) => {
    setSelectedMonth(mIndex);
    setSelectedYear(yVal);
    setIsOpen(false);

    const monthLabel = `${MONTHS_FULL[mIndex]} ${yVal}`;
    const dateObj = new Date(yVal, mIndex, 1);
    onChange({
      monthIndex: mIndex,
      year: yVal,
      label: monthLabel,
      date: dateObj,
    });
  };

  const isCurrentSelection =
    selectedYear === currentYear && selectedMonth === currentMonth;
  const isPreviousMonthSelection =
    selectedYear === (currentMonth === 0 ? currentYear - 1 : currentYear) &&
    selectedMonth === (currentMonth === 0 ? 11 : currentMonth - 1);

  return (
    <div ref={containerRef} className="space-y-1 relative">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold theme-text-primary">
          {label}
        </label>
        <span className="text-[11px] font-bold text-[#155360] dark:text-[#33c6e4]">
          {isCurrentSelection
            ? "Current Month"
            : isPreviousMonthSelection
            ? "Previous Month"
            : `${MONTHS_FULL[selectedMonth]} ${selectedYear}`}
        </span>
      </div>

      {/* Datepicker Trigger Input */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-xl border theme-border theme-surface px-3.5 py-2.5 text-xs font-bold theme-text-primary hover:border-[#33c6e4]/60 focus:outline-none focus:ring-2 focus:ring-[#33c6e4] transition shadow-sm min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#33c6e4]" />
          <span>
            {MONTHS_FULL[selectedMonth]} {selectedYear}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
          Change
        </span>
      </button>

      {helperText && (
        <p className="text-[10px] theme-text-muted">{helperText}</p>
      )}

      {/* Datepicker Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 p-3.5 rounded-2xl border theme-border theme-elevated shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Year Navigator */}
          <div className="flex items-center justify-between border-b theme-border pb-2.5">
            <button
              type="button"
              disabled={viewYear <= minYear}
              onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
              className="p-1.5 rounded-lg theme-text-muted hover:theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
              aria-label="Previous Year"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-extrabold text-sm theme-text-primary font-mono tracking-tight">
              {viewYear}
            </span>

            <button
              type="button"
              disabled={viewYear >= maxYear + 1}
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1.5 rounded-lg theme-text-muted hover:theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
              aria-label="Next Year"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 3x4 Month Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS_SHORT.map((name, idx) => {
              const isSelected =
                selectedYear === viewYear && selectedMonth === idx;
              const isThisMonth =
                currentYear === viewYear && currentMonth === idx;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(idx, viewYear)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center min-h-[40px] relative ${
                    isSelected
                      ? "bg-[#33c6e4] text-slate-950 shadow-md font-black"
                      : isThisMonth
                      ? "border border-[#33c6e4] theme-text-primary hover:bg-[#33c6e4]/10"
                      : "theme-surface theme-text-secondary hover:theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{name}</span>
                  {isThisMonth && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#33c6e4]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick-pick Shortcuts */}
          <div className="flex items-center justify-between pt-2 border-t theme-border text-[11px]">
            <button
              type="button"
              onClick={() => handleSelect(currentMonth, currentYear)}
              className="font-bold text-[#155360] dark:text-[#33c6e4] hover:underline"
            >
              Current Month
            </button>

            <button
              type="button"
              onClick={() => {
                const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
                const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
                handleSelect(prevM, prevY);
              }}
              className="font-bold theme-text-muted hover:theme-text-primary"
            >
              Previous Month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
