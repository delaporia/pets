import type { LoadedPet } from "./pet-loader";
import type { Catalog } from "./schemas";

export type PetLoadFn = (id: string) => Promise<LoadedPet>;
export type PetPersistFn = (id: string) => Promise<void>;

export class PetManager {
  current: LoadedPet | undefined;

  constructor(
    private readonly catalog: Catalog,
    private readonly savedPetId: string,
    private readonly load: PetLoadFn,
    private readonly persist: PetPersistFn,
  ) {}

  async initialize(): Promise<LoadedPet> {
    const candidates = Array.from(
      new Set([
        ...(this.catalog.pets.includes(this.savedPetId)
          ? [this.savedPetId]
          : []),
        this.catalog.defaultPet,
        "placeholder",
      ]),
    );
    let lastError: unknown;
    for (const id of candidates) {
      if (!this.catalog.pets.includes(id)) continue;
      try {
        const loaded = await this.load(id);
        if (id !== this.savedPetId) {
          await this.persist(id);
        }
        this.current = loaded;
        return loaded;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("No valid built-in pet is available");
  }

  async switchTo(id: string): Promise<LoadedPet> {
    if (!this.catalog.pets.includes(id)) {
      throw new Error(`Pet "${id}" is not registered`);
    }
    if (this.current?.manifest.id === id) {
      return this.current;
    }
    const replacement = await this.load(id);
    await this.persist(id);
    this.current = replacement;
    return replacement;
  }
}
