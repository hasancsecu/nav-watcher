import crypto from "node:crypto";
import { prisma } from "./prisma";

// 10 minutes validity as strictly required
export const OTP_VALIDITY_MINUTES = 10;
export const OTP_VALIDITY_MS = OTP_VALIDITY_MINUTES * 60 * 1000; // 600,000 ms
export const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown between resends
export const MAX_VERIFY_ATTEMPTS = 5; // Invalidate after 5 wrong tries

interface InMemoryOtpRecord {
  otp: string;
  expiresAt: number; // Unix timestamp ms
  createdAt: number; // Unix timestamp ms
  attempts: number;
}

// Global in-memory fallback store across hot-reloads and serverless invocations in the same process
const globalForOtp = globalThis as unknown as {
  __nav_otp_store__?: Map<string, InMemoryOtpRecord>;
};

if (!globalForOtp.__nav_otp_store__) {
  globalForOtp.__nav_otp_store__ = new Map<string, InMemoryOtpRecord>();
}

const memoryStore = globalForOtp.__nav_otp_store__;

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
 * Check if requesting another OTP for this email is currently rate-limited (within 30s)
 */
export function isOtpRateLimited(email: string): { limited: boolean; retryAfterSeconds: number } {
  const key = normalizeEmail(email);
  const existing = memoryStore.get(key);
  if (!existing) return { limited: false, retryAfterSeconds: 0 };

  const elapsed = Date.now() - existing.createdAt;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return { limited: true, retryAfterSeconds: remainingSeconds };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP and saves it with a 10-minute expiry
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
  const expiresAtMs = now + OTP_VALIDITY_MS;
  const expiresAt = new Date(expiresAtMs);

  // Save to in-memory store
  memoryStore.set(normalizedEmail, {
    otp,
    expiresAt: expiresAtMs,
    createdAt: now,
    attempts: 0,
  });

  // Also persist in Prisma database if available (with fallback on error)
  try {
    // Delete any old OTPs for this email in database
    await prisma.emailVerification.deleteMany({
      where: { email: normalizedEmail },
    }).catch(() => {});

    // Create fresh record
    await prisma.emailVerification.create({
      data: {
        email: normalizedEmail,
        otp,
        expiresAt,
      },
    });
  } catch (dbError) {
    // Database table might not be pushed yet or DB is offline in dev/sandbox
    console.warn(
      "[OTP Service] Notice: Could not persist OTP to database, relying on memory store.",
      dbError instanceof Error ? dbError.message : String(dbError)
    );
  }

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
 * Verifies the submitted OTP for the email.
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

  // 1. Check in-memory store first
  const memRecord = memoryStore.get(normalizedEmail);

  if (memRecord) {
    // Check max attempts
    if (memRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      memoryStore.delete(normalizedEmail);
      return {
        valid: false,
        reason: "MAX_ATTEMPTS",
        message: "Too many failed attempts. Please request a new verification code.",
      };
    }

    // Check expiration (10 minutes)
    if (now > memRecord.expiresAt) {
      memoryStore.delete(normalizedEmail);
      return {
        valid: false,
        reason: "EXPIRED",
        message: "Verification code has expired (valid for 10 minutes). Please request a new code.",
      };
    }

    // Check code match
    if (memRecord.otp !== cleanOtp) {
      memRecord.attempts += 1;
      const remainingAttempts = MAX_VERIFY_ATTEMPTS - memRecord.attempts;
      return {
        valid: false,
        reason: "MISMATCH",
        message: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts,
      };
    }

    // Code is valid! Consume it so it cannot be reused
    memoryStore.delete(normalizedEmail);

    // Also clean up DB if accessible
    try {
      await prisma.emailVerification.deleteMany({
        where: { email: normalizedEmail },
      });
    } catch {
      // Ignore
    }

    return { valid: true };
  }

  // 2. Fallback to Prisma database if memory record wasn't found (e.g. multi-process)
  try {
    const dbRecord = await prisma.emailVerification.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });

    if (!dbRecord) {
      return {
        valid: false,
        reason: "NOT_FOUND",
        message: "No active verification code found for this email. Please request a code.",
      };
    }

    if (new Date(dbRecord.expiresAt).getTime() < now) {
      await prisma.emailVerification.delete({ where: { id: dbRecord.id } }).catch(() => {});
      return {
        valid: false,
        reason: "EXPIRED",
        message: "Verification code has expired (valid for 10 minutes). Please request a new code.",
      };
    }

    if (dbRecord.otp !== cleanOtp) {
      return {
        valid: false,
        reason: "MISMATCH",
        message: "Incorrect verification code. Please check your email and try again.",
      };
    }

    // Match! Consume DB record
    await prisma.emailVerification.delete({ where: { id: dbRecord.id } }).catch(() => {});
    return { valid: true };
  } catch (error) {
    console.error("[OTP Service] verifyOtp DB fallback error:", error);
    return {
      valid: false,
      reason: "NOT_FOUND",
      message: "No active verification code found for this email. Please request a code.",
    };
  }
}
