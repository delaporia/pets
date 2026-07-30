import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const COLUMNS = 8;

function parseArgs(argv) {
  const rows = [];
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--row") {
      rows.push(argv[++index]);
    } else if (argv[index] === "--output") {
      output = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }
  if (!output || rows.length === 0 || rows.some((row) => !row)) {
    throw new Error("Usage: --row frames-dir [...] --output atlas.webp");
  }
  return { rows, output };
}

async function framePath(directory, column) {
  const filename = `${String(column).padStart(2, "0")}.png`;
  const direct = path.join(directory, filename);
  try {
    await fs.access(direct);
    return direct;
  } catch {
    const nested = path.join(directory, "running-right", filename);
    await fs.access(nested);
    return nested;
  }
}

async function main() {
  const { rows, output } = parseArgs(process.argv.slice(2));
  const composites = [];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      composites.push({
        input: await framePath(rows[row], column),
        left: column * CELL_WIDTH,
        top: row * CELL_HEIGHT,
      });
    }
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  const atlas = sharp({
    create: {
      width: CELL_WIDTH * COLUMNS,
      height: CELL_HEIGHT * rows.length,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites);
  if (path.extname(output).toLowerCase() === ".webp") {
    await atlas.webp({ lossless: true, effort: 6 }).toFile(output);
  } else {
    await atlas.png().toFile(output);
  }
}

await main();
