"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import {
  FundValuationMetrics,
  PortfolioSummaryMetrics,
  calculateCipReinvestment,
  applyCipUnitsToHolding,
  simulateSipWithCipSettlement,
} from "@/lib/calculations";
import { PortfolioHistoryItem } from "./PortfolioHistoryChart";
import {
  X,
  PlusCircle,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Coins,
  RefreshCw,
  SlidersHorizontal,
  Wallet,
  ArrowRight,
  Info,
} from "lucide-react";

export type ModalTab = "cip" | "sip" | "baseline";

interface UpdateHoldingsDialogProps {
  isOpen: boolean;
  initialTab?: ModalTab;
  initialFocusFundId: string | null;
  funds: FundValuationMetrics[];
  onClose: () => void;
  onSaveHoldings: (
    updates: Array<{
      fundId: string;
      totalInvested: number;
      averageBuyPrice: number;
      monthlySipTarget: number;
    }>
  ) => Promise<void>;
  onDataUpdated?: (data: {
    summary: PortfolioSummaryMetrics;
    funds: FundValuationMetrics[];
    history: PortfolioHistoryItem[];
  }) => void;
}

interface DraftHolding {
  totalInvested: string;
  averageBuyPrice: string;
  monthlySipTarget: string;
  investedError?: string;
  avgBuyError?: string;
}

