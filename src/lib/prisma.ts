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
  totalInvested: number;
  averageBuyPrice: number;
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
    totalInvested: 44000,
    averageBuyPrice: 10.74,
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
    totalInvested: 38000,
    averageBuyPrice: 11.121,
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
    totalInvested: 24000,
    averageBuyPrice: 11.32,
    monthlySipTarget: 8000,
    defaultNav: 11.3,
  },
];

export async function ensureFundsSeeded() {
  for (const fund of DEFAULT_FUNDS) {
    await prisma.fund.upsert({
      where: { id: fund.id },
      update: {
        primaryUrl: fund.primaryUrl,
        fallbackUrl: fund.fallbackUrl,
      },
      create: {
        id: fund.id,
        slug: fund.slug,
        name: fund.name,
        shortName: fund.shortName,
        fundManager: fund.fundManager,
        primaryUrl: fund.primaryUrl,
        fallbackUrl: fund.fallbackUrl,
        totalInvested: fund.totalInvested,
        averageBuyPrice: fund.averageBuyPrice,
        monthlySipTarget: fund.monthlySipTarget,
        latestNav: fund.defaultNav,
        buyPrice: fund.defaultNav,
        sellPrice: fund.defaultNav,
      },
    });
  }
}
