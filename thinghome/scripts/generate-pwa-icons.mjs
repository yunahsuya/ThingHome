import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "public", "icons");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#c9956a"/>
  <text x="256" y="310" text-anchor="middle" fill="white" font-size="180" font-weight="700" font-family="system-ui,sans-serif">TH</text>
</svg>`;

await mkdir(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(join(outDir, `icon-${size}x${size}.png`), png);
}

console.log("Generated PWA icons in public/icons/");
