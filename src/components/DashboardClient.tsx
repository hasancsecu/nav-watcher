"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { PortfolioSummaryMetrics } from "@/lib/calculations";
import { PortfolioHistoryItem } from "./PortfolioHistoryChart";
import AuthModal from "./AuthModal";
import ProfileModal from "./ProfileModal";
import AddFundModal from "./AddFundModal";
import AddInvestmentModal from "./AddInvestmentModal";
import EditInvestmentModal, { EditableInvestment } from "./EditInvestmentModal";
import ConfirmDialog from "./ConfirmDialog";
import FundComparisonSection from "./FundComparisonSection";
import HistoricalInvestmentComparisonChart, {
  SnapshotItem,
} from "./HistoricalInvestmentComparisonChart";
import InsertedInvestmentsSection from "./InsertedInvestmentsSection";
import { ToastProvider, useToast } from "./Toast";
import {
  RefreshCw,
  Wallet,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Sun,
  Moon,
  BarChart3,
  Download,
  Coins,
  Layers,
  Plus,
  User,
  LogOut,
  Trash2,
  Calendar,
  ChevronDown,
  Loader2,
} from "lucide-react";

export interface ScrapeLogItem {
  id: string;
  fundId: string | null;
  trigger: string;
  sourceUsed: string;
  urlAttempted: string;
  status: string;
  extractedNav: number | null;
  effectiveDate: string | null;
  durationMs: number | null;
  message: string | null;
  createdAt: string;
}

export interface SchedulerInfo {
  active: boolean;
  schedule: string;
  description?: string;
  timezone: string;
  startedAt?: string | null;
  lastCronRunAt?: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
}

interface DashboardClientProps {
  initialUser?: UserProfile | null;
  initialSummary: PortfolioSummaryMetrics | null;
  initialFunds: any[];
  initialSnapshots?: SnapshotItem[];
  initialHistory: PortfolioHistoryItem[];
  initialLogs: ScrapeLogItem[];
  initialScheduler: SchedulerInfo;
}

type MobileTab =
  | "portfolio"
  | "investments"
  | "charts"
  | "compare"
  | "breakdown";

const FUND_BRAND_CONFIG: Record<
  string,
  {
    initials: string;
    badgeBg: string;
    badgeText: string;
    color: string;
  }
> = {
  "shanta-amanah": {
    initials: "SA",
    badgeBg: "bg-emerald-500/15 border-emerald-500/30",
    badgeText: "status-gain-text",
    color: "#059669",
  },
  "idlc-shariah": {
    initials: "ID",
    badgeBg: "bg-sky-500/15 border-sky-500/30",
    badgeText: "status-info-text",
    color: "#0284c7",
  },
  "edge-alamin": {
    initials: "EA",
    badgeBg: "bg-violet-500/15 border-violet-500/30",
    badgeText: "text-violet-600 dark:text-violet-300",
    color: "#7c3aed",
  },
};

