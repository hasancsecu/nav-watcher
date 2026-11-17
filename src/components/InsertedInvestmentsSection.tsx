"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  Filter,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Coins,
  Layers,
  Sparkles,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  Search,
  Loader2,
  RefreshCw,
  Server,
  Laptop,
} from "lucide-react";
import MonthYearDatePicker, { MonthYearValue } from "./MonthYearDatePicker";

export interface InvestmentItem {
  id: string;
  userFundId: string;
  fundId: string;
  fundName: string;
  fundShortName: string;
  fundManager: string;
  calendarMonth: string;
  monthKey?: string;
  investmentDate: string | Date;
  cashInvested: number;
  cashBufferUsed: number;
  executionNav: number;
  unitsAllotted: number;
  unitsCost: number;
  cashRemainder: number;
  type: string;
  notes?: string | null;
  createdAt?: string | Date;
  fund: any;
}

interface ServerPaginationData {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ServerSummaryData {
  filteredCount: number;
  totalCashInvested: number;
  totalUnitsAllotted: number;
  totalUnitsCost: number;
}

interface InsertedInvestmentsSectionProps {
  funds: any[];
  onEditInvestment: (inv: any, fund: any) => void;
  onDeleteInvestment: (invId: string, month: string) => void;
  onAddInvestment: () => void;
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

export default function InsertedInvestmentsSection({
  funds,
  onEditInvestment,
  onDeleteInvestment,
  onAddInvestment,
}: InsertedInvestmentsSectionProps) {
  // ---------------------------------------------------------------------------
  // 1. Pagination & Execution Mode (Server-side vs Client-side)
  // ---------------------------------------------------------------------------
  const [mode, setMode] = useState<"server" | "client">("server");

  // Filter State (Shared between Server & Client)
  const [selectedFundId, setSelectedFundId] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Month-Year Filter: null means "All Months", or specific { monthIndex, year, label }
  const [selectedMonthYear, setSelectedMonthYear] = useState<{
    monthIndex: number;
    year: number;
    label: string;
  } | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Pagination State (Shared)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // ---------------------------------------------------------------------------
  // 2. Server-side State
  // ---------------------------------------------------------------------------
  const [serverInvestments, setServerInvestments] = useState<InvestmentItem[]>([]);
  const [serverPagination, setServerPagination] = useState<ServerPaginationData>({
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [serverSummary, setServerSummary] = useState<ServerSummaryData>({
    filteredCount: 0,
    totalCashInvested: 0,
    totalUnitsAllotted: 0,
    totalUnitsCost: 0,
  });
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastServerFetchTime, setLastServerFetchTime] = useState<Date | null>(null);

  // Debounce search query (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 on any filter or page size change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    handleFilterChange();
  }, [selectedFundId, selectedType, selectedMonthYear, debouncedSearch, pageSize, handleFilterChange]);

