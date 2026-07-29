import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
} from "@tauri-apps/plugin-autostart";
import type { InvokeFn } from "./native-window";
import {
  personalityModes,
  type PersonalityMode,
} from "../personality/profiles";
import type { PetMenuAction } from "../interactions/pet-menu-controller";

export interface TrayPet {
  id: string;
  displayName: string;
}

export interface TrayState {
  pets: TrayPet[];
  selectedPetId: string;
  personalityMode: PersonalityMode;
  testModeEnabled: boolean;
  paused: boolean;
  sleeping: boolean;
  visible: boolean;
  autostart: boolean;
  petScale: PetScale;
}

export const petScales = [0.75, 1, 1.25, 1.5] as const;
export type PetScale = (typeof petScales)[number];

interface EventLike {
  payload: unknown;
}

type ListenFn = (
  event: string,
  handler: (event: EventLike) => void,
) => Promise<UnlistenFn>;

export interface TrayHandlers {
  selectPet(id: string): void | Promise<void>;
  selectPersonality(mode: PersonalityMode): void | Promise<void>;
  selectScale(scale: PetScale): void | Promise<void>;
  petAction(action: PetMenuAction): void | Promise<void>;
  pause(): void | Promise<void>;
  visibility(): void | Promise<void>;
  autostart(): void | Promise<void>;
}

interface TrayDependencies {
  invoke?: InvokeFn;
  listen?: ListenFn;
  enableAutostart?: () => Promise<void>;
  disableAutostart?: () => Promise<void>;
}

const defaultInvoke: InvokeFn = (command, args) =>
  tauriInvoke(command, args);
const defaultListen: ListenFn = (event, handler) =>
  tauriListen(event, handler);

export class TrayClient {
  private readonly invoke: InvokeFn;
  private readonly listen: ListenFn;
  private readonly enableAutostart: () => Promise<void>;
  private readonly disableAutostart: () => Promise<void>;

  constructor(dependencies: TrayDependencies = {}) {
    this.invoke = dependencies.invoke ?? defaultInvoke;
    this.listen = dependencies.listen ?? defaultListen;
    this.enableAutostart = dependencies.enableAutostart ?? enableAutostart;
    this.disableAutostart = dependencies.disableAutostart ?? disableAutostart;
  }

  async configure(state: TrayState): Promise<void> {
    await this.invoke("configure_tray", { state });
  }

  async bind(handlers: TrayHandlers): Promise<() => void> {
    const unlisten = await Promise.all([
      this.listen("tray://select-pet", (event) => {
        if (typeof event.payload === "string") {
          void handlers.selectPet(event.payload);
        }
      }),
      this.listen("tray://pause", () => {
        void handlers.pause();
      }),
      this.listen("tray://select-personality", (event) => {
        if (
          typeof event.payload === "string" &&
          personalityModes.includes(event.payload as PersonalityMode)
        ) {
          void handlers.selectPersonality(event.payload as PersonalityMode);
        }
      }),
      this.listen("tray://select-scale", (event) => {
        if (
          typeof event.payload === "number" &&
          petScales.includes(event.payload as PetScale)
        ) {
          void handlers.selectScale(event.payload as PetScale);
        }
      }),
      this.listen("tray://pet-action", (event) => {
        if (
          typeof event.payload === "string" &&
          ["pet", "feed", "play", "sleep", "wake"].includes(event.payload)
        ) {
          void handlers.petAction(event.payload as PetMenuAction);
        }
      }),
      this.listen("tray://visibility", () => {
        void handlers.visibility();
      }),
      this.listen("tray://autostart", () => {
        void handlers.autostart();
      }),
    ]);
    return () => {
      for (const dispose of unlisten) dispose();
    };
  }

  async setAutostart(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.enableAutostart();
    } else {
      await this.disableAutostart();
    }
  }
}
