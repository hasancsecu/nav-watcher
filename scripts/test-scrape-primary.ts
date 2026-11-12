import { scrapeSingleFund } from "../src/lib/scraper";
import { ensureMasterCatalogSeeded } from "../src/lib/funds-catalog";

async function main() {
  console.log("=== Testing Official Primary AMC Scraping & Fallback ===");
  await ensureMasterCatalogSeeded();

  const testFunds = [
    {
      id: "vipb-sebl-1st-unit-fund-e5221a6a",
      name: "VIPB SEBL 1st Unit Fund",
      primaryUrl: "https://vipbamc.com/fund/vipb-sebl-1st-unit-fund",
      fallbackUrl: "https://bini.com.bd/funds/vipb-sebl-1st-unit-fund-e5221a6a",
    },
    {
      id: "edge-amc-growth-fund-759e11d6",
      name: "EDGE AMC Growth Fund",
      primaryUrl: "https://www.edgeamc.com/nav",
      fallbackUrl: "https://bini.com.bd/funds/edge-amc-growth-fund-759e11d6",
    },
    {
      id: "idlc-aml-shariah-fund-ffb5288f",
      name: "IDLC AML Shariah Fund",
      primaryUrl: "https://idlc.com/aml/nav.php",
      fallbackUrl: "https://bini.com.bd/funds/idlc-aml-shariah-fund-ffb5288f",
    },
    {
      id: "shanta-amanah-shariah-fund-ffb52cac",
      name: "Shanta Amanah Shariah Fund",
      primaryUrl: "https://www.shanta-aml.com/our-funds/shanta-amanah-shariah-fund",
      fallbackUrl: "https://bini.com.bd/funds/shanta-amanah-shariah-fund-ffb52cac",
    },
    {
      id: "midland-bank-growth-fund-4b628ce2",
      name: "Midland Bank Growth Fund",
      primaryUrl: "https://invalid-nonexistent-domain.xyz/fund", // Intentionally invalid to test fallback
      fallbackUrl: "https://bini.com.bd/funds/midland-bank-growth-fund-4b628ce2",
    },
  ];

  for (const fund of testFunds) {
    console.log(`\nTesting: ${fund.name}...`);
    const res = await scrapeSingleFund(fund, { trigger: "TEST_SUITE" });
    console.log("Result:", {
      status: res.status,
      sourceUsed: res.sourceUsed,
      nav: res.nav,
      buyPrice: res.buyPrice,
      sellPrice: res.sellPrice,
      effectiveDate: res.effectiveDate,
      durationMs: res.durationMs,
      urlUsed: res.urlUsed,
    });
  }
}

main().catch(console.error);
