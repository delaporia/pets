import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { WorkArea } from "../runtime/pet-context";
import type { PetMenuState } from "../interactions/pet-menu-controller";
import type { Rect } from "../stage/geometry";

export type InvokeFn = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export interface HitMaskPayload {
  width: number;
  height: number;
  threshold: number;
  pixels: number[];
}

const defaultInvoke: InvokeFn = (command, args) =>
  tauriInvoke(command, args);

export class NativeWindow {
  constructor(private readonly invoke: InvokeFn = defaultInvoke) {}

  async primaryWorkArea(): Promise<WorkArea & { scaleFactor: number }> {
    return (await this.invoke("primary_work_area")) as WorkArea & {
      scaleFactor: number;
    };
  }

  async move(x: number, y: number): Promise<void> {
    await this.invoke("move_pet_window", { x, y });
  }

  async cursorPosition(): Promise<{ x: number; y: number }> {
    return (await this.invoke("cursor_position")) as {
      x: number;
      y: number;
    };
  }

  async resize(width: number, height: number): Promise<void> {
    await this.invoke("resize_pet_window", { width, height });
  }

  async resizeAndMove(bounds: Rect): Promise<void> {
    await this.invoke("resize_and_move_pet_window", { ...bounds });
  }

  async setVisible(visible: boolean): Promise<void> {
    await this.invoke("set_pet_visible", { visible });
  }

  async updateHitMask(mask: HitMaskPayload): Promise<void> {
    await this.invoke("update_hit_mask", { mask });
  }

  async lockInteraction(locked: boolean): Promise<void> {
    await this.invoke("lock_pet_interaction", { locked });
  }

  async showPetMenu(state: PetMenuState): Promise<void> {
    await this.invoke("show_pet_menu", { state });
  }
}
