"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import {
  FundValuationMetrics,
  simulateSipInstallment,
} from "@/lib/calculations";
import { X, PlusCircle, Calculator, CheckCircle2, AlertCircle } from "lucide-react";

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
    }>
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
      setSubmitError(null);
    }
  }, [isOpen, funds]);

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
    value: string
  ) => {
    const num = Number(value);
    if (field === "totalInvested") {
      if (value.trim() === "" || Number.isNaN(num) || num < 0) {
        return "Enter a valid non-negative BDT amount (e.g., 48000).";
      }
    } else {
      if (value.trim() === "" || Number.isNaN(num) || num <= 0) {
        return "Enter a valid Average Buy Price greater than 0 (e.g., 10.45).";
      }
    }
    return undefined;
  };

  const handleInputChange = (
    fundId: string,
    field: "totalInvested" | "averageBuyPrice" | "monthlySipTarget",
    value: string
  ) => {
    setDrafts((prev) => {
      const current = prev[fundId] || {
        totalInvested: "0",
        averageBuyPrice: "10",
        monthlySipTarget: "8000",
      };
      // Clear existing error on input once resolved (per modern-web-guidance forms)
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
    field: "totalInvested" | "averageBuyPrice"
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
    const curAvg = Number(currentDraft.averageBuyPrice) || fund.effectiveNav || 10;
    const sipAmt = Number(currentDraft.monthlySipTarget) || 8000;
    const execNav = fund.buyPrice || fund.effectiveNav || curAvg;

    const simulated = simulateSipInstallment(
      curInvested,
      curAvg,
      sipAmt,
      execNav
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
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveHoldings(payload);
      dialogRef.current?.close("saved");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save holdings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-[calc(100%-1.5rem)] max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
        <div>
          <h2 id={titleId} className="text-lg font-semibold text-white">
            Update Portfolio &amp; Monthly SIP Baseline Holdings
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Edit your Total Invested Amount (BDT) and Average Buy Price / Cost NAV anytime, or click &ldquo;+ Record Monthly SIP&rdquo; when your SIP executes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close("cancel")}
          aria-label="Close holdings modal"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <form
        method="POST"
        action="/api/funds"
        onSubmit={handleSubmit}
        noValidate
        className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
      >
        {submitError && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="space-y-4">
          {funds.map((fund, idx) => {
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
                className={`rounded-xl border p-4 transition ${
                  initialFocusFundId === fund.id
                    ? "border-emerald-500/60 bg-slate-950/90"
                    : "border-slate-800 bg-slate-950/50"
                }`}
              >
                <legend className="px-2 text-sm font-semibold text-emerald-400">
                  {fund.name}
                </legend>

                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-400">
                  <span>
                    Latest Scraped NAV:{" "}
                    <strong className="font-mono text-white">
                      ৳{fund.effectiveNav.toFixed(3)}
                    </strong>{" "}
                    ({fund.navEffectiveDate || "Latest"})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickAddSip(fund)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                  >
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      + Record Monthly SIP (৳
                      {Number(d.monthlySipTarget || 8000).toLocaleString("en-BD")}{" "}
                      @ ৳{(fund.buyPrice || fund.effectiveNav).toFixed(2)})
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Total Invested Amount (BDT) */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`invested-${fund.id}`}
                      className="text-xs font-medium text-slate-300"
                    >
                      Total Invested Amount (BDT){" "}
                      <span aria-hidden="true" className="text-emerald-400">
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
                          e.target.value
                        )
                      }
                      onBlur={() => handleBlur(fund.id, "totalInvested")}
                      className="form-control-input rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white placeholder-slate-500"
                    />
                    {d.investedError ? (
                      <span
                        id={`invested-err-${fund.id}`}
                        className="text-xs text-rose-400"
                      >
                        {d.investedError}
                      </span>
                    ) : (
                      <span
                        id={`invested-help-${fund.id}`}
                        className="text-[11px] text-slate-400"
                      >
                        Cumulative BDT invested via SIP
                      </span>
                    )}
                  </div>

                  {/* Average Buy Price / Cost NAV (BDT) */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`avgbuy-${fund.id}`}
                      className="text-xs font-medium text-slate-300"
                    >
                      Average Buy Price / Cost NAV (BDT){" "}
                      <span aria-hidden="true" className="text-emerald-400">
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
                          e.target.value
                        )
                      }
                      onBlur={() => handleBlur(fund.id, "averageBuyPrice")}
                      className="form-control-input rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white placeholder-slate-500"
                    />
                    {d.avgBuyError ? (
                      <span
                        id={`avgbuy-err-${fund.id}`}
                        className="text-xs text-rose-400"
                      >
                        {d.avgBuyError}
                      </span>
                    ) : (
                      <span
                        id={`avgbuy-help-${fund.id}`}
                        className="text-[11px] text-slate-400"
                      >
                        Weighted average cost per unit
                      </span>
                    )}
                  </div>

                  {/* Monthly SIP Installment Target (BDT) */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`sip-${fund.id}`}
                      className="text-xs font-medium text-slate-300"
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
                          e.target.value
                        )
                      }
                      className="form-control-input rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white placeholder-slate-500"
                    />
                    <span className="text-[11px] text-slate-400">
                      Default ~8,000 BDT/month
                    </span>
                  </div>
                </div>

                {/* Live Formula Preview Bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-slate-300 border border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Calculator
                      className="h-3.5 w-3.5 text-sky-400"
                      aria-hidden="true"
                    />
                    <span>
                      Computed Units Held:{" "}
                      <strong className="font-mono text-white">
                        {previewUnits.toFixed(4)}
                      </strong>{" "}
                      units
                    </span>
                  </div>
                  <div>
                    Est. Market Value:{" "}
                    <strong className="font-mono text-emerald-400">
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

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close("cancel")}
            className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition shadow-lg shadow-emerald-500/20"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{isSubmitting ? "Saving Holdings..." : "Save Baseline Holdings"}</span>
          </button>
        </div>
      </form>
    </dialog>
  );
}

