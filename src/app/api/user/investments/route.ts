import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Rechains all investments for a user fund in chronological sequence.
 * Enforces:
 * 1. Available cash = cashInvested + previous cashRemainder buffer
 * 2. Units allotted = floor(availableCash / executionNav) [Plain integer units]
 * 3. Units cost = unitsAllotted * executionNav
 * 4. New cash remainder = availableCash - unitsCost (held as buffer for next installment)
 * 5. Recomputes UserFund totalUnits, totalInvested, averageBuyPrice, fractionalCashBalance
 */
async function rechainUserFundInvestments(userFundId: string) {
  const entries = await prisma.investmentEntry.findMany({
    where: { userFundId },
    orderBy: [{ investmentDate: "asc" }, { createdAt: "asc" }],
  });

  let runningCashBuffer = 0;
  let totalUnits = 0;
  let totalInvested = 0;
  let totalCipUnits = 0;

  for (const entry of entries) {
    const cashInvested = Math.max(0, Number(entry.cashInvested) || 0);
    const executionNav =
      Number(entry.executionNav) > 0 ? Number(entry.executionNav) : 10.0;
    const cashBufferUsed = runningCashBuffer;
    const totalAvailable = Number((cashInvested + cashBufferUsed).toFixed(2));

    // STRICT BANGLADESH AMC RULE: Strictly whole integer units!
    const unitsAllotted = Math.floor(totalAvailable / executionNav);
    const unitsCost = Number((unitsAllotted * executionNav).toFixed(2));
    const cashRemainder = Number(
      Math.max(0, totalAvailable - unitsCost).toFixed(2),
    );

    await prisma.investmentEntry.update({
      where: { id: entry.id },
      data: {
        cashBufferUsed,
        unitsAllotted,
        unitsCost,
        cashRemainder,
      },
    });

    runningCashBuffer = cashRemainder;
    totalUnits += unitsAllotted;
    totalInvested += unitsCost;
    if (entry.type === "CIP") {
      totalCipUnits += unitsAllotted;
    }
  }

  const averageBuyPrice =
    totalUnits > 0 ? Number((totalInvested / totalUnits).toFixed(4)) : 10.0;

  const updatedUserFund = await prisma.userFund.update({
    where: { id: userFundId },
    data: {
      totalUnits,
      totalInvested: Number(totalInvested.toFixed(2)),
      averageBuyPrice,
      fractionalCashBalance: Number(runningCashBuffer.toFixed(2)),
      totalCipUnits,
    },
    include: { fund: true },
  });

  return updatedUserFund;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
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
        { status: 400 },
      );
    }

    const userFund = await prisma.userFund.findUnique({
      where: { id: userFundId },
      include: { fund: true },
    });

    if (!userFund || userFund.userId !== user.id) {
      return NextResponse.json(
        { error: "Fund holding not found or does not belong to you." },
        { status: 404 },
      );
    }

    const safeCash = Math.max(0, Number(cashInvested) || 0);
    if (safeCash <= 0) {
      return NextResponse.json(
        { error: "Investment cash amount must be greater than 0 BDT." },
        { status: 400 },
      );
    }

    const safeNav =
      Number(executionNav) > 0
        ? Number(executionNav)
        : userFund.fund.latestNav || userFund.fund.defaultNav || 10.0;

    const monthStr =
      calendarMonth ||
      new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const monthKey = monthStr.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const invDate = investmentDate ? new Date(investmentDate) : new Date();

    // Create entry initially with base values
    const newEntry = await prisma.investmentEntry.create({
      data: {
        userId: user.id,
        userFundId: userFund.id,
        monthKey,
        calendarMonth: monthStr,
        investmentDate: invDate,
        cashInvested: safeCash,
        cashBufferUsed: 0,
        executionNav: safeNav,
        unitsAllotted: 0,
        unitsCost: 0,
        cashRemainder: 0,
        type,
        notes:
          notes ||
          `${type} Investment for ${monthStr}: Cash ৳${safeCash} @ ৳${safeNav.toFixed(3)}.`,
      },
    });

    // Rechain all investments to maintain sequential cash buffer integrity
    const updatedFund = await rechainUserFundInvestments(userFund.id);

    const recomputedEntry = await prisma.investmentEntry.findUnique({
      where: { id: newEntry.id },
    });

    return NextResponse.json({
      message: `Successfully recorded ${type} investment of ৳${safeCash.toLocaleString("en-BD")} for ${monthStr}.`,
      investment: recomputedEntry,
      userFund: updatedFund,
      summary: {
        unitsAllotted: recomputedEntry?.unitsAllotted ?? 0,
        unitsCost: recomputedEntry?.unitsCost ?? 0,
        newCashRemainder: updatedFund.fractionalCashBalance,
        newTotalUnits: updatedFund.totalUnits,
        newTotalInvested: updatedFund.totalInvested,
        newAverageBuyPrice: updatedFund.averageBuyPrice,
      },
    });
  } catch (error) {
    console.error("[API /api/user/investments POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to record investment", details: String(error) },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      investmentId,
      calendarMonth,
      investmentDate,
      cashInvested,
      executionNav,
      type,
      notes,
    } = body;

    if (!investmentId) {
      return NextResponse.json(
        { error: "Missing required parameter: investmentId" },
        { status: 400 },
      );
    }

    const entry = await prisma.investmentEntry.findUnique({
      where: { id: investmentId },
      include: { userFund: { include: { fund: true } } },
    });

    if (!entry || entry.userId !== user.id) {
      return NextResponse.json(
        { error: "Investment entry not found or unauthorized." },
        { status: 404 },
      );
    }

    const safeCash =
      cashInvested !== undefined
        ? Math.max(0, Number(cashInvested) || 0)
        : entry.cashInvested;
    if (safeCash <= 0) {
      return NextResponse.json(
        { error: "Invested cash amount must be greater than 0 BDT." },
        { status: 400 },
      );
    }

    const safeNav =
      executionNav !== undefined && Number(executionNav) > 0
        ? Number(executionNav)
        : entry.executionNav;

    const monthStr = calendarMonth || entry.calendarMonth;
    const monthKey = monthStr.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const invDate = investmentDate
      ? new Date(investmentDate)
      : entry.investmentDate;
    const invType = type || entry.type;

    // Update targeted investment entry
    await prisma.investmentEntry.update({
      where: { id: investmentId },
      data: {
        calendarMonth: monthStr,
        monthKey,
        investmentDate: invDate,
        cashInvested: safeCash,
        executionNav: safeNav,
        type: invType,
        notes: notes !== undefined ? notes : entry.notes,
      },
    });

    // Rechain sequence so cash remainder and integer units roll forward seamlessly
    const updatedFund = await rechainUserFundInvestments(entry.userFundId);

    const recomputedEntry = await prisma.investmentEntry.findUnique({
      where: { id: investmentId },
    });

    return NextResponse.json({
      message: `Successfully updated ${invType} investment for ${monthStr}.`,
      investment: recomputedEntry,
      userFund: updatedFund,
    });
  } catch (error) {
    console.error("[API /api/user/investments PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update investment", details: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const investmentId = searchParams.get("id");

    if (!investmentId) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 },
      );
    }

    const entry = await prisma.investmentEntry.findUnique({
      where: { id: investmentId },
      include: { userFund: true },
    });

    if (!entry || entry.userId !== user.id) {
      return NextResponse.json(
        { error: "Investment entry not found." },
        { status: 404 },
      );
    }

    const userFundId = entry.userFundId;

    // Delete investment
    await prisma.investmentEntry.delete({
      where: { id: investmentId },
    });

    // Rechain remaining investments
    const updatedUserFund = await rechainUserFundInvestments(userFundId);

    return NextResponse.json({
      message: "Investment entry deleted and holding metrics recalculated.",
      userFund: updatedUserFund,
    });
  } catch (error) {
    console.error("[API /api/user/investments DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete investment", details: String(error) },
      { status: 500 },
    );
  }
}
