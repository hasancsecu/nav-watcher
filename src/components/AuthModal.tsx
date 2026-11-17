"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: "login" | "signup";
  onClose: () => void;
  onSuccess: (user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  }) => void;
}

export default function AuthModal({
  isOpen,
  initialMode = "login",
  onClose,
  onSuccess,
}: AuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Handle native close and light dismiss
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint =
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? { name, email, password, phone, address }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Authentication failed. Please check your credentials.",
        );
      }

      onSuccess(data.user);
      dialogRef.current?.close();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="theme-elevated modal-native-backdrop w-full max-w-md rounded-2xl border theme-border p-0 shadow-2xl backdrop:bg-slate-950/70"
    >
      <div className="flex flex-col max-h-[90dvh]">
        {/* Header with Bini Cyan Accent */}
        <div className="relative border-b theme-border px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#33c6e4]/15 text-[#155360] dark:text-[#33c6e4]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id={titleId}
                  className="text-lg font-bold tracking-tight theme-text-primary"
                >
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="text-xs theme-text-secondary mt-0.5">
                  {mode === "login"
                    ? "Sign in to manage your mutual funds & investments"
                    : "Fresh start · Track your Bangladesh mutual funds & SIPs"}
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

          {/* Mode Switch Tabs */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-lg py-1.5 text-xs font-bold transition min-h-[36px] ${
                mode === "login"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`rounded-lg py-1.5 text-xs font-bold transition min-h-[36px] ${
                mode === "signup"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5"
        >
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              <span>Email Address *</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Password *</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="form-control-input w-full rounded-xl border px-3.5 py-2.5 pr-10 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1700-000000"
                  className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>Address</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Gulshan, Dhaka, Bangladesh"
                  className="form-control-input w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                />
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 font-bold text-xs sm:text-sm shadow-sm inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? "Sign In to Portfolio"
                      : "Create Account & Start"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="border-t theme-border p-4 text-center text-xs theme-text-secondary bg-slate-50/50 dark:bg-slate-900/40 rounded-b-2xl">
          {mode === "login" ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-bold text-[#155360] dark:text-[#33c6e4] hover:underline"
              >
                Sign up for free
              </button>
            </p>
          ) : (
            <p>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-bold text-[#155360] dark:text-[#33c6e4] hover:underline"
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
