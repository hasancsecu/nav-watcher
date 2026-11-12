import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const svgPath = join(process.cwd(), "public/icons/icon.svg");
const svgBuffer = readFileSync(svgPath);

async function generate() {
  console.log("Generating icons from", svgPath);

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(process.cwd(), "public/icons/icon-192x192.png"));
  console.log("Generated icon-192x192.png");

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(process.cwd(), "public/icons/icon-512x512.png"));
  console.log("Generated icon-512x512.png");

  // Maskable 512x512 (with 10% padding for safe area)
  await sharp(svgBuffer)
    .resize(460, 460)
    .extend({
      top: 26,
      bottom: 26,
      left: 26,
      right: 26,
      background: "#070c14",
    })
    .png()
    .toFile(join(process.cwd(), "public/icons/icon-maskable-512x512.png"));
  console.log("Generated icon-maskable-512x512.png");

  // apple-touch-icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(process.cwd(), "public/icons/apple-touch-icon.png"));
  console.log("Generated apple-touch-icon.png");

  // copy to public/favicon.ico
  const icoPng = await sharp(svgBuffer).resize(64, 64).png().toBuffer();
  writeFileSync(join(process.cwd(), "public/favicon.ico"), icoPng);
  console.log("Generated favicon.ico");

  console.log("All app icons successfully generated!");
}

generate().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
