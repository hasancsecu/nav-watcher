import * as cheerio from "cheerio";
import { prisma, ensureFundsSeeded } from "./prisma";
import { computePortfolioSummary } from "./calculations";

export interface HistoricalNavPoint {
  dateKey: string;
  displayDate: string;
  nav: number;
  buyPrice?: number | null;
  sellPrice?: number | null;
}

export interface ParsedFundNavResult {
  nav: number;
  buyPrice: number | null;
  sellPrice: number | null;
  effectiveDateRaw: string;
  dateKey: string;
  displayDate: string;
  historicalPoints: HistoricalNavPoint[];
}

export interface FundSyncResult {
  fundId: string;
  fundName: string;
  status: "SUCCESS" | "FALLBACK_SUCCESS" | "ERROR";
  sourceUsed: "PRIMARY" | "FALLBACK" | "BINI" | "FAILED";
  urlUsed: string;
  nav: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  effectiveDate: string | null;
  durationMs: number;
  error?: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Normalizes various Bangladeshi AMC date formats into YYYY-MM-DD and "DD MMM YYYY"
 * Examples handled:
 * - "11-November-2026"
 * - "11 November 2026"
 * - "11-Nov-26"
 * - "November 11, 2026"
 * - "11 Nov, 2026"
 * - "09 Nov 26"
 * - "30 Sept 26"
 */
export function normalizeDateString(raw?: string | null): {
  dateKey: string;
  displayDate: string;
} {
  if (raw) {
    const cleaned = raw
      .replace(/as\s+on/i, "")
      .replace(/as\s+of/i, "")
      .replace(/[()]/g, "")
      .replace(/,/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Pattern 1: DD Month YYYY or DD Month YY (e.g. "11 November 2026", "09 Nov 26")
    const dmyMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const monthNum = MONTH_MAP[dmyMatch[2].toLowerCase()];
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      if (monthNum && day >= 1 && day <= 31) {
        const yyyy = String(year);
        const mm = String(monthNum).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return {
          dateKey: `${yyyy}-${mm}-${dd}`,
          displayDate: `${dd} ${SHORT_MONTH_NAMES[monthNum - 1]} ${yyyy}`,
        };
      }
    }

    // Pattern 2: Month DD YYYY (e.g. "November 11 2026")
    const mdyMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{2,4})$/);
    if (mdyMatch) {
      const monthNum = MONTH_MAP[mdyMatch[1].toLowerCase()];
      const day = parseInt(mdyMatch[2], 10);
      let year = parseInt(mdyMatch[3], 10);
      if (year < 100) year += 2000;
      if (monthNum && day >= 1 && day <= 31) {
        const yyyy = String(year);
        const mm = String(monthNum).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return {
          dateKey: `${yyyy}-${mm}-${dd}`,
          displayDate: `${dd} ${SHORT_MONTH_NAMES[monthNum - 1]} ${yyyy}`,
        };
      }
    }

    // Pattern 3: YYYY-MM-DD
    const isoMatch = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const monthNum = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return {
          dateKey: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
          displayDate: `${String(day).padStart(2, "0")} ${SHORT_MONTH_NAMES[monthNum - 1]} ${year}`,
        };
      }
    }
  }

  // Fallback to current date in Asia/Dhaka
  const dhakaNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
  );
  const yyyy = dhakaNow.getFullYear();
  const monthIdx = dhakaNow.getMonth();
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(dhakaNow.getDate()).padStart(2, "0");
  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    displayDate: `${dd} ${SHORT_MONTH_NAMES[monthIdx]} ${yyyy}`,
  };
}

/**
 * Cleanly extracts a positive numeric NAV value from a text string.
 */
export function parseNumericNav(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (Number.isNaN(val) || val <= 0 || val > 10000) return null;
  return val;
}

/**
 * Fetches raw HTML with browser-like headers and timeout resilience.
 */
async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
  }

  const html = await response.text();
  if (!html || html.length < 200) {
    throw new Error(`Empty or truncated HTML response from ${url}`);
  }
  return html;
}

/**
 * 1. Parser for Shanta Amanah Shariah Fund Primary URL:
 * https://www.shanta-aml.com/our-funds/shanta-amanah-shariah-fund
 */
