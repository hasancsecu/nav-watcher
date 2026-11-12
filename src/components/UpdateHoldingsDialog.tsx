"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import {
  FundValuationMetrics,
  simulateSipInstallment,
} from "@/lib/calculations";
import {
  X,
  PlusCircle,
  Calculator,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface UpdateHoldingsDialogProps {
  isOpen: boolean;
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
}

interface DraftHolding {
  totalInvested: string;
  averageBuyPrice: string;
  monthlySipTarget: string;
  investedError?: string;
  avgBuyError?: string;
}

export default function UpdateHoldingsDialog({
  isOpen,
  initialFocusFundId,
  funds,
  onClose,
  onSaveHoldings,
}: UpdateHoldingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [drafts, setDrafts] = useState<Record<string, DraftHolding>>({});
  const [activeMobileFundId, setActiveMobileFundId] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync draft values when modal opens
  useEffect(() => {
    if (isOpen && funds.length > 0) {
      const initial: Record<string, DraftHolding> = {};
      for (const f of funds) {
        initial[f.id] = {
          totalInvested: String(f.totalInvested),
          averageBuyPrice: String(f.averageBuyPrice),
          monthlySipTarget: String(f.monthlySipTarget || 8000),
        };
      }
      setDrafts(initial);
      setActiveMobileFundId(initialFocusFundId || "all");
      setSubmitError(null);
    }
  }, [isOpen, funds, initialFocusFundId]);

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

  // MANDATORY light-dismiss fallback for browsers without native closedby="any" support
  // plus native close listener resetting dialog.returnValue = ''
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
    setDrafts((prev) => {
      const current = prev[fundId];
      if (!current) return prev;
      const err = validateField(fundId, field, current[field]);
      return {
        ...prev,
        [fundId]: {
          ...current,
          ...(field === "totalInvested"
            ? { investedError: err }
            : { avgBuyError: err }),
        },
      };
    });
  };

  const handleQuickAddSip = (fund: FundValuationMetrics) => {
    const currentDraft = drafts[fund.id];
    if (!currentDraft) return;
    const curInvested = Number(currentDraft.totalInvested) || 0;
    const curAvg =
      Number(currentDraft.averageBuyPrice) || fund.effectiveNav || 10;
    const sipAmt = Number(currentDraft.monthlySipTarget) || 8000;
    const execNav = fund.buyPrice || fund.effectiveNav || curAvg;

    const simulated = simulateSipInstallment(
      curInvested,
      curAvg,
      sipAmt,
      execNav,
    );

    setDrafts((prev) => ({
      ...prev,
      [fund.id]: {
        ...currentDraft,
        totalInvested: String(simulated.newTotalInvested),
        averageBuyPrice: String(simulated.newAverageBuyPrice),
        investedError: undefined,
        avgBuyError: undefined,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    let hasErrors = false;
    let firstErrorFundId: string | null = null;
    const nextDrafts = { ...drafts };
    const payload: Array<{
      fundId: string;
      totalInvested: number;
      averageBuyPrice: number;
      monthlySipTarget: number;
    }> = [];

    for (const f of funds) {
      const d = nextDrafts[f.id];
      if (!d) continue;
      const invErr = validateField(f.id, "totalInvested", d.totalInvested);
      const avgErr = validateField(f.id, "averageBuyPrice", d.averageBuyPrice);
      if (invErr || avgErr) {
        hasErrors = true;
        if (!firstErrorFundId) firstErrorFundId = f.id;
        nextDrafts[f.id] = {
          ...d,
          investedError: invErr,
          avgBuyError: avgErr,
        };
      } else {
        payload.push({
          fundId: f.id,
          totalInvested: Number(d.totalInvested),
          averageBuyPrice: Number(d.averageBuyPrice),
          monthlySipTarget: Number(d.monthlySipTarget) || 8000,
        });
      }
    }

    if (hasErrors) {
      setDrafts(nextDrafts);
      if (firstErrorFundId && activeMobileFundId !== "all") {
        setActiveMobileFundId(firstErrorFundId);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveHoldings(payload);
      dialogRef.current?.close("saved");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save holdings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleFunds =
    activeMobileFundId === "all"
      ? funds
      : funds.filter((f) => f.id === activeMobileFundId);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({
        closedby: "any",
      } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="theme-surface m-auto max-sm:mb-0 max-sm:mt-auto w-full sm:w-[calc(100%-2rem)] max-w-4xl rounded-t-3xl sm:rounded-2xl border p-0 shadow-2xl max-h-[92vh] overflow-hidden"
    >
      {/* Mobile Bottom-Sheet Drag Handle Indicator */}
      <div className="sm:hidden flex justify-center pt-2.5 pb-1 theme-elevated">
        <span className="h-1.5 w-12 rounded-full bg-slate-400/50" />
      </div>

      <div className="theme-elevated flex items-start sm:items-center justify-between border-b px-4 py-3.5 sm:px-6 sm:py-4 gap-3">
        <div>
          <h2
            id={titleId}
            className="text-base sm:text-lg font-bold theme-text-primary"
          >
            Update Portfolio &amp; Monthly SIP Holdings
          </h2>
          <p className="text-xs sm:text-sm theme-text-secondary mt-0.5">
            Edit your Total Invested Amount (BDT) and Average Buy Price / Cost
            NAV anytime, or tap &ldquo;+ Record Monthly SIP&rdquo;.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close("cancel")}
          aria-label="Close holdings modal"
          className="theme-surface inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border theme-text-secondary hover:opacity-80 transition"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Single-Row Fund Filter Tabs for Fast One-Handed Mobile Editing */}
      <div
        role="tablist"
        aria-label="Select mutual fund to edit"
        className="app-tablist theme-elevated px-4 sm:px-6"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeMobileFundId === "all"}
          onClick={() => setActiveMobileFundId("all")}
          className="app-tab text-xs sm:text-sm"
        >
          All 3 Funds
        </button>
        {funds.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={activeMobileFundId === f.id}
            onClick={() => setActiveMobileFundId(f.id)}
            className="app-tab text-xs sm:text-sm"
          >
            {f.shortName || f.name}
          </button>
        ))}
      </div>

      <form
        method="POST"
        action="/api/funds"
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col max-h-[calc(92dvh-8.5rem)]"
      >
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {submitError && (
            <div
              role="status"
              aria-live="polite"
              className="status-loss-badge flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="space-y-4">
            {visibleFunds.map((fund, idx) => {
              const d = drafts[fund.id] || {
                totalInvested: String(fund.totalInvested),
                averageBuyPrice: String(fund.averageBuyPrice),
                monthlySipTarget: String(fund.monthlySipTarget || 8000),
              };
              const previewInvested = Number(d.totalInvested) || 0;
              const previewAvg = Number(d.averageBuyPrice) || 10;
              const previewUnits =
                previewInvested > 0 && previewAvg > 0
                  ? previewInvested / previewAvg
                  : 0;
              const previewMarketVal = previewUnits * fund.effectiveNav;
              const isHighlighted =
                initialFocusFundId === fund.id ||
                (!initialFocusFundId && idx === 0);

              return (
                <fieldset
                  key={fund.id}
                  className="theme-elevated rounded-2xl border p-4 transition"
                >
                  <legend className="px-2 text-sm font-bold status-gain-text">
                    {fund.name}
                  </legend>

                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 text-xs theme-text-secondary">
                    <span>
                      Latest Scraped NAV:{" "}
                      <strong className="font-mono font-bold theme-text-primary">
                        ৳{fund.effectiveNav.toFixed(3)}
                      </strong>{" "}
                      ({fund.navEffectiveDate || "Latest"})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickAddSip(fund)}
                      className="status-gain-badge inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                    >
                      <PlusCircle
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        + Record Monthly SIP (৳
                        {Number(d.monthlySipTarget || 8000).toLocaleString(
                          "en-BD",
                        )}{" "}
                        @ ৳{(fund.buyPrice || fund.effectiveNav).toFixed(2)})
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Total Invested Amount (BDT) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`invested-${fund.id}`}
                        className="text-xs font-semibold theme-text-primary"
                      >
                        Total Invested Amount (BDT){" "}
                        <span aria-hidden="true" className="status-gain-text">
                          *
                        </span>
                      </label>
                      <input
                        id={`invested-${fund.id}`}
                        name={`invested-${fund.id}`}
                        type="text"
                        inputMode="decimal"
                        required
                        autoFocus={isHighlighted}
                        aria-invalid={d.investedError ? "true" : undefined}
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
                        className="form-control-input rounded-xl border px-3.5 py-2.5 font-mono font-semibold"
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
                          Cumulative BDT invested via SIP
                        </span>
                      )}
                    </div>

                    {/* Average Buy Price / Cost NAV (BDT) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`avgbuy-${fund.id}`}
                        className="text-xs font-semibold theme-text-primary"
                      >
                        Average Buy Price / Cost NAV (BDT){" "}
                        <span aria-hidden="true" className="status-gain-text">
                          *
                        </span>
                      </label>
                      <input
                        id={`avgbuy-${fund.id}`}
                        name={`avgbuy-${fund.id}`}
                        type="text"
                        inputMode="decimal"
                        required
                        aria-invalid={d.avgBuyError ? "true" : undefined}
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
                        className="form-control-input rounded-xl border px-3.5 py-2.5 font-mono font-semibold"
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
                          Weighted average cost per unit
                        </span>
                      )}
                    </div>

                    {/* Monthly SIP Installment Target (BDT) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`sip-${fund.id}`}
                        className="text-xs font-semibold theme-text-primary"
                      >
                        Monthly SIP Installment (BDT)
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
                        className="form-control-input rounded-xl border px-3.5 py-2.5 font-mono font-semibold"
                      />
                      <span className="text-xs theme-text-muted">
                        Default ~8,000 BDT/month
                      </span>
                    </div>
                  </div>

                  {/* Live Formula Preview Bar */}
                  <div className="theme-surface mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs border theme-border">
                    <div className="flex items-center gap-1.5 theme-text-secondary">
                      <Calculator
                        className="h-4 w-4 status-info-text"
                        aria-hidden="true"
                      />
                      <span>
                        Computed Units:{" "}
                        <strong className="font-mono font-bold theme-text-primary">
                          {previewUnits.toFixed(4)}
                        </strong>{" "}
                        units
                      </span>
                    </div>
                    <div className="theme-text-secondary">
                      Est. Market Value:{" "}
                      <strong className="font-mono font-bold status-gain-text">
                        ৳
                        {previewMarketVal.toLocaleString("en-BD", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>

        <div className="theme-elevated flex items-center justify-end gap-3 border-t theme-border px-4 py-3.5 sm:px-6 pb-safe-bottom">
          <button
            type="button"
            onClick={() => dialogRef.current?.close("cancel")}
            className="theme-surface min-h-[48px] rounded-xl border px-4 py-2.5 text-sm font-semibold theme-text-primary hover:opacity-90 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary inline-flex flex-1 sm:flex-initial justify-center min-h-[48px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-60 transition shadow-md"
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
