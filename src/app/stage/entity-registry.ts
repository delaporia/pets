import type { StageEntity } from "./entity";

interface RegistryEntry {
  entity: StageEntity;
  insertionOrder: number;
}

export class EntityRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private nextInsertionOrder = 0;

  add(entity: StageEntity): void {
    if (this.entries.has(entity.id)) {
      throw new Error(`Duplicate entity "${entity.id}"`);
    }
    this.entries.set(entity.id, {
      entity,
      insertionOrder: this.nextInsertionOrder,
    });
    this.nextInsertionOrder += 1;
  }

  get(id: string): StageEntity | undefined {
    return this.entries.get(id)?.entity;
  }

  remove(id: string): StageEntity | undefined {
    const entry = this.entries.get(id);
    this.entries.delete(id);
    return entry?.entity;
  }

  ordered(): StageEntity[] {
    return [...this.entries.values()]
      .sort(
        (left, right) =>
          left.entity.layer - right.entity.layer ||
          left.insertionOrder - right.insertionOrder,
      )
      .map(({ entity }) => entity);
  }

  clearTransient(): void {
    for (const [id, { entity }] of this.entries) {
      if (entity.transient) {
        this.entries.delete(id);
      }
    }
  }
}
