import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAV Watcher | Shariah Mutual Fund & SIP Tracker",
  description:
    "Full-stack Mutual Fund Portfolio & Monthly SIP Valuation Tracker for Shanta Amanah Shariah Fund, IDLC Shariah Fund, and Edge Al-Amin Shariah Consumer Fund.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NAV Watcher",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const foucPreventionScript = `
(function() {
  try {
    var stored = localStorage.getItem("color-scheme");
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.content = stored || "light dark";
    }
    var sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var effective = (stored === "light" || stored === "dark") ? stored : (sysDark ? "dark" : "light");
    var root = document.documentElement;
    root.dataset.theme = effective;
    if (effective === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* MANDATORY: Declare support for both light and dark themes & prevent FOUC (modern-web-guidance: dark-mode-toggle) */}
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: foucPreventionScript }} />
      </head>
      <body className="min-h-[100dvh] antialiased selection:bg-emerald-500/25">
        {children}
      </body>
    </html>
  );
}
