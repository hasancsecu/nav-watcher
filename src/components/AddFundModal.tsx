"use client";

import React, { useState, useEffect, useRef, useId, useMemo } from "react";
import {
  X,
  Search,
  Plus,
  Check,
  ExternalLink,
  Building2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Layers,
} from "lucide-react";

interface FundDirectoryItem {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  fundManager: string;
  category: string;
  biniUrl: string;
  latestNav?: number | null;
  defaultNav: number;
  isAdded?: boolean;
}

interface AddFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFundAdded: () => void;
}

export default function AddFundModal({
  isOpen,
  onClose,
  onFundAdded,
}: AddFundModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [funds, setFunds] = useState<FundDirectoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [addingFundId, setAddingFundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all funds from /api/bini/funds
  const loadDirectory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/bini/funds");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load funds directory.");
      }
      setFunds(data.funds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching funds.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory();
      setSearchQuery("");
      setSelectedCategory("All");
    }
  }, [isOpen]);

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

  const handleAddFund = async (fund: FundDirectoryItem) => {
    try {
      setAddingFundId(fund.id);
      setError(null);

      const res = await fetch("/api/user/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: fund.id, monthlySipTarget: 8000 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add fund.");
      }

      // Mark as added locally
      setFunds((prev) =>
        prev.map((f) => (f.id === fund.id ? { ...f, isAdded: true } : f))
      );

      onFundAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add fund.");
    } finally {
      setAddingFundId(null);
    }
  };

  const categories = ["All", "Shariah", "Growth", "Income", "Balanced"];

  const filteredFunds = useMemo(() => {
    return funds.filter((fund) => {
      const matchesCategory =
        selectedCategory === "All" ||
        fund.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        fund.name.toLowerCase().includes(q) ||
        fund.fundManager.toLowerCase().includes(q) ||
        fund.shortName.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [funds, selectedCategory, searchQuery]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="theme-elevated modal-native-backdrop w-full max-w-2xl rounded-2xl border theme-border p-0 shadow-2xl backdrop:bg-slate-950/70"
    >
      <div className="flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="border-b theme-border px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id={titleId}
                  className="text-base sm:text-lg font-bold tracking-tight theme-text-primary"
                >
                  Add Mutual Funds
                </h2>
                <p className="text-xs theme-text-secondary">
                  Select mutual funds to track in your personal portfolio · 28 Funds Available
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

          {/* Search bar */}
          <div className="mt-3.5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by fund name, asset manager (e.g. Shanta, IDLC, EDGE, VIPB)..."
              className="form-control-input w-full rounded-xl border pl-10 pr-4 py-2.5 text-xs font-medium"
            />
          </div>

          {/* Category filter pills */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition shrink-0 whitespace-nowrap min-h-[34px] ${
                  selectedCategory === cat
                    ? "bg-[#33c6e4] text-slate-950 font-bold shadow-sm"
                    : "border theme-border theme-text-secondary hover:theme-text-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Funds List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-3 text-xs">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-xs theme-text-muted">
              Loading mutual funds directory...
            </div>
          ) : filteredFunds.length === 0 ? (
            <div className="py-12 text-center text-xs theme-text-muted">
              No mutual funds found matching your search.
            </div>
          ) : (
            filteredFunds.map((fund) => {
              const isAdded = fund.isAdded;
              const isAdding = addingFundId === fund.id;

              return (
                <div
                  key={fund.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border theme-border p-3.5 theme-surface hover:border-[#33c6e4]/40 transition shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          fund.category === "Shariah"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : fund.category === "Income"
                            ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                            : fund.category === "Balanced"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            : "bg-[#ebf9fc] text-[#155360] dark:bg-slate-800 dark:text-[#33c6e4] border border-[#c0edf7] dark:border-slate-700"
                        }`}
                      >
                        {fund.category}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold theme-text-primary truncate">
                        {fund.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] theme-text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        <span>{fund.fundManager}</span>
                      </span>
                      <span>·</span>
                      <span>
                        Base NAV: <strong className="theme-text-primary font-mono">৳{(fund.latestNav || fund.defaultNav).toFixed(3)}</strong>
                      </span>
                      <span>·</span>
                      <a
                        href={fund.biniUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="View Fund Details"
                        className="inline-flex items-center gap-0.5 text-[#248da2] dark:text-[#33c6e4] hover:underline font-medium"
                      >
                        <span>Details</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center sm:self-center shrink-0">
                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <Check className="h-3.5 w-3.5" />
                        <span>In Portfolio</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => handleAddFund(fund)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 text-xs font-bold transition shadow-sm disabled:opacity-50 min-h-[38px]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAdding ? "Adding..." : "+ Add to Portfolio"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t theme-border px-4 py-3 sm:px-6 bg-slate-50/50 dark:bg-slate-900/40 rounded-b-2xl text-xs theme-text-muted">
          <span>{filteredFunds.length} funds matching criteria</span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-xl border theme-border px-4 py-1.5 text-xs font-semibold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[36px]"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
