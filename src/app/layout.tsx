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
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#33c6e4" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

const clientBootstrapScript = `
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

  // Register PWA service worker
  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    window.addEventListener("load", function() {
      navigator.serviceWorker.register("/sw.js").catch(function() {});
    });
  }
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
        {/* MANDATORY: Declare support for both light and dark themes & prevent FOUC */}
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Red+Hat+Text:ital,wght@0,300..700;1,300..700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script dangerouslySetInnerHTML={{ __html: clientBootstrapScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-[100dvh] w-full max-w-full overflow-x-clip font-sans antialiased selection:bg-[#33c6e4]/25"
      >
        {children}
      </body>
    </html>
  );
}
