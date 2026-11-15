import React from "react";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { initDailyNavScheduler } from "@/lib/scheduler";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const scheduler = initDailyNavScheduler();
  await ensureFundsSeeded();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardClient
        initialUser={null}
        initialSummary={null}
        initialFunds={[]}
        initialHistory={[]}
        initialLogs={[]}
        initialScheduler={scheduler}
      />
    );
  }

  // User is logged in: fetch their personalized funds and investments
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

  const userFundIds = userFunds.map((uf) => uf.fundId);
  const rawSnapshots =
    userFundIds.length > 0
      ? await prisma.navSnapshot.findMany({
          where: { fundId: { in: userFundIds } },
          orderBy: { dateKey: "asc" },
          take: 120,
        })
      : [];

  const snapshots = rawSnapshots.map((s) => ({
    id: s.id,
    fundId: s.fundId,
    dateKey: s.dateKey,
    displayDate: s.displayDate,
    nav: s.nav,
  }));

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
      fallbackUrl: uf.fund.fallbackUrl,
      latestNav: nav,
      buyPrice: uf.fund.buyPrice,
      sellPrice: uf.fund.sellPrice,
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
      portfolioWeightPct: 0,
      lastScrapedAt: uf.fund.lastScrapedAt ? new Date(uf.fund.lastScrapedAt).toISOString() : null,
      lastScrapeSource: uf.fund.lastScrapeSource,
      lastScrapeStatus: uf.fund.lastScrapeStatus,
      lastScrapeError: uf.fund.lastScrapeError,
      investments: uf.investments.map((inv) => ({
        ...inv,
        investmentDate: inv.investmentDate.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
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
    totalCipUnits: 0,
    lastUpdatedAt: new Date().toISOString(),
    fundsCount: fundsWithMetrics.length,
  };

  const serializedLogs = recentLogs.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <DashboardClient
      initialUser={user}
      initialSummary={summary}
      initialFunds={fundsWithMetrics}
      initialSnapshots={snapshots}
      initialHistory={[]}
      initialLogs={serializedLogs}
      initialScheduler={scheduler}
    />
  );
}
