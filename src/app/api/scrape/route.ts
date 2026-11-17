import { NextRequest, NextResponse } from "next/server";
import { syncAllFundsNav } from "@/lib/scraper";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { initDailyNavScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    // If not cron, must be logged-in user
    const user = await getCurrentUser();

    if (!isCronAuthorized && !user && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Unauthorized. Session or Cron authorization required." },
        { status: 401 }
      );
    }

    const scheduler = initDailyNavScheduler();
    const syncOutcome = await syncAllFundsNav({
      trigger: isCronAuthorized ? "VERCEL_SCHEDULE_MIDNIGHT_DHAKA" : "API_GET_SYNC",
    });

    const recentLogs = await prisma.scrapeLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return NextResponse.json(
      {
        success: true,
        syncOutcome,
        recentLogs,
        scheduler,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[API /api/scrape GET] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute scheduled NAV scrape",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to sync live NAVs." },
        { status: 401 }
      );
    }

    const scheduler = initDailyNavScheduler();
    let forceFallbackFor: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.forceFallbackFor)) {
        forceFallbackFor = body.forceFallbackFor;
      }
    } catch {
      // Empty request body is expected for standard manual sync
    }

    const syncOutcome = await syncAllFundsNav({
      trigger: forceFallbackFor.length > 0 ? "MANUAL_FALLBACK_TEST" : "MANUAL_SYNC",
      forceFallbackFor,
    });

    const recentLogs = await prisma.scrapeLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return NextResponse.json(
      {
        success: true,
        syncOutcome,
        recentLogs,
        scheduler,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[API /api/scrape POST] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute NAV scrape",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
