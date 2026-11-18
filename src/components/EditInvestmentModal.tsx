"use client";

import React, { useState, useEffect, useRef, useId, useMemo } from "react";
import {
  X,
  Pencil,
  Calendar,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import MonthYearDatePicker from "./MonthYearDatePicker";

export interface EditableInvestment {
  id: string;
  userFundId: string;
  fundName: string;
  calendarMonth: string;
  cashInvested: number;
  cashBufferUsed: number;
  executionNav: number;
  unitsAllotted: number;
  unitsCost: number;
  cashRemainder: number;
  type: string;
  notes?: string | null;
}

interface EditInvestmentModalProps {
  isOpen: boolean;
  investment: EditableInvestment | null;
  onClose: () => void;
  onUpdated: () => void;
}

function formatBdt(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

const MONTH_NAMES = [
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

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

export default function EditInvestmentModal({
  isOpen,
  investment,
  onClose,
  onUpdated,
}: EditInvestmentModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  const [selectedMonthIdx, setSelectedMonthIdx] =
    useState<number>(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [cashInvested, setCashInvested] = useState<string>("");
  const [executionNav, setExecutionNav] = useState<string>("");
  const [invType, setInvType] = useState<string>("SIP");
  const [notes, setNotes] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (investment) {
      if (investment.calendarMonth) {
        const parts = investment.calendarMonth.trim().split(" ");
        const mIdx = MONTH_NAMES.indexOf(parts[0]);
        const yVal = parseInt(parts[1], 10);
        if (mIdx !== -1) setSelectedMonthIdx(mIdx);
        if (!isNaN(yVal)) setSelectedYear(yVal);
      }
      setCashInvested(String(investment.cashInvested || ""));
      setExecutionNav(String(investment.executionNav || ""));
      setInvType(investment.type || "SIP");
      setNotes(investment.notes || "");
      setError(null);
      setSuccessMsg(null);
    }
  }, [investment]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Live calculation preview
  const numCash = Math.max(0, Number(cashInvested) || 0);
  const numNav = Number(executionNav) > 0 ? Number(executionNav) : 10.0;
  const bufferUsed = investment
    ? Math.max(0, investment.cashBufferUsed || 0)
    : 0;
  const totalAvailable = Number((numCash + bufferUsed).toFixed(2));
  const previewUnits = Math.floor(totalAvailable / numNav);
  const previewCost = Number((previewUnits * numNav).toFixed(2));
  const previewRemainder = Number(
    Math.max(0, totalAvailable - previewCost).toFixed(2),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investment) return;

    if (numCash <= 0) {
      setError("Invested cash amount must be greater than 0 BDT.");
      return;
    }
    if (numNav <= 0) {
      setError("Execution NAV must be a positive number.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const monthStr = `${MONTH_NAMES[selectedMonthIdx]} ${selectedYear}`;
    const invDate = new Date(selectedYear, selectedMonthIdx, 1);

    try {
      const res = await fetch("/api/user/investments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentId: investment.id,
          calendarMonth: monthStr,
          investmentDate: invDate.toISOString(),
          cashInvested: numCash,
          executionNav: numNav,
          type: invType,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update investment.");
      }

      setSuccessMsg(data.message || "Investment updated successfully.");
      onUpdated();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error updating investment.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="theme-elevated modal-native-backdrop w-full max-w-lg rounded-2xl border theme-border p-0 shadow-2xl backdrop:bg-slate-950/70"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="border-b theme-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <h2
                id={titleId}
                className="text-base sm:text-lg font-bold theme-text-primary"
              >
                Edit Investment
              </h2>
              <p className="text-xs theme-text-secondary">
                {investment?.fundName || "Mutual Fund"} · Units recalculated
                automatically
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-xl p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 p-3 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300 p-3 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Calendar Month & Year DatePicker */}
          <MonthYearDatePicker
            value={{ monthIndex: selectedMonthIdx, year: selectedYear }}
            onChange={(val) => {
              setSelectedMonthIdx(val.monthIndex);
              setSelectedYear(val.year);
            }}
            label="Calendar Month of Investment"
            helperText="Select previous or current calendar month for this installment"
          />

          {/* Type & Cash Invested */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold theme-text-secondary block mb-1">
                Type
              </label>
              <div className="relative">
                <select
                  value={invType}
                  onChange={(e) => setInvType(e.target.value)}
                  className="w-full appearance-none rounded-xl border theme-border theme-surface pl-3 pr-9 py-2.5 text-xs font-medium theme-text-primary focus:outline-none focus:ring-2 focus:ring-[#33c6e4] cursor-pointer"
                >
                  <option value="SIP">Monthly SIP</option>
                  <option value="LUMPSUM">Lump-sum</option>
                  <option value="CIP">CIP Dividend</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold theme-text-secondary block mb-1">
                Cash Invested (BDT)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={cashInvested}
                onChange={(e) => setCashInvested(e.target.value)}
                className="w-full rounded-xl border theme-border theme-surface px-3 py-2.5 text-xs font-mono font-medium theme-text-primary focus:outline-none focus:ring-2 focus:ring-[#33c6e4]"
                placeholder="e.g. 8000"
                required
              />
            </div>
          </div>

          {/* Execution NAV */}
          <div>
            <label className="text-xs font-bold theme-text-secondary block mb-1">
              Execution NAV (BDT)
            </label>
            <input
              type="number"
              step="any"
              min="0.001"
              value={executionNav}
              onChange={(e) => setExecutionNav(e.target.value)}
              className="w-full rounded-xl border theme-border theme-surface px-3 py-2.5 text-xs font-mono font-medium theme-text-primary focus:outline-none focus:ring-2 focus:ring-[#33c6e4]"
              placeholder="e.g. 10.75"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold theme-text-secondary block mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border theme-border theme-surface px-3 py-2 text-xs font-medium theme-text-primary focus:outline-none focus:ring-2 focus:ring-[#33c6e4]"
              placeholder="e.g. Bank debit, AMC transaction ID"
            />
          </div>

          {/* Live Mathematical Preview Card */}
          <div className="rounded-xl border theme-border bg-slate-50/80 dark:bg-slate-900/60 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#155360] dark:text-[#33c6e4]">
              <Calculator className="h-4 w-4" />
              <span>Recalculation Preview (Units Allotted)</span>
            </div>

            <div className="space-y-1.5 text-[11px] theme-text-secondary">
              <div className="flex justify-between">
                <span>Invested Cash + Carried Buffer:</span>
                <span className="font-mono font-semibold theme-text-primary">
                  ৳{formatBdt(numCash, 2)} + ৳{formatBdt(bufferUsed, 2)} = ৳
                  {formatBdt(totalAvailable, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Execution NAV:</span>
                <span className="font-mono font-semibold theme-text-primary">
                  ৳{numNav.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t theme-border pt-1 font-bold">
                <span className="text-[#155360] dark:text-[#33c6e4]">
                  Units Allotted:
                </span>
                <span className="font-mono text-sm text-[#155360] dark:text-[#33c6e4]">
                  {previewUnits.toLocaleString("en-BD")} units
                </span>
              </div>
              <div className="flex justify-between">
                <span>Units Capital Cost:</span>
                <span className="font-mono font-semibold theme-text-primary">
                  ৳{formatBdt(previewCost, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>New Cash Remainder (Held for next SIP):</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  ৳{formatBdt(previewRemainder, 2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t theme-border px-6 py-3.5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border theme-border px-4 py-2.5 text-xs font-bold theme-text-secondary hover:theme-text-primary transition min-h-[42px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 font-bold px-5 py-2.5 text-xs transition inline-flex items-center gap-1.5 min-h-[42px] shadow-sm disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
