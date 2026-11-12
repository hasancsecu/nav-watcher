export interface FundValuationInput {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  fundManager: string;
  primaryUrl: string;
  fallbackUrl: string;
  totalInvested: number;
  averageBuyPrice: number;
  monthlySipTarget: number;
  latestNav: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  navEffectiveDate: string | null;
  lastScrapedAt: string | Date | null;
  lastScrapeSource: string | null;
  lastScrapeStatus: string | null;
  lastScrapeError: string | null;
}

export interface FundValuationMetrics extends FundValuationInput {
  effectiveNav: number;
  totalUnitsHeld: number;
  currentMarketValue: number;
  absoluteGainLoss: number;
  returnPct: number;
  portfolioWeightPct: number;
}

export interface PortfolioSummaryMetrics {
  totalInvested: number;
  currentMarketValue: number;
  absoluteGainLoss: number;
  returnPct: number;
  totalMonthlySip: number;
  lastUpdatedAt: string | null;
  fundsCount: number;
}

/**
 * Computes fund-level SIP & portfolio metrics using the required formulas:
 * 1. Total Units Held = Total Invested Amount / Average Buy Price
 * 2. Current Market Value = Total Units Held * Latest Scraped NAV
 * 3. Absolute Gain/Loss (BDT) = Current Market Value - Total Invested Amount
 * 4. Return (%) = (Absolute Gain/Loss / Total Invested Amount) * 100
 */
export function computeFundMetrics(
  fund: FundValuationInput,
  totalPortfolioValue?: number
): FundValuationMetrics {
  const invested = Math.max(0, Number(fund.totalInvested) || 0);
  const avgBuy = Number(fund.averageBuyPrice) > 0 ? Number(fund.averageBuyPrice) : 10;
  const effectiveNav =
    fund.latestNav !== null && fund.latestNav !== undefined && Number(fund.latestNav) > 0
      ? Number(fund.latestNav)
      : avgBuy;

  const totalUnitsHeld = invested > 0 && avgBuy > 0 ? invested / avgBuy : 0;
  const currentMarketValue = totalUnitsHeld * effectiveNav;
  const absoluteGainLoss = currentMarketValue - invested;
  const returnPct = invested > 0 ? (absoluteGainLoss / invested) * 100 : 0;
  const portfolioWeightPct =
    totalPortfolioValue && totalPortfolioValue > 0
      ? (currentMarketValue / totalPortfolioValue) * 100
      : 0;

  return {
    ...fund,
    effectiveNav,
    totalUnitsHeld,
    currentMarketValue,
    absoluteGainLoss,
    returnPct,
    portfolioWeightPct,
  };
}

export function computePortfolioSummary(
  funds: FundValuationInput[]
): {
  summary: PortfolioSummaryMetrics;
  fundsWithMetrics: FundValuationMetrics[];
} {
  const preliminary = funds.map((f) => computeFundMetrics(f));
  const totalInvested = preliminary.reduce((acc, f) => acc + f.totalInvested, 0);
  const currentMarketValue = preliminary.reduce((acc, f) => acc + f.currentMarketValue, 0);
  const absoluteGainLoss = currentMarketValue - totalInvested;
  const returnPct = totalInvested > 0 ? (absoluteGainLoss / totalInvested) * 100 : 0;
  const totalMonthlySip = preliminary.reduce((acc, f) => acc + (f.monthlySipTarget || 8000), 0);

  let latestTimestamp: number | null = null;
  for (const f of funds) {
    if (f.lastScrapedAt) {
      const ts = new Date(f.lastScrapedAt).getTime();
      if (!Number.isNaN(ts) && (latestTimestamp === null || ts > latestTimestamp)) {
        latestTimestamp = ts;
      }
    }
  }

  const fundsWithMetrics = funds.map((f) => computeFundMetrics(f, currentMarketValue));

  return {
    summary: {
      totalInvested,
      currentMarketValue,
      absoluteGainLoss,
      returnPct,
      totalMonthlySip,
      lastUpdatedAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
      fundsCount: funds.length,
    },
    fundsWithMetrics,
  };
}

/**
 * Helper to compute new Total Invested Amount and new weighted Average Buy Price
 * when a new monthly SIP installment is executed at a given execution NAV.
 */
export function simulateSipInstallment(
  currentInvested: number,
  currentAvgBuyPrice: number,
  sipAmount: number,
  executionNav: number
): {
  newTotalInvested: number;
  newAverageBuyPrice: number;
  addedUnits: number;
  newTotalUnits: number;
} {
  const safeCurrentInvested = Math.max(0, Number(currentInvested) || 0);
  const safeCurrentAvg = Number(currentAvgBuyPrice) > 0 ? Number(currentAvgBuyPrice) : 10;
  const safeSip = Math.max(0, Number(sipAmount) || 0);
  const safeExecNav = Number(executionNav) > 0 ? Number(executionNav) : safeCurrentAvg;

  const existingUnits = safeCurrentInvested > 0 ? safeCurrentInvested / safeCurrentAvg : 0;
  const addedUnits = safeSip > 0 ? safeSip / safeExecNav : 0;
  const newTotalUnits = existingUnits + addedUnits;
  const newTotalInvested = safeCurrentInvested + safeSip;
  const newAverageBuyPrice =
    newTotalUnits > 0 ? newTotalInvested / newTotalUnits : safeExecNav;

  return {
    newTotalInvested: Number(newTotalInvested.toFixed(2)),
    newAverageBuyPrice: Number(newAverageBuyPrice.toFixed(4)),
    addedUnits,
    newTotalUnits,
  };
}