function formatBdt(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export default function UpdateHoldingsDialog({
  isOpen,
  initialTab = "cip",
  initialFocusFundId,
  funds,
  onClose,
  onSaveHoldings,
  onDataUpdated,
}: UpdateHoldingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  // Active modal tab: "cip" (CIP Dividend), "sip" (Monthly SIP), "baseline" (Holdings baseline)
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);

  // Selected AMC fund for CIP or SIP actions
  const [selectedFundId, setSelectedFundId] = useState<string>(
    initialFocusFundId || funds[0]?.id || "shanta-amanah"
  );

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TAB 1: CIP DIVIDEND STATE (Integer Units & Retained Cash)
  // -------------------------------------------------------------
  const [cipDividendAmount, setCipDividendAmount] = useState<string>("");
  const [cipNav, setCipNav] = useState<string>("");
  const [isManualUnits, setIsManualUnits] = useState(false);
  const [manualUnits, setManualUnits] = useState<string>("");
  const [manualCashRemainder, setManualCashRemainder] = useState<string>("");

  // -------------------------------------------------------------
  // TAB 2: MONTHLY SIP STATE (with CIP Cash Settlement)
  // -------------------------------------------------------------
  const [sipAmount, setSipAmount] = useState<string>("");
  const [sipExecutionNav, setSipExecutionNav] = useState<string>("");
  const [settlementMethod, setSettlementMethod] = useState<
    "ADD_TO_INVESTMENT" | "DEDUCT_FROM_PAYMENT"
  >("ADD_TO_INVESTMENT");

  // -------------------------------------------------------------
  // TAB 3: BASELINE HOLDINGS STATE
  // -------------------------------------------------------------
  const [drafts, setDrafts] = useState<Record<string, DraftHolding>>({});

  // Sync draft and form values whenever modal opens or active fund changes
  useEffect(() => {
    if (isOpen && funds.length > 0) {
      const fund =
        funds.find((f) => f.id === (initialFocusFundId || selectedFundId)) ||
        funds[0];
      const targetFundId = fund.id;
      setSelectedFundId(targetFundId);
      setActiveTab(initialTab);
      setSubmitError(null);
      setSuccessMessage(null);

      // Initialize CIP fields
      setCipDividendAmount("");
      setCipNav(String(fund.effectiveNav || 10.596));
      setIsManualUnits(false);
      setManualUnits("");
      setManualCashRemainder("");

      // Initialize SIP fields
      setSipAmount(String(fund.monthlySipTarget || 8000));
      setSipExecutionNav(String(fund.buyPrice || fund.effectiveNav || 10.596));
      setSettlementMethod("ADD_TO_INVESTMENT");

      // Initialize Baseline drafts
      const initialDrafts: Record<string, DraftHolding> = {};
      for (const f of funds) {
        initialDrafts[f.id] = {
          totalInvested: String(f.totalInvested),
          averageBuyPrice: String(f.averageBuyPrice),
          monthlySipTarget: String(f.monthlySipTarget || 8000),
        };
      }
      setDrafts(initialDrafts);
    }
  }, [isOpen, initialTab, initialFocusFundId, funds]);

  // Sync Nav and SIP defaults when selectedFundId changes
  const handleSelectFund = (fundId: string) => {
    setSelectedFundId(fundId);
    setSubmitError(null);
    setSuccessMessage(null);
    const fund = funds.find((f) => f.id === fundId);
    if (fund) {
      setCipNav(String(fund.effectiveNav || 10.596));
      setSipAmount(String(fund.monthlySipTarget || 8000));
      setSipExecutionNav(String(fund.buyPrice || fund.effectiveNav || 10.596));
    }
  };

  // Manage native <dialog> lifecycle
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

    let handleBackdropClick: ((event: MouseEvent) => void) | null = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener("click", handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      if (handleBackdropClick) {
        dialog.removeEventListener("click", handleBackdropClick);
      }
    };
  }, [onClose]);

  const currentFund =
    funds.find((f) => f.id === selectedFundId) || funds[0] || null;

  // -------------------------------------------------------------
  // CIP COMPUTATIONS (Strictly Integer Units & Exact Cash Remainder)
  // -------------------------------------------------------------
  const existingCashBuffer = currentFund?.fractionalCashBalance || 0;
  const numDividend = Number(cipDividendAmount) || 0;
  const numCipNav = Number(cipNav) > 0 ? Number(cipNav) : currentFund?.effectiveNav || 10;

  let computedUnitsAllotted = 0;
  let computedReinvestedAmount = 0;
  let computedCashRemainder = 0;

  if (isManualUnits) {
    computedUnitsAllotted = Math.floor(Math.max(0, Number(manualUnits) || 0));
    computedReinvestedAmount = Number((computedUnitsAllotted * numCipNav).toFixed(2));
    computedCashRemainder = Math.max(0, Number(manualCashRemainder) || 0);
  } else if (numDividend > 0) {
    const calc = calculateCipReinvestment(numDividend, numCipNav, existingCashBuffer);
    computedUnitsAllotted = calc.unitsAllotted;
    computedReinvestedAmount = calc.reinvestedAmount;
    computedCashRemainder = calc.cashRemainder;
  }

  // Preview of holding after CIP
  const cipHoldingPreview = currentFund
    ? applyCipUnitsToHolding(
        currentFund.totalInvested,
        currentFund.averageBuyPrice,
        computedUnitsAllotted,
        numCipNav
      )
    : null;

  // -------------------------------------------------------------
  // SIP WITH CIP SETTLEMENT COMPUTATIONS
  // -------------------------------------------------------------
  const numSip = Number(sipAmount) || 8000;
  const numSipNav = Number(sipExecutionNav) > 0 ? Number(sipExecutionNav) : currentFund?.effectiveNav || 10;
  const sipSettlementPreview = currentFund
    ? simulateSipWithCipSettlement(
        currentFund.totalInvested,
        currentFund.averageBuyPrice,
        numSip,
        numSipNav,
        existingCashBuffer,
        settlementMethod
      )
    : null;

  // -------------------------------------------------------------
  // SUBMIT HANDLERS
  // -------------------------------------------------------------

  // 1. Submit CIP Dividend
  const handleSubmitCip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFund) return;
    setSubmitError(null);
    setSuccessMessage(null);

    if (computedUnitsAllotted <= 0) {
      setSubmitError(
        "Please enter a dividend amount or whole units value greater than 0."
      );
      return;
    }

    if (!Number.isInteger(computedUnitsAllotted)) {
      setSubmitError("CIP units allotted MUST be a whole integer, not a decimal!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/cip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: currentFund.id,
          dividendAmount: numDividend || computedReinvestedAmount + computedCashRemainder,
          cipNav: numCipNav,
          unitsAllotted: computedUnitsAllotted,
          cashRemainder: computedCashRemainder,
          notes: `CIP Dividend Reinvestment: +${computedUnitsAllotted} integer units. ৳${computedCashRemainder.toFixed(2)} cash remainder retained for next SIP.`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add CIP dividend");
      }

      setSuccessMessage(
        `✓ Added ${computedUnitsAllotted} CIP units to ${currentFund.name}! ৳${computedCashRemainder.toFixed(2)} cash remainder is held to settle on your next SIP.`
      );
      if (onDataUpdated) {
        onDataUpdated({
          summary: data.summary,
          funds: data.funds,
          history: data.history,
        });
      }
      setTimeout(() => {
        dialogRef.current?.close("cip_saved");
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit SIP Installment & Settle Cash
  const handleSubmitSipSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFund) return;
    setSubmitError(null);
    setSuccessMessage(null);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/cip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: currentFund.id,
          freshSipCash: numSip,
          executionNav: numSipNav,
          settlementMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute SIP installment");
      }

      setSuccessMessage(
        `✓ Monthly SIP executed! Settled ৳${existingCashBuffer.toFixed(2)} previous CIP cash balance.`
      );
      if (onDataUpdated) {
        onDataUpdated({
          summary: data.summary,
          funds: data.funds,
          history: data.history,
        });
      }
      setTimeout(() => {
        dialogRef.current?.close("sip_settled");
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Baseline Holdings
  const handleSubmitBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const payload: Array<{
      fundId: string;
      totalInvested: number;
      averageBuyPrice: number;
      monthlySipTarget: number;
    }> = [];

    for (const f of funds) {
      const d = drafts[f.id];
      if (!d) continue;
      const inv = Number(d.totalInvested);
      const avg = Number(d.averageBuyPrice);
      const sip = Number(d.monthlySipTarget) || 8000;
      if (Number.isNaN(inv) || inv < 0 || Number.isNaN(avg) || avg <= 0) {
        setSubmitError(`Please check numbers for ${f.name}`);
        return;
      }
      payload.push({
        fundId: f.id,
        totalInvested: inv,
        averageBuyPrice: avg,
        monthlySipTarget: sip,
      });
    }

    setIsSubmitting(true);
    try {
      await onSaveHoldings(payload);
      setSuccessMessage("✓ Baseline holdings updated successfully!");
      setTimeout(() => {
        dialogRef.current?.close("baseline_saved");
      }, 1000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({
        closedby: "any",
      } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="theme-surface m-auto max-sm:mb-0 max-sm:mt-auto w-full sm:w-[calc(100%-2rem)] max-w-2xl rounded-t-3xl sm:rounded-2xl border p-0 shadow-2xl max-h-[92vh] overflow-hidden"
    >
      {/* Mobile Handle */}
      <div className="sm:hidden flex justify-center pt-2.5 pb-1 theme-elevated">
        <span className="h-1.5 w-12 rounded-full bg-slate-400/50" />
      </div>

      {/* Header */}
      <div className="theme-elevated flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div>
          <h2
            id={titleId}
            className="text-base sm:text-lg font-bold theme-text-primary"
          >
            Manage Portfolio, SIP &amp; CIP Dividends
          </h2>
          <p className="text-xs theme-text-secondary mt-0.5">
            Add CIP integer units, settle cash remainders, or record monthly SIPs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close("close_btn")}
          className="theme-surface rounded-xl border p-2 theme-text-muted hover:opacity-80 transition"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 3 Main Tabs */}
      <div className="grid grid-cols-3 border-b theme-border bg-slate-500/5 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setActiveTab("cip");
            setSubmitError(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
            activeTab === "cip"
              ? "btn-primary shadow-sm"
              : "theme-text-secondary hover:theme-text-primary"
          }`}
        >
          <Coins className="h-4 w-4 shrink-0" />
          <span>+ Add CIP Dividend</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("sip");
            setSubmitError(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
            activeTab === "sip"
              ? "btn-primary shadow-sm"
              : "theme-text-secondary hover:theme-text-primary"
          }`}
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>+ Record Monthly SIP</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("baseline");
            setSubmitError(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
            activeTab === "baseline"
              ? "btn-primary shadow-sm"
              : "theme-text-secondary hover:theme-text-primary"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span>Edit Holdings</span>
        </button>
      </div>

      {/* AMC Selector (For CIP and SIP tabs) */}
      {activeTab !== "baseline" && (
        <div className="px-4 sm:px-6 pt-3.5 pb-2 border-b theme-border theme-elevated">
          <label className="block text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1.5">
            Select AMC / Mutual Fund
          </label>
          <div className="grid grid-cols-3 gap-2">
            {funds.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleSelectFund(f.id)}
                className={`py-2 px-2.5 rounded-xl text-left text-xs font-bold border transition ${
                  selectedFundId === f.id
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "theme-surface theme-border theme-text-secondary hover:theme-text-primary"
                }`}
              >
                <div className="truncate">{f.shortName || f.name}</div>
                {f.fractionalCashBalance > 0 && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                    ৳{f.fractionalCashBalance.toFixed(2)} cash buffer
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {submitError && (
        <div className="m-4 status-loss-badge flex items-center gap-2 rounded-xl p-3 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 status-loss-text" />
          <span>{submitError}</span>
        </div>
      )}
      {successMessage && (
        <div className="m-4 status-gain-badge flex items-center gap-2 rounded-xl p-3 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0 status-gain-text" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: ADD CIP DIVIDEND (INTEGER UNITS & CASH REMAINDER)              */}
      {/* ==================================================================== */}
      {activeTab === "cip" && currentFund && (
        <form onSubmit={handleSubmitCip} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[62vh]">
          {/* AMC Banner */}
          <div className="theme-elevated flex items-center justify-between rounded-xl border p-3 text-xs">
            <div>
              <span className="theme-text-muted block text-[11px]">Selected Mutual Fund</span>
              <strong className="theme-text-primary text-sm font-extrabold">{currentFund.name}</strong>
            </div>
            <div className="text-right">
              <span className="theme-text-muted block text-[11px]">Existing Units Held</span>
              <strong className="font-mono text-sm font-bold status-info-text">
                {currentFund.totalUnitsHeld.toFixed(4)}
              </strong>
            </div>
          </div>

          {/* Existing Cash Buffer Notice */}
          {existingCashBuffer > 0 && (
            <div className="status-info-badge flex items-start gap-2.5 rounded-xl p-3 text-xs">
              <Info className="h-4 w-4 shrink-0 status-info-text mt-0.5" />
              <div>
                <strong className="block font-bold">
                  Existing CIP Cash Remainder: ৳{existingCashBuffer.toFixed(2)}
                </strong>
                <span className="text-[11px] opacity-90">
                  This previously unsettled cash balance will automatically combine with the new dividend payout to allot maximum whole units.
                </span>
              </div>
            </div>
          )}

          {/* Input Mode Switch */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-bold theme-text-primary">Dividend Entry Method</span>
            <label className="flex items-center gap-1.5 cursor-pointer theme-text-secondary">
              <input
                type="checkbox"
                checked={isManualUnits}
                onChange={(e) => setIsManualUnits(e.target.checked)}
                className="rounded border-slate-400"
              />
              <span>Enter Allotted Units Directly</span>
            </label>
          </div>

          {!isManualUnits ? (
            /* Auto-Calculate from Total Dividend Amount */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold theme-text-secondary mb-1">
                  Gross Dividend Payout (BDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-mono font-bold theme-text-muted">৳</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 2500"
                    value={cipDividendAmount}
                    onChange={(e) => setCipDividendAmount(e.target.value)}
                    required
                    className="form-control-input w-full rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] theme-text-muted mt-1">Total dividend amount declared by AMC</p>
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-secondary mb-1">
                  CIP Reinvestment NAV (BDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-mono font-bold theme-text-muted">৳</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={cipNav}
                    onChange={(e) => setCipNav(e.target.value)}
                    required
                    className="form-control-input w-full rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] theme-text-muted mt-1">Issue NAV for dividend reinvestment</p>
              </div>
            </div>
          ) : (
            /* Manual Integer Units & Cash Input */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold theme-text-secondary mb-1">
                  Allotted Whole Units (Integer)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="e.g. 188"
                  value={manualUnits}
                  onChange={(e) => setManualUnits(e.target.value)}
                  required
                  className="form-control-input w-full rounded-xl px-3 py-2.5 text-sm font-mono font-bold"
                />
                <p className="text-[11px] theme-text-muted mt-1">Strictly integer units (no decimals)</p>
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-secondary mb-1">
                  Reinvestment NAV (BDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-mono font-bold theme-text-muted">৳</span>
                  <input
                    type="number"
                    step="0.001"
                    value={cipNav}
                    onChange={(e) => setCipNav(e.target.value)}
                    required
                    className="form-control-input w-full rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-secondary mb-1">
                  Retained Cash Remainder (BDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-mono font-bold theme-text-muted">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 7.95"
                    value={manualCashRemainder}
                    onChange={(e) => setManualCashRemainder(e.target.value)}
                    className="form-control-input w-full rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] theme-text-muted mt-1">Settles on next SIP</p>
              </div>
            </div>
          )}

          {/* Live Calculation Feedback Card */}
          <div className="theme-elevated rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between text-xs border-b theme-border pb-2">
              <span className="font-bold theme-text-primary flex items-center gap-1.5">
                <Calculator className="h-4 w-4 status-gain-text" />
                <span>CIP Reinvestment Breakdown</span>
              </span>
              <span className="status-gain-badge px-2 py-0.5 rounded-full text-[10px] font-bold">
                Integer Units Mandatory
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <span className="text-[11px] theme-text-muted block">Allotted Whole Units</span>
                <strong className="font-mono text-base font-black status-gain-text">
                  +{computedUnitsAllotted} units
                </strong>
                <span className="block text-[10px] theme-text-muted mt-0.5">Integer only</span>
              </div>

              <div>
                <span className="text-[11px] theme-text-muted block">Reinvested Capital</span>
                <strong className="font-mono text-sm font-bold theme-text-primary">
                  ৳{formatBdt(computedReinvestedAmount, 2)}
                </strong>
                <span className="block text-[10px] theme-text-muted mt-0.5">{computedUnitsAllotted} × ৳{numCipNav}</span>
              </div>

              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0 theme-border">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block">
                  Remaining Cash Balance
                </span>
                <strong className="font-mono text-base font-black text-amber-600 dark:text-amber-400">
                  ৳{formatBdt(computedCashRemainder, 2)}
                </strong>
                <span className="block text-[10px] theme-text-muted mt-0.5">
                  Settles on next SIP
                </span>
              </div>
            </div>

            {/* Holding Impact Row */}
            {cipHoldingPreview && computedUnitsAllotted > 0 && (
              <div className="theme-surface rounded-lg border p-2.5 text-xs theme-text-secondary flex items-center justify-between">
                <span>
                  New Units: <strong className="font-mono font-bold theme-text-primary">{cipHoldingPreview.newTotalUnits.toFixed(4)}</strong>
                </span>
                <span>→</span>
                <span>
                  New Avg Cost: <strong className="font-mono font-bold theme-text-primary">৳{cipHoldingPreview.newAverageBuyPrice.toFixed(4)}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close("cancel")}
              className="theme-surface min-h-[44px] rounded-xl border px-4 py-2 text-xs font-bold theme-text-primary hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || computedUnitsAllotted <= 0}
              className="btn-primary min-h-[44px] rounded-xl px-5 py-2 text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? "Adding CIP Units..."
                  : `Confirm +${computedUnitsAllotted} Units (Keep ৳${computedCashRemainder.toFixed(2)} Cash)`}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: RECORD MONTHLY SIP (WITH CIP CASH SETTLEMENT)                 */}
      {/* ==================================================================== */}
      {activeTab === "sip" && currentFund && (
        <form onSubmit={handleSubmitSipSettlement} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[62vh]">
          {/* AMC Banner */}
          <div className="theme-elevated flex items-center justify-between rounded-xl border p-3 text-xs">
            <div>
              <span className="theme-text-muted block text-[11px]">Selected Mutual Fund</span>
              <strong className="theme-text-primary text-sm font-extrabold">{currentFund.name}</strong>
            </div>
            <div className="text-right">
              <span className="theme-text-muted block text-[11px]">Current Units</span>
              <strong className="font-mono text-sm font-bold status-info-text">
                {currentFund.totalUnitsHeld.toFixed(4)}
              </strong>
            </div>
          </div>

          {/* CIP Cash Remainder Detected Alert */}
          {existingCashBuffer > 0 ? (
            <div className="status-warn-badge rounded-xl border p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 status-warn-text" />
                <span className="font-extrabold status-warn-text">
                  ৳{existingCashBuffer.toFixed(2)} Unsettled CIP Cash Remainder Detected!
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                This fractional cash balance from your previous CIP dividend will be settled with this monthly SIP installment.
              </p>

              {/* Settlement Choice Radios */}
              <div className="space-y-2 pt-1 border-t border-amber-500/30">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="settlementMethod"
                    value="ADD_TO_INVESTMENT"
                    checked={settlementMethod === "ADD_TO_INVESTMENT"}
                    onChange={() => setSettlementMethod("ADD_TO_INVESTMENT")}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="block font-bold">
                      Add cash remainder to investment purchase (Recommended)
                    </strong>
                    <span className="text-[11px] opacity-80 block">
                      Invest fresh ৳{formatBdt(numSip, 0)} + ৳{existingCashBuffer.toFixed(2)} cash buffer = <strong>৳{formatBdt(numSip + existingCashBuffer, 2)}</strong> total invested in units.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="settlementMethod"
                    value="DEDUCT_FROM_PAYMENT"
                    checked={settlementMethod === "DEDUCT_FROM_PAYMENT"}
                    onChange={() => setSettlementMethod("DEDUCT_FROM_PAYMENT")}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="block font-bold">
                      Deduct cash remainder from bank payment
                    </strong>
                    <span className="text-[11px] opacity-80 block">
                      Total ৳{formatBdt(numSip, 0)} invested in units. You only transfer <strong>৳{formatBdt(Math.max(0, numSip - existingCashBuffer), 2)}</strong> from your bank account.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="status-info-badge flex items-center gap-2 rounded-xl p-3 text-xs">
              <CheckCircle2 className="h-4 w-4 status-info-text shrink-0" />
              <span>No unsettled CIP cash remainder for this AMC. Clean regular monthly SIP installment.</span>
            </div>
          )}

          {/* SIP Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold theme-text-secondary mb-1">
                Monthly SIP Installment Amount (BDT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-xs font-mono font-bold theme-text-muted">৳</span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={sipAmount}
                  onChange={(e) => setSipAmount(e.target.value)}
                  required
                  className="form-control-input w-full rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold"
                />
              </div>
              <p className="text-[11px] theme-text-muted mt-1">Monthly target: ৳{currentFund.monthlySipTarget}</p>
            </div>

            <div>
              <label className="block text-xs font-bold theme-text-secondary mb-1">
                Execution NAV / Buy Price (BDT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-xs font-mono font-bold theme-text-muted">৳</span>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={sipExecutionNav}
                  onChange={(e) => setSipExecutionNav(e.target.value)}
                  required
                  className="form-control-input w-full rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono"
                />
              </div>
              <p className="text-[11px] theme-text-muted mt-1">Current NAV: ৳{currentFund.effectiveNav.toFixed(3)}</p>
            </div>
          </div>

          {/* Simulation Preview */}
          {sipSettlementPreview && (
            <div className="theme-elevated rounded-xl border p-3.5 space-y-2 text-xs">
              <span className="font-bold theme-text-primary block">Execution Summary Preview</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] theme-text-muted block">Effective Units Purchased</span>
                  <strong className="font-mono font-bold status-gain-text">
                    +{sipSettlementPreview.addedUnits.toFixed(4)} units
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[11px] theme-text-muted block">CIP Cash Settled</span>
                  <strong className="font-mono font-bold status-info-text">
                    ৳{existingCashBuffer.toFixed(2)} → ৳0.00
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] theme-text-muted block">New Total Invested</span>
                  <strong className="font-mono font-bold theme-text-primary">
                    ৳{formatBdt(sipSettlementPreview.newTotalInvested, 2)}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[11px] theme-text-muted block">New Average Buy Price</span>
                  <strong className="font-mono font-bold theme-text-primary">
                    ৳{sipSettlementPreview.newAverageBuyPrice.toFixed(4)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close("cancel")}
              className="theme-surface min-h-[44px] rounded-xl border px-4 py-2 text-xs font-bold theme-text-primary hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary min-h-[44px] rounded-xl px-5 py-2 text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? "Recording SIP..."
                  : existingCashBuffer > 0
                  ? `Execute SIP & Settle ৳${existingCashBuffer.toFixed(2)} Cash`
                  : `Record ৳${formatBdt(numSip, 0)} Monthly SIP`}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: EDIT BASELINE HOLDINGS                                        */}
      {/* ==================================================================== */}
      {activeTab === "baseline" && (
        <form onSubmit={handleSubmitBaseline} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[62vh]">
          <div className="space-y-4">
            {funds.map((f) => {
              const d = drafts[f.id] || {
                totalInvested: String(f.totalInvested),
                averageBuyPrice: String(f.averageBuyPrice),
                monthlySipTarget: String(f.monthlySipTarget || 8000),
              };
              const inv = Number(d.totalInvested) || 0;
              const avg = Number(d.averageBuyPrice) || 10;
              const calcUnits = inv > 0 && avg > 0 ? inv / avg : 0;

              return (
                <div key={f.id} className="theme-elevated rounded-xl border p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b theme-border pb-2">
                    <strong className="text-sm font-bold theme-text-primary">{f.name}</strong>
                    <span className="font-mono text-xs theme-text-secondary">
                      Calculated Units: <strong className="status-info-text">{calcUnits.toFixed(4)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold theme-text-secondary mb-1">
                        Total Invested (BDT)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={d.totalInvested}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) => ({
                            ...prev,
                            [f.id]: { ...d, totalInvested: val },
                          }));
                        }}
                        className="form-control-input w-full rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold theme-text-secondary mb-1">
                        Average Buy Price (BDT)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={d.averageBuyPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) => ({
                            ...prev,
                            [f.id]: { ...d, averageBuyPrice: val },
                          }));
                        }}
                        className="form-control-input w-full rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold theme-text-secondary mb-1">
                        Monthly SIP Target (BDT)
                      </label>
                      <input
                        type="number"
                        step="100"
                        value={d.monthlySipTarget}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) => ({
                            ...prev,
                            [f.id]: { ...d, monthlySipTarget: val },
                          }));
                        }}
                        className="form-control-input w-full rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close("cancel")}
              className="theme-surface min-h-[44px] rounded-xl border px-4 py-2 text-xs font-bold theme-text-primary hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary min-h-[44px] rounded-xl px-5 py-2 text-xs font-bold shadow-md disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Baseline Holdings"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
