import { AnimationPlayer } from "../animation/animation-player";
import {
  clampPosition,
  setActivityAnchor,
  type AnimationControls,
  type PetContext,
  type Point,
  type WorkArea,
} from "../runtime/pet-context";
import { SettingsClient } from "../config/settings-client";
import {
  migrateUserSettings,
  type UserSettings,
} from "../config/settings";
import { NativeWindow } from "../native/native-window";
import { TrayClient } from "../native/tray-client";
import { loadPet, type LoadedPet } from "../pets/pet-loader";
import { PetManager } from "../pets/pet-manager";
import { parseCatalog } from "../pets/schemas";
import { createTrayHandlers } from "./tray-handlers";
import { CooldownLedger } from "../behaviors/cooldown-ledger";
import { PointerGestureTracker } from "../interactions/pointer-gesture";
import { InteractionRouter } from "../interactions/interaction-router";
import {
  PetMenuController,
  type PetMenuAction,
} from "../interactions/pet-menu-controller";
import { listen } from "@tauri-apps/api/event";
import { RuntimeSessionSwitcher } from "./runtime-session-switcher";
import {
  BodyInteractionTracker,
  identifyPetBodyZone,
  type BodyInteractionResult,
} from "../interactions/body-interaction";
import type { PetScale } from "../native/tray-client";
import { runtimeKindFor } from "./runtime-kind";
import type { PersonalityMode } from "../personality/profiles";
import { fittedPetScale } from "../stage/pet-screen-fit";

export interface DesktopPetRuntime {
  start(): void;
  stop(): void;
  setVisible(visible: boolean): Promise<void>;
  setPaused(paused: boolean): void;
  setPersonality(mode: PersonalityMode): void;
}

interface InteractionMachine {
  request(
    id: string,
    options?: {
      restart?: boolean;
      source?: "autonomous" | "user" | "system";
    },
  ): boolean;
}

interface InteractionNative {
  lockInteraction(locked: boolean): Promise<void>;
}

export interface BodyInteractionInput {
  active(): boolean;
  petOrigin(): Point;
  onResult(result: BodyInteractionResult): void;
}

export function createInitialContext(
  pet: LoadedPet,
  workArea: WorkArea,
  animations: AnimationControls,
  petScale = 1,
): PetContext {
  const idleId = pet.manifest.capabilities.idle;
  const idle = pet.manifest.animations[idleId];
  if (!idle) throw new Error("Pet has no idle animation");
  const atlas = pet.manifest.atlases[idle.atlas];
  if (!atlas) throw new Error("Pet idle atlas is unavailable");
  const effectiveScale = pet.manifest.display.scale * petScale;
  const windowSize = {
    width: Math.round(atlas.cellWidth * effectiveScale),
    height: Math.round(atlas.cellHeight * effectiveScale),
  };
  const sourceBounds = pet.manifest.display.visualBounds;
  const visualBounds = sourceBounds
    ? {
        left: sourceBounds.left * effectiveScale,
        top: sourceBounds.top * effectiveScale,
        right: sourceBounds.right * effectiveScale,
        bottom: sourceBounds.bottom * effectiveScale,
      }
    : undefined;
  const sourceFootAnchor = pet.manifest.display.footAnchor;
  const footAnchor = sourceFootAnchor
    ? {
        x: sourceFootAnchor.x * effectiveScale,
        y: sourceFootAnchor.y * effectiveScale,
      }
    : undefined;
  return {
    position: {
      x: workArea.x + workArea.width - windowSize.width - 32,
      y: workArea.y + workArea.height - windowSize.height,
    },
    workArea,
    windowSize,
    visualBounds,
    footAnchor,
    velocity: { x: 0, y: 0 },
    activityAnchor: null,
    roamingHalfWidth: pet.manifest.behaviorProfile.movement.roamingHalfWidth,
    behaviorProfile: pet.manifest.behaviorProfile,
    elapsedMs: 0,
    cooldowns: new CooldownLedger(),
    personalityMode: "balanced",
    paused: false,
    interactionActive: false,
    drag: {
      active: false,
      pointer: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
    },
    animations,
    random: Math.random,
  };
}

