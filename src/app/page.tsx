import React from "react";
import { prisma, ensureFundsSeeded } from "@/lib/prisma";
import { computePortfolioSummary } from "@/lib/calculations";
import { recomputePortfolioHistory } from "@/lib/scraper";
import { initDailyNavScheduler } from "@/lib/scheduler";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scheduler = initDailyNavScheduler();
  await ensureFundsSeeded();

  const historyCount = await prisma.portfolioHistory.count();
  if (historyCount === 0) {
    await recomputePortfolioHistory();
  }

  const [funds, history, recentLogs] = await Promise.all([
    prisma.fund.findMany({ orderBy: { id: "asc" } }),
    prisma.portfolioHistory.findMany({ orderBy: { dateKey: "asc" }, take: 45 }),
    prisma.scrapeLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const { summary, fundsWithMetrics } = computePortfolioSummary(funds);

  const serializedFunds = fundsWithMetrics.map((f) => ({
    ...f,
    lastScrapedAt: f.lastScrapedAt
      ? new Date(f.lastScrapedAt).toISOString()
      : null,
  }));

  const serializedLogs = recentLogs.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <DashboardClient
      initialSummary={summary}
      initialFunds={serializedFunds}
      initialHistory={history}
      initialLogs={serializedLogs}
      initialScheduler={scheduler}
    />
  );
}

