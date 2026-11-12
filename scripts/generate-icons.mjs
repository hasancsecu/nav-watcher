import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");
const iconsDir = path.join(publicDir, "icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Crisp, modern SVG for NAV Watcher with emerald gradient and financial shield
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="50%" stop-color="#059669" />
      <stop offset="100%" stop-color="#0f766e" />
    </linearGradient>
    <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#6ee7b7" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.28" />
    </filter>
  </defs>

  <!-- Background Squircle -->
  <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#bgGrad)" />
  <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#accentGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="4" />

  <!-- Shield Shape -->
  <g filter="url(#glow)">
    <path d="M256 96 C336 96 384 128 384 128 C384 272 320 368 256 400 C192 368 128 272 128 128 C128 128 176 96 256 96 Z"
          fill="#091e17" stroke="#34d399" stroke-width="12" stroke-linejoin="round" />
  </g>

  <!-- Financial Trend Line & Candlestick/Bars -->
  <!-- Bar 1 -->
  <rect x="176" y="240" width="22" height="70" rx="6" fill="#10b981" opacity="0.85" />
  <!-- Bar 2 -->
  <rect x="216" y="200" width="22" height="110" rx="6" fill="#34d399" opacity="0.9" />
  <!-- Bar 3 -->
  <rect x="256" y="220" width="22" height="90" rx="6" fill="#10b981" opacity="0.85" />
  <!-- Bar 4 -->
  <rect x="296" y="160" width="22" height="150" rx="6" fill="#6ee7b7" />

  <!-- Upward Trend Arrow Line -->
  <path d="M168 260 L 220 210 L 260 230 L 328 150" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
  <polygon points="334,136 342,166 312,156" fill="#ffffff" />

  <!-- Sparkle in top right of shield -->
  <circle cx="340" cy="148" r="8" fill="#fef08a" />
</svg>
`.trim();

fs.writeFileSync(path.join(iconsDir, "icon.svg"), svgIcon);

async function generatePngs() {
  const svgBuffer = Buffer.from(svgIcon);

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, "icon-192x192.png"));

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "icon-512x512.png"));

  // 180x180 (Apple touch icon)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, "apple-touch-icon.png"));

  // 512x512 maskable (with safe zone padding)
  const maskableSvg = svgIcon.replace(
    'viewBox="0 0 512 512"',
    'viewBox="-64 -64 640 640"'
  );
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "icon-maskable-512x512.png"));

  // Also write to public/favicon.png and public/apple-touch-icon.png
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, "apple-touch-icon.png"));

  console.log("Successfully generated all PWA icons in public/icons/");
}

generatePngs().catch(console.error);
