import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAV Watcher | Bangladesh Shariah Mutual Fund & SIP Tracker",
  description:
    "Full-stack Mutual Fund Portfolio & Monthly SIP Valuation Tracker for Shanta Amanah Shariah Fund, IDLC Shariah Fund, and Edge Al-Amin Shariah Consumer Fund.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}

