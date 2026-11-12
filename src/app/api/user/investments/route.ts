import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      userFundId,
      calendarMonth,
      investmentDate,
      cashInvested,
      executionNav,
      type = "SIP",
      notes,
    } = body;

    if (!userFundId) {
      return NextResponse.json(
        { error: "Missing required parameter: userFundId" },
        { status: 400 }
      );
    }

    const userFund = await prisma.userFund.findUnique({
      where: { id: userFundId },
      include: { fund: true },
    });

    if (!userFund || userFund.userId !== user.id) {
      return NextResponse.json(
        { error: "Fund holding not found or does not belong to you." },
        { status: 404 }
      );
    }

    const safeCash = Math.max(0, Number(cashInvested) || 0);
    if (safeCash <= 0) {
      return NextResponse.json(
        { error: "Investment cash amount must be greater than 0 BDT." },
        { status: 400 }
      );
    }

    const safeNav =
      Number(executionNav) > 0
        ? Number(executionNav)
        : userFund.fund.latestNav || userFund.fund.defaultNav || 10.0;

    // Previous unallotted cash buffer
    const previousCashBuffer = Math.max(0, Number(userFund.fractionalCashBalance) || 0);
    const totalAvailableCash = Number((safeCash + previousCashBuffer).toFixed(2));

    // STRICT BANGLADESH AMC RULE: Units allotted MUST be whole integers!
    const unitsAllotted = Math.floor(totalAvailableCash / safeNav);
    const unitsCost = Number((unitsAllotted * safeNav).toFixed(2));
    const newCashRemainder = Number(Math.max(0, totalAvailableCash - unitsCost).toFixed(2));

    const existingUnits = Math.max(0, userFund.totalUnits || 0);
    const existingInvested = Math.max(0, userFund.totalInvested || 0);

    const newTotalUnits = existingUnits + unitsAllotted;
    const newTotalInvested = Number((existingInvested + unitsCost).toFixed(2));
    const newAverageBuyPrice =
      newTotalUnits > 0
        ? Number((newTotalInvested / newTotalUnits).toFixed(4))
        : safeNav;

    const monthStr = calendarMonth || new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const monthKey = monthStr.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const invDate = investmentDate ? new Date(investmentDate) : new Date();

    // Create investment record & update user fund in a transaction
    const [investment, updatedFund] = await prisma.$transaction([
      prisma.investmentEntry.create({
        data: {
          userId: user.id,
          userFundId: userFund.id,
          monthKey,
          calendarMonth: monthStr,
          investmentDate: invDate,
          cashInvested: safeCash,
          cashBufferUsed: previousCashBuffer,
          executionNav: safeNav,
          unitsAllotted,
          unitsCost,
          cashRemainder: newCashRemainder,
          type,
          notes: notes || `${type} Investment for ${monthStr}: +${unitsAllotted} integer units allotted @ ৳${safeNav.toFixed(3)}.`,
        },
      }),
      prisma.userFund.update({
        where: { id: userFund.id },
        data: {
          totalUnits: newTotalUnits,
          totalInvested: newTotalInvested,
          averageBuyPrice: newAverageBuyPrice,
          fractionalCashBalance: newCashRemainder,
          ...(type === "CIP" ? { totalCipUnits: { increment: unitsAllotted } } : {}),
        },
        include: { fund: true },
      }),
    ]);

    return NextResponse.json({
      message: `Successfully recorded ${type} investment of ৳${safeCash.toLocaleString("en-BD")} for ${monthStr}.`,
      investment,
      userFund: updatedFund,
      summary: {
        unitsAllotted,
        unitsCost,
        newCashRemainder,
        newTotalUnits,
        newTotalInvested,
        newAverageBuyPrice,
      },
    });
  } catch (error) {
    console.error("[API /api/user/investments POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to record investment", details: String(error) },
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
    const investmentId = searchParams.get("id");

    if (!investmentId) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const entry = await prisma.investmentEntry.findUnique({
      where: { id: investmentId },
      include: { userFund: true },
    });

    if (!entry || entry.userId !== user.id) {
      return NextResponse.json(
        { error: "Investment entry not found." },
        { status: 404 }
      );
    }

    // Delete investment
    await prisma.investmentEntry.delete({
      where: { id: investmentId },
    });

    // Recompute UserFund metrics from remaining investments
    const remainingInvestments = await prisma.investmentEntry.findMany({
      where: { userFundId: entry.userFundId },
      orderBy: { investmentDate: "asc" },
    });

    let runningCashRemainder = 0;
    let runningUnits = 0;
    let runningInvested = 0;

    for (const inv of remainingInvestments) {
      runningUnits += inv.unitsAllotted;
      runningInvested += inv.unitsCost;
      runningCashRemainder = inv.cashRemainder;
    }

    const finalAvgBuy =
      runningUnits > 0
        ? Number((runningInvested / runningUnits).toFixed(4))
        : 10.0;

    const updatedUserFund = await prisma.userFund.update({
      where: { id: entry.userFundId },
      data: {
        totalUnits: runningUnits,
        totalInvested: Number(runningInvested.toFixed(2)),
        averageBuyPrice: finalAvgBuy,
        fractionalCashBalance: Number(runningCashRemainder.toFixed(2)),
      },
    });

    return NextResponse.json({
      message: "Investment entry deleted and holding metrics recalculated.",
      userFund: updatedUserFund,
    });
  } catch (error) {
    console.error("[API /api/user/investments DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete investment", details: String(error) },
      { status: 500 }
    );
  }
}
