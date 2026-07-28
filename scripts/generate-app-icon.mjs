import sharp from "sharp";
import { fileURLToPath } from "node:url";

const size = 512;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="512" height="512" rx="112" fill="#191b2a"/>
  <path d="M146 190 114 94l104 60c24-8 52-8 76 0l104-60-32 96c25 30 40 69 40 112 0 94-67 146-150 146s-150-52-150-146c0-43 15-82 40-112Z" fill="#f4c96b"/>
  <circle cx="205" cy="280" r="23" fill="#191b2a"/>
  <circle cx="307" cy="280" r="23" fill="#191b2a"/>
  <path d="M224 338c20 20 44 20 64 0" fill="none" stroke="#191b2a" stroke-width="18" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(fileURLToPath(new URL("../src-tauri/icons/icon.png", import.meta.url)));

console.log("generated 512x512 application icon");