export function parseShantaPrimaryHtml(html: string): ParsedFundNavResult {
  const $ = cheerio.load(html);
  let nav: number | null = null;
  let buyPrice: number | null = null;
  let sellPrice: number | null = null;
  let effectiveDateRaw = "";
  const historicalPoints: HistoricalNavPoint[] = [];

  // Strategy 1: Buy and Sale Rate table ("section.buy-sell table tbody tr")
  $("section.buy-sell table tbody tr").each((idx, row) => {
    if (idx > 0) return;
    const cells = $(row).find("td");
    if (cells.length >= 4) {
      const dateText = $(cells[0]).text().trim();
      const marketNav = parseNumericNav($(cells[1]).text());
      const unitBuy = parseNumericNav($(cells[2]).text());
      const redemption = parseNumericNav($(cells[3]).text());
      if (marketNav) {
        nav = marketNav;
        buyPrice = unitBuy ?? marketNav;
        sellPrice = redemption ?? marketNav;
        effectiveDateRaw = dateText;
      }
    }
  });

  // Strategy 2: Overview tab metric card (".tab-box__single")
  if (!nav) {
    $(".tab-box__single").each((_, el) => {
      const heading = $(el).find("h5").text().trim().toUpperCase();
      if (heading === "NAV") {
        const val = parseNumericNav($(el).find("h3").text());
        const datePara = $(el).find("p").text().replace(/As\s+on/i, "").trim();
        if (val) {
          nav = val;
          buyPrice = val;
          sellPrice = val;
          if (datePara) effectiveDateRaw = datePara;
        }
      }
    });
  }

  // Strategy 3: Fund Details tab (".fund-metrics__item")
  if (!nav) {
    $(".fund-metrics__item").each((_, el) => {
      const label = $(el).find(".fund-metrics__item-label").text().trim().toUpperCase();
      if (label === "NAV") {
        const valText = $(el).find(".fund-metrics__item-value").text().trim();
        const val = parseNumericNav(valText);
        const dateMatch = valText.match(/As\s+on\s+([^)]+)/i);
        if (val) {
          nav = val;
          buyPrice = val;
          sellPrice = val;
          if (dateMatch?.[1]) effectiveDateRaw = dateMatch[1].trim();
        }
      }
    });
  }

  // Extract historical NAV series from ".performance-table .nav-list table" (first table only, where header mentions NAV)
  $(".performance-table .nav-list table")
    .first()
    .find("tbody tr")
    .each((idx, row) => {
      if (idx >= 30) return;
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const dText = $(cells[0]).text().trim();
        const rowNav = parseNumericNav($(cells[1]).text());
        if (dText && rowNav && /[A-Za-z]/.test(dText)) {
          const norm = normalizeDateString(dText);
          historicalPoints.push({
            dateKey: norm.dateKey,
            displayDate: norm.displayDate,
            nav: rowNav,
            buyPrice: rowNav,
            sellPrice: rowNav,
          });
          if (!nav && idx === 0) {
            nav = rowNav;
            buyPrice = rowNav;
            sellPrice = rowNav;
            effectiveDateRaw = dText;
          }
        }
      }
    });

  // Also check __NEXT_DATA__ JSON for 30-day historical performance series of shanta-amanah-shariah-fund
  try {
    const nextDataText = $("script#__NEXT_DATA__").html();
    if (nextDataText) {
      const nextJson = JSON.parse(nextDataText);
      const list = nextJson?.props?.pageProps?.data?.data?.list;
      if (Array.isArray(list)) {
        const shantaItem = list.find(
          (item: { page_data?: { slug?: string } }) =>
            item?.page_data?.slug === "shanta-amanah-shariah-fund"
        );
        const perfArr = shantaItem?.performance?.data;
        if (Array.isArray(perfArr) && perfArr.length > 0) {
          const recent30 = perfArr.slice(-30);
          for (const entry of recent30) {
            const dText = String(entry?.Date || "").trim();
            const rNav = Number(entry?.Nav);
            if (dText && rNav > 0) {
              const norm = normalizeDateString(dText);
              if (!historicalPoints.some((p) => p.dateKey === norm.dateKey)) {
                historicalPoints.push({
                  dateKey: norm.dateKey,
                  displayDate: norm.displayDate,
                  nav: rNav,
                  buyPrice: rNav,
                  sellPrice: rNav,
                });
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore optional __NEXT_DATA__ parse issues
  }

  if (!nav) {
    throw new Error("Could not extract numeric NAV from Shanta primary page DOM");
  }

  const normalized = normalizeDateString(effectiveDateRaw);
  return {
    nav,
    buyPrice: buyPrice ?? nav,
    sellPrice: sellPrice ?? nav,
    effectiveDateRaw: effectiveDateRaw || normalized.displayDate,
    dateKey: normalized.dateKey,
    displayDate: normalized.displayDate,
    historicalPoints,
  };
}

/**
 * 2. Parser for IDLC Shariah Fund Primary URL:
 * https://idlc.com/aml/shariah_fund.php
 */
export function parseIdlcPrimaryHtml(html: string): ParsedFundNavResult {
  const $ = cheerio.load(html);
  let nav: number | null = null;
  let effectiveDateRaw = "";

  // Strategy 1: Locate "LATEST NAV" heading and inspect adjacent elements
  $("h4").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim().toUpperCase();
    if (text.includes("LATEST NAV")) {
      const parent = $(el).parent();
      const parentText = parent.text();
      const dateMatch = parentText.match(/NAV\s+as\s+on\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
      if (dateMatch?.[1]) {
        effectiveDateRaw = dateMatch[1].trim();
      }
      // Look for the green h4 or next h4 containing the numeric NAV
      const nextH4s = $(el).nextAll("h4");
      nextH4s.each((__, h4El) => {
        const candidate = parseNumericNav($(h4El).text());
        if (candidate && !nav) {
          nav = candidate;
        }
      });
    }
  });

  // Strategy 2: Regex fallback across the HTML around "LATEST NAV"
  if (!nav) {
    const blockMatch = html.match(
      /LATEST\s+NAV[\s\S]{0,500}?NAV\s+as\s+on\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})[\s\S]{0,400}?>\s*(\d+\.\d+)\s*</i
    );
    if (blockMatch) {
      effectiveDateRaw = blockMatch[1].trim();
      nav = parseNumericNav(blockMatch[2]);
    }
  }

  if (!nav) {
    throw new Error("Could not extract numeric NAV from IDLC primary page DOM");
  }

  const normalized = normalizeDateString(effectiveDateRaw);
  return {
    nav,
    buyPrice: nav,
    sellPrice: nav,
    effectiveDateRaw: effectiveDateRaw || normalized.displayDate,
    dateKey: normalized.dateKey,
    displayDate: normalized.displayDate,
    historicalPoints: [
      {
        dateKey: normalized.dateKey,
        displayDate: normalized.displayDate,
        nav,
        buyPrice: nav,
        sellPrice: nav,
      },
    ],
  };
}

/**
 * 3. Parser for Edge Al-Amin Shariah Consumer Fund Primary URL:
 * https://www.edgeamc.com/edge-alamin-shariah-consumer-fund
 */
export function parseEdgePrimaryHtml(html: string): ParsedFundNavResult {
  const $ = cheerio.load(html);
  let nav: number | null = null;
  let buyPrice: number | null = null;
  let sellPrice: number | null = null;
  let effectiveDateRaw = "";
  const historicalPoints: HistoricalNavPoint[] = [];

  // Strategy 1: Performance table #dataTable (has Date, Nav/Unit, Investor Sell Price, Investor Buy Price)
  $("#dataTable tbody tr").each((idx, row) => {
    if (idx >= 30) return;
    const cells = $(row).find("td");
    if (cells.length >= 4) {
      const dText = $(cells[0]).text().trim();
      const rowNav = parseNumericNav($(cells[1]).text());
      const rowSell = parseNumericNav($(cells[2]).text());
      const rowBuy = parseNumericNav($(cells[3]).text());

      if (dText && rowNav) {
        const norm = normalizeDateString(dText);
        historicalPoints.push({
          dateKey: norm.dateKey,
          displayDate: norm.displayDate,
          nav: rowNav,
          sellPrice: rowSell ?? rowNav,
          buyPrice: rowBuy ?? rowNav,
        });

        if (idx === 0) {
          nav = rowNav;
          sellPrice = rowSell ?? rowNav;
          buyPrice = rowBuy ?? rowNav;
          effectiveDateRaw = dText;
        }
      }
    }
  });

  // Strategy 2: Top summary card ".plan_funt_item"
  if (!nav) {
    $(".plan_funt_item").each((_, el) => {
      const title = $(el).find(".plan_funt_item_tt h4").text().trim().toUpperCase();
      if (title === "NAV") {
        const candidate = parseNumericNav($(el).find(".plan_funt_item_vl h5").text());
        if (candidate) {
          nav = candidate;
          buyPrice = candidate;
          sellPrice = candidate;
        }
      }
    });
  }

  if (!nav) {
    throw new Error("Could not extract numeric NAV from Edge AMC primary page DOM");
  }

  const normalized = normalizeDateString(effectiveDateRaw);
  return {
    nav,
    buyPrice: buyPrice ?? nav,
    sellPrice: sellPrice ?? nav,
    effectiveDateRaw: effectiveDateRaw || normalized.displayDate,
    dateKey: normalized.dateKey,
    displayDate: normalized.displayDate,
    historicalPoints,
  };
}

/**
 * Fallback Parser for Bini.com.bd fund pages:
 * - https://bini.com.bd/funds/shanta-amanah-shariah-fund-ffb52cac
 * - https://bini.com.bd/funds/idlc-aml-shariah-fund-ffb5288f
 * - https://bini.com.bd/funds/edge-al-amin-shariah-consumer-fund-759e11aa
 */
export function parseBiniFallbackHtml(html: string): ParsedFundNavResult {
  let nav: number | null = null;
  let effectiveDateRaw = "";

  // Strategy 1: Exact bini dt/dd structure regex
  // <dt ...>NAV<span ...><span class="sr-only">as of </span>11 Nov 26</span></dt><dd ...><span class="tabular" ...>৳ 10.60</span></dd>
  const exactBiniMatch = html.match(
    />NAV.*?as of <\/span>([^<]+)<\/span><\/dt>\s*<dd[^>]*>[\s\S]*?৳\s*([0-9.]+)/i
  );
  if (exactBiniMatch) {
    effectiveDateRaw = exactBiniMatch[1].trim();
    nav = parseNumericNav(exactBiniMatch[2]);
  }

  // Strategy 2: Cheerio search for dt/dd
  if (!nav) {
    const $ = cheerio.load(html);
    $("dt").each((_, dtEl) => {
      const dtText = $(dtEl).text().replace(/\s+/g, " ").trim();
      if (/^NAV\b/i.test(dtText)) {
        const datePart = dtText.replace(/^NAV/i, "").replace(/as\s+of/i, "").trim();
        const ddEl = $(dtEl).next("dd");
        const ddText = ddEl.text().trim();
        const candidate = parseNumericNav(ddText);
        if (candidate) {
          nav = candidate;
          effectiveDateRaw = datePart;
        }
      }
    });
  }

  // Strategy 3: Regex fallback on raw HTML
  if (!nav) {
    const regexMatch = html.match(
      /<dt[^>]*>NAV(?:<span[^>]*>(?:<span[^>]*>as of\s*<\/span>)?([^<]+)<\/span>)?<\/dt>\s*<dd[^>]*>[\s\S]{0,200}?(\d+\.\d+)/i
    );
    if (regexMatch) {
      effectiveDateRaw = (regexMatch[1] || "").trim();
      nav = parseNumericNav(regexMatch[2]);
    }
  }

  if (!nav) {
    throw new Error("Could not extract numeric NAV from Bini page DOM");
  }

  const normalized = normalizeDateString(effectiveDateRaw);
  return {
    nav,
    buyPrice: nav,
    sellPrice: nav,
    effectiveDateRaw: effectiveDateRaw || normalized.displayDate,
    dateKey: normalized.dateKey,
    displayDate: normalized.displayDate,
    historicalPoints: [
      {
        dateKey: normalized.dateKey,
        displayDate: normalized.displayDate,
        nav,
        buyPrice: nav,
        sellPrice: nav,
      },
    ],
  };
}

function parsePrimaryByFundId(fundId: string, html: string): ParsedFundNavResult {
  switch (fundId) {
    case "shanta-amanah":
      return parseShantaPrimaryHtml(html);
    case "idlc-shariah":
      return parseIdlcPrimaryHtml(html);
    case "edge-alamin":
      return parseEdgePrimaryHtml(html);
    default:
      throw new Error(`Unknown fundId: ${fundId}`);
  }
}

/**
 * Scrapes a single fund with automatic fallback to its specific bini.com.bd URL
 * if the primary URL fails to load or cannot be scraped.
 */
export async function scrapeSingleFund(
  fund: {
    id: string;
    name: string;
    biniUrl?: string;
    primaryUrl?: string | null;
    fallbackUrl?: string | null;
  },
  options?: {
    trigger?: string;
    forceFallback?: boolean;
  }
): Promise<FundSyncResult> {
  const startTime = Date.now();
  const trigger = options?.trigger || "MANUAL";
  const biniUrl = fund.biniUrl || fund.fallbackUrl;
  let primaryErrorMsg = "";

  // Step 1: Try Primary URL first if defined
  if (fund.primaryUrl && !options?.forceFallback) {
    try {
      const html = await fetchHtml(fund.primaryUrl);
      const parsed = parsePrimaryByFundId(fund.id, html);
      const durationMs = Date.now() - startTime;

      await persistScrapedFundData(fund.id, parsed, "PRIMARY", "SUCCESS");
      await prisma.scrapeLog.create({
        data: {
          fundId: fund.id,
          trigger,
          sourceUsed: "PRIMARY",
          urlAttempted: fund.primaryUrl,
          status: "SUCCESS",
          extractedNav: parsed.nav,
          effectiveDate: parsed.displayDate,
          durationMs,
          message: `Scraped primary AMC page (${parsed.displayDate}: ${parsed.nav} BDT)`,
        },
      });

      return {
        fundId: fund.id,
        fundName: fund.name,
        status: "SUCCESS",
        sourceUsed: "PRIMARY",
        urlUsed: fund.primaryUrl,
        nav: parsed.nav,
        buyPrice: parsed.buyPrice,
        sellPrice: parsed.sellPrice,
        effectiveDate: parsed.displayDate,
        durationMs,
      };
    } catch (primaryErr) {
      primaryErrorMsg =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      console.warn(
        `[NAV Scraper] Primary URL failed for ${fund.name} (${fund.primaryUrl}): ${primaryErrorMsg}. Trying bini.com.bd URL: ${biniUrl}`
      );
    }
  } else {
    primaryErrorMsg = "Primary skipped or not configured";
  }

  // Step 2: Scrape live NAV and date from bini.com.bd
  if (biniUrl) {
    try {
      const fallbackHtml = await fetchHtml(biniUrl);
      const parsed = parseBiniFallbackHtml(fallbackHtml);
      const durationMs = Date.now() - startTime;

      await persistScrapedFundData(fund.id, parsed, "BINI", "SUCCESS");
      await prisma.scrapeLog.create({
        data: {
          fundId: fund.id,
          trigger,
          sourceUsed: "BINI",
          urlAttempted: biniUrl,
          status: "SUCCESS",
          extractedNav: parsed.nav,
          effectiveDate: parsed.displayDate,
          durationMs,
          message: `Scraped live NAV & date from bini.com.bd (${parsed.displayDate}: ${parsed.nav} BDT)`,
        },
      });

      return {
        fundId: fund.id,
        fundName: fund.name,
        status: "SUCCESS",
        sourceUsed: "BINI",
        urlUsed: biniUrl,
        nav: parsed.nav,
        buyPrice: parsed.buyPrice,
        sellPrice: parsed.sellPrice,
        effectiveDate: parsed.displayDate,
        durationMs,
      };
    } catch (fallbackErr) {
      const fallbackErrorMsg =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      const combinedError = `Primary failed (${primaryErrorMsg}); Bini failed (${fallbackErrorMsg})`;
      const durationMs = Date.now() - startTime;

      console.error(`[NAV Scraper] Failed for ${fund.name}: ${combinedError}`);

      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          lastScrapeStatus: "ERROR",
          lastScrapeError: combinedError,
        },
      });

      await prisma.scrapeLog.create({
        data: {
          fundId: fund.id,
          trigger,
          sourceUsed: "FAILED",
          urlAttempted: `${fund.primaryUrl || "none"} -> ${biniUrl}`,
          status: "ERROR",
          durationMs,
          message: combinedError,
        },
      });

      return {
        fundId: fund.id,
        fundName: fund.name,
        status: "ERROR",
        sourceUsed: "FAILED",
        urlUsed: biniUrl,
        nav: null,
        buyPrice: null,
        sellPrice: null,
        effectiveDate: null,
        durationMs,
        error: combinedError,
      };
    }
  }

  return {
    fundId: fund.id,
    fundName: fund.name,
    status: "ERROR",
    sourceUsed: "FAILED",
    urlUsed: "none",
    nav: null,
    buyPrice: null,
    sellPrice: null,
    effectiveDate: null,
    durationMs: Date.now() - startTime,
    error: "No scraping URL provided",
  };
}