  // ---------------------------------------------------------------------------
  // 3. Client-side Local Data Computation (Instant Fallback / Client Mode)
  // ---------------------------------------------------------------------------
  const allClientInvestments = useMemo<InvestmentItem[]>(() => {
    const list: InvestmentItem[] = [];
    for (const fund of funds) {
      if (Array.isArray(fund.investments)) {
        for (const inv of fund.investments) {
          list.push({
            id: inv.id,
            userFundId: fund.id,
            fundId: fund.fundId,
            fundName: fund.name,
            fundShortName: fund.shortName,
            fundManager: fund.fundManager,
            calendarMonth: inv.calendarMonth,
            monthKey: inv.monthKey,
            investmentDate: inv.investmentDate,
            cashInvested: inv.cashInvested,
            cashBufferUsed: inv.cashBufferUsed || 0,
            executionNav: inv.executionNav,
            unitsAllotted: inv.unitsAllotted,
            unitsCost: inv.unitsCost,
            cashRemainder: inv.cashRemainder || 0,
            type: inv.type || "SIP",
            notes: inv.notes,
            createdAt: inv.createdAt,
            fund,
          });
        }
      }
    }

    return list.sort((a, b) => {
      const dateA = new Date(a.investmentDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.investmentDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [funds]);

  // Filtered Client-side data
  const filteredClientInvestments = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return allClientInvestments.filter((inv) => {
      // 1. Fund Filter
      if (selectedFundId !== "ALL" && inv.userFundId !== selectedFundId && inv.fundId !== selectedFundId) {
        return false;
      }

      // 2. Type Filter
      if (selectedType !== "ALL" && inv.type.toUpperCase() !== selectedType.toUpperCase()) {
        return false;
      }

      // 3. Month-Year Filter
      if (selectedMonthYear) {
        const expectedMonthName = MONTH_NAMES[selectedMonthYear.monthIndex].toLowerCase();
        const expectedYear = String(selectedMonthYear.year);
        const expectedMonthKey = `${expectedMonthName}-${expectedYear}`;

        const invMonth = inv.calendarMonth?.trim().toLowerCase() || "";
        const invMonthKey = inv.monthKey?.toLowerCase() || "";

        const matchesLabel =
          invMonth === `${expectedMonthName} ${expectedYear}` ||
          (invMonth.includes(expectedMonthName) && invMonth.includes(expectedYear));
        const matchesKey = invMonthKey === expectedMonthKey;

        if (!matchesLabel && !matchesKey) {
          return false;
        }
      }

      // 4. Free-Text Search Filter
      if (query) {
        const matchNotes = inv.notes?.toLowerCase().includes(query);
        const matchFund =
          inv.fundName?.toLowerCase().includes(query) ||
          inv.fundShortName?.toLowerCase().includes(query);
        const matchMonth = inv.calendarMonth?.toLowerCase().includes(query);
        const matchType = inv.type?.toLowerCase().includes(query);

        if (!matchNotes && !matchFund && !matchMonth && !matchType) {
          return false;
        }
      }

      return true;
    });
  }, [allClientInvestments, selectedFundId, selectedType, selectedMonthYear, debouncedSearch]);

  // Client-side Summary Metrics
  const clientSummary = useMemo(() => {
    let totalCash = 0;
    let totalUnits = 0;
    let totalCost = 0;

    for (const inv of filteredClientInvestments) {
      totalCash += inv.cashInvested;
      totalUnits += inv.unitsAllotted;
      totalCost += inv.unitsCost;
    }

    return {
      filteredCount: filteredClientInvestments.length,
      totalCashInvested: totalCash,
      totalUnitsAllotted: totalUnits,
      totalUnitsCost: totalCost,
    };
  }, [filteredClientInvestments]);

  // Client-side Paginated Slice
  const clientTotalPages = Math.max(1, Math.ceil(filteredClientInvestments.length / pageSize));
  const validClientPage = Math.min(currentPage, clientTotalPages);
  const clientStartIndex = (validClientPage - 1) * pageSize;
  const paginatedClientInvestments = useMemo(() => {
    return filteredClientInvestments.slice(clientStartIndex, clientStartIndex + pageSize);
  }, [filteredClientInvestments, clientStartIndex, pageSize]);

  // ---------------------------------------------------------------------------
  // 4. Server-Side Fetch Function
  // ---------------------------------------------------------------------------
  const fetchServerInvestments = useCallback(
    async (targetPage = currentPage, targetPageSize = pageSize) => {
      setIsLoadingServer(true);
      setServerError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("pageSize", String(targetPageSize));

        if (selectedFundId !== "ALL") {
          params.set("fundId", selectedFundId);
        }

        if (selectedType !== "ALL") {
          params.set("type", selectedType);
        }

        if (selectedMonthYear) {
          const expectedMonthName = MONTH_NAMES[selectedMonthYear.monthIndex].toLowerCase();
          const expectedYear = String(selectedMonthYear.year);
          params.set("monthKey", `${expectedMonthName}-${expectedYear}`);
        }

        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim());
        }

        const res = await fetch(`/api/user/investments?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data && Array.isArray(data.investments)) {
          setServerInvestments(data.investments);
          if (data.pagination) {
            setServerPagination(data.pagination);
          }
          if (data.summary) {
            setServerSummary(data.summary);
          }
          setLastServerFetchTime(new Date());
        }
      } catch (err: any) {
        console.error("[InsertedInvestments] Server fetch failed:", err);
        setServerError(err.message || "Failed to load investments from server.");
      } finally {
        setIsLoadingServer(false);
      }
    },
    [currentPage, pageSize, selectedFundId, selectedType, selectedMonthYear, debouncedSearch]
  );

  // Fetch from server whenever server mode is active and parameters change
  useEffect(() => {
    if (mode === "server") {
      fetchServerInvestments(currentPage, pageSize);
    }
  }, [mode, currentPage, pageSize, selectedFundId, selectedType, selectedMonthYear, debouncedSearch, fetchServerInvestments]);

  // Also refetch server data whenever external `funds` array updates (e.g. after adding/editing/deleting)
  const prevFundsRef = useRef(funds);
  useEffect(() => {
    if (prevFundsRef.current !== funds && mode === "server") {
      prevFundsRef.current = funds;
      fetchServerInvestments(currentPage, pageSize);
    }
  }, [funds, mode, currentPage, pageSize, fetchServerInvestments]);

  // ---------------------------------------------------------------------------
  // 5. Active View Data (Unified between Server and Client modes)
  // ---------------------------------------------------------------------------
  const isServer = mode === "server";
  const displayedInvestments = isServer ? serverInvestments : paginatedClientInvestments;
  const displayedTotalCount = isServer ? serverPagination.totalCount : filteredClientInvestments.length;
  const displayedTotalPages = isServer ? serverPagination.totalPages : clientTotalPages;
  const displayedCurrentPage = isServer ? serverPagination.currentPage : validClientPage;
  const displayedSummary = isServer ? serverSummary : clientSummary;

  const totalAllRecordsCount = isServer
    ? Math.max(serverPagination.totalCount, allClientInvestments.length)
    : allClientInvestments.length;

  const hasActiveFilters =
    selectedFundId !== "ALL" ||
    selectedType !== "ALL" ||
    selectedMonthYear !== null ||
    debouncedSearch.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedFundId("ALL");
    setSelectedType("ALL");
    setSelectedMonthYear(null);
    setSearchQuery("");
    setDebouncedSearch("");
    setIsDatePickerOpen(false);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    const target = Math.max(1, Math.min(newPage, displayedTotalPages));
    setCurrentPage(target);
    if (isServer) {
      fetchServerInvestments(target, pageSize);
    }
  };

  const startRecordIdx = (displayedCurrentPage - 1) * pageSize + 1;
  const endRecordIdx = Math.min(displayedCurrentPage * pageSize, displayedTotalCount);

  return (
    <section
      aria-labelledby="inserted-investments-heading"
      className="theme-surface rounded-2xl border theme-border p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5"
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. Header & Title & Mode Selector                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                id="inserted-investments-heading"
                className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary flex items-center gap-2"
              >
                <Calendar className="h-5 w-5 text-[#248da2] dark:text-[#33c6e4] shrink-0" />
                <span>Investments Log</span>
              </h3>

              <span className="rounded-full bg-[#33c6e4]/15 px-2.5 py-0.5 text-xs font-bold text-[#155360] dark:text-[#33c6e4]">
                {totalAllRecordsCount} Total
              </span>

              {/* Mode indicator badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  isServer
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                {isServer ? (
                  <>
                    <Server className="h-3 w-3" /> Server-side Mode
                  </>
                ) : (
                  <>
                    <Laptop className="h-3 w-3" /> Client-side Mode
                  </>
                )}
              </span>
            </div>

            <p className="text-xs sm:text-sm theme-text-secondary mt-1 leading-relaxed">
              Full server-side & client-side filtering and pagination with integer units and cash buffer roll-forward.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* Mode Toggle Switch */}
            <div className="inline-flex rounded-xl p-0.5 bg-slate-200/80 dark:bg-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setMode("server")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition ${
                  isServer
                    ? "bg-white dark:bg-slate-900 theme-text-primary shadow-xs font-extrabold text-[#155360] dark:text-[#33c6e4]"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
                title="Query directly from database via server API"
              >
                <Server className="h-3 w-3" />
                <span>Server</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("client")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition ${
                  !isServer
                    ? "bg-white dark:bg-slate-900 theme-text-primary shadow-xs font-extrabold text-[#155360] dark:text-[#33c6e4]"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
                title="Filter and paginate locally in browser memory"
              >
                <Laptop className="h-3 w-3" />
                <span>Client</span>
              </button>
            </div>

            {/* Refresh button (when in server mode) */}
            {isServer && (
              <button
                type="button"
                onClick={() => fetchServerInvestments(currentPage, pageSize)}
                disabled={isLoadingServer}
                className="p-2 rounded-xl border theme-border theme-surface hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                title="Refresh from server"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingServer ? "animate-spin text-[#33c6e4]" : ""}`} />
              </button>
            )}