function formatBdt(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

function formatDhakaTimestamp(iso?: string | Date | null): string {
  if (!iso) return "Not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not synced yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(d);
}

function applyThemeToDocument(effective: "light" | "dark", metaValue: string) {
  const meta = document.querySelector(
    'meta[name="color-scheme"]',
  ) as HTMLMetaElement | null;
  if (meta) {
    meta.content = metaValue;
  }
  const root = document.documentElement;
  root.dataset.theme = effective;
  if (effective === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function PortfolioSummarySkeleton() {
  return (
    <div className="theme-surface rounded-2xl border theme-border p-4 sm:p-6 shadow-sm space-y-4 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-4">
        <div className="space-y-1.5">
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-8 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="theme-elevated rounded-xl border theme-border p-3 space-y-2"
          >
            <div className="h-2.5 w-20 bg-slate-200/70 dark:bg-slate-800/70 rounded-md" />
            <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FundCardsGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border theme-border theme-surface p-4 space-y-3.5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2 border-b theme-border pb-3">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-24 bg-slate-200/70 dark:bg-slate-800/70 rounded-md" />
            </div>
            <div className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-9 w-full rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <div className="h-2.5 w-20 bg-slate-200/60 dark:bg-slate-800/60 rounded-md" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="space-y-1 text-right flex flex-col items-end">
              <div className="h-2.5 w-20 bg-slate-200/60 dark:bg-slate-800/60 rounded-md" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
          </div>
          <div className="h-8 w-full rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="theme-surface rounded-2xl sm:rounded-3xl border theme-border p-4 sm:p-6 shadow-sm space-y-4 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3.5">
        <div className="space-y-1.5">
          <div className="h-5 w-56 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-72 bg-slate-200/60 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
      </div>
      <div className="h-[280px] w-full rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/40 dark:from-slate-900/60 dark:to-slate-950/60 border theme-border flex items-end p-6 gap-6">
        <div className="h-1/3 flex-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-t-xl" />
        <div className="h-2/3 flex-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-t-xl" />
        <div className="h-1/2 flex-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-t-xl" />
        <div className="h-3/4 flex-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-t-xl" />
      </div>
    </div>
  );
}

function CompareSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between border-b theme-border pb-3">
        <div className="space-y-1">
          <div className="h-5 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-64 bg-slate-200/60 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="theme-surface rounded-xl border theme-border p-3 space-y-2"
          >
            <div className="h-3 w-28 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="theme-elevated rounded-2xl border theme-border p-4 space-y-3.5"
          >
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-2 w-full bg-slate-200/60 dark:bg-slate-800/60 rounded-full" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
              <div className="h-14 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
              <div className="h-14 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
              <div className="h-14 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient(props: DashboardClientProps) {
  return (
    <ToastProvider>
      <DashboardClientContent {...props} />
    </ToastProvider>
  );
}

function DashboardClientContent({
  initialUser,
  initialSummary,
  initialFunds,
  initialSnapshots,
  initialHistory,
  initialLogs,
  initialScheduler,
}: DashboardClientProps) {
  const toast = useToast();

  // Current user state
  const [user, setUser] = useState<UserProfile | null>(initialUser || null);

  const [summary, setSummary] = useState<PortfolioSummaryMetrics>(
    initialSummary || {
      totalInvested: 0,
      currentMarketValue: 0,
      absoluteGainLoss: 0,
      returnPct: 0,
      totalMonthlySip: 0,
      totalFractionalCash: 0,
      totalCipUnits: 0,
      lastUpdatedAt: null,
      fundsCount: 0,
    },
  );
  const [funds, setFunds] = useState<any[]>(initialFunds || []);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>(
    initialSnapshots || [],
  );
  const [history, setHistory] = useState<PortfolioHistoryItem[]>(
    initialHistory || [],
  );
  const [logs, setLogs] = useState<ScrapeLogItem[]>(initialLogs || []);
  const [scheduler] = useState<SchedulerInfo>(initialScheduler);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">(
    "login",
  );
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAddFundModalOpen, setIsAddFundModalOpen] = useState(false);
  const [isAddInvestmentModalOpen, setIsAddInvestmentModalOpen] =
    useState(false);
  const [preselectedFundIdForInv, setPreselectedFundIdForInv] = useState<
    string | null
  >(null);

  // Edit investment modal state
  const [editingInvestment, setEditingInvestment] =
    useState<EditableInvestment | null>(null);
  const [isEditInvestmentModalOpen, setIsEditInvestmentModalOpen] =
    useState(false);

  // ConfirmDialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "primary";
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // User menu dropdown toggle
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Total logged investments count
  const totalInvestmentsCount = useMemo(() => {
    return funds.reduce((acc, f) => acc + (f.investments?.length || 0), 0);
  }, [funds]);

  // Information on when NAV was last synced & next scheduled sync
  const syncInfo = useMemo(() => {
    let latestTime: Date | null = null;

    if (logs.length > 0 && logs[0].createdAt) {
      latestTime = new Date(logs[0].createdAt);
    }

    for (const f of funds) {
      if (f.lastScrapedAt) {
        const d = new Date(f.lastScrapedAt);
        if (!latestTime || d.getTime() > latestTime.getTime()) {
          latestTime = d;
        }
      }
    }

    if (!latestTime && summary?.lastUpdatedAt) {
      latestTime = new Date(summary.lastUpdatedAt);
    }

    const effectiveDates = funds
      .map((f) => f.navEffectiveDate)
      .filter((d): d is string => Boolean(d && d !== "Latest Day"));
    const latestEffectiveDate = effectiveDates[0] || "Latest Market Session";

    if (!latestTime) {
      return {
        timestamp: null,
        formattedTime: "Pending initial sync",
        relativeTime: "Not synced yet",
        effectiveDate: latestEffectiveDate,
        scheduleNote: "Auto-syncs daily at 12:00 AM BST",
      };
    }

    const now = Date.now();
    const diffMs = Math.max(0, now - latestTime.getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    let relativeTime = "";
    if (diffMins < 1) {
      relativeTime = "Just now";
    } else if (diffMins < 60) {
      relativeTime = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      relativeTime = `${diffHours}h ago`;
    } else {
      const days = Math.floor(diffHours / 24);
      relativeTime = `${days}d ago`;
    }

    const formattedTime = latestTime.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return {
      timestamp: latestTime,
      formattedTime,
      relativeTime,
      effectiveDate: latestEffectiveDate,
      scheduleNote: "Auto-syncs daily at 12:00 AM BST",
    };
  }, [logs, funds, summary?.lastUpdatedAt]);

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [crudLoadingMessage, setCrudLoadingMessage] = useState<string | null>(
    null,
  );
  const [syncBanner, setSyncBanner] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [mobileTab, setMobileTab] = useState<MobileTab>("portfolio");
  const [mobileBreakdownMode, setMobileBreakdownMode] = useState<
    "cards" | "table"
  >("cards");

  // Theme state
  const [themePreference, setThemePreference] = useState<
    "system" | "light" | "dark"
  >("light");

  // PWA install prompt
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Initialize theme
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemePreference(stored);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const resolveEffective = () => {
      if (themePreference === "system") {
        return mediaQuery.matches ? "dark" : "light";
      }
      return themePreference;
    };

    const effective = resolveEffective();
    applyThemeToDocument(effective, themePreference);

    const handleSystemChange = () => {
      if (themePreference === "system") {
        applyThemeToDocument(mediaQuery.matches ? "dark" : "light", "system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [themePreference]);

  const toggleTheme = () => {
    const next = themePreference === "dark" ? "light" : "dark";
    setThemePreference(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore
    }
  };

  // PWA install handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredInstallPrompt) return;
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsAppInstalled(true);
      }
      setDeferredInstallPrompt(null);
    } catch {
      // ignore
    }
  };

  // Refresh user portfolio data
  const refreshUserData = async (loadingMsg?: string) => {
    try {
      setIsDataLoading(true);
      if (loadingMsg) setCrudLoadingMessage(loadingMsg);
      const res = await fetch("/api/user/funds");
      if (res.status === 401) {
        setUser(null);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setFunds(data.funds || []);
        if (data.user) setUser(data.user);
      }
    } catch (err) {
      console.error("Failed to refresh user data", err);
    } finally {
      setIsDataLoading(false);
      setCrudLoadingMessage(null);
    }
  };

  const handleOpenEditInvestment = (inv: any, fund: any) => {
    setEditingInvestment({
      id: inv.id,
      userFundId: fund.id,
      fundName: fund.name,
      calendarMonth: inv.calendarMonth,
      cashInvested: inv.cashInvested,
      cashBufferUsed: inv.cashBufferUsed || 0,
      executionNav: inv.executionNav,
      unitsAllotted: inv.unitsAllotted,
      unitsCost: inv.unitsCost,
      cashRemainder: inv.cashRemainder || 0,
      type: inv.type || "SIP",
      notes: inv.notes,
    });
    setIsEditInvestmentModalOpen(true);
  };

  // Delete Fund from profile
  const handleDeleteFund = (userFundId: string, fundName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Mutual Fund",
      message: `Are you sure you want to remove "${fundName}" from your portfolio? All associated monthly SIP and CIP investments will also be removed.`,
      confirmLabel: "Remove Fund",
      variant: "danger",
      isLoading: false,
      onConfirm: async () => {
        try {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          setIsRefreshing(true);
          const res = await fetch(`/api/user/funds?id=${userFundId}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to remove fund.");

          await refreshUserData("Removing fund from portfolio...");
          toast.success(`Removed "${fundName}" from your portfolio.`);
          setConfirmDialog((prev) => ({
            ...prev,
            isOpen: false,
            isLoading: false,
          }));
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Error deleting fund.",
          );
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        } finally {
          setIsRefreshing(false);
        }
      },
    });
  };

  // Delete single investment record
  const handleDeleteInvestment = (invId: string, month: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Investment Record",
      message: `Delete the investment record for ${month}? Units will be recalculated automatically.`,
      confirmLabel: "Delete Investment",
      variant: "danger",
      isLoading: false,
      onConfirm: async () => {
        try {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          setIsRefreshing(true);
          const res = await fetch(`/api/user/investments?id=${invId}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok)
            throw new Error(data.error || "Failed to delete investment.");

          await refreshUserData("Deleting investment & recalculating...");
          toast.success(`Deleted investment record for ${month}.`);
          setConfirmDialog((prev) => ({
            ...prev,
            isOpen: false,
            isLoading: false,
          }));
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Error deleting investment.",
          );
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        } finally {
          setIsRefreshing(false);
        }
      },
    });
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setFunds([]);
      setSummary({
        totalInvested: 0,
        currentMarketValue: 0,
        absoluteGainLoss: 0,
        returnPct: 0,
        totalMonthlySip: 0,
        totalFractionalCash: 0,
        totalCipUnits: 0,
        lastUpdatedAt: null,
        fundsCount: 0,
      });
      setIsUserMenuOpen(false);
      toast.info("You have been signed out.");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // Trigger live NAV sync from AMCs and bini
  const handleManualSync = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL_SYNC" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync NAVs.");

      if (data.recentLogs && Array.isArray(data.recentLogs)) {
        setLogs(data.recentLogs);
      }

      await refreshUserData("Syncing live NAVs from AMCs...");
      const syncTimeStr = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      toast.success(
        `Latest NAVs scraped & updated successfully at ${syncTimeStr}. Next auto-sync: 12:00 AM BST.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync NAVs.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Opportunistic auto catch-up sync:
  // If user opens dashboard and the last sync is stale (>14 hours old, e.g. from yesterday),
  // automatically trigger background sync once per session so NAV values are always up to date.
  const hasTriggeredCatchUpRef = useRef(false);
  useEffect(() => {
    if (
      !user ||
      funds.length === 0 ||
      hasTriggeredCatchUpRef.current ||
      isRefreshing
    )
      return;

    const lastSyncTime = syncInfo.timestamp;
    if (!lastSyncTime) return;

    const diffHours = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
    if (diffHours >= 14) {
      hasTriggeredCatchUpRef.current = true;
      handleManualSync();
    }
  }, [user, funds.length, syncInfo.timestamp, isRefreshing]);

  const isNetGain = summary.absoluteGainLoss >= 0;

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip flex flex-col pb-28 sm:pb-8">
      {/* ------------------------------------------------------------- */}
      {/* GLOBAL LOADING PROGRESS BAR & FLOATING SPINNER */}
      {/* ------------------------------------------------------------- */}
      {(isDataLoading || isRefreshing) && (
        <div className="fixed top-0 inset-x-0 h-1 z-50 bg-[#33c6e4]/20 overflow-hidden">
          <div className="h-full bg-[#33c6e4] animate-pulse w-full shadow-[0_0_10px_#33c6e4]" />
        </div>
      )}

      {(isDataLoading || isRefreshing) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-950/95 dark:bg-[#070b14]/95 text-white backdrop-blur-md border border-[#33c6e4]/50 shadow-2xl animate-in fade-in slide-in-from-top-2 text-xs font-bold pointer-events-none"
        >
          <Loader2 className="h-4 w-4 animate-spin text-[#33c6e4]" />
          <span>
            {crudLoadingMessage ||
              (isRefreshing
                ? "Syncing live NAV from AMCs..."
                : "Updating portfolio data...")}
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAVBAR (Bini Aesthetic) */}
      {/* ------------------------------------------------------------- */}
      <header className="theme-header sticky top-0 z-40 border-b backdrop-blur-md w-full max-w-full">
        <div className="mx-auto flex max-w-7xl w-full items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3.5 lg:px-8 min-w-0">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#33c6e4]/20 text-[#155360] dark:text-[#33c6e4] shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight theme-text-primary truncate">
                  NAV Watcher
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs theme-text-secondary truncate flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full inline-block animate-pulse shrink-0 bg-[#33c6e4]" />
                <span className="truncate">Mutual Funds Tracker</span>
              </p>
            </div>
          </div>

          {/* Action Buttons & User Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Install PWA Button (if available) */}
            {deferredInstallPrompt && !isAppInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs font-bold transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4 text-[#33c6e4]" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Sync Timestamp Info (Desktop) */}
            {user && (
              <div
                title={`Last synced: ${syncInfo.formattedTime}. Next auto-sync: 12:00 AM BST.`}
                className="hidden lg:flex flex-col text-right pr-1 cursor-default select-none"
              >
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Synced {syncInfo.relativeTime}</span>
                </span>
                <span className="text-[9px] theme-text-muted">
                  {syncInfo.formattedTime}
                </span>
              </div>
            )}

            {/* Manual Sync NAVs Button */}
            {user && (
              <button
                type="button"
                disabled={isRefreshing}
                onClick={handleManualSync}
                title="Sync Latest NAVs from AMCs"
                aria-label="Sync Latest NAVs"
                className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border theme-border px-2.5 py-1.5 text-xs font-bold theme-text-secondary hover:theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin text-[#33c6e4]" : ""}`}
                />
                <span className="hidden sm:inline ml-1.5">
                  {isRefreshing ? "Syncing..." : "Sync NAV"}
                </span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border theme-border p-2 text-xs font-semibold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {themePreference === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>

            {/* Authenticated Controls vs Unauthenticated Auth Buttons */}
            {user ? (
              <div className="flex items-center gap-2">
                {/* Add Fund Button */}
                <button
                  type="button"
                  onClick={() => setIsAddFundModalOpen(true)}
                  className="hidden md:inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Fund</span>
                </button>

                {/* Add Investment Button */}
                {funds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreselectedFundIdForInv(funds[0]?.id || null);
                      setIsAddInvestmentModalOpen(true);
                    }}
                    className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Calendar className="h-3.5 w-3.5 text-[#33c6e4]" />
                    <span>Add Investment</span>
                  </button>
                )}

                {/* User Profile Dropdown Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-xl border theme-border bg-white dark:bg-slate-900 p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#33c6e4]/20 text-[#155360] dark:text-[#33c6e4] font-bold text-xs">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline truncate max-w-[100px] theme-text-primary">
                      {user.name.split(" ")[0]}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl border theme-border bg-white dark:bg-slate-900 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 border-b theme-border">
                        <p className="text-xs font-bold theme-text-primary truncate">
                          {user.name}
                        </p>
                        <p className="text-[11px] theme-text-muted truncate">
                          {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-[10px] theme-text-muted truncate mt-0.5">
                            {user.phone}
                          </p>
                        )}
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsProfileModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <User className="h-4 w-4 text-slate-400" />
                          <span>My Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsAddFundModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Layers className="h-4 w-4 text-slate-400" />
                          <span>Explore Mutual Funds</span>
                        </button>
                      </div>

                      <div className="border-t theme-border pt-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("login");
                    setIsAuthModalOpen(true);
                  }}
                  className="rounded-xl border theme-border px-3 py-1.5 text-xs font-bold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[38px]"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("signup");
                    setIsAuthModalOpen(true);
                  }}
                  className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-3.5 py-1.5 text-xs font-bold transition shadow-sm min-h-[38px]"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. NOTIFICATION BANNER */}
      {/* ------------------------------------------------------------- */}
      {syncBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`border-b px-4 py-2.5 text-center text-xs font-medium transition ${
            syncBanner.type === "success"
              ? "status-gain-badge border-emerald-500/25"
              : syncBanner.type === "error"
                ? "status-loss-badge border-rose-500/25"
                : "status-info-badge border-sky-500/25"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
            {syncBanner.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 status-gain-text" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 status-loss-text" />
            )}
            <span>{syncBanner.text}</span>
            <button
              type="button"
              onClick={() => setSyncBanner(null)}
              aria-label="Dismiss banner"
              className="ml-2 font-bold opacity-75 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DASHBOARD CONTENT */}
      {/* ------------------------------------------------------------- */}
      <main className="mx-auto max-w-7xl w-full flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-6 pb-24 sm:pb-8">
        {/* CASE A: UNREGISTERED / NOT LOGGED IN LANDING SCREEN */}
        {!user ? (
          <div className="py-8 sm:py-16 max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold bg-[#ebf9fc] text-[#155360] dark:bg-slate-800 dark:text-[#33c6e4] border border-[#c0edf7] dark:border-slate-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Bangladesh Open-Ended Mutual Funds</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight theme-text-primary leading-tight">
              Track Your Mutual Funds in Bangladesh with Precision
            </h2>

            <p className="text-sm sm:text-base theme-text-secondary max-w-xl mx-auto leading-relaxed">
              Create your profile, add mutual funds across top AMCs, log
              previous and current month SIP investments, and track live
              valuations with real-time NAVs and automated SIP tracking.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode("signup");
                  setIsAuthModalOpen(true);
                }}
                className="w-full sm:w-auto rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-6 py-3 text-sm font-bold shadow-md transition"
              >
                Create Account &amp; Start Fresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode("login");
                  setIsAuthModalOpen(true);
                }}
                className="w-full sm:w-auto rounded-xl border theme-border px-6 py-3 text-sm font-bold theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Sign In to Existing Portfolio
              </button>
            </div>

            {/* 3 Core Highlights (Bini Tone) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-left">
              <div className="rounded-2xl border theme-border p-5 theme-surface shadow-sm space-y-2">
                <div className="p-2 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] w-fit">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm theme-text-primary">
                  28 Mutual Funds
                </h3>
                <p className="text-xs theme-text-muted leading-relaxed">
                  Browse and add funds across major AMCs including Shanta, IDLC,
                  EDGE, VIPB, Ekush, UCB, and CWT.
                </p>
              </div>

              <div className="rounded-2xl border theme-border p-5 theme-surface shadow-sm space-y-2">
                <div className="p-2 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] w-fit">
                  <Coins className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm theme-text-primary">
                  Units Tracking
                </h3>
                <p className="text-xs theme-text-muted leading-relaxed">
                  Mutual fund units are allotted as whole units with automatic
                  balance roll-forward on each monthly SIP.
                </p>
              </div>

              <div className="rounded-2xl border theme-border p-5 theme-surface shadow-sm space-y-2">
                <div className="p-2 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] w-fit">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm theme-text-primary">
                  Monthly SIP Logging
                </h3>
                <p className="text-xs theme-text-muted leading-relaxed">
                  Log previous or current calendar month installments.
                  Portfolios update dynamically with weighted cost averaging.
                </p>
              </div>
            </div>
          </div>
        ) : isDataLoading || isRefreshing ? (
          /* SKELETON LOADER UNTIL API RESPONSE */
          <div className="space-y-6">
            <div className="rounded-2xl border theme-border p-3.5 bg-slate-100/50 dark:bg-slate-900/50 animate-pulse flex items-center justify-between">
              <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <PortfolioSummarySkeleton />
            <div className="space-y-4">
              <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
              <FundCardsGridSkeleton
                count={funds.length > 0 ? funds.length : 3}
              />
            </div>
          </div>
        ) : funds.length === 0 ? (
          /* CASE B: LOGGED IN BUT ZERO FUNDS ADDED (FRESH START) */
          <div className="py-12 max-w-xl mx-auto text-center space-y-6">
            <div className="rounded-3xl border border-[#c0edf7] bg-[#ebf9fc]/40 dark:bg-slate-900/40 p-8 sm:p-12 space-y-5 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#33c6e4]/20 text-[#155360] dark:text-[#33c6e4]">
                <Layers className="h-7 w-7" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-extrabold theme-text-primary">
                  Welcome, {user.name}!
                </h2>
                <p className="text-xs sm:text-sm theme-text-secondary leading-relaxed">
                  Your portfolio is ready for a fresh start with zero seed data.
                  Begin by adding your mutual funds to track.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFundModalOpen(true)}
                  className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-6 py-3 text-xs sm:text-sm font-bold shadow-md inline-flex items-center gap-2 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Browse &amp; Add Mutual Funds</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CASE C: LOGGED IN WITH ACTIVE FUNDS */
          <div className="space-y-6">
            {/* TAB 1: PORTFOLIO (Quick Actions, Net Worth Hero, Mutual Fund Asset Cards) */}
            <div
              className={
                mobileTab === "portfolio"
                  ? "space-y-6"
                  : "hidden sm:block sm:space-y-6"
              }
            >
              {/* Top Quick Actions Bar (Mobile-First 2-Row / Desktop Flex) */}
              <div className="space-y-2.5">
                <div className="bg-white dark:bg-slate-900 border theme-border rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-2 sm:space-y-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    {/* On Mobile: Row 1 is full-width primary button. On Desktop: inline left button */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 flex-1">
                      {/* 1. Primary Hero: Record Investment */}
                      <button
                        type="button"
                        onClick={() => {
                          setPreselectedFundIdForInv(funds[0]?.id || null);
                          setIsAddInvestmentModalOpen(true);
                        }}
                        className="w-full sm:w-auto rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-4 py-2.5 sm:py-2 text-xs font-bold transition shadow-sm inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] whitespace-nowrap active:scale-[0.98]"
                      >
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>Record Monthly SIP</span>
                      </button>

                      {/* On Mobile: Row 2 is a balanced 50/50 split of [Add Fund] and [Sync Live NAV] */}
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5 flex-1">
                        {/* 2. Add Fund Button */}
                        <button
                          type="button"
                          onClick={() => setIsAddFundModalOpen(true)}
                          className="w-full sm:w-auto rounded-xl border theme-border px-3 py-2.5 sm:py-2 text-xs font-semibold theme-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] whitespace-nowrap active:scale-[0.98]"
                        >
                          <Plus className="h-3.5 w-3.5 text-[#33c6e4] shrink-0" />
                          <span>Add Fund</span>
                        </button>

                        {/* 3. Sync Live NAV Button (Mobile: right 50% / Desktop: hidden here, shown on right side) */}
                        <button
                          type="button"
                          disabled={isRefreshing}
                          onClick={handleManualSync}
                          className="sm:hidden w-full rounded-xl border theme-border px-3 py-2.5 text-xs font-semibold theme-text-secondary hover:theme-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-1.5 min-h-[40px] whitespace-nowrap disabled:opacity-50 active:scale-[0.98]"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isRefreshing ? "animate-spin text-[#33c6e4]" : ""
                            }`}
                          />
                          <span>
                            {isRefreshing ? "Syncing..." : "Sync Live NAV"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Desktop Right Side: Sync NAV & Loading indicator */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {isDataLoading && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] text-xs font-bold animate-in fade-in">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="truncate max-w-[140px]">
                            {crudLoadingMessage || "Updating..."}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isRefreshing}
                        onClick={handleManualSync}
                        className="rounded-xl border theme-border px-3.5 py-2 text-xs font-semibold theme-text-secondary hover:theme-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center gap-1.5 min-h-[36px] whitespace-nowrap disabled:opacity-50 active:scale-[0.98]"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isRefreshing ? "animate-spin text-[#33c6e4]" : ""
                          }`}
                        />
                        <span>
                          {isRefreshing ? "Syncing..." : "Sync Live NAV"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* NAV Sync Status Card (Mobile-First) */}
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-950/25 p-2.5 sm:px-3.5 sm:py-2 text-xs shadow-xs space-y-1.5">
                  {/* Top Row: Live status dot & primary timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                      <span className="font-bold text-slate-900 dark:text-white shrink-0 text-xs">
                        Live NAVs Synced:
                      </span>
                      <span className="font-mono text-emerald-800 dark:text-emerald-300 font-bold truncate text-[11px] sm:text-xs">
                        {syncInfo.formattedTime}
                      </span>
                    </div>

                    <span className="shrink-0 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-md">
                      {syncInfo.relativeTime}
                    </span>
                  </div>

                  {/* Bottom Row: Market Session & Auto-sync Schedule */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-500/15 text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1 truncate">
                      <span>Market:</span>
                      <strong className="text-slate-900 dark:text-slate-200 font-semibold truncate">
                        {syncInfo.effectiveDate}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-right">
                      <span>Auto-sync:</span>
                      <strong className="text-slate-900 dark:text-slate-200 font-semibold">
                        Daily at 12:00 AM BST
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Hero Portfolio Summary Card */}
              {isDataLoading || isRefreshing ? (
                <PortfolioSummarySkeleton />
              ) : (
                <section
                  aria-labelledby="portfolio-summary-heading"
                  className="theme-surface rounded-2xl border p-4 sm:p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider theme-text-muted">
                        My Mutual Funds Portfolio
                      </span>
                      <h2
                        id="portfolio-summary-heading"
                        className="text-2xl sm:text-3xl font-black tracking-tight theme-text-primary mt-0.5"
                      >
                        ৳{formatBdt(summary.currentMarketValue, 2)}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold font-mono ${
                          isNetGain ? "status-gain-badge" : "status-loss-badge"
                        }`}
                      >
                        {isNetGain ? (
                          <TrendingUp className="h-4 w-4 shrink-0 status-gain-text" />
                        ) : (
                          <TrendingDown className="h-4 w-4 shrink-0 status-loss-text" />
                        )}
                        <span>
                          {isNetGain ? "+" : "-"}৳
                          {formatBdt(Math.abs(summary.absoluteGainLoss), 2)} (
                          {isNetGain ? "+" : ""}
                          {summary.returnPct.toFixed(2)}%)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 3 Key Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="theme-elevated rounded-xl border p-3">
                      <span className="theme-text-muted block text-[11px]">
                        Total Invested Capital
                      </span>
                      <strong className="font-mono text-sm sm:text-base font-bold theme-text-primary">
                        ৳{formatBdt(summary.totalInvested, 2)}
                      </strong>
                    </div>

                    <div className="theme-elevated rounded-xl border p-3">
                      <span className="theme-text-muted block text-[11px]">
                        Total Units Held
                      </span>
                      <strong className="font-mono text-sm sm:text-base font-bold text-[#155360] dark:text-[#33c6e4]">
                        {Math.floor(
                          summary.totalUnitsHeld ??
                            funds.reduce(
                              (acc, f) => acc + (f.totalUnitsHeld || 0),
                              0,
                            ),
                        ).toLocaleString("en-BD")}{" "}
                        units
                      </strong>
                      <span className="block text-[10px] theme-text-muted mt-0.5">
                        Portfolio Holdings
                      </span>
                    </div>

                    <div className="theme-elevated rounded-xl border p-3">
                      <span className="theme-text-muted block text-[11px]">
                        Unallotted Cash Buffer
                      </span>
                      <strong className="font-mono text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                        ৳{formatBdt(summary.totalFractionalCash, 2)}
                      </strong>
                      <span className="block text-[10px] theme-text-muted mt-0.5">
                        Rolls to next SIP
                      </span>
                    </div>

                    <div className="theme-elevated rounded-xl border p-3">
                      <span className="theme-text-muted block text-[11px]">
                        Funds Tracked
                      </span>
                      <strong className="font-mono text-sm sm:text-base font-bold theme-text-primary">
                        {summary.fundsCount} Funds
                      </strong>
                      <span className="block text-[10px] theme-text-muted mt-0.5">
                        In Portfolio
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* 2. User Fund Asset Cards */}
              <section
                aria-labelledby="user-funds-heading"
                className="space-y-4"
              >
                <div className="flex items-center justify-between px-1">
                  <h3
                    id="user-funds-heading"
                    className="text-base font-bold theme-text-primary flex items-center gap-2"
                  >
                    <span>My Mutual Funds</span>
                    <span className="text-xs font-normal theme-text-muted">
                      ({funds.length})
                    </span>
                  </h3>
                </div>

                {isDataLoading || isRefreshing ? (
                  <FundCardsGridSkeleton
                    count={funds.length > 0 ? funds.length : 3}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {funds.map((fund) => {
                      const isGain = fund.absoluteGainLoss >= 0;

                      return (
                        <div
                          key={fund.id}
                          className="rounded-2xl border theme-border theme-surface p-4 space-y-3.5 shadow-sm hover:border-[#33c6e4]/40 transition flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            {/* Fund Header */}
                            <div className="flex items-start justify-between gap-2 border-b theme-border pb-3">
                              <div className="min-w-0">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold mb-1 ${
                                    fund.category === "Shariah"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : fund.category === "Income"
                                        ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                        : "bg-[#ebf9fc] text-[#155360] dark:bg-slate-800 dark:text-[#33c6e4] border border-[#c0edf7] dark:border-slate-700"
                                  }`}
                                >
                                  {fund.category}
                                </span>
                                <h4 className="text-sm font-bold theme-text-primary truncate">
                                  {fund.name}
                                </h4>
                                <p className="text-[11px] theme-text-muted truncate mt-0.5">
                                  {fund.fundManager}
                                </p>
                              </div>

                              <a
                                href={fund.biniUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="View Fund Details"
                                className="p-1.5 rounded-lg border theme-border text-slate-400 hover:text-[#33c6e4] transition shrink-0"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>

                            {/* NAV Badge */}
                            <div className="flex items-center justify-between text-xs rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2 border theme-border">
                              <span className="theme-text-muted">
                                Latest Scraped NAV:
                              </span>
                              <span className="font-mono font-bold status-gain-text">
                                ৳{fund.effectiveNav.toFixed(2)}
                              </span>
                            </div>

                            {/* Financial Stats */}
                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div>
                                <span className="text-[10px] theme-text-muted block">
                                  Invested Capital
                                </span>
                                <strong className="font-mono text-xs font-bold theme-text-primary">
                                  ৳{formatBdt(fund.totalInvested, 2)}
                                </strong>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] theme-text-muted block">
                                  Market Value
                                </span>
                                <strong className="font-mono text-xs font-bold theme-text-primary">
                                  ৳{formatBdt(fund.currentMarketValue, 2)}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[10px] theme-text-muted block">
                                  Units Held
                                </span>
                                <strong className="font-mono text-xs font-bold text-[#155360] dark:text-[#33c6e4]">
                                  {Math.floor(
                                    fund.totalUnitsHeld,
                                  ).toLocaleString("en-BD")}{" "}
                                  units
                                </strong>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] theme-text-muted block">
                                  Avg Buy Cost
                                </span>
                                <strong className="font-mono text-xs font-bold theme-text-primary">
                                  ৳
                                  {Number(fund.averageBuyPrice || 0).toFixed(2)}
                                </strong>
                              </div>
                            </div>

                            {/* Return Badge */}
                            <div className="flex items-center justify-between text-xs border-t theme-border pt-2.5">
                              <span className="theme-text-muted text-[11px]">
                                Net Gain / Loss
                              </span>
                              <span
                                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                  isGain
                                    ? "status-gain-badge"
                                    : "status-loss-badge"
                                }`}
                              >
                                {isGain ? "+" : "-"}৳
                                {formatBdt(Math.abs(fund.absoluteGainLoss), 2)}{" "}
                                ({isGain ? "+" : ""}
                                {fund.returnPct.toFixed(2)}%)
                              </span>
                            </div>
                          </div>

                          {/* Card Action Buttons */}
                          <div className="pt-3 border-t theme-border space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreselectedFundIdForInv(fund.id);
                                  setIsAddInvestmentModalOpen(true);
                                }}
                                className="flex-1 rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 py-2.5 px-3 text-xs font-bold transition shadow-sm inline-flex items-center justify-center gap-1.5"
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Add Investment</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteFund(fund.id, fund.name)
                                }
                                title="Remove fund from portfolio"
                                className="rounded-xl border border-rose-200 dark:border-rose-900/60 p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* TAB: INSERTED INVESTMENTS (Filterable, Paginated Investment Log) */}
            <div
              className={
                mobileTab === "investments" ? "block" : "hidden sm:block"
              }
            >
              {funds.length > 0 && (
                <InsertedInvestmentsSection
                  funds={funds}
                  onEditInvestment={handleOpenEditInvestment}
                  onDeleteInvestment={handleDeleteInvestment}
                  onAddInvestment={() => {
                    setPreselectedFundIdForInv(funds[0]?.id || null);
                    setIsAddInvestmentModalOpen(true);
                  }}
                />
              )}
            </div>

            {/* TAB 2: CHARTS (Historical Investment & Performance Comparison Chart) */}
            <div
              className={mobileTab === "charts" ? "block" : "hidden sm:block"}
            >
              {isRefreshing ? (
                <ChartSkeleton />
              ) : funds.length > 0 ? (
                <HistoricalInvestmentComparisonChart
                  funds={funds}
                  snapshots={snapshots}
                />
              ) : null}
            </div>

            {/* TAB 3: COMPARE (Invested Funds Comparison Section) */}
            <div
              className={mobileTab === "compare" ? "block" : "hidden sm:block"}
            >
              {isRefreshing ? (
                <CompareSkeleton />
              ) : funds.length > 0 ? (
                <FundComparisonSection
                  funds={funds}
                  totalPortfolioInvested={summary.totalInvested}
                  totalPortfolioValue={summary.currentMarketValue}
                />
              ) : null}
            </div>

            {/* TAB 4: BREAKDOWN (Detailed SIP Valuation & Formula Breakdown) */}
            <div
              className={
                mobileTab === "breakdown" ? "block" : "hidden sm:block"
              }
            >
              {/* 3. Detailed SIP Valuation Breakdown Section */}
              <section
                aria-labelledby="fund-breakdown-heading"
                className="theme-surface rounded-2xl border p-4 sm:p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3
                      id="fund-breakdown-heading"
                      className="text-sm sm:text-lg font-extrabold tracking-tight theme-text-primary"
                    >
                      Detailed SIP Valuation &amp; Formula Breakdown
                    </h3>
                    <p className="text-xs sm:text-sm theme-text-secondary mt-0.5 leading-relaxed">
                      Units = ⌊Invested ÷ Avg Price⌋ · Market Value = Units ×
                      Latest NAV
                    </p>
                  </div>

                  {/* Mobile View Toggle: Cards View vs Wide Table */}
                  <div className="flex sm:hidden items-center p-1 rounded-xl theme-elevated border theme-border shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => setMobileBreakdownMode("cards")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        mobileBreakdownMode === "cards"
                          ? "bg-[#33c6e4] text-slate-950 shadow-sm"
                          : "theme-text-secondary hover:theme-text-primary"
                      }`}
                    >
                      Cards View
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileBreakdownMode("table")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        mobileBreakdownMode === "table"
                          ? "bg-[#33c6e4] text-slate-950 shadow-sm"
                          : "theme-text-secondary hover:theme-text-primary"
                      }`}
                    >
                      Wide Table
                    </button>
                  </div>
                </div>

                {/* Mobile Cards View */}
                <div
                  className={`${
                    mobileBreakdownMode === "cards"
                      ? "flex flex-col gap-3 sm:hidden"
                      : "hidden"
                  }`}
                >
                  {funds.map((fund) => {
                    const isGain = fund.absoluteGainLoss >= 0;
                    return (
                      <article
                        key={fund.id}
                        className="theme-elevated rounded-2xl border theme-border p-4 space-y-3 overflow-hidden shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 border-b theme-border pb-2.5 min-w-0">
                          <div className="min-w-0 flex-1">
                            <h4
                              className="text-sm font-extrabold theme-text-primary truncate"
                              title={fund.name}
                            >
                              {fund.name}
                            </h4>
                            <p className="text-[11px] theme-text-muted mt-0.5 truncate">
                              NAV Date: {fund.navEffectiveDate || "Latest Day"}{" "}
                              · {fund.fundManager}
                            </p>
                          </div>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] shrink-0 whitespace-nowrap">
                            {fund.category}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="theme-surface rounded-lg border p-2.5">
                            <span className="text-[10px] theme-text-muted uppercase font-bold block">
                              Invested Capital
                            </span>
                            <span className="font-mono text-sm font-bold theme-text-primary">
                              ৳{formatBdt(fund.totalInvested, 2)}
                            </span>
                          </div>
                          <div className="theme-surface rounded-lg border p-2.5">
                            <span className="text-[10px] theme-text-muted uppercase font-bold block">
                              Avg Buy Cost
                            </span>
                            <span className="font-mono text-sm font-bold theme-text-primary">
                              ৳{fund.averageBuyPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="theme-surface rounded-lg border p-2.5">
                            <span className="text-[10px] theme-text-muted uppercase font-bold block">
                              Units Held
                            </span>
                            <span className="font-mono text-sm font-bold text-[#155360] dark:text-[#33c6e4]">
                              {Math.floor(fund.totalUnitsHeld).toLocaleString(
                                "en-BD",
                              )}{" "}
                              units
                            </span>
                          </div>
                          <div className="theme-surface rounded-lg border p-2.5">
                            <span className="text-[10px] theme-text-muted uppercase font-bold block">
                              Current Scraped NAV
                            </span>
                            <span className="font-mono text-sm font-bold status-gain-text">
                              ৳{fund.effectiveNav.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="theme-surface flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <span className="text-[10px] theme-text-muted uppercase font-bold block">
                              Current Market Value
                            </span>
                            <span className="font-mono text-base font-black theme-text-primary">
                              ৳{formatBdt(fund.currentMarketValue, 2)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] theme-text-muted uppercase font-bold block">
                              Net Gain / Loss
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold mt-0.5 ${
                                isGain
                                  ? "status-gain-badge"
                                  : "status-loss-badge"
                              }`}
                            >
                              {isGain ? "+" : "-"}৳
                              {formatBdt(Math.abs(fund.absoluteGainLoss), 2)} (
                              {isGain ? "+" : ""}
                              {fund.returnPct.toFixed(2)}%)
                            </span>
                          </div>
                        </div>

                        {/* Card Action Buttons at bottom - 100% contained, zero horizontal overflow */}
                        <div className="pt-2.5 border-t theme-border flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreselectedFundIdForInv(fund.id);
                              setIsAddInvestmentModalOpen(true);
                            }}
                            className="flex-1 rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 py-2.5 px-3 text-xs font-bold transition shadow-sm inline-flex items-center justify-center gap-1.5"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Add Investment</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteFund(fund.id, fund.name)}
                            title="Remove fund from portfolio"
                            className="rounded-xl border border-rose-200 dark:border-rose-900/60 p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Desktop / Wide Table View */}
                <div
                  className={`${
                    mobileBreakdownMode === "table"
                      ? "block"
                      : "hidden sm:block"
                  }`}
                >
                  <div className="table-wrapper scrollbar-thin rounded-xl border theme-border">
                    <table className="responsive-fund-table text-left text-xs sm:text-sm min-w-[760px] w-full">
                      <thead>
                        <tr className="theme-elevated border-b theme-border text-xs uppercase tracking-wider theme-text-secondary">
                          <th scope="col" className="py-3 px-3.5 font-bold">
                            Mutual Fund
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Current NAV
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Avg Buy Price
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Units
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Invested (BDT)
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Current Value
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Gain / Loss
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-bold text-right"
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-500/15">
                        {funds.map((fund) => {
                          const isGain = fund.absoluteGainLoss >= 0;
                          return (
                            <tr
                              key={fund.id}
                              className="hover:bg-slate-500/5 transition"
                            >
                              <th
                                scope="row"
                                className="py-3 px-3.5 font-bold theme-text-primary whitespace-nowrap"
                              >
                                <div>{fund.name}</div>
                                <div className="text-[11px] font-medium theme-text-muted mt-0.5">
                                  {fund.category} · {fund.fundManager}
                                </div>
                              </th>
                              <td className="py-3 px-3.5 font-mono text-right status-gain-text font-bold whitespace-nowrap">
                                ৳{fund.effectiveNav.toFixed(2)}
                              </td>
                              <td className="py-3 px-3.5 font-mono text-right font-semibold theme-text-primary whitespace-nowrap">
                                ৳{fund.averageBuyPrice.toFixed(2)}
                              </td>
                              <td className="py-3 px-3.5 font-mono text-right font-bold text-[#155360] dark:text-[#33c6e4] whitespace-nowrap">
                                <div>
                                  {Math.floor(
                                    fund.totalUnitsHeld,
                                  ).toLocaleString("en-BD")}
                                </div>
                                {fund.fractionalCashBalance > 0 && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                                    +৳{formatBdt(fund.fractionalCashBalance, 2)}{" "}
                                    buffer
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3.5 font-mono text-right font-semibold theme-text-primary whitespace-nowrap">
                                ৳{formatBdt(fund.totalInvested, 2)}
                              </td>
                              <td className="py-3 px-3.5 font-mono text-right font-extrabold theme-text-primary whitespace-nowrap">
                                ৳{formatBdt(fund.currentMarketValue, 2)}
                              </td>
                              <td className="py-3 px-3.5 font-mono text-right whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono ${
                                    isGain
                                      ? "status-gain-badge"
                                      : "status-loss-badge"
                                  }`}
                                >
                                  {isGain ? "+" : "-"}৳
                                  {formatBdt(
                                    Math.abs(fund.absoluteGainLoss),
                                    2,
                                  )}{" "}
                                  ({isGain ? "+" : ""}
                                  {fund.returnPct.toFixed(2)}%)
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreselectedFundIdForInv(fund.id);
                                      setIsAddInvestmentModalOpen(true);
                                    }}
                                    className="rounded-lg bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-3 py-1.5 text-xs font-bold transition shadow-sm inline-flex items-center gap-1"
                                  >
                                    <Calendar className="h-3 w-3" />
                                    <span>Add Investment</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteFund(fund.id, fund.name)
                                    }
                                    title="Delete fund"
                                    className="text-rose-500 hover:text-rose-700 p-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE BOTTOM NAVIGATION DOCK (sm:hidden) */}
      {/* ------------------------------------------------------------- */}
      {user && funds.length > 0 && (
        <nav
          aria-label="Mobile Navigation"
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#090d16]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 h-16 items-center px-1">
            {/* 1. Investments Tab */}
            <button
              type="button"
              onClick={() => {
                setMobileTab("investments");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex flex-col items-center justify-center gap-1 h-full py-1 transition relative ${
                mobileTab === "investments"
                  ? "text-[#155360] dark:text-[#33c6e4] font-bold"
                  : "theme-text-muted hover:theme-text-secondary"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition relative ${
                  mobileTab === "investments"
                    ? "bg-[#33c6e4]/20"
                    : "bg-transparent"
                }`}
              >
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight">Investments</span>
              {mobileTab === "investments" && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#33c6e4]" />
              )}
            </button>

            {/* 2. Charts Tab */}
            <button
              type="button"
              onClick={() => {
                setMobileTab("charts");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex flex-col items-center justify-center gap-1 h-full py-1 transition relative ${
                mobileTab === "charts"
                  ? "text-[#155360] dark:text-[#33c6e4] font-bold"
                  : "theme-text-muted hover:theme-text-secondary"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  mobileTab === "charts" ? "bg-[#33c6e4]/20" : "bg-transparent"
                }`}
              >
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight">Charts</span>
              {mobileTab === "charts" && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#33c6e4]" />
              )}
            </button>

            {/* 3. CENTER HIGHLIGHTED PORTFOLIO TAB */}
            <button
              type="button"
              onClick={() => {
                setMobileTab("portfolio");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex flex-col items-center justify-center -translate-y-2.5 transition-transform active:scale-95 relative group"
            >
              <div
                className={`flex items-center justify-center h-12 w-12 rounded-full transition-all duration-200 shadow-md ${
                  mobileTab === "portfolio"
                    ? "bg-[#33c6e4] text-slate-950 shadow-[#33c6e4]/50 ring-4 ring-white dark:ring-[#090d16] scale-105"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-[#33c6e4]/50 ring-4 ring-white dark:ring-[#090d16]"
                }`}
              >
                <Wallet
                  className={`h-5 w-5 ${
                    mobileTab === "portfolio" ? "stroke-[2.5]" : ""
                  }`}
                />
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 font-extrabold ${
                  mobileTab === "portfolio"
                    ? "text-[#155360] dark:text-[#33c6e4]"
                    : "theme-text-secondary"
                }`}
              >
                Portfolio
              </span>
            </button>

            {/* 4. Compare Tab */}
            <button
              type="button"
              onClick={() => {
                setMobileTab("compare");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex flex-col items-center justify-center gap-1 h-full py-1 transition relative ${
                mobileTab === "compare"
                  ? "text-[#155360] dark:text-[#33c6e4] font-bold"
                  : "theme-text-muted hover:theme-text-secondary"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  mobileTab === "compare" ? "bg-[#33c6e4]/20" : "bg-transparent"
                }`}
              >
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight">Compare</span>
              {mobileTab === "compare" && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#33c6e4]" />
              )}
            </button>

            {/* 5. Breakdown Tab */}
            <button
              type="button"
              onClick={() => {
                setMobileTab("breakdown");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex flex-col items-center justify-center gap-1 h-full py-1 transition relative ${
                mobileTab === "breakdown"
                  ? "text-[#155360] dark:text-[#33c6e4] font-bold"
                  : "theme-text-muted hover:theme-text-secondary"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition ${
                  mobileTab === "breakdown"
                    ? "bg-[#33c6e4]/20"
                    : "bg-transparent"
                }`}
              >
                <Coins className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight">Breakdown</span>
              {mobileTab === "breakdown" && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#33c6e4]" />
              )}
            </button>
          </div>
        </nav>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MODALS */}
      {/* ------------------------------------------------------------- */}
      {/* Auth Modal (Login / Signup) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          setMobileTab("portfolio"); // Always open portfolio menu page on mobile after login
          setIsDataLoading(true); // Immediately activate skeleton loader until portfolio API responds
          refreshUserData("Loading your portfolio...");
          setSyncBanner({
            type: "success",
            text: `Welcome, ${newUser.name}!`,
          });
        }}
      />

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        user={user}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdate={(updated) => {
          setUser(updated);
          setSyncBanner({
            type: "success",
            text: "Profile updated successfully.",
          });
        }}
      />

      {/* Add Mutual Fund Modal */}
      <AddFundModal
        isOpen={isAddFundModalOpen}
        onClose={() => setIsAddFundModalOpen(false)}
        onFundAdded={() => {
          refreshUserData("Adding fund to portfolio...");
          setSyncBanner({
            type: "success",
            text: "Mutual fund added to your portfolio.",
          });
        }}
      />

      {/* Add Investment Modal (Previous / Current Calendar Month) */}
      <AddInvestmentModal
        isOpen={isAddInvestmentModalOpen}
        funds={funds}
        preselectedUserFundId={preselectedFundIdForInv}
        onClose={() => setIsAddInvestmentModalOpen(false)}
        onInvestmentAdded={() => {
          refreshUserData("Recording investment & updating units...");
          toast.success("Investment recorded and portfolio metrics updated.");
        }}
      />

      {/* Edit Previously Inserted Investment Modal */}
      <EditInvestmentModal
        isOpen={isEditInvestmentModalOpen}
        investment={editingInvestment}
        onClose={() => {
          setIsEditInvestmentModalOpen(false);
          setEditingInvestment(null);
        }}
        onUpdated={() => {
          refreshUserData("Updating investment & recalculating...");
          toast.success(
            "Investment updated and portfolio metrics recalculated.",
          );
        }}
      />

      {/* Custom Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
}
