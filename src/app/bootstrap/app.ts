import { AnimationPlayer } from "../animation/animation-player";
import { createDefaultBehaviors } from "../behaviors/registry";
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
import { EventBus } from "../events/event-bus";
import { NativeWindow } from "../native/native-window";
import { TrayClient } from "../native/tray-client";
import { loadPet, type LoadedPet } from "../pets/pet-loader";
import { PetManager } from "../pets/pet-manager";
import { parseCatalog } from "../pets/schemas";
import { CanvasRenderer } from "../renderer/canvas-renderer";
import { PetRuntime } from "../runtime/pet-runtime";
import { BehaviorMachine } from "../state-machine/behavior-machine";
import { createTrayHandlers } from "./tray-handlers";
import { CooldownLedger } from "../behaviors/cooldown-ledger";
import { PointerGestureTracker } from "../interactions/pointer-gesture";
import { InteractionRouter } from "../interactions/interaction-router";
import { CursorProximityController } from "../interactions/cursor-proximity";
import { CareController } from "../care/care-controller";
import {
  defaultPetCareState,
  type PetCareState,
} from "../care/care-state";
import { SemanticInteractionBehavior } from "../behaviors/semantic-interaction";
import {
  PetMenuController,
  type PetMenuAction,
} from "../interactions/pet-menu-controller";
import { listen } from "@tauri-apps/api/event";
import { RuntimeSessionSwitcher } from "./runtime-session-switcher";
import { TestShowcase } from "../behaviors/test-showcase";
import {
  BodyInteractionTracker,
  identifyYingBodyZone,
  type BodyInteractionResult,
} from "../interactions/body-interaction";
import { InteractionWheelView } from "../interactions/interaction-wheel-view";
import { InteractionSurfaceController } from "../interactions/interaction-surface-controller";
import {
  interactionForYingBody,
  interactionForYingSecondary,
} from "../interactions/ying-interaction-profile";
import { PropOverlayView } from "../interactions/prop-overlay-view";
import { CareStatusView } from "../interactions/care-status-view";
import type { PetScale } from "../native/tray-client";
import { TimelineInteractionBehavior } from "../behaviors/timeline-interaction";
import type { InteractionTimelineStage } from "../pets/schemas";

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
  careState: PetCareState = defaultPetCareState(Date.now()),
  petScale: PetScale = 1,
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
    careState,
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
    identifyYingBodyZone,
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

