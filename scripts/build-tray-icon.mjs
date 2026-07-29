import process from "node:process";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error("Usage: node scripts/build-tray-icon.mjs input.png output.png");
}

const trimmed = await sharp(input)
  .trim({
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    threshold: 4,
  })
  .png()
  .toBuffer();

const portrait = await sharp(trimmed)
  .resize({
    width: 30,
    height: 30,
    fit: "inside",
    kernel: sharp.kernel.lanczos3,
  })
  .sharpen({ sigma: 0.55 })
  .png()
  .toBuffer();
const metadata = await sharp(portrait).metadata();
if (!metadata.width || !metadata.height) {
  throw new Error("Unable to determine resized tray icon dimensions");
}

await sharp({
  create: {
    width: 32,
    height: 32,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    {
      input: portrait,
      left: Math.round((32 - metadata.width) / 2),
      top: Math.round((32 - metadata.height) / 2),
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(output);

process.stdout.write(`wrote ${output}\n`);
