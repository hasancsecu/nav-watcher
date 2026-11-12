import { NextResponse } from "next/server";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureFundsSeeded();
    const user = await getCurrentUser();

    const [allFunds, userFunds] = await Promise.all([
      prisma.fund.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      user
        ? prisma.userFund.findMany({
            where: { userId: user.id },
            select: { fundId: true },
          })
        : [],
    ]);

    const userFundIdSet = new Set(userFunds.map((uf) => uf.fundId));

    const fundsWithStatus = allFunds.map((fund) => ({
      ...fund,
      isAdded: userFundIdSet.has(fund.id),
    }));

    return NextResponse.json({
      funds: fundsWithStatus,
      totalCount: fundsWithStatus.length,
    });
  } catch (error) {
    console.error("[API /api/bini/funds GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch funds catalog", details: String(error) },
      { status: 500 }
    );
  }
}
