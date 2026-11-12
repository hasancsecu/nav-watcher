# NAV Watcher — Bangladesh Shariah Mutual Fund Portfolio & SIP Tracker

**NAV Watcher** is a full-stack web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma**, **SQLite**, **Cheerio**, and **node-cron** to track monthly SIP investments across three Bangladeshi Shariah-compliant open-end mutual funds.

---

## 1. Tracked Mutual Funds & Multi-Tier Scraper Targets

The scraper fetches the latest published **Net Asset Value (NAV)** (reflecting the previous trading day's valuation) from each Asset Management Company (AMC) portal, and automatically falls back to its specific **Bini.com.bd** fund page if a primary site is unreachable or fails to parse:

| Mutual Fund | Fund Manager | Primary AMC URL | Fallback URL (`bini.com.bd`) |
| :--- | :--- | :--- | :--- |
| **Shanta Amanah Shariah Fund** | Shanta Asset Management Limited | [shanta-aml.com/.../shanta-amanah-shariah-fund](https://www.shanta-aml.com/our-funds/shanta-amanah-shariah-fund) | [bini.com.bd/.../shanta-amanah-shariah-fund-ffb52cac](https://bini.com.bd/funds/shanta-amanah-shariah-fund-ffb52cac) |
| **IDLC Shariah Fund** | IDLC Asset Management Limited | [idlc.com/aml/shariah_fund.php](https://idlc.com/aml/shariah_fund.php) | [bini.com.bd/.../idlc-aml-shariah-fund-ffb5288f](https://bini.com.bd/funds/idlc-aml-shariah-fund-ffb5288f) |
| **Edge Al-Amin Shariah Consumer Fund** | EDGE AMC Limited | [edgeamc.com/edge-alamin-shariah-consumer-fund](https://www.edgeamc.com/edge-alamin-shariah-consumer-fund) | [bini.com.bd/.../edge-al-amin-shariah-consumer-fund-759e11aa](https://bini.com.bd/funds/edge-al-amin-shariah-consumer-fund-759e11aa) |

---

## 2. Core Features

- **Automated Daily NAV Scraper (`9:05 AM Asia/Dhaka` / `UTC+6`)**:
  - Uses `node-cron` locally (`5 9 * * *` in `Asia/Dhaka` timezone) and Vercel Cron (`vercel.json`) in serverless deployments to automatically scrape the latest NAVs and persist daily `NavSnapshot` and `PortfolioHistory` records.
  - **Manual Trigger**: Click **"Sync NAV Now"** on the dashboard header at any time to fetch live NAVs immediately, or click **"Test Fallback Scraper (bini.com.bd)"** in the telemetry panel to verify the fallback pipeline.
- **SIP Baseline Holdings & Valuation Engine**:
  - Input and update **Total Invested Amount (BDT)**, **Average Buy Price / Cost NAV (BDT)**, and **Monthly SIP Target (BDT)** for each fund anytime.
  - Includes a one-click **"+ Record Monthly SIP (৳8,000)"** helper inside the Update Holdings modal that automatically calculates the new weighted Average Buy Price when a monthly SIP installment executes.
  - Dynamically computes:
    - $\text{Total Units Held} = \frac{\text{Total Invested Amount}}{\text{Average Buy Price}}$
    - $\text{Current Market Value} = \text{Total Units Held} \times \text{Latest Scraped NAV}$
    - $\text{Absolute Gain/Loss (BDT)} = \text{Current Market Value} - \text{Total Invested Amount}$
    - $\text{Return (\%)} = \left(\frac{\text{Absolute Gain/Loss}}{\text{Total Invested Amount}}\right) \times 100$
- **3-Fund Investment Comparison Chart**:
  - **Valuation & Return Bars Mode**: Side-by-side comparison of Invested Capital vs. Current Market Value, Net Gain/Loss, Return %, Cost NAV vs. Live NAV spread, and Portfolio Allocation Weight across all 3 funds.
  - **3-Fund Historical Trajectory Mode**: Multi-line interactive SVG chart comparing all 3 funds over time across **Market Value (BDT)**, **Unit NAV (BDT)**, and **Return (%)**.
- **Portfolio History Line Chart**:
  - Tracks overall **Daily Portfolio Market Value vs. Total Invested Amount** over time using stored daily NAV snapshots.
- **Light & Dark Theme Support**:
  - Full Light and Dark mode support powered by CSS `color-scheme`, `light-dark()` design tokens, FOUC-prevention `<meta name="color-scheme">`, and a header theme toggle that respects OS preferences.

---

## 3. Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + CSS Custom Properties (`light-dark()`) + Lucide Icons
- **Database & ORM**: Prisma + SQLite (zero-config local persistence in `prisma/dev.db`, with automatic `/tmp/dev.db` initialization on Vercel serverless)
- **Web Scraping & Scheduling**: Cheerio + `node-cron`

---

## 4. Getting Started Locally

### Prerequisites
- Node.js 18.18+ (or 20+) and `npm`

### Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize the SQLite database schema**:
   ```bash
   npm run db:push
   ```

3. **Run the parser verification & initial NAV seed**:
   ```bash
   npm run scrape:test
   ```
   *(Optional: pass `-- --live` to fetch directly from the live AMC websites via CLI: `npm run scrape:test -- --live`)*

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Project Structure

```text
├── prisma/
│   └── schema.prisma                  # Fund, NavSnapshot, PortfolioHistory, ScrapeLog models
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── funds/route.ts         # PUT /api/funds — update baseline SIP holdings
│   │   │   ├── portfolio/route.ts     # GET /api/portfolio — full valuation, history & logs
│   │   │   └── scrape/route.ts        # GET & POST /api/scrape — manual & scheduled NAV sync
│   │   ├── globals.css                # Light/Dark tokens, dialog & responsive table rules
│   │   ├── layout.tsx                 # Root layout + FOUC-free color-scheme initialization
│   │   └── page.tsx                   # Server-rendered dashboard entry point
│   ├── components/
│   │   ├── DashboardClient.tsx        # Main interactive dashboard + theme toggle
│   │   ├── FundComparisonChart.tsx    # 3-fund comparison bars & multi-line trajectory chart
│   │   ├── PortfolioHistoryChart.tsx  # Daily portfolio value vs. invested line chart
│   │   └── UpdateHoldingsDialog.tsx   # Native <dialog> modal for editing SIP holdings
│   ├── lib/
│   │   ├── calculations.ts            # Valuation formulas & SIP installment simulator
│   │   ├── prisma.ts                  # Prisma client singleton & default fund seeding
│   │   ├── scheduler.ts               # 9:05 AM Asia/Dhaka (UTC+6) cron scheduler
│   │   └── scraper.ts                 # Primary AMC & Bini.com.bd fallback Cheerio parsers
│   └── instrumentation.ts             # Boots the daily cron scheduler on server startup
├── vercel.json                        # Vercel scheduled cron configuration
└── package.json
```

---

## 6. Deploying to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket or deploy via the Vercel CLI (`npx vercel --prod`).
2. During the build step, `npm run build` automatically runs:
   ```bash
   DATABASE_URL=file:./dev.db prisma db push && prisma generate && next build
   ```
3. `next.config.mjs` includes `outputFileTracingIncludes` to bundle the initialized SQLite database, and `src/lib/prisma.ts` automatically copies it to `/tmp/dev.db` in Vercel's serverless runtime so reads and writes work out-of-the-box without requiring external database setup.

