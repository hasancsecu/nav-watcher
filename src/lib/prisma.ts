import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaPgClientV2: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  const rawUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.DATABASE_URL_POOLED ||
    "";

  return rawUrl.trim().replace(/^["']|["']$/g, "");
}

export const prisma =
  globalForPrisma.prismaPgClientV2 ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaPgClientV2 = prisma;
}

export interface DefaultFundConfig {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  fundManager: string;
  primaryUrl: string;
  fallbackUrl: string;
  totalUnits: number;
  totalInvested: number;
  averageBuyPrice: number;
  fractionalCashBalance: number;
  monthlySipTarget: number;
  defaultNav: number;
}

export const DEFAULT_FUNDS: DefaultFundConfig[] = [
  {
    id: "shanta-amanah",
    slug: "shanta-amanah-shariah-fund",
    name: "Shanta Amanah Shariah Fund",
    shortName: "Shanta Amanah",
    fundManager: "Shanta Asset Management Limited",
    primaryUrl:
      "https://www.shanta-aml.com/our-funds/shanta-amanah-shariah-fund",
    fallbackUrl:
      "https://bini.com.bd/funds/shanta-amanah-shariah-fund-ffb52cac",
    totalUnits: 4096, // Math.floor(44000 / 10.74)
    totalInvested: 43991.04, // 4096 * 10.74
    averageBuyPrice: 10.74,
    fractionalCashBalance: 8.96, // 44000 - 43991.04 (settles on next SIP)
    monthlySipTarget: 8000,
    defaultNav: 10.596,
  },
  {
    id: "idlc-shariah",
    slug: "idlc-shariah-fund",
    name: "IDLC Shariah Fund",
    shortName: "IDLC Shariah",
    fundManager: "IDLC Asset Management Limited",
    primaryUrl: "https://idlc.com/aml/shariah_fund.php",
    fallbackUrl: "https://bini.com.bd/funds/idlc-aml-shariah-fund-ffb5288f",
    totalUnits: 3416, // Math.floor(38000 / 11.121)
    totalInvested: 37989.34, // 3416 * 11.121
    averageBuyPrice: 11.121,
    fractionalCashBalance: 10.66, // 38000 - 37989.34 (settles on next SIP)
    monthlySipTarget: 8000,
    defaultNav: 10.92,
  },
  {
    id: "edge-alamin",
    slug: "edge-al-amin-shariah-consumer-fund",
    name: "Edge Al-Amin Shariah Consumer Fund",
    shortName: "Edge Al-Amin",
    fundManager: "EDGE AMC Limited",
    primaryUrl: "https://www.edgeamc.com/edge-alamin-shariah-consumer-fund",
    fallbackUrl:
      "https://bini.com.bd/funds/edge-al-amin-shariah-consumer-fund-759e11aa",
    totalUnits: 2120, // Math.floor(24000 / 11.32)
    totalInvested: 23998.40, // 2120 * 11.32
    averageBuyPrice: 11.32,
    fractionalCashBalance: 1.60, // 24000 - 23998.40 (settles on next SIP)
    monthlySipTarget: 8000,
    defaultNav: 11.3,
  },
];

export async function ensureFundsSeeded() {
  for (const fund of DEFAULT_FUNDS) {
    const existing = await prisma.fund.findUnique({ where: { id: fund.id } });
    if (!existing) {
      await prisma.fund.create({
        data: {
          id: fund.id,
          slug: fund.slug,
          name: fund.name,
          shortName: fund.shortName,
          fundManager: fund.fundManager,
          primaryUrl: fund.primaryUrl,
          fallbackUrl: fund.fallbackUrl,
          totalUnits: fund.totalUnits,
          totalInvested: fund.totalInvested,
          averageBuyPrice: fund.averageBuyPrice,
          fractionalCashBalance: fund.fractionalCashBalance,
          monthlySipTarget: fund.monthlySipTarget,
          latestNav: fund.defaultNav,
          buyPrice: fund.defaultNav,
          sellPrice: fund.defaultNav,
        },
      });
    } else if (!existing.totalUnits || existing.totalUnits === 0) {
      const computedUnits = Math.floor(existing.totalInvested / (existing.averageBuyPrice || 10));
      const unitsCost = Number((computedUnits * existing.averageBuyPrice).toFixed(2));
      const cashRemainder = Number(Math.max(0, existing.totalInvested - unitsCost).toFixed(2));
      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          totalUnits: computedUnits,
          fractionalCashBalance:
            existing.fractionalCashBalance > 0
              ? existing.fractionalCashBalance
              : cashRemainder,
        },
      });
    }
  }
}
