import type { StageEntity } from "../stage/entity";
import { EntityRegistry } from "../stage/entity-registry";

export class SceneScope {
  private readonly entityIds: string[] = [];
  private readonly disposers: Array<() => void> = [];
  private released = false;

  constructor(private readonly registry: EntityRegistry) {}

  add(entity: StageEntity): void {
    if (!entity.transient) {
      throw new Error(
        `Scene entity "${entity.id}" must be transient`,
      );
    }
    this.registry.add(entity);
    this.entityIds.push(entity.id);
  }

  onRelease(dispose: () => void): void {
    if (this.released) {
      dispose();
      return;
    }
    this.disposers.push(dispose);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    for (const id of this.entityIds) {
      this.registry.remove(id);
    }
    for (const dispose of this.disposers.reverse()) {
      dispose();
    }
  }
}
