import { prisma } from "./prisma";
import biniCatalogJson from "./bini-catalog.json";

export interface MasterFundItem {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  fundManager: string;
  category: string;
  biniUrl: string;
  primaryUrl?: string;
  defaultNav: number;
}

export const MASTER_BINI_FUNDS: MasterFundItem[] = biniCatalogJson;

/**
 * Ensures the global Master Fund directory is populated in the database
 * so users can search, browse, and add funds from bini.com.bd.
 * DOES NOT create any seed data for user portfolios (fresh start for users).
 */
export async function ensureMasterCatalogSeeded(): Promise<void> {
  try {
    const count = await prisma.fund.count();
    if (count >= MASTER_BINI_FUNDS.length) {
      return;
    }

    for (const fund of MASTER_BINI_FUNDS) {
      await prisma.fund.upsert({
        where: { id: fund.id },
        update: {
          name: fund.name,
          shortName: fund.shortName,
          slug: fund.slug,
          fundManager: fund.fundManager,
          category: fund.category,
          biniUrl: fund.biniUrl,
          defaultNav: fund.defaultNav,
        },
        create: {
          id: fund.id,
          name: fund.name,
          shortName: fund.shortName,
          slug: fund.slug,
          fundManager: fund.fundManager,
          category: fund.category,
          biniUrl: fund.biniUrl,
          defaultNav: fund.defaultNav,
          latestNav: fund.defaultNav,
          buyPrice: fund.defaultNav,
          sellPrice: fund.defaultNav,
          navEffectiveDate: "11 Nov 2026",
          lastScrapeStatus: "INITIAL",
        },
      });
    }
  } catch (error) {
    console.error("[ensureMasterCatalogSeeded Error]", error);
  }
}
