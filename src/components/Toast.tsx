"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, d?: number) => addToast("success", msg, d),
    error: (msg: string, d?: number) => addToast("error", msg, d),
    info: (msg: string, d?: number) => addToast("info", msg, d),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[100] flex max-w-sm w-full flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => removeToast(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const duration = item.duration ?? 4000;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const config = {
    success: {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
      border: "border-emerald-500/40",
      bg: "bg-surface theme-elevated",
      bar: "bg-emerald-500",
    },
    error: {
      icon: <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />,
      border: "border-rose-500/40",
      bg: "bg-surface theme-elevated",
      bar: "bg-rose-500",
    },
    info: {
      icon: <Info className="h-5 w-5 text-[#33c6e4] shrink-0" />,
      border: "border-[#33c6e4]/40",
      bg: "bg-surface theme-elevated",
      bar: "bg-[#33c6e4]",
    },
  }[item.type];

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${config.border} ${config.bg} p-3.5 shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1 text-xs sm:text-sm font-medium theme-text-primary leading-snug">
          {item.message}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-lg p-1 theme-text-muted hover:theme-text-primary transition shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/20 dark:bg-slate-700/30 overflow-hidden">
          <div
            className={`h-full ${config.bar}`}
            style={{
              animation: `toastProgress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
