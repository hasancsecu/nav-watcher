import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { computePortfolioSummary } from "@/lib/calculations";
import { recomputePortfolioHistory } from "@/lib/scraper";

export const dynamic = "force-dynamic";

interface HoldingUpdateItem {
  fundId: string;
  totalInvested: number;
  averageBuyPrice: number;
  monthlySipTarget?: number;
}

export async function PUT(req: NextRequest) {
  try {
    await ensureFundsSeeded();
    const body = await req.json();

    const updates: HoldingUpdateItem[] = Array.isArray(body.holdings)
      ? body.holdings
      : body.fundId
      ? [body]
      : [];

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fund holding updates provided." },
        { status: 400 }
      );
    }

    for (const item of updates) {
      const invested = Number(item.totalInvested);
      const avgBuy = Number(item.averageBuyPrice);
      const sipTarget =
        item.monthlySipTarget !== undefined
          ? Number(item.monthlySipTarget)
          : undefined;

      if (Number.isNaN(invested) || invested < 0) {
        return NextResponse.json(
          { error: `Invalid Total Invested Amount for ${item.fundId}. Must be >= 0.` },
          { status: 400 }
        );
      }
      if (Number.isNaN(avgBuy) || avgBuy <= 0) {
        return NextResponse.json(
          { error: `Invalid Average Buy Price for ${item.fundId}. Must be > 0.` },
          { status: 400 }
        );
      }

      // Strict Bangladesh AMC rule: plain integer units only
      const integerUnits = Math.floor(invested / avgBuy);
      const costOfUnits = Number((integerUnits * avgBuy).toFixed(2));
      const cashRemainder = Math.max(0, Number((invested - costOfUnits).toFixed(2)));

      await prisma.fund.update({
        where: { id: item.fundId },
        data: {
          totalInvested: Number(invested.toFixed(2)),
          averageBuyPrice: Number(avgBuy.toFixed(4)),
          totalUnits: integerUnits,
          fractionalCashBalance: cashRemainder,
          ...(sipTarget !== undefined && !Number.isNaN(sipTarget) && sipTarget >= 0
            ? { monthlySipTarget: Number(sipTarget.toFixed(2)) }
            : {}),
        },
      });
    }

    await recomputePortfolioHistory();

    const [funds, history] = await Promise.all([
      prisma.fund.findMany({ orderBy: { id: "asc" } }),
      prisma.portfolioHistory.findMany({ orderBy: { dateKey: "asc" }, take: 45 }),
    ]);

    const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

    return NextResponse.json({
      message: "Holdings updated and portfolio valuation recalculated.",
      summary,
      funds: fundsWithMetrics,
      history,
    });
  } catch (error) {
    console.error("[API /api/funds PUT] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to update fund holdings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