export async function bootDesktopPet(): Promise<PetRuntime> {
  const canvas = document.querySelector<HTMLCanvasElement>("#pet-canvas");
  if (!canvas) throw new Error("Pet canvas is missing");
  const interactionRoot = document.querySelector<HTMLElement>(
    "#pet-interaction-wheel",
  );
  if (!interactionRoot) {
    throw new Error("Pet interaction wheel is missing");
  }
  const propRoot =
    document.querySelector<HTMLElement>("#pet-prop-overlay");
  if (!propRoot) {
    throw new Error("Pet prop overlay is missing");
  }
  const careStatusRoot =
    document.querySelector<HTMLElement>("#pet-care-status");
  if (!careStatusRoot) {
    throw new Error("Pet care status is missing");
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
  const care = new CareController(settings.careByPet);
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
    const persisted = { ...next, careByPet: care.snapshot() };
    await settingsClient.write(persisted);
    settings = persisted;
  };

  interface RuntimeSession {
    runtime: PetRuntime;
    context: PetContext;
    petMenu: PetMenuController;
    dispose: () => void;
  }

  const createSession = async (
    loadedPet: LoadedPet,
    previousPosition?: Point,
    previousAnchor?: Point | null,
    scale: PetScale = settings.petScale,
  ): Promise<RuntimeSession> => {
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
    const context = createInitialContext(
      loadedPet,
      workArea,
      animations,
      care.get(loadedPet.manifest.id),
      scale,
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
    await native.resize(context.windowSize.width, context.windowSize.height);
    const events = new EventBus<{
      behaviorError: { id: string; message: string };
      interactionStage: {
        actionId: string;
        stage: InteractionTimelineStage;
        index: number;
      };
      interactionComplete: {
        actionId: string;
        completed: boolean;
      };
    }>();
    const machine = new BehaviorMachine(context, events, "idle");
    for (const behavior of createDefaultBehaviors(
      loadedPet.manifest.behaviorProfile,
      loadedPet.manifest.actions,
    )) {
      machine.register(behavior);
    }
    const interactionBehaviors = new Map<
      Exclude<PetMenuAction, "wake">,
      SemanticInteractionBehavior
    >();
    for (const [actionId, playback] of [
      ["pet", "once"],
      ["feed", "timed"],
      ["play", "once"],
      ["sleep", "timed"],
    ] as const) {
      const behavior = new SemanticInteractionBehavior(
        actionId,
        loadedPet.manifest.actions[actionId],
        playback,
      );
      interactionBehaviors.set(actionId, behavior);
      machine.register(behavior);
    }
    for (const [actionId, definition] of Object.entries(
      loadedPet.manifest.interactionActions,
    )) {
      if (loadedPet.manifest.interactionTimelines[actionId]) continue;
      machine.register(
        new SemanticInteractionBehavior(
          actionId,
          definition,
          actionId.startsWith("feed-") ? "timed" : "once",
        ),
      );
    }
    for (const [actionId, definition] of Object.entries(
      loadedPet.manifest.interactionTimelines,
    )) {
      machine.register(
        new TimelineInteractionBehavior(actionId, definition, {
          onStage: (id, stage, index) => {
            events.emit("interactionStage", {
              actionId: id,
              stage,
              index,
            });
          },
          onComplete: (id, completed) => {
            events.emit("interactionComplete", {
              actionId: id,
              completed,
            });
          },
        }),
      );
    }
    machine.request("idle");
    const renderer = new CanvasRenderer(
      canvas,
      context.windowSize.width,
      context.windowSize.height,
    );
    const interactionSurface = new InteractionSurfaceController(
      interactionRoot,
      renderer,
      native,
    );
    const cursor = new CursorProximityController(
      context.behaviorProfile,
      context.cooldowns,
      machine,
      native,
      {
        look: (directionIndex) => player.look(directionIndex),
        clear: () => player.clearLook(),
      },
    );
    const label =
      document.querySelector<HTMLElement>("#test-action-label");
    const showcase = new TestShowcase(
      loadedPet.manifest.actions,
      animations,
      {
        show: (text) => {
          if (!label) return;
          label.textContent = text;
          label.classList.add("visible");
        },
        hide: () => {
          if (!label) return;
          label.classList.remove("visible");
          label.textContent = "";
        },
      },
    );
    const runtime = new PetRuntime({
      context,
      machine,
      player,
      renderer,
      native,
      cursor,
      showcase,
    });
    const petMenu = new PetMenuController({
      getMenuState: () => {
        const careState = care.get(loadedPet.manifest.id);
        context.careState = careState;
        return {
          pets: catalog.pets.map((id) => ({
            id,
            displayName: cache.get(id)?.manifest.displayName ?? id,
          })),
          selectedPetId: loadedPet.manifest.id,
          personalityMode: context.personalityMode,
          testModeEnabled,
          paused: context.paused,
          care: careState,
        };
      },
      showMenu: (state) => native.showPetMenu(state),
      requestAction: (behaviorId) =>
        machine.request(`interaction-${behaviorId}`, {
          restart: true,
          source: "user",
        }),
      requestWake: () => {
        const sleep = interactionBehaviors.get("sleep");
        if (!sleep || machine.activeId !== sleep.id) return false;
        sleep.requestExit();
        return true;
      },
      isSleeping: () =>
        machine.activeId === interactionBehaviors.get("sleep")?.id,
      applyCare: (action) => {
        const careState = care.apply(loadedPet.manifest.id, action);
        context.careState = careState;
        return careState;
      },
      persist: () => saveSettings(settings),
    });
    const propOverlay = new PropOverlayView(propRoot);
    const disposeTimelineStage = events.on(
      "interactionStage",
      ({ stage }) => {
        propOverlay.setTimelineStage(stage.propState ?? stage.id);
      },
    );
    const careStatus = new CareStatusView(careStatusRoot);
    const propLayout = () => ({
      petOrigin: interactionSurface.petOrigin,
      petSize: context.windowSize,
      side:
        interactionRoot.dataset.side === "left"
          ? ("left" as const)
          : ("right" as const),
    });
    let bodyInteractionActive = false;
    const closeInteractionSurface = async (): Promise<void> => {
      bodyInteractionActive = false;
      propOverlay.cancel();
      careStatus.hide();
      document.body.classList.remove("body-interaction-active");
      await interactionSurface.close(context);
      runtime.invalidateRender();
      await runtime.update(0);
    };
    const interactionWheel = new InteractionWheelView(interactionRoot, {
      getAffection: () => care.get(loadedPet.manifest.id).affection,
      enterBodyInteraction: () => {
        bodyInteractionActive = true;
        document.body.classList.add("body-interaction-active");
      },
      select: async (option) => {
        if (option === "wake") {
          await petMenu.handle("wake");
          return;
        }
        const interaction = interactionForYingSecondary(option);
        const timeline =
          loadedPet.manifest.interactionTimelines[
            interaction.behaviorId
          ];
        let waitForTimeline: Promise<boolean> | undefined;
        let disposeTimelineCompletion: (() => void) | undefined;
        if (timeline && interaction.prop) {
          propOverlay.beginTimeline(interaction.prop, propLayout());
          waitForTimeline = new Promise<boolean>((resolve) => {
            disposeTimelineCompletion = events.on(
              "interactionComplete",
              (event) => {
                if (event.actionId !== interaction.behaviorId) return;
                disposeTimelineCompletion?.();
                disposeTimelineCompletion = undefined;
                resolve(event.completed);
              },
            );
          });
        }
        const accepted = await petMenu.handle(
          interaction.careAction,
          interaction.behaviorId,
        );
        careStatus.show(
          care.get(loadedPet.manifest.id),
          interactionSurface.statusOrigin,
          context.windowSize.width,
        );
        if (!accepted) {
          disposeTimelineCompletion?.();
          propOverlay.cancel();
          return;
        }
        if (waitForTimeline) {
          await waitForTimeline;
          propOverlay.endTimeline();
        } else if (interaction.prop) {
          await propOverlay.play(interaction.prop, propLayout());
        }
      },
      close: () => {
        void closeInteractionSurface();
      },
    });
    const openInteractionWheel = async (): Promise<void> => {
      if (interactionSurface.isOpen) {
        interactionWheel.close();
        return;
      }
      machine.request("idle", { restart: true, source: "user" });
      await interactionSurface.open(context);
      runtime.invalidateRender();
      await runtime.update(0);
      careStatus.show(
        care.get(loadedPet.manifest.id),
        interactionSurface.statusOrigin,
        context.windowSize.width,
      );
      interactionWheel.open();
    };
    const disposeDrag = installInteractionHandlers(
      canvas,
      context,
      machine,
      native,
      () => {
        if (loadedPet.manifest.id === "ying") {
          void openInteractionWheel();
        } else {
          void petMenu.show();
        }
      },
      loadedPet.manifest.id === "ying"
        ? {
            active: () => bodyInteractionActive,
            petOrigin: () => interactionSurface.petOrigin,
            onResult: (result) => {
              const interaction = interactionForYingBody(result);
              propOverlay.showBodyFeedback(
                interaction.feedback,
                result.zone,
                propLayout(),
              );
              void petMenu.handle(
                interaction.careAction,
                interaction.behaviorId,
              ).then(() => {
                careStatus.show(
                  care.get(loadedPet.manifest.id),
                  interactionSurface.statusOrigin,
                  context.windowSize.width,
                );
              });
            },
          }
        : undefined,
    );
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && interactionSurface.isOpen) {
        interactionWheel.close();
      }
    };
    const closeOnBlur = (): void => {
      if (interactionSurface.isOpen) {
        interactionWheel.close();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", closeOnBlur);
    await runtime.update(0);
    return {
      runtime,
      context,
      petMenu,
      dispose: () => {
        disposeDrag();
        window.removeEventListener("keydown", closeOnEscape);
        window.removeEventListener("blur", closeOnBlur);
        bodyInteractionActive = false;
        propOverlay.cancel();
        careStatus.hide();
        disposeTimelineStage();
        document.body.classList.remove("body-interaction-active");
        if (interactionSurface.isOpen) {
          interactionWheel.close();
        }
      },
    };
  };

  const initialSession = await createSession(pet);
  const sessions = new RuntimeSessionSwitcher(initialSession);
  await sessions.current.runtime.setVisible(settings.visible);
  sessions.current.runtime.start();

  const refreshTray = async (): Promise<void> => {
    await tray.configure({
      pets: catalog.pets.map((id) => ({
        id,
        displayName: cache.get(id)?.manifest.displayName ?? id,
      })),
      selectedPetId: settings.selectedPetId,
      personalityMode: settings.personalityMode,
      testModeEnabled,
      paused: settings.activityPaused,
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
          previous.context.position,
          previous.context.activityAnchor,
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
          previous.context.position,
          previous.context.activityAnchor,
          scale,
        ),
      );
    },
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
