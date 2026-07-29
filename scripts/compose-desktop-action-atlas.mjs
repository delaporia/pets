import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const FRAME_COUNT = 8;
const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const CONTENT_WIDTH = 182;
const CONTENT_HEIGHT = 200;

function parseArgs(argv) {
  const values = { rows: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--row") {
      const value = argv[++index];
      const separator = value?.indexOf("=");
      if (!value || separator < 1) {
        throw new Error("--row expects name=/absolute/or/relative/path.png");
      }
      values.rows.push({
        name: value.slice(0, separator),
        source: value.slice(separator + 1),
      });
    } else if (argument === "--output") {
      values.output = argv[++index];
    } else if (argument === "--manifest") {
      values.manifest = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!values.output || !values.manifest || values.rows.length === 0) {
    throw new Error("Usage: --row name=strip.png [...] --output atlas.webp --manifest atlas.json");
  }

  return values;
}

async function splitAndTrim(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height || info.channels !== 4) {
    throw new Error(`Unable to read image dimensions: ${source}`);
  }

  const pixelCount = info.width * info.height;
  const labels = new Int32Array(pixelCount);
  labels.fill(-1);
  const queue = new Int32Array(pixelCount);
  const components = [];

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (labels[pixel] !== -1 || data[pixel * 4 + 3] <= 4) continue;
    const id = components.length;
    let head = 0;
    let tail = 0;
    let count = 0;
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    labels[pixel] = id;
    queue[tail++] = pixel;

    while (head < tail) {
      const current = queue[head++];
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbours = [current - 1, current + 1, current - info.width, current + info.width];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || neighbour >= pixelCount || labels[neighbour] !== -1) continue;
        const neighbourX = neighbour % info.width;
        if (Math.abs(neighbourX - x) > 1 || data[neighbour * 4 + 3] <= 4) continue;
        labels[neighbour] = id;
        queue[tail++] = neighbour;
      }
    }
    components.push({ id, count, minX, maxX, minY, maxY });
  }

  const characters = components
    .sort((left, right) => right.count - left.count)
    .slice(0, FRAME_COUNT)
    .sort((left, right) => left.minX - right.minX);
  if (characters.length !== FRAME_COUNT || characters.some((component) => component.count < 10_000)) {
    throw new Error(`Expected eight character silhouettes in ${source}`);
  }

  return characters.map((component) => {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    const isolated = Buffer.alloc(width * height * 4);
    for (let y = component.minY; y <= component.maxY; y += 1) {
      for (let x = component.minX; x <= component.maxX; x += 1) {
        const sourcePixel = y * info.width + x;
        if (labels[sourcePixel] !== component.id) continue;
        const targetPixel = (y - component.minY) * width + (x - component.minX);
        data.copy(isolated, targetPixel * 4, sourcePixel * 4, sourcePixel * 4 + 4);
      }
    }

    return {
      data: sharp(isolated, { raw: { width, height, channels: 4 } }).png().toBuffer(),
      sourceSlot: {
        left: component.minX,
        top: component.minY,
        width,
        height,
      },
      trimmed: { width, height },
    };
  });
}

async function normalizeRow(row) {
  const frames = await splitAndTrim(row.source);
  const maxWidth = Math.max(...frames.map((frame) => frame.trimmed.width));
  const maxHeight = Math.max(...frames.map((frame) => frame.trimmed.height));
  const scale = Math.min(CONTENT_WIDTH / maxWidth, CONTENT_HEIGHT / maxHeight, 1);

  const normalized = [];
  for (const frame of frames) {
    const width = Math.max(1, Math.round(frame.trimmed.width * scale));
    const height = Math.max(1, Math.round(frame.trimmed.height * scale));
    const sprite = await sharp(await frame.data)
      .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    const left = Math.round((CELL_WIDTH - width) / 2);
    const top = CELL_HEIGHT - height - 4;
    const cell = await sharp({
      create: {
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: sprite, left, top }])
      .png()
      .toBuffer();

    normalized.push({
      cell,
      sourceSlot: frame.sourceSlot,
      trimmed: frame.trimmed,
      placed: { left, top, width, height },
    });
  }

  return {
    name: row.name,
    source: row.source,
    scale,
    frames: normalized,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = [];
  for (const row of args.rows) {
    rows.push(await normalizeRow(row));
  }

  const width = CELL_WIDTH * FRAME_COUNT;
  const height = CELL_HEIGHT * rows.length;
  const composites = rows.flatMap((row, rowIndex) =>
    row.frames.map((frame, frameIndex) => ({
      input: frame.cell,
      left: frameIndex * CELL_WIDTH,
      top: rowIndex * CELL_HEIGHT,
    })),
  );
  const atlas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites);

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  const outputExtension = path.extname(args.output).toLowerCase();
  if (outputExtension === ".webp") {
    await atlas.webp({ lossless: true, effort: 6 }).toFile(args.output);
  } else {
    await atlas.png().toFile(args.output);
  }

  const manifest = {
    schemaVersion: 1,
    output: args.output,
    width,
    height,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    columns: FRAME_COUNT,
    rows: rows.map((row, rowIndex) => ({
      name: row.name,
      row: rowIndex,
      source: row.source,
      scale: row.scale,
      frames: row.frames.map(({ sourceSlot, trimmed, placed }, frame) => ({
        frame,
        sourceSlot,
        trimmed,
        placed,
      })),
    })),
  };
  await fs.writeFile(args.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
