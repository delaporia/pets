import {
  copyFile,
  mkdir,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { sanitizeFrame } from "./lib/sprite-components.mjs";

const root = resolve("src/assets/pets");
const write = process.argv.includes("--write");
const backupArgument = process.argv.find((argument) =>
  argument.startsWith("--backup-dir="),
);
const backupDirectory = backupArgument
  ? resolve(backupArgument.slice("--backup-dir=".length))
  : undefined;
const catalog = JSON.parse(
  await readFile(join(root, "catalog.json"), "utf8"),
);

let totalRemoved = 0;
for (const petId of catalog.pets) {
  const petRoot = join(root, petId);
  const manifest = JSON.parse(
    await readFile(join(petRoot, "pet.json"), "utf8"),
  );
  for (const [atlasId, atlas] of Object.entries(manifest.atlases)) {
    const atlasPath = join(petRoot, atlas.path);
    const { data, info } = await sharp(atlasPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sanitizedAtlas = Buffer.from(data);
    let atlasRemoved = 0;

    for (let row = 0; row < atlas.rows; row += 1) {
      for (let column = 0; column < atlas.columns; column += 1) {
        const frame = extractFrame(
          data,
          info.width,
          atlas.cellWidth,
          atlas.cellHeight,
          row,
          column,
        );
        const sanitized = sanitizeFrame({
          data: frame,
          width: atlas.cellWidth,
          height: atlas.cellHeight,
        });
        if (sanitized.removedComponents.length === 0) continue;
        atlasRemoved += sanitized.removedComponents.length;
        replaceFrame(
          sanitizedAtlas,
          info.width,
          atlas.cellWidth,
          atlas.cellHeight,
          row,
          column,
          sanitized.data,
        );
        console.log(
          `${petId}/${atlasId} row ${row} column ${column}: ` +
            `remove ${sanitized.removedComponents.length} fragment(s)`,
        );
      }
    }

    totalRemoved += atlasRemoved;
    if (!write || atlasRemoved === 0) continue;
    if (backupDirectory) {
      await mkdir(backupDirectory, { recursive: true });
      await copyFile(
        atlasPath,
        join(backupDirectory, `${petId}-${atlasId}-${basename(atlas.path)}`),
      );
    }
    const temporaryPath = `${atlasPath}.sanitize.tmp.webp`;
    await sharp(sanitizedAtlas, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .webp({ lossless: true, effort: 6 })
      .toFile(temporaryPath);
    const verified = await sharp(temporaryPath)
      .ensureAlpha()
      .raw()
      .toBuffer();
    if (!visiblePixelsEqual(verified, sanitizedAtlas)) {
      await unlink(temporaryPath);
      throw new Error(`${petId}/${atlasId}: lossless verification failed`);
    }
    await rename(temporaryPath, atlasPath);
  }
}

console.log(
  write
    ? `removed ${totalRemoved} fragment(s)`
    : `dry run: found ${totalRemoved} fragment(s); pass --write to remove`,
);

function extractFrame(
  atlasData,
  atlasWidth,
  cellWidth,
  cellHeight,
  row,
  column,
) {
  const frame = Buffer.alloc(cellWidth * cellHeight * 4);
  for (let y = 0; y < cellHeight; y += 1) {
    const sourceStart =
      ((row * cellHeight + y) * atlasWidth + column * cellWidth) * 4;
    atlasData.copy(
      frame,
      y * cellWidth * 4,
      sourceStart,
      sourceStart + cellWidth * 4,
    );
  }
  return frame;
}

function replaceFrame(
  atlasData,
  atlasWidth,
  cellWidth,
  cellHeight,
  row,
  column,
  frame,
) {
  for (let y = 0; y < cellHeight; y += 1) {
    const targetStart =
      ((row * cellHeight + y) * atlasWidth + column * cellWidth) * 4;
    frame.copy(
      atlasData,
      targetStart,
      y * cellWidth * 4,
      (y + 1) * cellWidth * 4,
    );
  }
}

function visiblePixelsEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index += 4) {
    if (actual[index + 3] !== expected[index + 3]) return false;
    if (
      expected[index + 3] > 0 &&
      (actual[index] !== expected[index] ||
        actual[index + 1] !== expected[index + 1] ||
        actual[index + 2] !== expected[index + 2])
    ) {
      return false;
    }
  }
  return true;
}
