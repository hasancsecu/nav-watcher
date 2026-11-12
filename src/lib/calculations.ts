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
  fractionalCashBalance?: number;
  totalCipUnits?: number;
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
  fractionalCashBalance: number;
  totalCipUnits: number;
}

export interface PortfolioSummaryMetrics {
  totalInvested: number;
  currentMarketValue: number;
  absoluteGainLoss: number;
  returnPct: number;
  totalMonthlySip: number;
  totalFractionalCash: number;
  totalCipUnits: number;
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

  const fractionalCashBalance = Math.max(0, Number(fund.fractionalCashBalance) || 0);
  const totalCipUnits = Math.max(0, Math.floor(Number(fund.totalCipUnits) || 0));

  return {
    ...fund,
    effectiveNav,
    totalUnitsHeld,
    currentMarketValue,
    absoluteGainLoss,
    returnPct,
    portfolioWeightPct,
    fractionalCashBalance,
    totalCipUnits,
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
  const totalFractionalCash = preliminary.reduce((acc, f) => acc + (f.fractionalCashBalance || 0), 0);
  const totalCipUnits = preliminary.reduce((acc, f) => acc + (f.totalCipUnits || 0), 0);

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
      totalFractionalCash,
      totalCipUnits,
      lastUpdatedAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
      fundsCount: funds.length,
    },
    fundsWithMetrics,
  };
}

/**
 * Calculates CIP Dividend Reinvestment into strictly INTEGER units
 * with the exact remainder stored as cash value to settle on the next SIP.
 */
export function calculateCipReinvestment(
  dividendAmount: number,
  cipNav: number,
  existingCashBuffer = 0
): {
  totalAvailable: number;
  unitsAllotted: number; // Strictly INTEGER!
  reinvestedAmount: number;
  cashRemainder: number;
} {
  const safeDiv = Math.max(0, Number(dividendAmount) || 0);
  const safeBuffer = Math.max(0, Number(existingCashBuffer) || 0);
  const safeNav = Number(cipNav) > 0 ? Number(cipNav) : 10;

  const totalAvailable = Number((safeDiv + safeBuffer).toFixed(2));
  // Mandatory Bangladesh AMC CIP Rule: Units allotted MUST be integer, not decimal!
  const unitsAllotted = Math.floor(totalAvailable / safeNav);
  const reinvestedAmount = Number((unitsAllotted * safeNav).toFixed(2));
  const cashRemainder = Number(Math.max(0, totalAvailable - reinvestedAmount).toFixed(2));

  return {
    totalAvailable,
    unitsAllotted,
    reinvestedAmount,
    cashRemainder,
  };
}

/**
 * Computes portfolio updates when CIP units are credited to a fund.
 */
export function applyCipUnitsToHolding(
  currentInvested: number,
  currentAvgBuyPrice: number,
  allottedUnits: number,
  reinvestmentNav: number
): {
  newTotalInvested: number;
  newAverageBuyPrice: number;
  newTotalUnits: number;
} {
  const safeInvested = Math.max(0, Number(currentInvested) || 0);
  const safeAvg = Number(currentAvgBuyPrice) > 0 ? Number(currentAvgBuyPrice) : 10;
  const safeUnits = Math.max(0, Math.floor(Number(allottedUnits) || 0));
  const safeNav = Number(reinvestmentNav) > 0 ? Number(reinvestmentNav) : safeAvg;

  const existingUnits = safeInvested > 0 ? safeInvested / safeAvg : 0;
  const newTotalUnits = existingUnits + safeUnits;
  const reinvestedCost = safeUnits * safeNav;
  const newTotalInvested = safeInvested + reinvestedCost;
  const newAverageBuyPrice =
    newTotalUnits > 0 ? newTotalInvested / newTotalUnits : safeAvg;

  return {
    newTotalInvested: Number(newTotalInvested.toFixed(2)),
    newAverageBuyPrice: Number(newAverageBuyPrice.toFixed(4)),
    newTotalUnits,
  };
}

/**
 * Simulates executing a monthly SIP installment while settling any previous
 * CIP fractional cash remainder.
 */
export function simulateSipWithCipSettlement(
  currentInvested: number,
  currentAvgBuyPrice: number,
  freshSipCash: number,
  executionNav: number,
  unsettledCashBalance = 0,
  settlementMethod: "ADD_TO_INVESTMENT" | "DEDUCT_FROM_PAYMENT" = "ADD_TO_INVESTMENT"
): {
  effectiveInvestedInUnits: number;
  userOutOfPocketCash: number;
  settledCashAmount: number;
  remainingCashBalance: number;
  newTotalInvested: number;
  newAverageBuyPrice: number;
  addedUnits: number;
  newTotalUnits: number;
} {
  const safeInvested = Math.max(0, Number(currentInvested) || 0);
  const safeAvg = Number(currentAvgBuyPrice) > 0 ? Number(currentAvgBuyPrice) : 10;
  const safeSip = Math.max(0, Number(freshSipCash) || 0);
  const safeNav = Number(executionNav) > 0 ? Number(executionNav) : safeAvg;
  const safeCash = Math.max(0, Number(unsettledCashBalance) || 0);

  let effectiveInvestedInUnits = safeSip;
  let userOutOfPocketCash = safeSip;
  const settledCashAmount = safeCash;

  if (settlementMethod === "ADD_TO_INVESTMENT") {
    // E.g. User invests fresh ৳8,000 + ৳15.40 cash remainder = ৳8,015.40 total into units
    effectiveInvestedInUnits = safeSip + safeCash;
    userOutOfPocketCash = safeSip;
  } else {
    // E.g. User pays ৳7,984.60 from bank, AMC consumes ৳15.40 cash remainder, ৳8,000 total into units
    effectiveInvestedInUnits = safeSip;
    userOutOfPocketCash = Math.max(0, safeSip - safeCash);
  }

  const existingUnits = safeInvested > 0 ? safeInvested / safeAvg : 0;
  const addedUnits = effectiveInvestedInUnits > 0 ? effectiveInvestedInUnits / safeNav : 0;
  const newTotalUnits = existingUnits + addedUnits;
  const newTotalInvested = safeInvested + effectiveInvestedInUnits;
  const newAverageBuyPrice =
    newTotalUnits > 0 ? newTotalInvested / newTotalUnits : safeNav;

  return {
    effectiveInvestedInUnits: Number(effectiveInvestedInUnits.toFixed(2)),
    userOutOfPocketCash: Number(userOutOfPocketCash.toFixed(2)),
    settledCashAmount: Number(settledCashAmount.toFixed(2)),
    remainingCashBalance: 0, // Fully settled!
    newTotalInvested: Number(newTotalInvested.toFixed(2)),
    newAverageBuyPrice: Number(newAverageBuyPrice.toFixed(4)),
    addedUnits,
    newTotalUnits,
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

