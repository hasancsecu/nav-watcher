import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Standardizes calendar month formatting and generates a predictable monthKey.
 * E.g., "November 2026", "nov 2026", or date object -> { monthKey: "november-2026", calendarMonth: "November 2026", invDate }
 */
function normalizeMonth(
  calendarMonth?: string,
  investmentDate?: Date | string | null,
): { monthKey: string; calendarMonth: string; invDate: Date } {
  let year: number;
  let monthIdx: number;

  if (calendarMonth && calendarMonth.trim()) {
    const parts = calendarMonth.trim().split(/\s+/);
    if (parts.length === 2) {
      const mIdx = MONTH_NAMES.findIndex((m) =>
        m.toLowerCase().startsWith(parts[0].toLowerCase().slice(0, 3)),
      );
      const yVal = parseInt(parts[1], 10);
      if (mIdx !== -1 && !isNaN(yVal)) {
        monthIdx = mIdx;
        year = yVal;
        return {
          monthKey: `${MONTH_NAMES[monthIdx].toLowerCase()}-${year}`,
          calendarMonth: `${MONTH_NAMES[monthIdx]} ${year}`,
          invDate: investmentDate
            ? new Date(investmentDate)
            : new Date(year, monthIdx, 1),
        };
      }
    }
  }

  const d = investmentDate ? new Date(investmentDate) : new Date();
  const validD = isNaN(d.getTime()) ? new Date() : d;
  year = validD.getFullYear();
  monthIdx = validD.getMonth();

  return {
    monthKey: `${MONTH_NAMES[monthIdx].toLowerCase()}-${year}`,
    calendarMonth: `${MONTH_NAMES[monthIdx]} ${year}`,
    invDate: validD,
  };
}

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

