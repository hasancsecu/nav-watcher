import { NextRequest, NextResponse } from "next/server";
import { syncAllFundsNav } from "@/lib/scraper";
import { prisma } from "@/lib/prisma";
import { computePortfolioSummary } from "@/lib/calculations";
import { initDailyNavScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scheduler = initDailyNavScheduler();
    const syncOutcome = await syncAllFundsNav({
      trigger: "VERCEL_SCHEDULE_905_DHAKA",
    });

    const [funds, history, recentLogs] = await Promise.all([
      prisma.fund.findMany({ orderBy: { id: "asc" } }),
      prisma.portfolioHistory.findMany({ orderBy: { dateKey: "asc" }, take: 45 }),
      prisma.scrapeLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    ]);

    const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

    return NextResponse.json({
      syncOutcome,
      summary,
      funds: fundsWithMetrics,
      history,
      recentLogs,
      scheduler,
    });
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

    const [funds, history, recentLogs] = await Promise.all([
      prisma.fund.findMany({ orderBy: { id: "asc" } }),
      prisma.portfolioHistory.findMany({ orderBy: { dateKey: "asc" }, take: 45 }),
      prisma.scrapeLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    ]);

    const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

    return NextResponse.json({
      syncOutcome,
      summary,
      funds: fundsWithMetrics,
      history,
      recentLogs,
      scheduler,
    });
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
