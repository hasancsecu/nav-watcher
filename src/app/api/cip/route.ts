import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureFundsSeeded();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in.", isAuthRequired: true },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        },
      );
    }

    const userFunds = await prisma.userFund.findMany({
      where: { userId: user.id },
      include: {
        fund: true,
        cipTransactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const transactions = userFunds.flatMap((uf) => uf.cipTransactions);
    const unsettledBalances = userFunds.map((uf) => ({
      userFundId: uf.id,
      fundId: uf.fundId,
      fundName: uf.fund.name,
      shortName: uf.fund.shortName,
      cashBalance: uf.fractionalCashBalance,
      totalCipUnits: uf.totalCipUnits,
    }));

    return NextResponse.json({
      transactions,
      unsettledBalances,
    });
  } catch (error) {
    console.error("[API /api/cip GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CIP transactions", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureFundsSeeded();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fundId, userFundId, dividendAmount, cipNav } = body;

    const targetUserFund = await prisma.userFund.findFirst({
      where: {
        userId: user.id,
        ...(userFundId ? { id: userFundId } : { fundId }),
      },
      include: { fund: true },
    });

    if (!targetUserFund) {
      return NextResponse.json(
        { error: "Fund holding not found in your portfolio." },
        { status: 404 },
      );
    }

    const safeNav =
      Number(cipNav) > 0
        ? Number(cipNav)
        : targetUserFund.fund.latestNav || targetUserFund.averageBuyPrice || 10;
    const safeDiv = Math.max(0, Number(dividendAmount) || 0);

    const availableCash = Number(
      (safeDiv + targetUserFund.fractionalCashBalance).toFixed(2),
    );
    const unitsAllotted = Math.floor(availableCash / safeNav);
    const reinvestedCost = Number((unitsAllotted * safeNav).toFixed(2));
    const newCashRemainder = Number(
      Math.max(0, availableCash - reinvestedCost).toFixed(2),
    );

    const newTotalUnits = targetUserFund.totalUnits + unitsAllotted;
    const newTotalInvested = Number(
      (targetUserFund.totalInvested + reinvestedCost).toFixed(2),
    );
    const newAverageBuyPrice =
      newTotalUnits > 0
        ? Number((newTotalInvested / newTotalUnits).toFixed(4))
        : safeNav;

    const [updatedUserFund, transaction] = await prisma.$transaction([
      prisma.userFund.update({
        where: { id: targetUserFund.id },
        data: {
          totalUnits: newTotalUnits,
          totalInvested: newTotalInvested,
          averageBuyPrice: newAverageBuyPrice,
          fractionalCashBalance: newCashRemainder,
          totalCipUnits: { increment: unitsAllotted },
        },
      }),
      prisma.cipTransaction.create({
        data: {
          userFundId: targetUserFund.id,
          dividendAmount: safeDiv,
          cipNav: safeNav,
          unitsAllotted,
          reinvestedAmount: reinvestedCost,
          cashRemainder: newCashRemainder,
          isSettled: false,
          notes: `CIP Dividend: +${unitsAllotted} units allotted @ ৳${safeNav.toFixed(3)}. ৳${newCashRemainder.toFixed(2)} cash balance held for next SIP.`,
        },
      }),
    ]);

    return NextResponse.json({
      message: `Credited ${unitsAllotted} CIP units to ${targetUserFund.fund.name}.`,
      transaction,
      unitsAllotted,
      reinvestedCost,
      cashRemainder: newCashRemainder,
      userFund: updatedUserFund,
    });
  } catch (error) {
    console.error("[API /api/cip POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to record CIP dividend", details: String(error) },
      { status: 500 },
    );
  }
}
