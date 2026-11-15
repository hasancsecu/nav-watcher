import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in.", user: null },
        { status: 401, headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } },
      );
    }
    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } },
    );
  } catch (error) {
    console.error("[API /api/auth/me GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve user profile" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { name, phone, address } = body;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && typeof name === "string" ? { name: name.trim() } : {}),
        phone:
          phone !== undefined
            ? phone
              ? String(phone).trim()
              : null
            : undefined,
        address:
          address !== undefined
            ? address
              ? String(address).trim()
              : null
            : undefined,
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

    return NextResponse.json({
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[API /api/auth/me PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update profile", details: String(error) },
      { status: 500 },
    );
  }
}
