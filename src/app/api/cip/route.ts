import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import {
  computePortfolioSummary,
  applyCipUnitsToHolding,
  simulateSipWithCipSettlement,
  calculateCipReinvestment,
} from "@/lib/calculations";
import { recomputePortfolioHistory } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/**
 * GET /api/cip
 * Returns list of CIP dividend transactions and current unsettled cash balances.
 */
export async function GET() {
  try {
    await ensureFundsSeeded();
    const [transactions, funds] = await Promise.all([
      prisma.cipTransaction.findMany({
        orderBy: { createdAt: "desc" },
        include: { fund: { select: { name: true, shortName: true } } },
      }),
      prisma.fund.findMany({
        select: {
          id: true,
          name: true,
          shortName: true,
          fractionalCashBalance: true,
          totalCipUnits: true,
        },
      }),
    ]);

    return NextResponse.json({
      transactions,
      unsettledBalances: funds.map((f) => ({
        fundId: f.id,
        fundName: f.name,
        shortName: f.shortName,
        cashBalance: f.fractionalCashBalance,
        totalCipUnits: f.totalCipUnits,
      })),
    });
  } catch (error) {
    console.error("[API /api/cip GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CIP transactions", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cip
 * Adds CIP dividend units (strictly integer) to a specific AMC fund.
 * The fractional remainder is preserved as cash balance to settle on the next SIP.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureFundsSeeded();
    const body = await req.json();

    const {
      fundId,
      dividendAmount,
      cipNav,
      unitsAllotted: rawUnitsAllotted,
      cashRemainder: rawCashRemainder,
      notes,
    } = body;

    if (!fundId) {
      return NextResponse.json(
        { error: "Missing required field: fundId" },
        { status: 400 }
      );
    }

    const fund = await prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) {
      return NextResponse.json(
        { error: `Fund with id '${fundId}' not found.` },
        { status: 404 }
      );
    }

    const safeNav = Number(cipNav) > 0 ? Number(cipNav) : fund.latestNav || fund.averageBuyPrice || 10;
    const safeDiv = Math.max(0, Number(dividendAmount) || 0);

    // If unitsAllotted or cashRemainder are passed explicitly, use them; otherwise auto-calculate
    let unitsAllotted: number;
    let cashRemainder: number;
    let reinvestedAmount: number;

    if (rawUnitsAllotted !== undefined) {
      const parsedUnits = Number(rawUnitsAllotted);
      // STRICT REQUIREMENT: Units MUST be integer!
      if (!Number.isInteger(parsedUnits) || parsedUnits < 0) {
        return NextResponse.json(
          {
            error: "CIP units allotted must be a non-negative whole integer (e.g. 150, not 150.5).",
          },
          { status: 400 }
        );
      }
      unitsAllotted = parsedUnits;
      reinvestedAmount = Number((unitsAllotted * safeNav).toFixed(2));
      cashRemainder =
        rawCashRemainder !== undefined
          ? Number(Math.max(0, Number(rawCashRemainder)).toFixed(2))
          : Number(Math.max(0, safeDiv - reinvestedAmount).toFixed(2));
    } else {
      const calc = calculateCipReinvestment(safeDiv, safeNav, fund.fractionalCashBalance);
      unitsAllotted = calc.unitsAllotted;
      reinvestedAmount = calc.reinvestedAmount;
      cashRemainder = calc.cashRemainder;
    }

    // Apply CIP units to fund holdings
    const updatedHolding = applyCipUnitsToHolding(
      fund.totalInvested,
      fund.averageBuyPrice,
      unitsAllotted,
      safeNav
    );

    // Update fund in database
    await prisma.fund.update({
      where: { id: fundId },
      data: {
        totalInvested: updatedHolding.newTotalInvested,
        averageBuyPrice: updatedHolding.newAverageBuyPrice,
        fractionalCashBalance: cashRemainder,
        totalCipUnits: { increment: unitsAllotted },
      },
    });

    // Create CIP transaction audit log
    const transaction = await prisma.cipTransaction.create({
      data: {
        fundId,
        dividendAmount: safeDiv,
        cipNav: Number(safeNav.toFixed(4)),
        unitsAllotted,
        reinvestedAmount,
        cashRemainder,
        isSettled: false,
        notes: notes || `CIP Dividend: +${unitsAllotted} integer units allotted @ ৳${safeNav.toFixed(3)}. ৳${cashRemainder.toFixed(2)} cash remainder held for next SIP settlement.`,
      },
    });

    await recomputePortfolioHistory();

    const [funds, history] = await Promise.all([
      prisma.fund.findMany({ orderBy: { id: "asc" } }),
      prisma.portfolioHistory.findMany({ orderBy: { dateKey: "asc" }, take: 45 }),
    ]);

    const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

    return NextResponse.json({
      message: `Successfully credited ${unitsAllotted} CIP units to ${fund.name}. ৳${cashRemainder.toFixed(2)} cash balance retained to settle on next SIP.`,
      transaction,
      unitsAllotted,
      reinvestedAmount,
      cashRemainder,
      summary,
      funds: fundsWithMetrics,
      history,
    });
  } catch (error) {
    console.error("[API /api/cip POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to record CIP dividend", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cip
 * Settles the retained CIP cash balance with the next monthly SIP investment.
 */
export async function PUT(req: NextRequest) {
  try {
    await ensureFundsSeeded();
    const body = await req.json();

    const {
      fundId,
      freshSipCash,
      executionNav,
      settlementMethod = "ADD_TO_INVESTMENT",
    } = body;

    if (!fundId) {
      return NextResponse.json(
        { error: "Missing required field: fundId" },
        { status: 400 }
      );
    }

    const fund = await prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) {
      return NextResponse.json(
        { error: `Fund with id '${fundId}' not found.` },
        { status: 404 }
      );
    }

    const safeSip = Math.max(0, Number(freshSipCash) || fund.monthlySipTarget || 8000);
    const safeNav = Number(executionNav) > 0 ? Number(executionNav) : fund.buyPrice || fund.latestNav || fund.averageBuyPrice || 10;
    const unsettledCash = Math.max(0, Number(fund.fractionalCashBalance) || 0);

    const simulation = simulateSipWithCipSettlement(
      fund.totalInvested,
      fund.averageBuyPrice,
      safeSip,
      safeNav,
      unsettledCash,
      settlementMethod === "DEDUCT_FROM_PAYMENT" ? "DEDUCT_FROM_PAYMENT" : "ADD_TO_INVESTMENT"
    );

    // Update fund holdings and reset fractional cash balance to 0 (fully settled)
    await prisma.fund.update({
      where: { id: fundId },
      data: {
        totalInvested: simulation.newTotalInvested,
        averageBuyPrice: simulation.newAverageBuyPrice,
        fractionalCashBalance: 0,
      },
    });

    // Mark previous unsettled CIP transactions as settled
    await prisma.cipTransaction.updateMany({
      where: { fundId, isSettled: false },
      data: {
        isSettled: true,
        settledAt: new Date(),
        settledWithSipAmount: safeSip,
      },
    });

    await recomputePortfolioHistory();

    const [funds, history] = await Promise.all([
      prisma.fund.findMany({ orderBy: { id: "asc" } }),
      prisma.portfolioHistory.findMany({ orderBy: { dateKey: "asc" }, take: 45 }),
    ]);

    const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

    return NextResponse.json({
      message: `Monthly SIP of ৳${safeSip.toLocaleString("en-BD")} executed. Settle ৳${unsettledCash.toFixed(2)} CIP cash remainder.`,
      settlement: {
        settledCashAmount: simulation.settledCashAmount,
        effectiveInvestedInUnits: simulation.effectiveInvestedInUnits,
        userOutOfPocketCash: simulation.userOutOfPocketCash,
        addedUnits: simulation.addedUnits,
      },
      summary,
      funds: fundsWithMetrics,
      history,
    });
  } catch (error) {
    console.error("[API /api/cip PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to settle CIP cash balance with SIP", details: String(error) },
      { status: 500 }
    );
  }
}
