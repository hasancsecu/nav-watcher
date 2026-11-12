"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  createdAt?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onUpdate: (updatedUser: UserProfile) => void;
}

export default function ProfileModal({
  isOpen,
  user,
  onClose,
  onUpdate,
}: ProfileModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setMessage(null);
    }
  }, [user, isOpen]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      onUpdate(data.user);
      setMessage({
        type: "success",
        text: "Profile details updated successfully.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Update failed.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="theme-elevated modal-native-backdrop w-full max-w-md rounded-2xl border theme-border p-0 shadow-2xl backdrop:bg-slate-950/70"
    >
      <form onSubmit={handleSave} className="flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b theme-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4] font-bold text-sm">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2
                id={titleId}
                className="text-base font-bold theme-text-primary"
              >
                My Profile
              </h2>
              <p className="text-xs theme-text-secondary">
                Personal details &amp; contact information
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

        {/* Notifications */}
        {message && (
          <div
            className={`mx-6 mt-3 rounded-xl border p-3 text-xs flex items-center gap-2 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full rounded-xl border bg-slate-100 dark:bg-slate-800/50 theme-border px-3.5 py-2.5 text-xs font-mono text-slate-500 cursor-not-allowed"
            />
            <span className="text-[10px] theme-text-muted">
              Email is linked to your account credentials
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 17..."
              className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>Address</span>
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your residential address"
              className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
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
            disabled={isLoading}
            className="rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 px-5 py-2 text-xs font-bold shadow-sm transition disabled:opacity-60 min-h-[40px] inline-flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