/**
 * GET /api/user/investments
 * Server-side filtering, searching, and pagination of user investments.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in.", isAuthRequired: true },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        },
      );
    }

    const { searchParams } = new URL(req.url);
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(
      searchParams.get("limit") || searchParams.get("pageSize") || "10",
      10,
    );
    const fundId = searchParams.get("fundId");
    const type = searchParams.get("type");
    const monthKey = searchParams.get("monthKey");
    const calendarMonth = searchParams.get("calendarMonth");
    const search = searchParams.get("search");

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const limit = Math.min(
      100,
      Math.max(1, isNaN(limitParam) ? 10 : limitParam),
    );
    const skip = (page - 1) * limit;

    // Build filter query strictly scoped to authenticated user
    const conditions: any[] = [{ userId: user.id }];

    if (fundId && fundId !== "ALL") {
      conditions.push({
        OR: [{ userFundId: fundId }, { userFund: { fundId } }],
      });
    }

    if (type && type !== "ALL") {
      conditions.push({
        type: type.trim().toUpperCase(),
      });
    }

    if (monthKey && monthKey !== "ALL") {
      conditions.push({
        monthKey: monthKey.toLowerCase(),
      });
    } else if (calendarMonth && calendarMonth !== "ALL") {
      const norm = normalizeMonth(calendarMonth);
      conditions.push({
        monthKey: norm.monthKey,
      });
    }

    if (search && search.trim()) {
      const q = search.trim();
      conditions.push({
        OR: [
          { notes: { contains: q, mode: "insensitive" } },
          { calendarMonth: { contains: q, mode: "insensitive" } },
          {
            userFund: { fund: { name: { contains: q, mode: "insensitive" } } },
          },
          {
            userFund: {
              fund: { shortName: { contains: q, mode: "insensitive" } },
            },
          },
        ],
      });
    }

    const whereClause = { AND: conditions };

    // Execute queries in parallel
    const [totalCount, filteredEntries, aggregateData] = await Promise.all([
      prisma.investmentEntry.count({
        where: whereClause,
      }),
      prisma.investmentEntry.findMany({
        where: whereClause,
        include: {
          userFund: {
            include: {
              fund: true,
            },
          },
        },
        orderBy: [{ investmentDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.investmentEntry.aggregate({
        where: whereClause,
        _sum: {
          cashInvested: true,
          unitsAllotted: true,
          unitsCost: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const investments = filteredEntries.map((inv) => ({
      id: inv.id,
      userFundId: inv.userFundId,
      fundId: inv.userFund.fundId,
      fundName: inv.userFund.fund.name,
      fundShortName: inv.userFund.fund.shortName,
      fundManager: inv.userFund.fund.fundManager,
      calendarMonth: inv.calendarMonth,
      monthKey: inv.monthKey,
      investmentDate: inv.investmentDate.toISOString(),
      cashInvested: inv.cashInvested,
      cashBufferUsed: inv.cashBufferUsed,
      executionNav: inv.executionNav,
      unitsAllotted: inv.unitsAllotted,
      unitsCost: inv.unitsCost,
      cashRemainder: inv.cashRemainder,
      type: inv.type,
      notes: inv.notes,
      createdAt: inv.createdAt.toISOString(),
      fund: {
        id: inv.userFund.id,
        userFundId: inv.userFund.id,
        fundId: inv.userFund.fundId,
        name: inv.userFund.fund.name,
        shortName: inv.userFund.fund.shortName,
        fundManager: inv.userFund.fund.fundManager,
        category: inv.userFund.fund.category,
        latestNav: inv.userFund.fund.latestNav,
        effectiveNav:
          inv.userFund.fund.latestNav || inv.userFund.averageBuyPrice,
      },
    }));

    return NextResponse.json(
      {
        investments,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        summary: {
          filteredCount: totalCount,
          totalCashInvested: Number(
            (aggregateData._sum.cashInvested || 0).toFixed(2),
          ),
          totalUnitsAllotted: aggregateData._sum.unitsAllotted || 0,
          totalUnitsCost: Number(
            (aggregateData._sum.unitsCost || 0).toFixed(2),
          ),
        },
      },
      {
        headers: {
          "Cache-Control":
            "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[API /api/user/investments GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user investments", details: String(error) },
      { status: 500 },
    );
  }
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

    if (!userFund) {
      return NextResponse.json(
        { error: "Fund holding not found." },
        { status: 404 },
      );
    }

    if (userFund.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden. This fund holding belongs to another user." },
        { status: 403 },
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

    const norm = normalizeMonth(calendarMonth, investmentDate);
    const invType = String(type || "SIP").trim().toUpperCase();

    // Enforce: For the same fund and same month, an investment type (SIP, CIP, LUMPSUM) can only be added once!
    const existingSameType = await prisma.investmentEntry.findFirst({
      where: {
        userFundId: userFund.id,
        monthKey: norm.monthKey,
        type: invType,
      },
    });

    if (existingSameType) {
      return NextResponse.json(
        {
          error: `A ${invType} investment for ${userFund.fund.name} has already been recorded for ${norm.calendarMonth}. For any given month, only one investment of each type (SIP, CIP, or Lumpsum) can be added. You can edit the existing entry if you need to update its amount or execution NAV.`,
          code: "DUPLICATE_MONTH_TYPE_INVESTMENT",
          existingInvestmentId: existingSameType.id,
        },
        { status: 409 },
      );
    }

    // Create entry initially with base values
    const newEntry = await prisma.investmentEntry.create({
      data: {
        userId: user.id,
        userFundId: userFund.id,
        monthKey: norm.monthKey,
        calendarMonth: norm.calendarMonth,
        investmentDate: norm.invDate,
        cashInvested: safeCash,
        cashBufferUsed: 0,
        executionNav: safeNav,
        unitsAllotted: 0,
        unitsCost: 0,
        cashRemainder: 0,
        type: invType,
        notes:
          notes ||
          `${invType} Investment for ${norm.calendarMonth}: Cash ৳${safeCash} @ ৳${safeNav.toFixed(3)}.`,
      },
    });

    // Rechain all investments to maintain sequential cash buffer integrity
    const updatedFund = await rechainUserFundInvestments(userFund.id);

    const recomputedEntry = await prisma.investmentEntry.findUnique({
      where: { id: newEntry.id },
    });

    return NextResponse.json({
      message: `Successfully recorded ${invType} investment of ৳${safeCash.toLocaleString("en-BD")} for ${norm.calendarMonth}.`,
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

    if (!entry) {
      return NextResponse.json(
        { error: "Investment entry not found." },
        { status: 404 },
      );
    }

    if (entry.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden. This investment entry belongs to another user." },
        { status: 403 },
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

    const norm = normalizeMonth(
      calendarMonth || entry.calendarMonth,
      investmentDate || entry.investmentDate,
    );
    const invType = String(type || entry.type).trim().toUpperCase();

    // Prevent updating to a month & type that already has an entry for this fund
    const existingSameType = await prisma.investmentEntry.findFirst({
      where: {
        userFundId: entry.userFundId,
        monthKey: norm.monthKey,
        type: invType,
        id: { not: investmentId },
      },
    });

    if (existingSameType) {
      return NextResponse.json(
        {
          error: `Another ${invType} investment for ${entry.userFund.fund.name} has already been recorded for ${norm.calendarMonth}. For any given month, only one investment of each type (SIP, CIP, or Lumpsum) can exist.`,
          code: "DUPLICATE_MONTH_TYPE_INVESTMENT",
          existingInvestmentId: existingSameType.id,
        },
        { status: 409 },
      );
    }

    // Update targeted investment entry
    await prisma.investmentEntry.update({
      where: { id: investmentId },
      data: {
        calendarMonth: norm.calendarMonth,
        monthKey: norm.monthKey,
        investmentDate: norm.invDate,
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
      message: `Successfully updated ${invType} investment for ${norm.calendarMonth}.`,
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

    if (!entry) {
      return NextResponse.json(
        { error: "Investment entry not found." },
        { status: 404 },
      );
    }

    if (entry.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden. This investment entry belongs to another user." },
        { status: 403 },
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
