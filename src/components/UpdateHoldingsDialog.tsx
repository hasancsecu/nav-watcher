"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import {
  FundValuationMetrics,
  PortfolioSummaryMetrics,
  calculateCipReinvestment,
  simulateSipInstallment,
} from "@/lib/calculations";
import { PortfolioHistoryItem } from "./PortfolioHistoryChart";
import {
  X,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Coins,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
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
    }>,
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
  initialTab = "baseline",
  initialFocusFundId,
  funds,
  onClose,
  onSaveHoldings,
  onDataUpdated,
}: UpdateHoldingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  // Selected filter pill: "all" or specific fund ID
  const [activeFundFilter, setActiveFundFilter] = useState<string>("all");

  // Inline expanded forms: fundId -> "sip" | "cip" | null
  const [expandedAction, setExpandedAction] = useState<Record<string, "sip" | "cip" | null>>({});

  // Inline SIP state per fund
  const [sipCashInputs, setSipCashInputs] = useState<Record<string, string>>({});
  const [sipNavInputs, setSipNavInputs] = useState<Record<string, string>>({});

  // Inline CIP state per fund
  const [cipDividendInputs, setCipDividendInputs] = useState<Record<string, string>>({});
  const [cipNavInputs, setCipNavInputs] = useState<Record<string, string>>({});

  // Baseline Draft holdings
  const [drafts, setDrafts] = useState<Record<string, DraftHolding>>({});

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingActionFundId, setSubmittingActionFundId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Sync draft and form values whenever modal opens
  useEffect(() => {
    if (isOpen && funds.length > 0) {
      const initial: Record<string, DraftHolding> = {};
      const initialSipCash: Record<string, string> = {};
      const initialSipNav: Record<string, string> = {};
      const initialCipDiv: Record<string, string> = {};
      const initialCipNav: Record<string, string> = {};
      const initialExpanded: Record<string, "sip" | "cip" | null> = {};

      for (const f of funds) {
        initial[f.id] = {
          totalInvested: String(f.totalInvested),
          averageBuyPrice: String(f.averageBuyPrice),
          monthlySipTarget: String(f.monthlySipTarget || 8000),
        };
        initialSipCash[f.id] = String(f.monthlySipTarget || 8000);
        initialSipNav[f.id] = String(f.effectiveNav || f.averageBuyPrice || 10);
        initialCipDiv[f.id] = "";
        initialCipNav[f.id] = String(f.effectiveNav || f.averageBuyPrice || 10);

        // If opened with specific action
        if (initialFocusFundId === f.id && (initialTab === "sip" || initialTab === "cip")) {
          initialExpanded[f.id] = initialTab;
        } else {
          initialExpanded[f.id] = null;
        }
      }

      setDrafts(initial);
      setSipCashInputs(initialSipCash);
      setSipNavInputs(initialSipNav);
      setCipDividendInputs(initialCipDiv);
      setCipNavInputs(initialCipNav);
      setExpandedAction(initialExpanded);

      if (initialFocusFundId && funds.some((f) => f.id === initialFocusFundId)) {
        setActiveFundFilter(initialFocusFundId);
      } else {
        setActiveFundFilter("all");
      }

      setSubmitError(null);
      setActionSuccessMessage(null);
    }
  }, [isOpen, funds, initialFocusFundId, initialTab]);

  // Manage native <dialog> showModal() and close() lifecycle
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Light-dismiss fallback & close listener
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

  const validateField = (
    fundId: string,
    field: "totalInvested" | "averageBuyPrice",
    value: string,
  ) => {
    const num = Number(value);
    if (field === "totalInvested") {
      if (value.trim() === "" || Number.isNaN(num) || num < 0) {
        return "Enter a valid non-negative BDT amount (e.g., 44000).";
      }
    } else {
      if (value.trim() === "" || Number.isNaN(num) || num <= 0) {
        return "Enter a valid Average Buy Price greater than 0 (e.g., 10.74).";
      }
    }
    return undefined;
  };

  const handleInputChange = (
    fundId: string,
    field: "totalInvested" | "averageBuyPrice" | "monthlySipTarget",
    value: string,
  ) => {
    setDrafts((prev) => {
      const current = prev[fundId] || {
        totalInvested: "0",
        averageBuyPrice: "10",
        monthlySipTarget: "8000",
      };
      const next: DraftHolding = {
        ...current,
        [field]: value,
      };
      if (field === "totalInvested" && current.investedError) {
        if (!validateField(fundId, "totalInvested", value)) {
          next.investedError = undefined;
        }
      }
      if (field === "averageBuyPrice" && current.avgBuyError) {
        if (!validateField(fundId, "averageBuyPrice", value)) {
          next.avgBuyError = undefined;
        }
      }
      return { ...prev, [fundId]: next };
    });
  };

  const handleBlur = (
    fundId: string,
    field: "totalInvested" | "averageBuyPrice",
  ) => {
    const current = drafts[fundId];
    if (!current) return;
    const error = validateField(fundId, field, current[field]);
    setDrafts((prev) => ({
      ...prev,
      [fundId]: {
        ...prev[fundId],
        [field === "totalInvested" ? "investedError" : "avgBuyError"]: error,
      },
    }));
  };

  // Toggle inline SIP or CIP drawer inside fund card
  const toggleInlineAction = (fundId: string, action: "sip" | "cip") => {
    setExpandedAction((prev) => ({
      ...prev,
      [fundId]: prev[fundId] === action ? null : action,
    }));
    setSubmitError(null);
    setActionSuccessMessage(null);
  };

  // Execute inline Monthly SIP with auto cash settlement
  const handleExecuteSip = async (fund: FundValuationMetrics) => {
    try {
      setSubmittingActionFundId(fund.id);
      setSubmitError(null);
      setActionSuccessMessage(null);

      const cash = Number(sipCashInputs[fund.id]) || fund.monthlySipTarget || 8000;
      const nav = Number(sipNavInputs[fund.id]) || fund.effectiveNav || fund.averageBuyPrice || 10;

      const res = await fetch("/api/cip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: fund.id,
          freshSipCash: cash,
          executionNav: nav,
          settlementMethod: "ADD_TO_INVESTMENT",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record monthly SIP.");
      }

      if (onDataUpdated) {
        onDataUpdated({
          summary: data.summary,
          funds: data.funds,
          history: data.history,
        });
      }

      setActionSuccessMessage(
        `Recorded SIP for ${fund.shortName}: +${data.settlement?.addedUnits ?? 0} integer units allotted. Cash balance updated.`,
      );
      setExpandedAction((prev) => ({ ...prev, [fund.id]: null }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingActionFundId(null);
    }
  };

  // Execute inline CIP Dividend Reinvestment into integer units + cash remainder
  const handleExecuteCip = async (fund: FundValuationMetrics) => {
    try {
      setSubmittingActionFundId(fund.id);
      setSubmitError(null);
      setActionSuccessMessage(null);

      const dividend = Number(cipDividendInputs[fund.id]);
      const nav = Number(cipNavInputs[fund.id]) || fund.effectiveNav || fund.averageBuyPrice || 10;

      if (!dividend || dividend <= 0) {
        throw new Error("Please enter a valid dividend amount in BDT.");
      }

      const res = await fetch("/api/cip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: fund.id,
          dividendAmount: dividend,
          cipNav: nav,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add CIP dividend.");
      }

      if (onDataUpdated) {
        onDataUpdated({
          summary: data.summary,
          funds: data.funds,
          history: data.history,
        });
      }

      setActionSuccessMessage(
        `Added CIP Dividend for ${fund.shortName}: +${data.unitsAllotted} integer units. Remaining ৳${data.cashRemainder} cash held for next SIP.`,
      );
      setExpandedAction((prev) => ({ ...prev, [fund.id]: null }));
      setCipDividendInputs((prev) => ({ ...prev, [fund.id]: "" }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingActionFundId(null);
    }
  };

  // Save Baseline Holdings Form
  const handleSubmitBaseline = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    // Validate all fields
    let hasError = false;
    const validatedDrafts = { ...drafts };

    for (const f of funds) {
      const d = drafts[f.id] || {
        totalInvested: "0",
        averageBuyPrice: "10",
        monthlySipTarget: "8000",
      };
      const invErr = validateField(f.id, "totalInvested", d.totalInvested);
      const avgErr = validateField(f.id, "averageBuyPrice", d.averageBuyPrice);

      validatedDrafts[f.id] = {
        ...d,
        investedError: invErr,
        avgBuyError: avgErr,
      };

      if (invErr || avgErr) hasError = true;
    }

    setDrafts(validatedDrafts);
    if (hasError) {
      setSubmitError("Please correct the invalid fields marked in red.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updates = funds.map((f) => {
        const d = drafts[f.id];
        return {
          fundId: f.id,
          totalInvested: Number(d.totalInvested),
          averageBuyPrice: Number(d.averageBuyPrice),
          monthlySipTarget: Number(d.monthlySipTarget || 8000),
        };
      });

      await onSaveHoldings(updates);
      dialogRef.current?.close("saved");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save baseline holdings.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFunds =
    activeFundFilter === "all"
      ? funds
      : funds.filter((f) => f.id === activeFundFilter);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="theme-elevated modal-native-backdrop w-full max-w-2xl rounded-2xl border theme-border p-0 shadow-2xl backdrop:bg-slate-950/70"
    >
      <form onSubmit={handleSubmitBaseline} className="flex flex-col max-h-[90dvh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b theme-border px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary truncate"
              >
                Edit Holdings &amp; Investments
              </h2>
              <p className="text-xs theme-text-secondary truncate">
                Integer units · Cash buffers · SIP &amp; CIP dividend actions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close("dismiss")}
            aria-label="Close dialog"
            className="theme-text-muted hover:theme-text-primary rounded-xl p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Global Notifications */}
        {actionSuccessMessage && (
          <div className="mx-4 mt-3 sm:mx-6 rounded-xl border p-3 text-xs status-gain-badge flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 status-gain-text" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}
        {submitError && (
          <div className="mx-4 mt-3 sm:mx-6 rounded-xl border p-3 text-xs status-loss-badge flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 status-loss-text" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Fund Selector Filter Pills */}
        <div className="border-b theme-border px-4 py-2 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveFundFilter("all")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 whitespace-nowrap min-h-[36px] ${
                activeFundFilter === "all"
                  ? "btn-primary shadow-sm"
                  : "theme-surface theme-text-secondary hover:theme-text-primary border theme-border"
              }`}
            >
              All Funds ({funds.length})
            </button>
            {funds.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFundFilter(f.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 whitespace-nowrap min-h-[36px] ${
                  activeFundFilter === f.id
                    ? "btn-primary shadow-sm"
                    : "theme-surface theme-text-secondary hover:theme-text-primary border theme-border"
                }`}
              >
                {f.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          <div className="space-y-5">
            {filteredFunds.map((fund) => {
              const d = drafts[fund.id] || {
                totalInvested: String(fund.totalInvested),
                averageBuyPrice: String(fund.averageBuyPrice),
                monthlySipTarget: String(fund.monthlySipTarget || 8000),
              };

              const numInvested = Math.max(0, Number(d.totalInvested) || 0);
              const numAvgBuy = Number(d.averageBuyPrice) > 0 ? Number(d.averageBuyPrice) : 10;
              const previewUnits = Math.floor(numInvested / numAvgBuy);
              const previewUnitsCost = Number((previewUnits * numAvgBuy).toFixed(2));
              const previewCashRemainder = Math.max(0, Number((numInvested - previewUnitsCost).toFixed(2)));
              const previewMarketVal = previewUnits * fund.effectiveNav;

              const isSipExpanded = expandedAction[fund.id] === "sip";
              const isCipExpanded = expandedAction[fund.id] === "cip";
              const isFundActionLoading = submittingActionFundId === fund.id;

              // Compute inline SIP preview
              const sipCashVal = Number(sipCashInputs[fund.id]) || fund.monthlySipTarget || 8000;
              const sipNavVal = Number(sipNavInputs[fund.id]) || fund.effectiveNav || fund.averageBuyPrice || 10;
              const sipSim = simulateSipInstallment(
                fund.totalInvested,
                fund.averageBuyPrice,
                sipCashVal,
                sipNavVal,
                fund.totalUnitsHeld,
                fund.fractionalCashBalance
              );

              // Compute inline CIP preview
              const cipDivVal = Number(cipDividendInputs[fund.id]) || 0;
              const cipNavVal = Number(cipNavInputs[fund.id]) || fund.effectiveNav || fund.averageBuyPrice || 10;
              const cipCalc = calculateCipReinvestment(
                cipDivVal,
                cipNavVal,
                fund.fractionalCashBalance
              );

              return (
                <fieldset
                  key={fund.id}
                  className="theme-elevated rounded-2xl border theme-border p-4 sm:p-5 space-y-4 shadow-sm"
                >
                  {/* Fund Header Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b theme-border pb-3">
                    <div className="min-w-0">
                      <legend className="text-sm sm:text-base font-extrabold theme-text-primary">
                        {fund.name}
                      </legend>
                      <p className="text-[11px] theme-text-muted mt-0.5">
                        {fund.fundManager} · NAV Date: {fund.navEffectiveDate || "Latest Day"}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-lg border theme-border px-2.5 py-1 text-xs font-mono font-bold status-gain-badge">
                      <span>Latest NAV:</span>
                      <strong>৳{fund.effectiveNav.toFixed(3)}</strong>
                    </div>
                  </div>

                  {/* Integer Units & Cash Buffer Info Banner */}
                  <div className="theme-surface rounded-xl border theme-border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs theme-text-secondary">Current Holdings:</span>
                        <strong className="font-mono text-xs sm:text-sm font-bold status-info-text">
                          {Math.floor(fund.totalUnitsHeld).toLocaleString("en-BD")} units
                        </strong>
                        <span className="text-[10px] theme-text-muted">(Plain Integer)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Coins className="h-3.5 w-3.5 status-warn-text" />
                        <span className="theme-text-secondary">Cash Buffer:</span>
                        <strong className="font-mono font-bold status-warn-text">
                          ৳{formatBdt(fund.fractionalCashBalance, 2)}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] theme-text-muted leading-relaxed">
                      Under Bangladesh AMC rules, mutual fund units are strictly whole integers. The decimal remainder (৳{formatBdt(fund.fractionalCashBalance, 2)}) is held in cash and automatically rolls forward to settle with whole units on your next monthly SIP.
                    </p>
                  </div>

                  {/* 2 Quick Action Buttons inside this fund card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleInlineAction(fund.id, "sip")}
                      className={`inline-flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition min-h-[44px] ${
                        isSipExpanded
                          ? "btn-primary shadow-sm"
                          : "theme-surface theme-text-primary hover:border-emerald-500/50"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <RefreshCw className="h-4 w-4 shrink-0" />
                        <span>Record Monthly SIP (৳{formatBdt(fund.monthlySipTarget || 8000, 0)})</span>
                      </span>
                      {isSipExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleInlineAction(fund.id, "cip")}
                      className={`inline-flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition min-h-[44px] ${
                        isCipExpanded
                          ? "status-gain-badge border-emerald-500/50 shadow-sm"
                          : "theme-surface theme-text-primary hover:border-emerald-500/50"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Coins className="h-4 w-4 status-gain-text shrink-0" />
                        <span>Add CIP Dividend</span>
                      </span>
                      {isCipExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* INLINE SIP EXPANDABLE DRAWER */}
                  {isSipExpanded && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Record Monthly SIP Installment</span>
                        </h4>
                        <span className="text-[11px] status-warn-text font-semibold">
                          Combines ৳{formatBdt(fund.fractionalCashBalance, 2)} cash buffer
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-semibold theme-text-secondary">
                            Fresh Monthly SIP Cash (BDT)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sipCashInputs[fund.id] ?? ""}
                            onChange={(e) =>
                              setSipCashInputs((prev) => ({
                                ...prev,
                                [fund.id]: e.target.value,
                              }))
                            }
                            placeholder="8000"
                            className="form-control-input rounded-xl border px-3 py-2 font-mono font-semibold text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-semibold theme-text-secondary">
                            Execution NAV (BDT)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sipNavInputs[fund.id] ?? ""}
                            onChange={(e) =>
                              setSipNavInputs((prev) => ({
                                ...prev,
                                [fund.id]: e.target.value,
                              }))
                            }
                            placeholder="10.596"
                            className="form-control-input rounded-xl border px-3 py-2 font-mono font-semibold text-xs"
                          />
                        </div>
                      </div>

                      {/* Live SIP Settlement Preview */}
                      <div className="theme-surface rounded-xl border theme-border p-2.5 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold theme-text-primary">
                          <span>Total Cash Available:</span>
                          <span className="font-mono">
                            ৳{formatBdt(sipCashVal + fund.fractionalCashBalance, 2)} (৳{formatBdt(sipCashVal, 0)} + ৳{formatBdt(fund.fractionalCashBalance, 2)} buffer)
                          </span>
                        </div>
                        <div className="flex items-center justify-between theme-text-secondary">
                          <span>New Plain Integer Units:</span>
                          <span className="font-mono font-bold status-gain-text">
                            +{sipSim.addedUnits} units @ ৳{sipNavVal.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between theme-text-secondary">
                          <span>Remaining Cash (rolls to next SIP):</span>
                          <span className="font-mono font-bold status-warn-text">
                            ৳{formatBdt(sipSim.remainingCashBalance, 2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between theme-text-muted pt-1 border-t theme-border text-[10px]">
                          <span>New Total Holdings:</span>
                          <span className="font-mono font-bold theme-text-primary">
                            {sipSim.newTotalUnits} units · Avg ৳{sipSim.newAverageBuyPrice.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleInlineAction(fund.id, "sip")}
                          className="theme-surface rounded-lg border px-3 py-1.5 text-xs font-semibold theme-text-primary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isFundActionLoading}
                          onClick={() => handleExecuteSip(fund)}
                          className="btn-primary rounded-lg px-4 py-1.5 text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                        >
                          {isFundActionLoading ? "Recording SIP..." : "Record SIP & Settle Cash"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* INLINE CIP DIVIDEND EXPANDABLE DRAWER */}
                  {isCipExpanded && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                          <Coins className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Add CIP Dividend Reinvestment</span>
                        </h4>
                        <span className="text-[11px] status-warn-text font-semibold">
                          Includes ৳{formatBdt(fund.fractionalCashBalance, 2)} buffer
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-semibold theme-text-secondary">
                            CIP Dividend Cash Value (BDT)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={cipDividendInputs[fund.id] ?? ""}
                            onChange={(e) =>
                              setCipDividendInputs((prev) => ({
                                ...prev,
                                [fund.id]: e.target.value,
                              }))
                            }
                            placeholder="e.g. 2000"
                            className="form-control-input rounded-xl border px-3 py-2 font-mono font-semibold text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-semibold theme-text-secondary">
                            Execution CIP NAV (BDT)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={cipNavInputs[fund.id] ?? ""}
                            onChange={(e) =>
                              setCipNavInputs((prev) => ({
                                ...prev,
                                [fund.id]: e.target.value,
                              }))
                            }
                            placeholder="10.74"
                            className="form-control-input rounded-xl border px-3 py-2 font-mono font-semibold text-xs"
                          />
                        </div>
                      </div>

                      {/* Live CIP Preview */}
                      <div className="theme-surface rounded-xl border theme-border p-2.5 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold theme-text-primary">
                          <span>Total Reinvestment Funds:</span>
                          <span className="font-mono">
                            ৳{formatBdt(cipCalc.totalAvailable, 2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between theme-text-secondary">
                          <span>Allotted Plain Integer Units:</span>
                          <span className="font-mono font-bold status-gain-text">
                            +{cipCalc.unitsAllotted} units @ ৳{cipNavVal.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between theme-text-secondary">
                          <span>New Cash Balance (to next SIP):</span>
                          <span className="font-mono font-bold status-warn-text">
                            ৳{formatBdt(cipCalc.cashRemainder, 2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between theme-text-muted pt-1 border-t theme-border text-[10px]">
                          <span>Post-CIP Total Holdings:</span>
                          <span className="font-mono font-bold theme-text-primary">
                            {Math.floor(fund.totalUnitsHeld) + cipCalc.unitsAllotted} units
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleInlineAction(fund.id, "cip")}
                          className="theme-surface rounded-lg border px-3 py-1.5 text-xs font-semibold theme-text-primary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isFundActionLoading || !cipDivVal || cipDivVal <= 0}
                          onClick={() => handleExecuteCip(fund)}
                          className="btn-primary rounded-lg px-4 py-1.5 text-xs font-bold shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isFundActionLoading ? "Adding CIP Units..." : "Credit CIP Integer Units"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3 Baseline Inputs (The Clean UI the user loved!) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Total Invested (BDT) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`invested-${fund.id}`}
                        className="text-xs font-semibold theme-text-primary"
                      >
                        Total Invested (BDT)
                      </label>
                      <input
                        id={`invested-${fund.id}`}
                        name={`invested-${fund.id}`}
                        type="text"
                        inputMode="decimal"
                        aria-invalid={Boolean(d.investedError)}
                        aria-describedby={
                          d.investedError
                            ? `invested-err-${fund.id}`
                            : `invested-help-${fund.id}`
                        }
                        value={d.totalInvested}
                        onChange={(e) =>
                          handleInputChange(
                            fund.id,
                            "totalInvested",
                            e.target.value,
                          )
                        }
                        onBlur={() => handleBlur(fund.id, "totalInvested")}
                        className="form-control-input rounded-xl border px-3.5 py-2.5 font-mono font-semibold text-xs sm:text-sm"
                      />
                      {d.investedError ? (
                        <span
                          id={`invested-err-${fund.id}`}
                          className="text-xs font-medium status-loss-text"
                        >
                          {d.investedError}
                        </span>
                      ) : (
                        <span
                          id={`invested-help-${fund.id}`}
                          className="text-xs theme-text-muted"
                        >
                          Cumulative capital deposited
                        </span>
                      )}
                    </div>

                    {/* Average Buy Price (BDT) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`avgbuy-${fund.id}`}
                        className="text-xs font-semibold theme-text-primary"
                      >
                        Average Buy Price (BDT)
                      </label>
                      <input
                        id={`avgbuy-${fund.id}`}
                        name={`avgbuy-${fund.id}`}
                        type="text"
                        inputMode="decimal"
                        aria-invalid={Boolean(d.avgBuyError)}
                        aria-describedby={
                          d.avgBuyError
                            ? `avgbuy-err-${fund.id}`
                            : `avgbuy-help-${fund.id}`
                        }
                        value={d.averageBuyPrice}
                        onChange={(e) =>
                          handleInputChange(
                            fund.id,
                            "averageBuyPrice",
                            e.target.value,
                          )
                        }
                        onBlur={() => handleBlur(fund.id, "averageBuyPrice")}
                        className="form-control-input rounded-xl border px-3.5 py-2.5 font-mono font-semibold text-xs sm:text-sm"
                      />
                      {d.avgBuyError ? (
                        <span
                          id={`avgbuy-err-${fund.id}`}
                          className="text-xs font-medium status-loss-text"
                        >
                          {d.avgBuyError}
                        </span>
                      ) : (
                        <span
                          id={`avgbuy-help-${fund.id}`}
                          className="text-xs theme-text-muted"
                        >
                          Weighted purchase price
                        </span>
                      )}
                    </div>

                    {/* Monthly SIP Installment Target (BDT) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`sip-${fund.id}`}
                        className="text-xs font-semibold theme-text-primary"
                      >
                        Monthly SIP Target (BDT)
                      </label>
                      <input
                        id={`sip-${fund.id}`}
                        name={`sip-${fund.id}`}
                        type="text"
                        inputMode="decimal"
                        value={d.monthlySipTarget}
                        onChange={(e) =>
                          handleInputChange(
                            fund.id,
                            "monthlySipTarget",
                            e.target.value,
                          )
                        }
                        className="form-control-input rounded-xl border px-3.5 py-2.5 font-mono font-semibold text-xs sm:text-sm"
                      />
                      <span className="text-xs theme-text-muted">
                        Default ~8,000 BDT/month
                      </span>
                    </div>
                  </div>

                  {/* Live Formula Preview Bar */}
                  <div className="theme-surface mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs border theme-border">
                    <div className="flex items-center gap-1.5 theme-text-secondary">
                      <Calculator
                        className="h-4 w-4 status-info-text shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Integer Units:{" "}
                        <strong className="font-mono font-bold theme-text-primary">
                          {previewUnits.toLocaleString("en-BD")}
                        </strong>{" "}
                        units
                        {previewCashRemainder > 0 && (
                          <span className="status-warn-text ml-1 font-semibold">
                            (৳{formatBdt(previewCashRemainder, 2)} cash remainder)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="theme-text-secondary">
                      Est. Market Value:{" "}
                      <strong className="font-mono font-bold status-gain-text">
                        ৳{formatBdt(previewMarketVal, 2)}
                      </strong>
                    </div>
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="theme-elevated flex items-center justify-end gap-3 border-t theme-border px-4 py-3.5 sm:px-6 pb-safe-bottom">
          <button
            type="button"
            onClick={() => dialogRef.current?.close("cancel")}
            className="theme-surface min-h-[44px] rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-semibold theme-text-primary hover:opacity-90 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary inline-flex flex-1 sm:flex-initial justify-center min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold disabled:opacity-60 transition shadow-md"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {isSubmitting ? "Saving Holdings..." : "Save Baseline Holdings"}
            </span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
