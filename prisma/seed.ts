import fs from "node:fs";
import path from "node:path";

// Load .env.local before importing prisma so tsx scripts use Vercel-provisioned Postgres credentials
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  const { prisma, ensureFundsSeeded } = await import("../src/lib/prisma");
  const { syncAllFundsNav } = await import("../src/lib/scraper");

  try {
    console.log("[Seed] Seeding default Bangladesh Shariah mutual funds...");
    await ensureFundsSeeded();
    console.log("[Seed] Running initial live NAV scrape & history computation...");
    const result = await syncAllFundsNav({ trigger: "STARTUP" });
    console.log(
      `[Seed] Completed: ${result.results
        .map((r) => `${r.fundId}=${r.nav}`)
        .join(", ")}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});