export function installInteractionHandlers(
  canvas: HTMLCanvasElement,
  context: PetContext,
  machine: InteractionMachine,
  native: InteractionNative,
  showContextMenu?: () => void,
  bodyInteraction?: BodyInteractionInput,
): () => void {
  const gestures = new PointerGestureTracker(6);
  const bodyGestures = new BodyInteractionTracker(
    identifyPetBodyZone,
  );
  let bodyPointerId: number | undefined;
  const router = new InteractionRouter(
    context.behaviorProfile,
    context.cooldowns,
    machine,
  );
  let lockQueue: Promise<void> | undefined;
  let interactionLocked = false;
  const setInteractionLocked = (locked: boolean): void => {
    if (locked === interactionLocked) return;
    interactionLocked = locked;
    const applyLock = (): Promise<void> =>
      native.lockInteraction(locked).catch(() => undefined);
    lockQueue = lockQueue
      ? lockQueue.then(applyLock, applyLock)
      : applyLock();
  };
  const pointerDown = (event: PointerEvent): void => {
    if (
      event.button === 0 &&
      bodyInteraction?.active()
    ) {
      bodyPointerId = event.pointerId;
      const origin = bodyInteraction.petOrigin();
      bodyGestures.start(
        {
          x: (event.clientX - origin.x) / context.windowSize.width,
          y: (event.clientY - origin.y) / context.windowSize.height,
        },
        event.timeStamp,
      );
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    const outcome = gestures.down(
      event.pointerId,
      { x: event.clientX, y: event.clientY },
      { button: event.button, scaleFactor: 1 },
    );
    if (outcome !== "pending") {
      if (outcome === "context-menu") {
        event.preventDefault();
        showContextMenu?.();
      }
      return;
    }
    context.drag.active = false;
    context.drag.pointer = { x: event.screenX, y: event.screenY };
    context.drag.offset = { x: event.clientX, y: event.clientY };
    setInteractionLocked(true);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const pointerMove = (event: PointerEvent): void => {
    if (
      event.pointerId === bodyPointerId &&
      bodyInteraction?.active()
    ) {
      const origin = bodyInteraction.petOrigin();
      bodyGestures.move(
        {
          x: (event.clientX - origin.x) / context.windowSize.width,
          y: (event.clientY - origin.y) / context.windowSize.height,
        },
        event.timeStamp,
      );
      return;
    }
    const result = gestures.move(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (result === "ignored" || result === "pending") return;
    context.drag.pointer = { x: event.screenX, y: event.screenY };
    if (result === "drag-start") {
      context.drag.active = true;
      router.onDragStart();
    }
  };
  const pointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === bodyPointerId) {
      const origin = bodyInteraction?.petOrigin() ?? { x: 0, y: 0 };
      const result = bodyGestures.finish(
        {
          x: (event.clientX - origin.x) / context.windowSize.width,
          y: (event.clientY - origin.y) / context.windowSize.height,
        },
        event.timeStamp,
      );
      bodyPointerId = undefined;
      if (result) bodyInteraction?.onResult(result);
      canvas.releasePointerCapture?.(event.pointerId);
      return;
    }
    const result = gestures.end(event.pointerId);
    if (result === "ignored") return;
    if (result === "click") {
      router.onClick(context.elapsedMs);
    } else if (result === "drag-end") {
      context.drag.active = false;
      router.onDragEnd();
    }
    canvas.releasePointerCapture?.(event.pointerId);
    setInteractionLocked(false);
  };
  const pointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === bodyPointerId) {
      bodyPointerId = undefined;
      bodyGestures.cancel();
      canvas.releasePointerCapture?.(event.pointerId);
      return;
    }
    const wasDragging = context.drag.active;
    const result = gestures.cancel(event.pointerId);
    if (result === "ignored") return;
    context.drag.active = false;
    if (wasDragging) router.onDragEnd();
    setInteractionLocked(false);
  };
  const windowBlur = (): void => {
    if (bodyPointerId !== undefined) {
      pointerCancel({ pointerId: bodyPointerId } as PointerEvent);
    }
    const pointerId = gestures.activePointerId;
    if (pointerId === undefined) return;
    pointerCancel({ pointerId } as PointerEvent);
  };
  const preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("lostpointercapture", pointerCancel);
  canvas.addEventListener("contextmenu", preventContextMenu);
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerEnd);
  window.addEventListener("pointercancel", pointerCancel);
  window.addEventListener("blur", windowBlur);
  return () => {
    windowBlur();
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("lostpointercapture", pointerCancel);
    canvas.removeEventListener("contextmenu", preventContextMenu);
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", pointerEnd);
    window.removeEventListener("pointercancel", pointerCancel);
    window.removeEventListener("blur", windowBlur);
  };
}