async function persistScrapedFundData(
  fundId: string,
  parsed: ParsedFundNavResult,
  source: "PRIMARY" | "FALLBACK" | "BINI",
  status: "SUCCESS" | "FALLBACK_SUCCESS"
) {
  const now = new Date();

  await prisma.fund.update({
    where: { id: fundId },
    data: {
      latestNav: parsed.nav,
      buyPrice: parsed.buyPrice,
      sellPrice: parsed.sellPrice,
      navEffectiveDate: parsed.displayDate,
      lastScrapedAt: now,
      lastScrapeSource: source,
      lastScrapeStatus: status,
      lastScrapeError: null,
    },
  });

  // Upsert the primary snapshot
  await prisma.navSnapshot.upsert({
    where: {
      fundId_dateKey: {
        fundId,
        dateKey: parsed.dateKey,
      },
    },
    update: {
      nav: parsed.nav,
      buyPrice: parsed.buyPrice,
      sellPrice: parsed.sellPrice,
      displayDate: parsed.displayDate,
      source,
      scrapedAt: now,
    },
    create: {
      fundId,
      dateKey: parsed.dateKey,
      displayDate: parsed.displayDate,
      nav: parsed.nav,
      buyPrice: parsed.buyPrice,
      sellPrice: parsed.sellPrice,
      source,
      scrapedAt: now,
    },
  });

  // Upsert any historical table rows extracted from the page
  for (const pt of parsed.historicalPoints) {
    if (pt.dateKey === parsed.dateKey) continue;
    await prisma.navSnapshot.upsert({
      where: {
        fundId_dateKey: {
          fundId,
          dateKey: pt.dateKey,
        },
      },
      update: {
        nav: pt.nav,
        buyPrice: pt.buyPrice ?? pt.nav,
        sellPrice: pt.sellPrice ?? pt.nav,
        displayDate: pt.displayDate,
      },
      create: {
        fundId,
        dateKey: pt.dateKey,
        displayDate: pt.displayDate,
        nav: pt.nav,
        buyPrice: pt.buyPrice ?? pt.nav,
        sellPrice: pt.sellPrice ?? pt.nav,
        source: "HISTORICAL_TABLE",
      },
    });
  }
}

