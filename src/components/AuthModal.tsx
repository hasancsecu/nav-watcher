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
  CheckCircle2,
  Clock,
  ArrowLeft,
  RotateCw,
  ShieldCheck,
  Check,
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
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [signupStep, setSignupStep] = useState<"details" | "otp">("details");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // OTP state
  const [otp, setOtp] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(600); // 10 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState(0); // Cooldown between resends
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);

  // Status & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Reset or initialize modal state
  useEffect(() => {
    setMode(initialMode);
    setSignupStep("details");
    setError(null);
    setInfoMessage(null);
    setOtp("");
    setPreviewOtp(null);
  }, [initialMode, isOpen]);

  // Handle native dialog open / close
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

  // 10-minute OTP countdown & 30s resend cooldown timer
  useEffect(() => {
    if (signupStep !== "otp") return;

    const timer = setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [signupStep]);

  // Focus OTP input when transitioning to OTP step
  useEffect(() => {
    if (signupStep === "otp") {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [signupStep]);

  // Helper to format remaining seconds into MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isEmailValid = (em: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim());
  const doPasswordsMatch =
    confirmPassword.length > 0 && password.length > 0 && password === confirmPassword;
  const isPasswordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  // Step 1: Validate inputs and send OTP email (10 min validity)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    // Validation 1: Full name
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    // Validation 2: Email format
    if (!isEmailValid(email)) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    // Validation 3: Password minimum length
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    // Validation 4: Password and Confirm Password match
    if (!confirmPassword) {
      setError("Please confirm your password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your confirm password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setSignupStep("otp");
      setOtpExpiresIn(data.expiresInSeconds || 600);
      setResendCooldown(30);
      setOtp("");
      if (data.previewOtp) {
        setPreviewOtp(data.previewOtp);
      }
      setInfoMessage("Verification code sent! Please check your email.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong sending the verification code.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP action
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setError(null);
    setInfoMessage(null);
    setIsResending(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to resend verification code.");
      }

      setOtpExpiresIn(data.expiresInSeconds || 600);
      setResendCooldown(30);
      setOtp("");
      if (data.previewOtp) {
        setPreviewOtp(data.previewOtp);
      }
      setInfoMessage("A fresh verification code was sent to your email.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to resend code. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  };

  // Step 2: Verify OTP and finalize account creation
  const handleVerifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (otpExpiresIn <= 0) {
      setError("This verification code has expired (10 min validity). Please click Resend Code.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          otp: cleanOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account.");
      }

      onSuccess(data.user);
      dialogRef.current?.close();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong verifying your code. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Standard Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
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
                {mode === "signup" && signupStep === "otp" ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2
                  id={titleId}
                  className="text-lg font-bold tracking-tight theme-text-primary"
                >
                  {mode === "login"
                    ? "Welcome back"
                    : signupStep === "otp"
                      ? "Verify Your Email"
                      : "Create your account"}
                </h2>
                <p className="text-xs theme-text-secondary mt-0.5">
                  {mode === "login"
                    ? "Sign in to manage your mutual funds & investments"
                    : signupStep === "otp"
                      ? "Enter the 6-digit code sent to your email"
                      : "Track Bangladesh mutual funds & automated SIPs"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="rounded-xl p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode Switch Tabs (hidden on OTP step) */}
          {signupStep === "details" && (
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`rounded-lg py-1.5 text-xs font-bold transition min-h-[36px] ${
                  mode === "login"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`rounded-lg py-1.5 text-xs font-bold transition min-h-[36px] ${
                  mode === "signup"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* FORM CONTENT */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Global Alert Messages */}
          {error && (
            <div className="mb-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-3.5 rounded-xl border border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-900 p-3 text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#33c6e4]" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-3.5">
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="form-control-input w-full rounded-xl border px-3.5 py-2.5 pr-10 text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[44px] rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 font-bold text-xs sm:text-sm shadow-sm inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Portfolio</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 2. SIGNUP MODE - STEP 1: FORM DETAILS */}
          {mode === "signup" && signupStep === "details" && (
            <form onSubmit={handleRequestOtp} className="space-y-3.5">
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
                <p className="text-[10px] theme-text-secondary">
                  A 6-digit OTP (valid for 10 minutes) will be sent to this email.
                </p>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Password *</span>
                  </label>
                  {password.length > 0 && password.length < 6 && (
                    <span className="text-[10px] text-amber-500 font-medium">
                      At least 6 chars
                    </span>
                  )}
                </div>
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
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password matching with Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Confirm Password *</span>
                  </label>
                  {confirmPassword.length > 0 && (
                    <span
                      className={`text-[10px] font-semibold flex items-center gap-1 ${
                        doPasswordsMatch ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {doPasswordsMatch ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Passwords match</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          <span>Passwords do not match</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`form-control-input w-full rounded-xl border px-3.5 py-2.5 pr-10 text-xs font-medium transition ${
                      confirmPassword.length > 0
                        ? doPasswordsMatch
                          ? "border-emerald-500/60 dark:border-emerald-500/60 ring-1 ring-emerald-500/20"
                          : "border-rose-500/60 dark:border-rose-500/60 ring-1 ring-rose-500/20"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Optional Phone & Address */}
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || isPasswordMismatch}
                  className="w-full min-h-[44px] rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 font-bold text-xs sm:text-sm shadow-sm inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue & Verify Email</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 3. SIGNUP MODE - STEP 2: OTP VERIFICATION */}
          {mode === "signup" && signupStep === "otp" && (
            <form onSubmit={handleVerifyAndSignup} className="space-y-4">
              {/* Back to Edit button */}
              <button
                type="button"
                onClick={() => {
                  setSignupStep("details");
                  setError(null);
                  setInfoMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to edit details</span>
              </button>

              {/* Target Email Card with 10-Minute Expiry Badge */}
              <div className="rounded-xl border theme-border bg-slate-50/70 dark:bg-slate-900/60 p-3.5 text-center space-y-1.5">
                <p className="text-xs theme-text-secondary">
                  We sent a 6-digit verification code to:
                </p>
                <p className="text-xs font-bold theme-text-primary break-all">
                  {email}
                </p>

                {/* 10-Minute Validity Timer */}
                <div className="pt-1.5 flex items-center justify-center gap-1.5">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      otpExpiresIn > 60
                        ? "bg-[#33c6e4]/10 text-[#155360] dark:text-[#33c6e4] border-[#33c6e4]/30"
                        : otpExpiresIn > 0
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>
                      {otpExpiresIn > 0
                        ? `Valid for: ${formatTime(otpExpiresIn)} (10 min)`
                        : "Code expired (10 min limit)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dev mode helper */}
              {previewOtp && (
                <div className="rounded-xl border border-dashed border-[#33c6e4]/60 bg-[#33c6e4]/5 p-2.5 text-center">
                  <p className="text-[11px] text-[#155360] dark:text-[#33c6e4] font-medium">
                    Demo Mode · Generated Code:{" "}
                    <span className="font-mono font-bold text-xs tracking-wider">
                      {previewOtp}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setOtp(previewOtp)}
                    className="mt-1 text-[10px] font-bold text-[#155360] dark:text-[#33c6e4] underline hover:opacity-80"
                  >
                    Click to auto-fill code
                  </button>
                </div>
              )}

              {/* OTP Digits Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold theme-text-primary text-center block">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex justify-center">
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                    }}
                    placeholder="••••••"
                    className="form-control-input w-full max-w-[240px] text-center text-2xl font-mono font-extrabold tracking-[0.5em] py-2.5 rounded-xl border"
                  />
                </div>
              </div>

              {/* Resend Code Section */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <span className="theme-text-secondary text-[11px]">
                  Didn&apos;t receive code?
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="font-bold text-[#155360] dark:text-[#33c6e4] hover:underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <span>Resend in {resendCooldown}s</span>
                    </>
                  ) : (
                    <>
                      <RotateCw className="h-3 w-3" />
                      <span>Resend Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || otp.trim().length !== 6 || otpExpiresIn <= 0}
                  className="w-full min-h-[44px] rounded-xl bg-[#33c6e4] hover:bg-[#2eb4cf] text-slate-950 font-bold text-xs sm:text-sm shadow-sm inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying & Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verify & Complete Sign Up</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t theme-border p-4 text-center text-xs theme-text-secondary bg-slate-50/50 dark:bg-slate-900/40 rounded-b-2xl">
          {mode === "login" ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setSignupStep("details");
                  setError(null);
                  setInfoMessage(null);
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
                  setSignupStep("details");
                  setError(null);
                  setInfoMessage(null);
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