async function loadCatalog(): Promise<ReturnType<typeof parseCatalog>> {
  const response = await fetch(new URL("pets/catalog.json", document.baseURI));
  if (!response.ok) {
    throw new Error(`Failed to load pet catalog: HTTP ${response.status}`);
  }
  return parseCatalog(await response.json());
}

export async function bootDesktopPet(): Promise<DesktopPetRuntime> {
  const initialCanvas =
    document.querySelector<HTMLCanvasElement>("#pet-canvas");
  if (!initialCanvas) throw new Error("Pet canvas is missing");
  const interactionRoot = document.querySelector<HTMLElement>(
    "#pet-interaction-wheel",
  );
  if (!interactionRoot) {
    throw new Error("Pet interaction wheel is missing");
  }
  const native = new NativeWindow();
  const tray = new TrayClient();
  const settingsClient = new SettingsClient();
  let settings = await settingsClient.read();
  const migratedSettings = migrateUserSettings(settings);
  if (migratedSettings !== settings) {
    settings = migratedSettings;
    await settingsClient.write(settings);
  }
  const testModeEnabled = await settingsClient.readTestModeEnabled();
  if (!testModeEnabled && settings.personalityMode === "test") {
    settings = { ...settings, personalityMode: "balanced" };
    await settingsClient.write(settings);
  }
  const catalog = await loadCatalog();
  const cache = new Map<string, LoadedPet>();
  const loadById = async (id: string): Promise<LoadedPet> => {
    const cached = cache.get(id);
    if (cached) return cached;
    const loaded = await loadPet(new URL(`pets/${id}/`, document.baseURI));
    cache.set(id, loaded);
    return loaded;
  };
  const manager = new PetManager(
    catalog,
    settings.selectedPetId,
    loadById,
    async () => undefined,
  );
  const pet = await manager.initialize();
  await Promise.allSettled(catalog.pets.map((id) => loadById(id)));
  if (settings.selectedPetId !== pet.manifest.id) {
    settings = { ...settings, selectedPetId: pet.manifest.id };
    await settingsClient.write(settings);
  }
  const workArea = await native.primaryWorkArea();
  const saveSettings = async (next: UserSettings): Promise<void> => {
    await settingsClient.write(next);
    settings = next;
  };

  interface RuntimeSession {
    runtime: DesktopPetRuntime;
    context: PetContext;
    petMenu: Pick<PetMenuController, "show" | "handle">;
    position(): Point;
    activityAnchor(): Point | null;
    isSleeping(): boolean;
    dispose: () => void;
  }

  let refreshTray = async (): Promise<void> => undefined;

  const createSession = async (
    loadedPet: LoadedPet,
    previousPosition?: Point,
    previousAnchor?: Point | null,
    scale: PetScale = settings.petScale,
  ): Promise<RuntimeSession> => {
    const currentCanvas =
      document.querySelector<HTMLCanvasElement>("#pet-canvas");
    if (!currentCanvas) throw new Error("Pet canvas is missing");
    const canvas = currentCanvas.cloneNode(false) as HTMLCanvasElement;
    const player = new AnimationPlayer(loadedPet);
    const animations: AnimationControls = {
      play: (capability, restart) => player.play(capability, restart),
      hasCapability: (capability) =>
        Boolean(
          loadedPet.manifest.animations[
            loadedPet.manifest.capabilities[capability] ?? capability
          ],
        ),
      durationMs: (capability) => {
        const animationId =
          loadedPet.manifest.capabilities[capability] ?? capability;
        const animation = loadedPet.manifest.animations[animationId];
        if (!animation) {
          throw new Error(`Unknown animation capability "${capability}"`);
        }
        return (animation.frames.length / animation.fps) * 1_000;
      },
    };
    const effectiveScale = fittedPetScale(
      loadedPet,
      scale,
      workArea,
    );
    const context = createInitialContext(
      loadedPet,
      workArea,
      animations,
      effectiveScale,
    );
    if (previousPosition) {
      context.position = clampPosition(context, previousPosition);
    }
    if (previousAnchor) {
      setActivityAnchor(context, previousAnchor);
      context.position.y = context.activityAnchor!.y;
    }
    context.paused = settings.activityPaused;
    context.personalityMode = settings.personalityMode;
    if (runtimeKindFor(loadedPet.manifest) === "stage") {
      const { createRealtimePetSession } = await import(
        "./realtime-pet-session"
      );
      const realtime = await createRealtimePetSession({
        canvas,
        interactionRoot,
        pet: loadedPet,
        petScale: effectiveScale,
        workArea,
        native,
        previousFootPosition: previousPosition,
        paused: context.paused,
        personalityMode: context.personalityMode,
      });
      const petMenu: Pick<PetMenuController, "show" | "handle"> = {
        show: realtime.showMenu,
        handle: (action) => realtime.performAction(action),
      };
      currentCanvas.replaceWith(canvas);
      return {
        runtime: realtime.runtime,
        context,
        petMenu,
        position: realtime.position,
        activityAnchor: () => null,
        isSleeping: realtime.isSleeping,
        dispose: realtime.dispose,
      };
    }
    throw new Error("Only realtime-v1 pets are supported");
  };

  const initialSession = await createSession(pet);
  const sessions = new RuntimeSessionSwitcher(initialSession);
  await sessions.current.runtime.setVisible(settings.visible);
  sessions.current.runtime.start();

  refreshTray = async (): Promise<void> => {
    await tray.configure({
      pets: catalog.pets.map((id) => ({
        id,
        displayName: cache.get(id)?.manifest.displayName ?? id,
      })),
      selectedPetId: settings.selectedPetId,
      personalityMode: settings.personalityMode,
      testModeEnabled,
      paused: settings.activityPaused,
      sleeping: sessions.current.isSleeping(),
      visible: settings.visible,
      autostart: settings.autostart,
      petScale: settings.petScale,
    });
  };
  const handlers = createTrayHandlers({
    getSettings: () => settings,
    saveSettings,
    async switchPet(id) {
      const replacement = await manager.switchTo(id);
      const previous = sessions.current;
      await sessions.replace(() =>
        createSession(
          replacement,
          previous.position(),
          previous.activityAnchor(),
        ),
      );
    },
    setPaused: (paused) => sessions.current.runtime.setPaused(paused),
    setVisible: (visible) => sessions.current.runtime.setVisible(visible),
    setAutostart: (enabled) => tray.setAutostart(enabled),
    setPersonality: (mode) => sessions.current.runtime.setPersonality(mode),
    async setScale(scale) {
      const previous = sessions.current;
      const currentPet = manager.current;
      if (!currentPet) return;
      await sessions.replace(() =>
        createSession(
          currentPet,
          previous.position(),
          previous.activityAnchor(),
          scale,
        ),
      );
    },
    performPetAction: (action) =>
      sessions.current.petMenu.handle(action),
    refreshTray,
  });
  await tray.setAutostart(settings.autostart);
  await tray.bind(handlers);
  await listen<unknown>("pet-menu://action", (event) => {
    if (
      typeof event.payload === "string" &&
      ["pet", "feed", "play", "sleep", "wake"].includes(event.payload)
    ) {
      void sessions.current.petMenu.handle(event.payload as PetMenuAction);
    }
  });
  await refreshTray();
  return sessions.current.runtime;
}
