import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAV Watcher — BD Mutual Fund SIP Tracker",
    short_name: "NAV Watcher",
    description:
      "Track daily NAVs, monthly SIP investments, and live portfolio returns for Shanta Amanah, IDLC Shariah, and Edge Al-Amin funds.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "window-controls-overlay", "browser"],
    background_color: "#090d16",
    theme_color: "#33c6e4",
    orientation: "portrait-primary",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "Sync NAVs",
        short_name: "Sync",
        url: "/?action=sync",
        description: "Scrape latest mutual fund NAVs immediately",
      },
      {
        name: "Update Holdings",
        short_name: "Holdings",
        url: "/?action=holdings",
        description: "Edit invested amount or average buy price",
      },
    ],
  };
}
