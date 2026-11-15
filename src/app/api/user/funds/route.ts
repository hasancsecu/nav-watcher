import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureFundsSeeded();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in.", isAuthRequired: true },
        { status: 401 }
      );
    }

    const userFunds = await prisma.userFund.findMany({
      where: { userId: user.id },
      include: {
        fund: true,
        investments: {
          orderBy: { investmentDate: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

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
      user,
    };

    return NextResponse.json(
      {
        summary,
        funds: fundsWithMetrics,
        user,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[API /api/user/funds GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user funds", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureFundsSeeded();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fundId, monthlySipTarget = 8000 } = body;

    if (!fundId) {
      return NextResponse.json(
        { error: "Missing required parameter: fundId" },
        { status: 400 }
      );
    }

    // Verify fund exists in MasterFund catalog
    const targetFund = await prisma.fund.findUnique({ where: { id: fundId } });
    if (!targetFund) {
      return NextResponse.json(
        { error: `Fund with id '${fundId}' not found.` },
        { status: 404 }
      );
    }

    // Check if user already added this fund
    const existing = await prisma.userFund.findUnique({
      where: {
        userId_fundId: {
          userId: user.id,
          fundId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `${targetFund.name} is already added to your portfolio.` },
        { status: 409 }
      );
    }

    const userFund = await prisma.userFund.create({
      data: {
        userId: user.id,
        fundId,
        monthlySipTarget: Math.max(0, Number(monthlySipTarget) || 8000),
        totalUnits: 0,
        totalInvested: 0.0,
        averageBuyPrice: targetFund.latestNav || targetFund.defaultNav || 10.0,
        fractionalCashBalance: 0.0,
      },
      include: {
        fund: true,
      },
    });

    return NextResponse.json({
      message: `Successfully added ${targetFund.name} to your portfolio.`,
      userFund,
    });
  } catch (error) {
    console.error("[API /api/user/funds POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to add fund to profile", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    let userFundId = idParam;

    if (!userFundId) {
      try {
        const body = await req.json();
        userFundId = body.userFundId || body.id;
      } catch {
        // no body
      }
    }

    if (!userFundId) {
      return NextResponse.json(
        { error: "Missing required parameter: userFundId or id" },
        { status: 400 }
      );
    }

    // Verify ownership
    const userFund = await prisma.userFund.findUnique({
      where: { id: userFundId },
      include: { fund: true },
    });

    if (!userFund) {
      return NextResponse.json(
        { error: "Fund holding not found." },
        { status: 404 }
      );
    }

    if (userFund.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden. This fund holding belongs to another user." },
        { status: 403 }
      );
    }

    await prisma.userFund.delete({
      where: { id: userFundId },
    });

    return NextResponse.json({
      message: `Successfully deleted ${userFund.fund.name} from your portfolio.`,
      deletedFundId: userFund.fundId,
    });
  } catch (error) {
    console.error("[API /api/user/funds DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete fund from profile", details: String(error) },
      { status: 500 }
    );
  }
}
