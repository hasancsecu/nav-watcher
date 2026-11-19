import crypto from "node:crypto";
import { prisma } from "./prisma";

// 10 minutes validity as strictly required
export const OTP_VALIDITY_MINUTES = 10;
export const OTP_VALIDITY_MS = OTP_VALIDITY_MINUTES * 60 * 1000; // 600,000 ms
export const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown between resends
export const MAX_VERIFY_ATTEMPTS = 5; // Invalidate after 5 wrong tries

/**
 * Normalizes email address to avoid case-sensitivity issues
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates email format with a standard RFC 5322 regex
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Check if requesting another OTP for this email is currently rate-limited (within 30s).
 * Uses DB as the source of truth so it works correctly on Vercel serverless.
 */
export async function isOtpRateLimited(
  email: string,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const key = normalizeEmail(email);

  try {
    const existing = await prisma.emailVerification.findFirst({
      where: { email: key },
      orderBy: { createdAt: "desc" },
    });

    if (!existing) return { limited: false, retryAfterSeconds: 0 };

    const elapsed = Date.now() - new Date(existing.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { limited: true, retryAfterSeconds: remainingSeconds };
    }
  } catch {
    // DB unavailable — allow the request through
  }

  return { limited: false, retryAfterSeconds: 0 };
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP and saves it to the database.
 * DB is the primary store so it works correctly across Vercel serverless instances.
 */
export async function generateAndSaveOtp(email: string): Promise<{
  otp: string;
  expiresAt: Date;
  expiresInSeconds: number;
}> {
  const normalizedEmail = normalizeEmail(email);

  // Generate 6-digit numeric OTP code (100000 - 999999)
  const otpNumber = crypto.randomInt(100000, 1000000);
  const otp = otpNumber.toString();

  const now = Date.now();
  const expiresAt = new Date(now + OTP_VALIDITY_MS);

  // Delete any existing OTPs for this email, then create a fresh one
  await prisma.emailVerification.deleteMany({
    where: { email: normalizedEmail },
  });

  await prisma.emailVerification.create({
    data: {
      email: normalizedEmail,
      otp,
      expiresAt,
    },
  });

  return {
    otp,
    expiresAt,
    expiresInSeconds: OTP_VALIDITY_MINUTES * 60,
  };
}

export type VerifyOtpResult =
  | { valid: true }
  | {
      valid: false;
      reason: "NOT_FOUND" | "EXPIRED" | "MISMATCH" | "MAX_ATTEMPTS";
      message: string;
      remainingAttempts?: number;
    };

/**
 * Verifies the submitted OTP for the email against the database.
 * Checks 10-minute expiration, match, and attempts limit.
 * If valid, consumes (deletes) the OTP to prevent replay attacks.
 */
export async function verifyOtp(
  email: string,
  submittedOtp: string,
): Promise<VerifyOtpResult> {
  const normalizedEmail = normalizeEmail(email);
  const cleanOtp = submittedOtp.trim();
  const now = Date.now();

  try {
    const dbRecord = await prisma.emailVerification.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });

    if (!dbRecord) {
      return {
        valid: false,
        reason: "NOT_FOUND",
        message:
          "No active verification code found for this email. Please request a new code.",
      };
    }

    // Check max attempts
    if ((dbRecord.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      await prisma.emailVerification.delete({ where: { id: dbRecord.id } }).catch(() => {});
      return {
        valid: false,
        reason: "MAX_ATTEMPTS",
        message: "Too many failed attempts. Please request a new verification code.",
      };
    }

    // Check expiration (10 minutes)
    if (new Date(dbRecord.expiresAt).getTime() < now) {
      await prisma.emailVerification.delete({ where: { id: dbRecord.id } }).catch(() => {});
      return {
        valid: false,
        reason: "EXPIRED",
        message:
          "Verification code has expired (valid for 10 minutes). Please request a new code.",
      };
    }

    // Check code match
    if (dbRecord.otp !== cleanOtp) {
      const newAttempts = (dbRecord.attempts ?? 0) + 1;
      await prisma.emailVerification
        .update({ where: { id: dbRecord.id }, data: { attempts: newAttempts } })
        .catch(() => {});
      const remainingAttempts = MAX_VERIFY_ATTEMPTS - newAttempts;
      return {
        valid: false,
        reason: "MISMATCH",
        message: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts,
      };
    }

    // Code is valid! Consume it so it cannot be reused
    await prisma.emailVerification.delete({ where: { id: dbRecord.id } }).catch(() => {});
    return { valid: true };
  } catch (error) {
    console.error("[OTP Service] verifyOtp DB error:", error);
    return {
      valid: false,
      reason: "NOT_FOUND",
      message:
        "Verification failed due to a server error. Please try again.",
    };
  }
}
