import sharp from "sharp";
import { fileURLToPath } from "node:url";

const cellWidth = 192;
const cellHeight = 208;
const columns = 8;
const rows = 11;
const poses = [];

for (let row = 0; row < 3; row += 1) {
  const frameCount = row === 0 ? 6 : 8;
  for (let column = 0; column < frameCount; column += 1) {
    const x = column * cellWidth;
    const y = row * cellHeight;
    const bob = row === 0 ? column % 2 : column % 2 === 0 ? 0 : 4;
    const stride = row === 0 ? 0 : column % 2 === 0 ? -8 : 8;
    const facing = row === 2 ? -1 : 1;
    poses.push(`
      <g transform="translate(${x} ${y + bob})">
        <path d="M54 78 40 34l43 25c10-4 20-4 30 0l43-25-14 44c10 13 16 30 16 48 0 42-27 66-62 66s-62-24-62-66c0-18 6-35 20-48Z" fill="#f4c96b" stroke="#191b2a" stroke-width="7"/>
        <circle cx="76" cy="112" r="8" fill="#191b2a"/>
        <circle cx="116" cy="112" r="8" fill="#191b2a"/>
        <path d="M84 140c8 8 16 8 24 0" fill="none" stroke="#191b2a" stroke-width="6" stroke-linecap="round"/>
        <path d="M${72 + stride * facing} 180v12M${120 - stride * facing} 180v12" stroke="#191b2a" stroke-width="9" stroke-linecap="round"/>
      </g>`);
  }
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth * columns}" height="${cellHeight * rows}" viewBox="0 0 ${cellWidth * columns} ${cellHeight * rows}">
  ${poses.join("\n")}
</svg>`;

const output = fileURLToPath(
  new URL(
    "../src/assets/pets/placeholder/spritesheet.webp",
    import.meta.url,
  ),
);
await sharp(Buffer.from(svg)).webp({ lossless: true }).toFile(output);
console.log("generated 1536x2288 placeholder atlas");
