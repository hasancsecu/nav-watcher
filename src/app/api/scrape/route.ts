import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncAllFundsNav } from "@/lib/scraper";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { initDailyNavScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60-second allowance for external AMC web scraping

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get("key") || searchParams.get("secret");

    // Vercel Cron automated headers
    const isVercelCronHeader =
      Boolean(req.headers.get("x-vercel-cron-schedule")) ||
      req.headers.get("x-vercel-cron") === "1" ||
      Boolean(
        req.headers.get("user-agent")?.toLowerCase().includes("vercel-cron"),
      );

    // Check secret if CRON_SECRET is configured
    const isBearerMatch = Boolean(
      cronSecret && authHeader === `Bearer ${cronSecret}`,
    );
    const isQueryMatch = Boolean(cronSecret && queryKey === cronSecret);

    const user = await getCurrentUser();

    // Determine authorization:
    // 1. Valid CRON_SECRET via Bearer token or Query Key
    // 2. Vercel Cron internal header (x-vercel-cron: "1" or user-agent: vercel-cron)
    // 3. Explicit cron query flag (?cron=1)
    // 4. Logged-in user session
    // 5. Development mode
    const isCronAuthorized =
      isBearerMatch ||
      isQueryMatch ||
      isVercelCronHeader ||
      searchParams.get("cron") === "1";

    const isAuthorized =
      isCronAuthorized ||
      Boolean(user) ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Valid cron token, Vercel cron signature, or user session required.",
        },
        { status: 401 },
      );
    }

    const scheduler = initDailyNavScheduler();
    const triggerSource =
      isVercelCronHeader || isBearerMatch
        ? "VERCEL_SCHEDULE_MIDNIGHT_DHAKA"
        : isCronAuthorized
          ? "CRON_SCHEDULE_MIDNIGHT_DHAKA"
          : "API_GET_SYNC";

    const syncOutcome = await syncAllFundsNav({
      trigger: triggerSource,
    });

    try {
      revalidatePath("/");
      revalidatePath("/api/portfolio");
      revalidatePath("/api/user/funds");
    } catch {
      // Ignore cache revalidation errors outside request context
    }

    const recentLogs = await prisma.scrapeLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return NextResponse.json(
      {
        success: true,
        trigger: triggerSource,
        syncOutcome,
        recentLogs,
        scheduler,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[API /api/scrape GET] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute scheduled NAV scrape",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to sync live NAVs." },
        { status: 401 },
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
      trigger:
        forceFallbackFor.length > 0 ? "MANUAL_FALLBACK_TEST" : "MANUAL_SYNC",
      forceFallbackFor,
    });

    try {
      revalidatePath("/");
      revalidatePath("/api/portfolio");
      revalidatePath("/api/user/funds");
    } catch {
      // Ignore
    }

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
      },
    );
  } catch (error) {
    console.error("[API /api/scrape POST] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute NAV scrape",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
