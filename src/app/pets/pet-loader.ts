import { parsePetManifest, type PetManifest } from "./schemas";

export interface LoadedPet {
  manifest: PetManifest;
  images: Map<string, HTMLImageElement>;
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

export async function loadPet(baseUrl: URL): Promise<LoadedPet> {
  const manifest = parsePetManifest(
    await fetchJson(new URL("pet.json", baseUrl)),
  );
  const images = new Map<string, HTMLImageElement>();

  await Promise.all(
    Object.entries(manifest.atlases).map(async ([atlasId, atlas]) => {
      const image = new Image();
      image.src = new URL(atlas.path, baseUrl).toString();
      await image.decode();

      const expectedWidth = atlas.cellWidth * atlas.columns;
      const expectedHeight = atlas.cellHeight * atlas.rows;
      if (
        image.naturalWidth !== expectedWidth ||
        image.naturalHeight !== expectedHeight
      ) {
        throw new Error(
          `Atlas ${atlasId} expected ${expectedWidth}x${expectedHeight}, ` +
            `received ${image.naturalWidth}x${image.naturalHeight}`,
        );
      }
      images.set(atlasId, image);
    }),
  );

  return { manifest, images };
}
