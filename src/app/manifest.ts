import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAV Watcher — Shariah Mutual Fund SIP Tracker",
    short_name: "NAV Watcher",
    description:
      "Track daily NAVs, monthly SIP investments, and live portfolio returns for Shanta Amanah, IDLC Shariah, and Edge Al-Amin funds.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#059669",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
