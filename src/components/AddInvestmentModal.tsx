"use client";

import React, { useState, useEffect, useRef, useId, useMemo } from "react";
import {
  X,
  Coins,
  Calendar,
  Calculator,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Loader2,
  ChevronDown,
} from "lucide-react";
import MonthYearDatePicker from "./MonthYearDatePicker";

interface UserFundOption {
  id: string; // userFundId
  fundId: string;
  name: string;
  shortName: string;
  fundManager: string;
  category: string;
  effectiveNav: number;
  totalUnitsHeld: number;
  totalInvested: number;
  averageBuyPrice: number;
  fractionalCashBalance: number;
  monthlySipTarget: number;
  investments?: any[];
}

interface AddInvestmentModalProps {
  isOpen: boolean;
  funds: UserFundOption[];
  preselectedUserFundId?: string | null;
  onClose: () => void;
  onInvestmentAdded: () => void;
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

export default function AddInvestmentModal({
  isOpen,
  funds,
  preselectedUserFundId,
  onClose,
  onInvestmentAdded,
}: AddInvestmentModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  const [selectedUserFundId, setSelectedUserFundId] = useState<string>(
    preselectedUserFundId || funds[0]?.id || "",
  );
  const [selectedMonthIdx, setSelectedMonthIdx] =
    useState<number>(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [cashAmount, setCashAmount] = useState<string>("8000");
  const [executionNav, setExecutionNav] = useState<string>("");
  const [investmentType, setInvestmentType] = useState<
    "SIP" | "LUMPSUM" | "CIP"
  >("SIP");
  const [notes, setNotes] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active fund
  const activeFund = useMemo(() => {
    return funds.find((f) => f.id === selectedUserFundId) || funds[0] || null;
  }, [funds, selectedUserFundId]);

  useEffect(() => {
    if (isOpen) {
      const fund =
        funds.find((f) => f.id === preselectedUserFundId) || funds[0] || null;

      if (fund) {
        setSelectedUserFundId(fund.id);
        setCashAmount(String(fund.monthlySipTarget || 8000));
        setExecutionNav(String(fund.effectiveNav || 10.5));
      }
      setSelectedMonthIdx(currentMonthIdx);
      setSelectedYear(currentYear);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, funds, preselectedUserFundId, currentMonthIdx, currentYear]);

  // Update default NAV and cash when user switches fund in dropdown
  const handleFundChange = (ufId: string) => {
    setSelectedUserFundId(ufId);
    const fund = funds.find((f) => f.id === ufId);
    if (fund) {
      setCashAmount(String(fund.monthlySipTarget || 8000));
      setExecutionNav(String(fund.effectiveNav || 10.5));
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = "";
      onClose();
    };

    dialog.addEventListener("close", handleNativeClose);
    return () => dialog.removeEventListener("close", handleNativeClose);
  }, [onClose]);

  // LIVE INTEGER UNIT CALCULATION
  const numCash = Math.max(0, Number(cashAmount) || 0);
  const numNav =
    Number(executionNav) > 0
      ? Number(executionNav)
      : activeFund?.effectiveNav || 10;
  const previousCashBuffer = activeFund?.fractionalCashBalance || 0;
  const totalAvailableCash = Number((numCash + previousCashBuffer).toFixed(2));

  // Strictly INTEGER units:
  const previewUnitsAllotted = Math.floor(totalAvailableCash / numNav);
  const previewUnitsCost = Number((previewUnitsAllotted * numNav).toFixed(2));
  const previewCashRemainder = Number(
    Math.max(0, totalAvailableCash - previewUnitsCost).toFixed(2),
  );

  const previewNewTotalUnits =
    (activeFund?.totalUnitsHeld || 0) + previewUnitsAllotted;
  const previewNewTotalInvested = Number(
    ((activeFund?.totalInvested || 0) + previewUnitsCost).toFixed(2),
  );
  const previewNewAvgBuy =
    previewNewTotalUnits > 0
      ? Number((previewNewTotalInvested / previewNewTotalUnits).toFixed(2))
      : numNav;

  const selectedMonthStr = `${MONTH_NAMES[selectedMonthIdx]} ${selectedYear}`;
  const selectedMonthKey = `${MONTH_NAMES[selectedMonthIdx].toLowerCase()}-${selectedYear}`;

  // Check if an investment of this type has already been logged for this fund in this month
  const existingInvestmentConflict = useMemo(() => {
    if (!activeFund?.investments || !Array.isArray(activeFund.investments))
      return null;
    return activeFund.investments.find((inv: any) => {
      const matchType =
        (inv.type || "SIP").toUpperCase() === investmentType.toUpperCase();
      const invMonthKey =
        inv.monthKey?.toLowerCase() ||
        inv.calendarMonth?.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const matchMonth =
        invMonthKey === selectedMonthKey ||
        (inv.calendarMonth &&
          inv.calendarMonth.trim().toLowerCase() ===
            selectedMonthStr.toLowerCase());
      return matchType && matchMonth;
    });
  }, [activeFund, investmentType, selectedMonthKey, selectedMonthStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFund) return;

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const monthStr = `${MONTH_NAMES[selectedMonthIdx]} ${selectedYear}`;
    const invDate = new Date(selectedYear, selectedMonthIdx, 1);

    try {
      const res = await fetch("/api/user/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userFundId: activeFund.id,
          calendarMonth: monthStr,
          investmentDate: invDate.toISOString(),
          cashInvested: numCash,
          executionNav: numNav,
          type: investmentType,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record investment.");
      }

      setSuccessMsg(data.message);
      onInvestmentAdded();
      setTimeout(() => {
        dialogRef.current?.close();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving investment.");
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
        <div className="border-b theme-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id={titleId}
                  className="text-base sm:text-lg font-bold theme-text-primary"
                >
                  Add Investment
                </h2>
                <p className="text-xs theme-text-secondary">
                  Previous or current calendar month · Units allotted
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="rounded-xl p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-3 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Select Mutual Fund */}
          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary">
              Target Mutual Fund
            </label>
            <div className="relative">
              <select
                value={selectedUserFundId}
                onChange={(e) => handleFundChange(e.target.value)}
                className="form-control-input w-full appearance-none rounded-xl border pl-3.5 pr-9 py-2.5 text-xs font-semibold cursor-pointer"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.category})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

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

          {/* Investment Type */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setInvestmentType("SIP")}
              className={`py-1.5 rounded-lg transition min-h-[34px] ${
                investmentType === "SIP"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Monthly SIP
            </button>
            <button
              type="button"
              onClick={() => setInvestmentType("LUMPSUM")}
              className={`py-1.5 rounded-lg transition min-h-[34px] ${
                investmentType === "LUMPSUM"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Lumpsum
            </button>
            <button
              type="button"
              onClick={() => setInvestmentType("CIP")}
              className={`py-1.5 rounded-lg transition min-h-[34px] ${
                investmentType === "CIP"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              CIP Dividend
            </button>
          </div>

          {/* Amount & NAV Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold theme-text-primary">
                Cash Invested (BDT) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="8000"
                className="form-control-input w-full rounded-xl border px-3.5 py-2.5 font-mono text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold theme-text-primary">
                Execution NAV (BDT) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={executionNav}
                onChange={(e) => setExecutionNav(e.target.value)}
                placeholder="10.596"
                className="form-control-input w-full rounded-xl border px-3.5 py-2.5 font-mono text-xs font-bold"
              />
            </div>
          </div>

          {/* Live Calculation & Cash Buffer Card */}
          <div className="rounded-xl border border-[#c0edf7] bg-[#ebf9fc]/60 dark:bg-slate-800/80 dark:border-slate-700 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
              <span className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-[#248da2] dark:text-[#33c6e4]" />
                <span>Total Cash Available:</span>
              </span>
              <span className="font-mono">
                ৳{formatBdt(totalAvailableCash, 2)}{" "}
                {previousCashBuffer > 0 && (
                  <span className="text-[11px] font-normal text-slate-600 dark:text-slate-400">
                    (৳{formatBdt(numCash, 0)} + ৳
                    {formatBdt(previousCashBuffer, 2)} prev buffer)
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#33c6e4]/20 dark:border-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Units Allotted
                </span>
                <strong className="font-mono text-sm font-extrabold text-[#155360] dark:text-[#33c6e4]">
                  +{previewUnitsAllotted.toLocaleString("en-BD")} units
                </strong>
                <span className="block text-[10px] text-slate-500">
                  @ ৳{numNav.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Roll-Forward Cash Buffer
                </span>
                <strong className="font-mono text-sm font-extrabold text-amber-600 dark:text-amber-400">
                  ৳{formatBdt(previewCashRemainder, 2)}
                </strong>
                <span className="block text-[10px] text-slate-500">
                  Settles on next SIP
                </span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-300">
              Post-investment holdings:{" "}
              <strong className="font-mono font-bold text-slate-900 dark:text-white">
                {previewNewTotalUnits.toLocaleString("en-BD")} units
              </strong>{" "}
              · Weighted Avg Price:{" "}
              <strong className="font-mono font-bold text-slate-900 dark:text-white">
                ৳{previewNewAvgBuy.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Existing Investment Warning */}
          {existingInvestmentConflict && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">
                  {investmentType} Already Recorded for {selectedMonthStr}
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  For <strong>{activeFund?.name}</strong>, only one investment
                  of each type (SIP, CIP, or Lumpsum) can be added per month. A{" "}
                  {investmentType} entry (৳
                  {existingInvestmentConflict.cashInvested?.toLocaleString(
                    "en-BD",
                  )}{" "}
                  @ ৳
                  {Number(existingInvestmentConflict.executionNav).toFixed(2)})
                  is already logged for this month.
                </p>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold pt-0.5">
                  Tip: To modify this installment, edit the existing entry from
                  the dashboard instead.
                </div>
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Regular monthly installment via bank transfer"
              className="form-control-input w-full rounded-xl border px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t theme-border px-6 py-3.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-b-2xl">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-xl border theme-border px-4 py-2 text-xs font-semibold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              isLoading ||
              previewUnitsAllotted <= 0 ||
              Boolean(existingInvestmentConflict)
            }
            className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-5 py-2 text-xs font-bold shadow-sm transition disabled:opacity-50 min-h-[40px] inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Recording Investment...</span>
              </>
            ) : (
              <>
                <span>Confirm &amp; Record Investment</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
