"use client";

import React, { useEffect, useRef, useId } from "react";
import { AlertTriangle, Trash2, X, HelpCircle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descId = useId();

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

  // Handle native escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!isLoading) {
        onCancel();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [isLoading, onCancel]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="theme-elevated modal-native-backdrop w-full max-w-md rounded-2xl border theme-border p-0 shadow-2xl backdrop:bg-slate-950/70"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                : "bg-[#33c6e4]/15 text-[#33c6e4] border border-[#33c6e4]/30"
            }`}
          >
            {variant === "danger" ? (
              <Trash2 className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id={titleId}
              className="text-base font-bold theme-text-primary tracking-tight"
            >
              {title}
            </h3>
            <p
              id={descId}
              className="mt-1 text-xs sm:text-sm theme-text-secondary leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t theme-border">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="rounded-xl border theme-border px-4 py-2.5 text-xs font-bold theme-text-secondary hover:theme-text-primary transition disabled:opacity-50 min-h-[42px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-xs font-bold transition inline-flex items-center gap-1.5 min-h-[42px] shadow-sm disabled:opacity-50 ${
              variant === "danger"
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
