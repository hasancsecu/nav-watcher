export interface FundValuationInput {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  fundManager: string;
  primaryUrl: string;
  fallbackUrl: string;
  totalUnits?: number;
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
  totalUnitsHeld: number; // Plain Integer Only under Bangladesh AMC rules
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
 * Computes fund-level SIP & portfolio metrics using Bangladesh Open-Ended AMC rules:
 * 1. Total Units Held = strictly INTEGER (whole number) = floor(Invested / Avg Buy Price)
 * 2. Unsettled Cash Balance = Invested - (Units * Avg Buy Price), retained to settle on next SIP
 * 3. Current Market Value = Units Held * Latest Scraped NAV
 * 4. Absolute Gain/Loss (BDT) = Current Market Value - Total Invested in Units
 * 5. Return (%) = (Absolute Gain/Loss / Total Invested in Units) * 100
 */
export function computeFundMetrics(
  fund: FundValuationInput,
  totalPortfolioValue?: number
): FundValuationMetrics {
  const avgBuy = Number(fund.averageBuyPrice) > 0 ? Number(fund.averageBuyPrice) : 10;
  const effectiveNav =
    fund.latestNav !== null && fund.latestNav !== undefined && Number(fund.latestNav) > 0
      ? Number(fund.latestNav)
      : avgBuy;

  // Strict Bangladesh Mutual Fund rule: units must be whole plain integers
  let totalUnitsHeld = 0;
  if (fund.totalUnits !== undefined && fund.totalUnits !== null && Number(fund.totalUnits) > 0) {
    totalUnitsHeld = Math.floor(Number(fund.totalUnits));
  } else if (Number(fund.totalInvested) > 0 && avgBuy > 0) {
    totalUnitsHeld = Math.floor(Number(fund.totalInvested) / avgBuy);
  }

  const costOfUnits = Number((totalUnitsHeld * avgBuy).toFixed(2));
  const rawInvested = Math.max(0, Number(fund.totalInvested) || 0);
  const invested = rawInvested > 0 ? rawInvested : costOfUnits;

  // Fractional cash balance remaining from non-allotted decimal units
  let fractionalCashBalance = 0;
  if (fund.fractionalCashBalance !== undefined && fund.fractionalCashBalance !== null) {
    fractionalCashBalance = Math.max(0, Number(fund.fractionalCashBalance));
  } else if (invested > costOfUnits) {
    fractionalCashBalance = Math.max(0, Number((invested - costOfUnits).toFixed(2)));
  }

  const currentMarketValue = Number((totalUnitsHeld * effectiveNav).toFixed(2));
  const absoluteGainLoss = Number((currentMarketValue - costOfUnits).toFixed(2));
  const returnPct = costOfUnits > 0 ? (absoluteGainLoss / costOfUnits) * 100 : 0;
  const portfolioWeightPct =
    totalPortfolioValue && totalPortfolioValue > 0
      ? (currentMarketValue / totalPortfolioValue) * 100
      : 0;

  const totalCipUnits = Math.max(0, Math.floor(Number(fund.totalCipUnits) || 0));

  return {
    ...fund,
    totalUnits: totalUnitsHeld,
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
 * All units are strictly whole integers.
 */
export function applyCipUnitsToHolding(
  currentInvested: number,
  currentAvgBuyPrice: number,
  allottedUnits: number,
  reinvestmentNav: number,
  currentUnits?: number
): {
  newTotalInvested: number;
  newAverageBuyPrice: number;
  newTotalUnits: number;
} {
  const safeInvested = Math.max(0, Number(currentInvested) || 0);
  const safeAvg = Number(currentAvgBuyPrice) > 0 ? Number(currentAvgBuyPrice) : 10;
  const safeUnits = Math.max(0, Math.floor(Number(allottedUnits) || 0));
  const safeNav = Number(reinvestmentNav) > 0 ? Number(reinvestmentNav) : safeAvg;

  const existingUnits =
    currentUnits !== undefined && currentUnits > 0
      ? Math.floor(currentUnits)
      : Math.floor(safeInvested / safeAvg);

  const newTotalUnits = existingUnits + safeUnits;
  const reinvestedCost = safeUnits * safeNav;
  const newTotalInvested = Number((safeInvested + reinvestedCost).toFixed(2));
  const newAverageBuyPrice =
    newTotalUnits > 0 ? Number((newTotalInvested / newTotalUnits).toFixed(4)) : safeAvg;

  return {
    newTotalInvested,
    newAverageBuyPrice,
    newTotalUnits,
  };
}

/**
 * Simulates executing a monthly SIP installment while settling any previous
 * CIP fractional cash remainder into whole units. The new fractional remainder
 * carries forward to the next SIP installment.
 */
export function simulateSipWithCipSettlement(
  currentInvested: number,
  currentAvgBuyPrice: number,
  freshSipCash: number,
  executionNav: number,
  unsettledCashBalance = 0,
  settlementMethod: "ADD_TO_INVESTMENT" | "DEDUCT_FROM_PAYMENT" = "ADD_TO_INVESTMENT",
  currentUnits?: number
): {
  effectiveInvestedInUnits: number;
  userOutOfPocketCash: number;
  settledCashAmount: number;
  remainingCashBalance: number;
  newTotalInvested: number;
  newAverageBuyPrice: number;
  addedUnits: number; // Strictly INTEGER!
  newTotalUnits: number; // Strictly INTEGER!
} {
  const safeInvested = Math.max(0, Number(currentInvested) || 0);
  const safeAvg = Number(currentAvgBuyPrice) > 0 ? Number(currentAvgBuyPrice) : 10;
  const safeSip = Math.max(0, Number(freshSipCash) || 0);
  const safeNav = Number(executionNav) > 0 ? Number(executionNav) : safeAvg;
  const safeCash = Math.max(0, Number(unsettledCashBalance) || 0);

  const existingUnits =
    currentUnits !== undefined && currentUnits > 0
      ? Math.floor(currentUnits)
      : Math.floor(safeInvested / safeAvg);

  let cashAvailableForUnits = safeSip;
  let userOutOfPocketCash = safeSip;
  const settledCashAmount = safeCash;

  if (settlementMethod === "ADD_TO_INVESTMENT") {
    cashAvailableForUnits = safeSip + safeCash;
    userOutOfPocketCash = safeSip;
  } else {
    cashAvailableForUnits = safeSip;
    userOutOfPocketCash = Math.max(0, safeSip - safeCash);
  }

  // Under Bangladesh open-ended mutual fund rules, units are strictly INTEGER ONLY!
  const addedUnits = Math.floor(cashAvailableForUnits / safeNav);
  const costOfAddedUnits = Number((addedUnits * safeNav).toFixed(2));
  // The decimal portion remains as the new fractional cash balance to roll forward to the next SIP!
  const remainingCashBalance = Number(
    Math.max(0, cashAvailableForUnits - costOfAddedUnits).toFixed(2)
  );

  const newTotalUnits = existingUnits + addedUnits;
  const newTotalInvested = Number((safeInvested + costOfAddedUnits).toFixed(2));
  const newAverageBuyPrice =
    newTotalUnits > 0
      ? Number((newTotalInvested / newTotalUnits).toFixed(4))
      : safeNav;

  return {
    effectiveInvestedInUnits: costOfAddedUnits,
    userOutOfPocketCash: Number(userOutOfPocketCash.toFixed(2)),
    settledCashAmount: Number(settledCashAmount.toFixed(2)),
    remainingCashBalance,
    newTotalInvested,
    newAverageBuyPrice,
    addedUnits,
    newTotalUnits,
  };
}

/**
 * Helper to compute new Total Invested Amount and new weighted Average Buy Price
 * when a new monthly SIP installment is executed at a given execution NAV.
 * All units are strictly integers; remainder rolls into remainingCashBalance.
 */
export function simulateSipInstallment(
  currentInvested: number,
  currentAvgBuyPrice: number,
  sipAmount: number,
  executionNav: number,
  currentUnits?: number,
  existingCashBuffer = 0
): {
  newTotalInvested: number;
  newAverageBuyPrice: number;
  addedUnits: number;
  newTotalUnits: number;
  costOfAddedUnits: number;
  remainingCashBalance: number;
} {
  const safeCurrentInvested = Math.max(0, Number(currentInvested) || 0);
  const safeCurrentAvg = Number(currentAvgBuyPrice) > 0 ? Number(currentAvgBuyPrice) : 10;
  const safeSip = Math.max(0, Number(sipAmount) || 0);
  const safeExecNav = Number(executionNav) > 0 ? Number(executionNav) : safeCurrentAvg;
  const safeCash = Math.max(0, Number(existingCashBuffer) || 0);

  const existingUnits =
    currentUnits !== undefined && currentUnits > 0
      ? Math.floor(currentUnits)
      : Math.floor(safeCurrentInvested / safeCurrentAvg);

  const totalCash = safeSip + safeCash;
  const addedUnits = Math.floor(totalCash / safeExecNav);
  const costOfAddedUnits = Number((addedUnits * safeExecNav).toFixed(2));
  const remainingCashBalance = Number(Math.max(0, totalCash - costOfAddedUnits).toFixed(2));

  const newTotalUnits = existingUnits + addedUnits;
  const newTotalInvested = Number((safeCurrentInvested + costOfAddedUnits).toFixed(2));
  const newAverageBuyPrice =
    newTotalUnits > 0
      ? Number((newTotalInvested / newTotalUnits).toFixed(4))
      : safeExecNav;

  return {
    newTotalInvested,
    newAverageBuyPrice,
    addedUnits,
    newTotalUnits,
    costOfAddedUnits,
    remainingCashBalance,
  };
}

