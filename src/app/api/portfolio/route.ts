import { NextResponse } from "next/server";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { initDailyNavScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scheduler = initDailyNavScheduler();
    await ensureFundsSeeded();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({
        user: null,
        summary: null,
        funds: [],
        history: [],
        scheduler,
      });
    }

    const [userFunds, recentLogs] = await Promise.all([
      prisma.userFund.findMany({
        where: { userId: user.id },
        include: {
          fund: true,
          investments: {
            orderBy: { investmentDate: "desc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.scrapeLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    let totalInvested = 0;
    let currentMarketValue = 0;
    let totalMonthlySip = 0;
    let totalFractionalCash = 0;
    let totalUnitsHeld = 0;

    const fundsWithMetrics = userFunds.map((uf) => {
      const nav =
        uf.fund.latestNav !== null && uf.fund.latestNav !== undefined && uf.fund.latestNav > 0
          ? uf.fund.latestNav
          : uf.averageBuyPrice > 0
          ? uf.averageBuyPrice
          : uf.fund.defaultNav || 10;

      const units = Math.max(0, Math.floor(uf.totalUnits || 0));
      const avgBuy = uf.averageBuyPrice > 0 ? uf.averageBuyPrice : nav;
      const invested = Math.max(0, uf.totalInvested || 0);
      const costOfUnits = Number((units * avgBuy).toFixed(2));
      const baseInvested = invested > 0 ? invested : costOfUnits;

      const marketValue = Number((units * nav).toFixed(2));
      const gainLoss = Number((marketValue - costOfUnits).toFixed(2));
      const returnPct = costOfUnits > 0 ? (gainLoss / costOfUnits) * 100 : 0;
      const cashBuffer = Math.max(0, Number(uf.fractionalCashBalance) || 0);

      totalInvested += baseInvested;
      currentMarketValue += marketValue;
      totalMonthlySip += uf.monthlySipTarget || 8000;
      totalFractionalCash += cashBuffer;
      totalUnitsHeld += units;

      return {
        id: uf.id,
        userFundId: uf.id,
        fundId: uf.fundId,
        name: uf.fund.name,
        shortName: uf.fund.shortName,
        slug: uf.fund.slug,
        fundManager: uf.fund.fundManager,
        category: uf.fund.category,
        biniUrl: uf.fund.biniUrl,
        primaryUrl: uf.fund.primaryUrl,
        latestNav: nav,
        effectiveNav: nav,
        navEffectiveDate: uf.fund.navEffectiveDate || "Latest Day",
        totalUnits: units,
        totalUnitsHeld: units,
        totalInvested: baseInvested,
        averageBuyPrice: avgBuy,
        monthlySipTarget: uf.monthlySipTarget || 8000,
        fractionalCashBalance: cashBuffer,
        totalCipUnits: uf.totalCipUnits || 0,
        currentMarketValue: marketValue,
        absoluteGainLoss: gainLoss,
        returnPct,
        investmentsCount: uf.investments.length,
        investments: uf.investments,
      };
    });

    const absoluteGainLoss = Number((currentMarketValue - totalInvested).toFixed(2));
    const returnPct = totalInvested > 0 ? (absoluteGainLoss / totalInvested) * 100 : 0;

    const summary = {
      totalInvested: Number(totalInvested.toFixed(2)),
      currentMarketValue: Number(currentMarketValue.toFixed(2)),
      absoluteGainLoss,
      returnPct,
      totalMonthlySip,
      totalFractionalCash: Number(totalFractionalCash.toFixed(2)),
      totalUnitsHeld,
      fundsCount: fundsWithMetrics.length,
      lastUpdatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      user,
      summary,
      funds: fundsWithMetrics,
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
