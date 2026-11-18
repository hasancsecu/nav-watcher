import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAndSaveOtp,
  isOtpRateLimited,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name } = body;

    if (!email || typeof email !== "string" || !isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if account already exists
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          {
            error:
              "An account with this email address already exists. Please log in.",
          },
          { status: 409 },
        );
      }
    } catch (dbError) {
      console.warn(
        "[API /api/auth/send-otp] Prisma user check warning:",
        dbError instanceof Error ? dbError.message : String(dbError),
      );
    }

    // Check 30s resend rate limiting
    const rateLimit = isOtpRateLimited(normalizedEmail);
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: `Please wait ${rateLimit.retryAfterSeconds}s before requesting another verification code.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    // Generate 6-digit OTP with 10-minute expiry
    const { otp, expiresAt, expiresInSeconds } =
      await generateAndSaveOtp(normalizedEmail);

    // Send email (or log to console if no provider configured)
    const emailResult = await sendOtpEmail({
      email: normalizedEmail,
      name: typeof name === "string" ? name.trim() : undefined,
      otp,
      expiresAt,
    });

    return NextResponse.json({
      message: "A 6-digit verification code has been sent to your email (valid for 10 minutes).",
      expiresInSeconds,
      previewOtp: emailResult.previewOtp,
    });
  } catch (error) {
    console.error("[API /api/auth/send-otp POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code", details: String(error) },
      { status: 500 },
    );
  }
}
