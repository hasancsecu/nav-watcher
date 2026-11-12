import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  // If running on Vercel serverless, /var/task is read-only.
  // Copy the bundled prisma/dev.db to /tmp/dev.db so SQLite is read/write out-of-the-box.
  if (process.env.VERCEL) {
    const tmpDbPath = "/tmp/dev.db";
    if (!fs.existsSync(tmpDbPath)) {
      const candidateSources = [
        path.join(process.cwd(), "prisma", "dev.db"),
        path.join(process.cwd(), "dev.db"),
      ];
      for (const src of candidateSources) {
        if (fs.existsSync(src)) {
          try {
            fs.copyFileSync(src, tmpDbPath);
            break;
          } catch (err) {
            console.warn("[Prisma] Failed to copy seed SQLite DB to /tmp:", err);
          }
        }
      }
    }
    return `file:${tmpDbPath}`;
  }

  return process.env.DATABASE_URL || "file:./dev.db";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
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
    primaryUrl: "https://www.shanta-aml.com/our-funds/shanta-amanah-shariah-fund",
    fallbackUrl: "https://bini.com.bd/funds/shanta-amanah-shariah-fund-ffb52cac",
    totalInvested: 48000,
    averageBuyPrice: 10.25,
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
    totalInvested: 48000,
    averageBuyPrice: 10.40,
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
    fallbackUrl: "https://bini.com.bd/funds/edge-al-amin-shariah-consumer-fund-759e11aa",
    totalInvested: 48000,
    averageBuyPrice: 10.65,
    monthlySipTarget: 8000,
    defaultNav: 11.30,
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
