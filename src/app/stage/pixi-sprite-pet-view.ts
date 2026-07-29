import {
  Container,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";

import type { LoadedPet } from "../pets/pet-loader";
import {
  createDefaultPixiView,
  type PixiViewFactory,
  type SnapshotView,
} from "./pixi-display-adapter";
import type { StageDisplaySnapshot } from "./pixi-stage";
import {
  spriteFrameFor,
  spriteFrameForGaze,
} from "./sprite-pet-actor";

class SpritePetView extends Container implements SnapshotView {
  private readonly sprite = new Sprite(Texture.EMPTY);
  private readonly textures = new Map<string, Texture>();

  constructor(
    private readonly pet: LoadedPet,
    petScale: number,
  ) {
    super();
    const idleId = pet.manifest.capabilities.idle;
    const idle = pet.manifest.animations[idleId];
    const atlas = idle
      ? pet.manifest.atlases[idle.atlas]
      : undefined;
    if (!idle || !atlas) {
      throw new Error("Pet idle atlas is unavailable");
    }
    const foot = pet.manifest.display.footAnchor ?? {
      x: atlas.cellWidth / 2,
      y: atlas.cellHeight,
    };
    this.sprite.anchor.set(
      foot.x / atlas.cellWidth,
      foot.y / atlas.cellHeight,
    );
    const displayScale = pet.manifest.display.scale * petScale;
    this.sprite.scale.set(displayScale);
    this.addChild(this.sprite);
  }

  syncStageSnapshot(snapshot: StageDisplaySnapshot): void {
    const animation = snapshot.animation;
    if (!animation) return;
    const frame =
      snapshot.gazeDirectionIndex === undefined
        ? spriteFrameFor(this.pet, animation)
        : spriteFrameForGaze(
            this.pet,
            snapshot.gazeDirectionIndex,
          );
    const key = [
      frame.atlasId,
      frame.row,
      frame.column,
    ].join(":");
    let texture = this.textures.get(key);
    if (!texture) {
      const sourceTexture = Texture.from(frame.image);
      texture = new Texture({
        source: sourceTexture.source,
        frame: new Rectangle(
          frame.column * frame.cellWidth,
          frame.row * frame.cellHeight,
          frame.cellWidth,
          frame.cellHeight,
        ),
      });
      this.textures.set(key, texture);
    }
    this.sprite.texture = texture;
  }

  override destroy(options?: Parameters<Container["destroy"]>[0]): void {
    for (const texture of this.textures.values()) {
      texture.destroy(false);
    }
    this.textures.clear();
    super.destroy(options);
  }
}

export function createPetPixiViewFactory(
  pet: LoadedPet,
  petScale: number,
): PixiViewFactory {
  return (snapshot) =>
    snapshot.visual === "pet-sprite"
      ? new SpritePetView(pet, petScale)
      : createDefaultPixiView(snapshot);
}
