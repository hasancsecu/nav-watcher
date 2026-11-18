import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { isValidEmailFormat, normalizeEmail, verifyOtp } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, confirmPassword, phone, address, otp } = body;

    // 1. Full Name validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Full Name is required." },
        { status: 400 },
      );
    }

    // 2. Email format validation
    if (!email || typeof email !== "string" || !isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: "A valid email address is required (e.g. name@example.com)." },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // 3. Password length validation
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 },
      );
    }

    // 4. Confirm Password matching validation
    if (!confirmPassword || typeof confirmPassword !== "string") {
      return NextResponse.json(
        { error: "Please confirm your password." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match. Please verify your confirm password." },
        { status: 400 },
      );
    }

    // 5. OTP verification check (10 minutes validity)
    if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
      return NextResponse.json(
        { error: "A valid 6-digit email verification code is required." },
        { status: 400 },
      );
    }

    const otpVerification = await verifyOtp(normalizedEmail, otp.trim());
    if (!otpVerification.valid) {
      return NextResponse.json(
        { error: otpVerification.message },
        { status: 400 },
      );
    }

    // 6. Check if user already exists
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

    // 7. Hash password & create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        emailVerified: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });

    // 8. Create session token
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      message: "Account created and verified successfully.",
      user,
    });

    // 9. Set secure HTTP-only cookie
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("[API /api/auth/signup POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create account", details: String(error) },
      { status: 500 },
    );
  }
}