            {/* Add New Investment Button */}
            <button
              type="button"
              onClick={onAddInvestment}
              className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-3.5 py-2 text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add Investment</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Search & Filter Bar (Mobile-first)                         */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border theme-border bg-slate-50/70 dark:bg-slate-900/60 p-3 sm:p-4 space-y-3">
        {/* Top bar of filter section: title & reset */}
        <div className="flex items-center justify-between gap-2 border-b theme-border pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold theme-text-primary">
            <Filter className="h-3.5 w-3.5 text-[#33c6e4]" />
            <span>Filter & Search</span>
            {isLoadingServer && (
              <span className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400 ml-1">
                <Loader2 className="h-3 w-3 animate-spin text-[#33c6e4]" /> Fetching...
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 transition"
            >
              <X className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Free text search bar */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, month, or fund name..."
            className="w-full rounded-xl border theme-border theme-surface pl-9 pr-9 py-2 text-xs font-medium theme-text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#33c6e4]/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {/* A. Mutual Fund Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-[11px] font-bold theme-text-secondary uppercase tracking-wider block">
              Mutual Fund
            </label>
            <div className="relative">
              <select
                value={selectedFundId}
                onChange={(e) => setSelectedFundId(e.target.value)}
                className="w-full appearance-none rounded-xl border theme-border theme-surface pl-3 pr-9 py-2 text-xs font-semibold theme-text-primary focus:outline-none focus:ring-2 focus:ring-[#33c6e4]/40 cursor-pointer min-h-[38px]"
              >
                <option value="ALL">All Mutual Funds ({funds.length})</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.shortName})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* B. Investment Type Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-[11px] font-bold theme-text-secondary uppercase tracking-wider block">
              Investment Type
            </label>
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full appearance-none rounded-xl border theme-border theme-surface pl-3 pr-9 py-2 text-xs font-semibold theme-text-primary focus:outline-none focus:ring-2 focus:ring-[#33c6e4]/40 cursor-pointer min-h-[38px]"
              >
                <option value="ALL">All Types (SIP, Lumpsum, CIP)</option>
                <option value="SIP">Monthly SIP</option>
                <option value="LUMPSUM">Lumpsum Deposit</option>
                <option value="CIP">CIP Dividend Reinvestment</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* C. Calendar Month-Year Datepicker Filter */}
          <div className="space-y-1 relative">
            <label className="text-[10px] sm:text-[11px] font-bold theme-text-secondary uppercase tracking-wider block">
              Calendar Month-Year
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between rounded-xl border pl-3 pr-3 py-2 text-xs font-semibold transition theme-surface min-h-[38px] ${
                  selectedMonthYear
                    ? "border-[#33c6e4] text-[#155360] dark:text-[#33c6e4] font-bold bg-[#ebf9fc]/40 dark:bg-slate-800"
                    : "theme-border theme-text-primary hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate pr-2">
                  <Calendar className="h-3.5 w-3.5 text-[#33c6e4] shrink-0" />
                  <span className="truncate">
                    {selectedMonthYear ? selectedMonthYear.label : "All Months (No Filter)"}
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {selectedMonthYear && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMonthYear(null);
                      }}
                      title="Clear month filter"
                      className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform text-slate-400 ${
                      isDatePickerOpen ? "rotate-180 text-[#33c6e4]" : ""
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* Dropdown popup for MonthYearDatePicker */}
            {isDatePickerOpen && (
              <div className="absolute top-full right-0 z-30 mt-1.5 w-72 max-w-[90vw] rounded-2xl border theme-border theme-surface p-3 shadow-xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b theme-border">
                  <span className="text-xs font-bold theme-text-primary">
                    Select Filter Month
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonthYear(null);
                      setIsDatePickerOpen(false);
                    }}
                    className="text-[11px] font-semibold text-[#33c6e4] hover:underline"
                  >
                    All Months
                  </button>
                </div>
                <MonthYearDatePicker
                  value={
                    selectedMonthYear
                      ? {
                          monthIndex: selectedMonthYear.monthIndex,
                          year: selectedMonthYear.year,
                        }
                      : {
                          monthIndex: new Date().getMonth(),
                          year: new Date().getFullYear(),
                        }
                  }
                  onChange={(val: MonthYearValue) => {
                    setSelectedMonthYear({
                      monthIndex: val.monthIndex,
                      year: val.year,
                      label: val.label,
                    });
                    setIsDatePickerOpen(false);
                  }}
                  label="Target Month"
                  helperText="Show investments from this calendar month only"
                />
              </div>
            )}
          </div>
        </div>

        {/* Filter Summary Metrics Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t theme-border text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
              Showing{" "}
              <strong className="theme-text-primary">
                {displayedTotalCount}
              </strong>{" "}
              of {totalAllRecordsCount} entries
            </span>
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#33c6e4]/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-[#155360] dark:text-[#33c6e4]">
                <Sparkles className="h-3 w-3" /> Filtered Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 font-mono text-[11px] sm:text-xs">
            <span>
              Cash:{" "}
              <strong className="theme-text-primary font-bold">
                ৳{formatBdt(displayedSummary.totalCashInvested, 0)}
              </strong>
            </span>
            <span>·</span>
            <span>
              Units:{" "}
              <strong className="text-[#155360] dark:text-[#33c6e4] font-bold">
                +{displayedSummary.totalUnitsAllotted.toLocaleString("en-BD")}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Server Error Notice (if any)                               */}
      {/* ------------------------------------------------------------- */}
      {serverError && isServer && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-rose-500" />
            <span>Server query error: {serverError}. You can switch to Client mode to view cached data.</span>
          </div>
          <button
            type="button"
            onClick={() => setMode("client")}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 shrink-0"
          >
            Use Client Mode
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. Table / Cards View                                         */}
      {/* ------------------------------------------------------------- */}
      {isLoadingServer && displayedInvestments.length === 0 ? (
        <div className="rounded-2xl border border-dashed theme-border p-8 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          <Loader2 className="h-8 w-8 animate-spin text-[#33c6e4] mx-auto" />
          <p className="text-xs font-semibold theme-text-secondary">
            Loading investments from server...
          </p>
        </div>
      ) : displayedInvestments.length === 0 ? (
        <div className="rounded-2xl border border-dashed theme-border p-8 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto theme-text-muted">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold theme-text-primary">
              No Investments Found
            </h4>
            <p className="text-xs theme-text-secondary max-w-sm mx-auto">
              {hasActiveFilters
                ? "No investment records match your current filter criteria. Try adjusting or clearing your filters."
                : "You haven't logged any investments yet. Click below to add your first installment."}
            </p>
          </div>
          <div className="pt-1">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-xl border theme-border px-4 py-2 text-xs font-bold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={onAddInvestment}
                className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-4 py-2 text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Record First Investment</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border theme-border">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b theme-border bg-slate-100/70 dark:bg-slate-800/60 font-bold theme-text-secondary">
                  <th className="py-3 px-3.5">Month &amp; Date</th>
                  <th className="py-3 px-3.5">Fund &amp; AMC</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-right">Cash Invested</th>
                  <th className="py-3 px-3 text-right">Exec. NAV</th>
                  <th className="py-3 px-3 text-right">Units Allotted</th>
                  <th className="py-3 px-3 text-right">Units Cost</th>
                  <th className="py-3 px-3 text-right">Buffer Remainder</th>
                  <th className="py-3 px-3.5">Notes</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {displayedInvestments.map((inv) => {
                  const typeUpper = (inv.type || "SIP").toUpperCase();
                  const typeColor =
                    typeUpper === "SIP"
                      ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                      : typeUpper === "LUMPSUM"
                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-extrabold theme-text-primary block">
                          {inv.calendarMonth}
                        </span>
                        <span className="text-[10px] theme-text-muted block">
                          {inv.investmentDate
                            ? new Date(inv.investmentDate).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 max-w-[200px]">
                        <span
                          className="font-bold theme-text-primary block truncate"
                          title={inv.fundName}
                        >
                          {inv.fundShortName || inv.fundName}
                        </span>
                        <span className="text-[10px] theme-text-muted block truncate">
                          {inv.fundManager}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${typeColor}`}
                        >
                          {typeUpper}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold theme-text-primary whitespace-nowrap">
                        ৳{formatBdt(inv.cashInvested, 0)}
                        {inv.cashBufferUsed > 0 && (
                          <span
                            className="block text-[10px] font-normal text-slate-500"
                            title={`৳${formatBdt(inv.cashBufferUsed, 2)} buffer rolled in`}
                          >
                            +৳{formatBdt(inv.cashBufferUsed, 0)} buf
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        ৳{Number(inv.executionNav).toFixed(3)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <strong className="font-mono text-xs font-black text-[#155360] dark:text-[#33c6e4]">
                          +{inv.unitsAllotted.toLocaleString("en-BD")}
                        </strong>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        ৳{formatBdt(inv.unitsCost, 2)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                          ৳{formatBdt(inv.cashRemainder, 2)}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          rolls forward
                        </span>
                      </td>

                      <td
                        className="py-3 px-3.5 max-w-[150px] text-[11px] theme-text-secondary truncate"
                        title={inv.notes || ""}
                      >
                        {inv.notes || "—"}
                      </td>

                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditInvestment(inv, inv.fund)}
                            title="Edit investment record"
                            className="p-1.5 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary hover:border-[#33c6e4]/60 hover:bg-[#33c6e4]/10 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteInvestment(inv.id, inv.calendarMonth)
                            }
                            title="Delete investment record"
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {displayedInvestments.map((inv) => {
              const typeUpper = (inv.type || "SIP").toUpperCase();
              const typeColor =
                typeUpper === "SIP"
                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                  : typeUpper === "LUMPSUM"
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";

              return (
                <div
                  key={inv.id}
                  className="rounded-2xl border theme-border theme-surface p-3.5 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b theme-border pb-2.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm theme-text-primary">
                          {inv.calendarMonth}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${typeColor}`}
                        >
                          {typeUpper}
                        </span>
                      </div>
                      <span className="text-xs font-semibold theme-text-secondary block mt-0.5">
                        {inv.fundShortName || inv.fundName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditInvestment(inv, inv.fund)}
                        title="Edit record"
                        className="p-1.5 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary hover:border-[#33c6e4]/60 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onDeleteInvestment(inv.id, inv.calendarMonth)
                        }
                        title="Delete record"
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Cash Invested
                      </span>
                      <strong className="font-mono text-sm font-extrabold theme-text-primary">
                        ৳{formatBdt(inv.cashInvested, 0)}
                      </strong>
                      {inv.cashBufferUsed > 0 && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          +৳{formatBdt(inv.cashBufferUsed, 2)} buf
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Integer Units Allotted
                      </span>
                      <strong className="font-mono text-sm font-black text-[#155360] dark:text-[#33c6e4]">
                        +{inv.unitsAllotted.toLocaleString("en-BD")}
                      </strong>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        @ ৳{Number(inv.executionNav).toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t theme-border text-slate-500">
                    <span>
                      Cost:{" "}
                      <strong className="font-mono theme-text-primary">
                        ৳{formatBdt(inv.unitsCost, 2)}
                      </strong>
                    </span>
                    <span>
                      Buffer:{" "}
                      <strong className="font-mono text-amber-600 dark:text-amber-400">
                        ৳{formatBdt(inv.cashRemainder, 2)}
                      </strong>
                    </span>
                  </div>

                  {inv.notes && (
                    <div className="text-[11px] theme-text-secondary bg-slate-100/60 dark:bg-slate-800/60 rounded-lg p-2 leading-relaxed">
                      {inv.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 5. Pagination Controls (Mobile-First Responsive)             */}
          {/* ------------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t theme-border text-xs">
            {/* Rows selector and showing indicator */}
            <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 theme-text-secondary">
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <div className="relative inline-block">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="appearance-none rounded-lg border theme-border theme-surface pl-2 pr-6 py-1 text-xs font-semibold theme-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-slate-400">
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </div>
              </div>

              <span className="text-[11px] sm:text-xs">
                {displayedTotalCount === 0
                  ? "0 of 0"
                  : `Showing ${startRecordIdx}–${endRecordIdx} of ${displayedTotalCount}`}
              </span>
            </div>

            {/* Prev / Page X of Y / Next Buttons */}
            <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handlePageChange(displayedCurrentPage - 1)}
                disabled={displayedCurrentPage <= 1 || isLoadingServer}
                className="p-1.5 rounded-lg border theme-border theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:pointer-events-none"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3 py-1 rounded-lg border theme-border font-mono font-bold theme-text-primary text-xs">
                Page {displayedCurrentPage} of {displayedTotalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(displayedCurrentPage + 1)}
                disabled={displayedCurrentPage >= displayedTotalPages || isLoadingServer}
                className="p-1.5 rounded-lg border theme-border theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:pointer-events-none"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