/**
 * Rebuilds the daily PortfolioHistory series using the stored NavSnapshots and
 * current holdings so the Historical Chart accurately shows Daily Portfolio Value vs. Total Invested Amount.
 */
export async function recomputePortfolioHistory(): Promise<void> {
  const funds = await prisma.fund.findMany({
    orderBy: { id: "asc" },
  });
  if (funds.length === 0) return;

  const allSnapshots = await prisma.navSnapshot.findMany({
    orderBy: { dateKey: "asc" },
  });

  // Collect all distinct dateKeys sorted ascending
  const dateMap = new Map<string, string>();
  for (const snap of allSnapshots) {
    dateMap.set(snap.dateKey, snap.displayDate);
  }

  // If no snapshots yet, create one for today
  if (dateMap.size === 0) {
    const today = normalizeDateString(null);
    dateMap.set(today.dateKey, today.displayDate);
  }

  const sortedDates = Array.from(dateMap.keys()).sort();

  // Group snapshots by fundId -> Map<dateKey, nav>
  const fundSnapByDate = new Map<string, Map<string, number>>();
  const earliestNavByFund = new Map<string, number>();

  for (const f of funds) {
    fundSnapByDate.set(f.id, new Map());
    earliestNavByFund.set(f.id, f.latestNav ?? f.defaultNav ?? 10);
  }

  for (const snap of allSnapshots) {
    const m = fundSnapByDate.get(snap.fundId);
    if (m) {
      m.set(snap.dateKey, snap.nav);
    }
  }

  // For each fund, find its first known snapshot NAV as baseline before its earliest snapshot
  for (const f of funds) {
    const m = fundSnapByDate.get(f.id);
    if (m && m.size > 0) {
      const firstKey = Array.from(m.keys()).sort()[0];
      const firstVal = m.get(firstKey);
      if (firstVal) earliestNavByFund.set(f.id, firstVal);
    }
  }

  const runningNavByFund = new Map<string, number>(earliestNavByFund);

  for (const dateKey of sortedDates) {
    const displayDate = dateMap.get(dateKey) || dateKey;

    const simulatedFunds = funds.map((f) => {
      const m = fundSnapByDate.get(f.id);
      const snapNav = m?.get(dateKey);
      if (snapNav !== undefined) {
        runningNavByFund.set(f.id, snapNav);
      }
      const navForDate =
        runningNavByFund.get(f.id) ?? f.latestNav ?? f.defaultNav ?? 10;
      return {
        ...f,
        totalInvested: 0,
        averageBuyPrice: 10,
        monthlySipTarget: 8000,
        latestNav: navForDate,
      };
    });

    const { summary } = computePortfolioSummary(simulatedFunds);

    await prisma.portfolioHistory.upsert({
      where: { dateKey },
      update: {
        displayDate,
        totalInvested: Number(summary.totalInvested.toFixed(2)),
        currentMarketValue: Number(summary.currentMarketValue.toFixed(2)),
        absoluteGainLoss: Number(summary.absoluteGainLoss.toFixed(2)),
        returnPct: Number(summary.returnPct.toFixed(2)),
        shantaNav: runningNavByFund.get("shanta-amanah") ?? null,
        idlcNav: runningNavByFund.get("idlc-shariah") ?? null,
        edgeNav: runningNavByFund.get("edge-alamin") ?? null,
      },
      create: {
        dateKey,
        displayDate,
        totalInvested: Number(summary.totalInvested.toFixed(2)),
        currentMarketValue: Number(summary.currentMarketValue.toFixed(2)),
        absoluteGainLoss: Number(summary.absoluteGainLoss.toFixed(2)),
        returnPct: Number(summary.returnPct.toFixed(2)),
        shantaNav: runningNavByFund.get("shanta-amanah") ?? null,
        idlcNav: runningNavByFund.get("idlc-shariah") ?? null,
        edgeNav: runningNavByFund.get("edge-alamin") ?? null,
      },
    });
  }
}

/**
 * Scrapes all 3 Bangladeshi mutual funds concurrently, logs results,
 * updates snapshots, and recomputes the historical portfolio chart.
 */
export async function syncAllFundsNav(options?: {
  trigger?: string;
  forceFallbackFor?: string[];
}): Promise<{
  results: FundSyncResult[];
  syncedAt: string;
}> {
  await ensureFundsSeeded();
  const funds = await prisma.fund.findMany({
    orderBy: { id: "asc" },
  });

  const forceSet = new Set(options?.forceFallbackFor || []);
  const results = await Promise.all(
    funds.map((fund) =>
      scrapeSingleFund(fund, {
        trigger: options?.trigger || "MANUAL",
        forceFallback: forceSet.has(fund.id),
      })
    )
  );

  await recomputePortfolioHistory();

  return {
    results,
    syncedAt: new Date().toISOString(),
  };
}
