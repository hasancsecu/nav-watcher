import { NextResponse } from "next/server";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { computePortfolioSummary } from "@/lib/calculations";
import { recomputePortfolioHistory } from "@/lib/scraper";
import { initDailyNavScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scheduler = initDailyNavScheduler();
    await ensureFundsSeeded();

    const historyCount = await prisma.portfolioHistory.count();
    if (historyCount === 0) {
      await recomputePortfolioHistory();
    }

    const [funds, history, recentLogs] = await Promise.all([
      prisma.fund.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.portfolioHistory.findMany({
        orderBy: { dateKey: "asc" },
        take: 45,
      }),
      prisma.scrapeLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

    return NextResponse.json({
      summary,
      funds: fundsWithMetrics,
      history,
      recentLogs,
      scheduler,
    });
  } catch (error) {
    console.error("[API /api/portfolio GET] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to load portfolio data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

