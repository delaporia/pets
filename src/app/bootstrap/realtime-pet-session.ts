import type { PersonalityMode } from "../personality/profiles";
import type { LoadedPet } from "../pets/pet-loader";
import type { HitMaskPayload } from "../native/native-window";
import type { WorkArea } from "../runtime/pet-context";
import { StageRuntime } from "../runtime/stage-runtime";
import { createPetChasesButterflyScene } from "../scenes/pet-chases-butterfly";
import {
  createPetEatsFoodScene,
  type PetFood,
} from "../scenes/pet-eats-treat";
import {
  createPetPlaysWithToyScene,
  type PetToy,
} from "../scenes/pet-plays-with-toy";
import { SceneDirector } from "../scenes/scene-director";
import type {
  SceneDefinition,
  SceneEntityDeclaration,
} from "../scenes/timeline";
import type { StageEntity } from "../stage/entity";
import { EntityRegistry } from "../stage/entity-registry";
import type { Point, Rect } from "../stage/geometry";
import { PixiDisplayBackend } from "../stage/pixi-display-adapter";
import { createPetPixiViewFactory } from "../stage/pixi-sprite-pet-view";
import { PixiStage } from "../stage/pixi-stage";
import { createSpritePetActor } from "../stage/sprite-pet-actor";
import { WorldCoordinateSystem } from "../stage/world-coordinate-system";
import { InteractionWheelView } from "../interactions/interaction-wheel-view";
import { installStagePetInteractions } from "../interactions/stage-pet-interaction";
import { StageCursorGazeController } from "../interactions/stage-cursor-gaze";
import {
  interactionActionIdForBody,
  interactionActionIdForOption,
  resolvePetInteraction,
  type ResolvedPetInteraction,
} from "../interactions/pet-interaction-resolver";
import { PetSleepController } from "../interactions/pet-sleep-controller";
import type { PetMenuAction } from "../interactions/pet-menu-controller";
import {
  phasedSteps,
  testActionCatalog,
  type TestActionEntry,
} from "../interactions/test-action-catalog";
import { TestActionPreviewController } from "../interactions/test-action-preview-controller";
import { TestActionWheelView } from "../interactions/test-action-wheel-view";
import { petSceneMotionProfileFor } from "../scenes/pet-scene-motion-profile";
import { StageAutonomyController } from "../behaviors/stage-autonomy";
import { createPetAutonomousScene } from "../scenes/pet-autonomous-scene";
import type { BehaviorAction } from "../pets/schemas";
import {
  movementWithinRoamingBounds,
  roamingBoundsFor,
} from "../stage/roaming-boundary";
import {
  clampEntityPositionToWorkArea,
  PET_VIEWPORT_PADDING,
} from "../stage/pet-screen-fit";

interface RealtimeNative {
  resizeAndMove(bounds: Rect): Promise<void>;
  updateHitMask(mask: HitMaskPayload): Promise<void>;
  setVisible(visible: boolean): Promise<void>;
  lockInteraction(locked: boolean): Promise<void>;
  cursorPosition(): Promise<Point>;
}

export interface RealtimePetSessionOptions {
  canvas: HTMLCanvasElement;
  interactionRoot: HTMLElement;
  pet: LoadedPet;
  petScale: number;
  workArea: WorkArea;
  native: RealtimeNative;
  previousFootPosition?: Point;
  paused: boolean;
  personalityMode: PersonalityMode;
}

export interface RealtimePetSession {
  runtime: StageRuntime;
  actor: StageEntity;
  director: SceneDirector;
  position(): Point;
  playButterfly(): Promise<boolean>;
  performAction(action: PetMenuAction): Promise<boolean>;
  isSleeping(): boolean;
  showMenu(): Promise<void>;
  dispose(): void;
}

function initialFootPosition(
  pet: LoadedPet,
  petScale: number,
  workArea: WorkArea,
  previousFootPosition?: Point,
): Point {
  const idle = pet.manifest.animations[
    pet.manifest.capabilities.idle
  ];
  if (!idle) throw new Error("Pet idle animation is unavailable");
  const atlas = pet.manifest.atlases[idle.atlas];
  if (!atlas) throw new Error("Pet idle atlas is unavailable");
  const scale = pet.manifest.display.scale * petScale;
  const foot = pet.manifest.display.footAnchor ?? {
    x: atlas.cellWidth / 2,
    y: atlas.cellHeight,
  };
  if (previousFootPosition) {
    return { ...previousFootPosition };
  }
  return {
    x:
      workArea.x +
      workArea.width -
      atlas.cellWidth * scale -
      32 +
      foot.x * scale,
    y:
      workArea.y +
      workArea.height -
      atlas.cellHeight * scale +
      foot.y * scale,
  };
}

function sceneEntity(
  declaration: SceneEntityDeclaration,
): StageEntity {
  return {
    id: declaration.id,
    kind: declaration.kind,
    layer: declaration.layer,
    transient: true,
    visible: true,
    visual: declaration.visual,
    localBounds: declaration.localBounds
      ? { ...declaration.localBounds }
      : undefined,
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

export async function createRealtimePetSession(
  options: RealtimePetSessionOptions,
): Promise<RealtimePetSession> {
  const {
    canvas,
    interactionRoot,
    pet,
    petScale,
    workArea,
    native,
  } = options;
  const actor = createSpritePetActor(
    pet,
    initialFootPosition(
      pet,
      petScale,
      workArea,
      options.previousFootPosition,
    ),
    petScale,
  );
  actor.transform.position = clampEntityPositionToWorkArea(
    actor,
    workArea,
  );
  let activityAnchor = { ...actor.transform.position };
  const currentRoamingBounds = () =>
    roamingBoundsFor(
      activityAnchor,
      pet.manifest.behaviorProfile.movement.roamingHalfWidth,
      workArea,
      Math.max(72, (actor.localBounds?.width ?? 120) / 2),
    );
  const registry = new EntityRegistry();
  registry.add(actor);
  const director = new SceneDirector(registry, sceneEntity);
  const coordinates = new WorldCoordinateSystem(workArea);
  const bounds = actor.localBounds;
  if (!bounds) throw new Error("Realtime pet bounds are unavailable");
  const initialWidth = Math.ceil(bounds.width + 56);
  const initialHeight = Math.ceil(bounds.height + 56);
  const stage = await PixiStage.create(canvas, {
    width: initialWidth,
    height: initialHeight,
    backend: new PixiDisplayBackend(
      createPetPixiViewFactory(pet, petScale),
    ),
  });
  const testActionLabel =
    document.querySelector<HTMLElement>("#test-action-label");
  const testActions = testActionCatalog(pet.manifest);
  const testPreview = new TestActionPreviewController({
    play: (clip, loop) => {
      director.interrupt("test-action");
      actor.gazeDirectionIndex = undefined;
      actor.animation = {
        clip,
        loop,
        elapsedMs: 0,
      };
    },
    completed: () => {
      testActionLabel?.classList.remove("visible");
      if (testActionLabel) testActionLabel.textContent = "";
    },
    schedule: (callback, delayMs) =>
      window.setTimeout(callback, delayMs),
    cancel: (handle) =>
      window.clearTimeout(handle as number),
  });
  const bodyPreview = new TestActionPreviewController({
    play: (clip, loop) => {
      director.interrupt("body-interaction");
      actor.gazeDirectionIndex = undefined;
      actor.animation = {
        clip,
        loop,
        elapsedMs: 0,
      };
    },
    completed: () => undefined,
    schedule: (callback, delayMs) =>
      window.setTimeout(callback, delayMs),
    cancel: (handle) =>
      window.clearTimeout(handle as number),
  });
  let menuSurface: StageEntity | undefined;
  let bodyInteractionActive = false;
  let latestPetOrigin = { x: 0, y: 0 };
  let personalityMode = options.personalityMode;
  let activityPaused = options.paused;
  const animationDuration = (animationId: string): number => {
    const animation = pet.manifest.animations[animationId];
    return animation
      ? (animation.frames.length / animation.fps) * 1_000
      : 600;
  };
  const sleepController = new PetSleepController(
    pet.manifest.actions.sleep,
    {
      play: (clip, loop) => {
        director.interrupt("sleep-state");
        actor.gazeDirectionIndex = undefined;
        actor.animation = { clip, loop, elapsedMs: 0 };
      },
      durationMs: animationDuration,
      changed: () => undefined,
      schedule: (callback, delayMs) =>
        window.setTimeout(callback, delayMs),
      cancel: (handle) => window.clearTimeout(handle),
    },
  );
  const gaze = new StageCursorGazeController(
    actor,
    native,
    () => menuSurface !== undefined,
  );
  const playAutonomous = (activity: BehaviorAction) => {
    const action =
      activity.id === "walk-around"
        ? "walk"
        : activity.capability === "sleep"
          ? "sleep"
          : activity.capability === "groom"
            ? "groom"
            : activity.capability === "play"
              ? "happyHop"
              : activity.capability === "pet"
                ? "seekAttention"
                : "observe";
    const origin = { ...actor.transform.position };
    const movement = movementWithinRoamingBounds(
      origin,
      currentRoamingBounds(),
      70 + Math.random() * 45,
    );
    const sleep = pet.manifest.actions.sleep;
    const sleepPhases =
      action === "sleep"
        ? {
            ...(sleep.enter
              ? {
                  enter: {
                    clip: sleep.enter,
                    durationMs: animationDuration(sleep.enter),
                  },
                }
              : {}),
            loop: { clip: sleep.loop },
            ...(sleep.exit
              ? {
                  exit: {
                    clip: sleep.exit,
                    durationMs: animationDuration(sleep.exit),
                  },
                }
              : {}),
          }
        : undefined;
    const durationMs =
      activity.playback === "timed"
        ? activity.minDurationMs +
          Math.random() *
            (activity.maxDurationMs - activity.minDurationMs)
        : animationDuration(
            pet.manifest.capabilities[activity.capability] ??
              activity.capability,
          );
    return director.play(
      createPetAutonomousScene({
        petEntityId: actor.id,
        action,
        origin,
        clip:
          action === "walk" || action === "sleep"
            ? undefined
            : activity.capability,
        durationMs,
        direction: movement.direction,
        ...(action === "walk"
          ? { distance: movement.distance }
          : {}),
        ...(sleepPhases ? { phases: sleepPhases } : {}),
      }),
    );
  };
  const autonomy = new StageAutonomyController({
    actions: pet.manifest.behaviorProfile.actions,
    getPersonality: () => personalityMode,
    isBusy: () =>
      activityPaused ||
      menuSurface !== undefined ||
      director.activeSceneId !== undefined ||
      actor.animation?.clip !== "idle",
    play: playAutonomous,
  });
  const syncInteractionLayout = (viewport: Rect): void => {
    if (!menuSurface) return;
    const petOrigin = {
      x:
        actor.transform.position.x +
        bounds.x -
        viewport.x,
      y:
        actor.transform.position.y +
        bounds.y -
        viewport.y,
    };
    latestPetOrigin = petOrigin;
    if (menuSurface) {
      interactionRoot.style.setProperty(
        "--pet-origin-x",
        `${petOrigin.x}px`,
      );
      interactionRoot.style.setProperty(
        "--pet-origin-y",
        `${petOrigin.y}px`,
      );
      interactionRoot.style.setProperty(
        "--pet-width",
        `${bounds.width}px`,
      );
      interactionRoot.style.setProperty(
        "--pet-height",
        `${bounds.height}px`,
      );
      interactionRoot.style.setProperty(
        "--pet-center-y",
        `${petOrigin.y + bounds.height / 2}px`,
      );
    }
  };
  const runtime = new StageRuntime({
    registry,
    director,
    stage,
    native,
    coordinates,
    boundsPadding: PET_VIEWPORT_PADDING,
    hitMaskIntervalMs: 100,
    onLayout: syncInteractionLayout,
    onBeforeRender: async (elapsedMs, deltaMs) => {
      autonomy.update(elapsedMs);
      bodyPreview.update(deltaMs);
      actor.transform.position = clampEntityPositionToWorkArea(
        actor,
        workArea,
      );
      if (menuSurface) {
        if (
          actor.animation?.clip !== pet.manifest.capabilities.idle ||
          actor.animation.loop !== true
        ) {
          actor.animation = {
            clip: pet.manifest.capabilities.idle,
            loop: true,
            elapsedMs: 0,
          };
        }
      }
      if (personalityMode === "test") {
        actor.gazeDirectionIndex = undefined;
        testPreview.update(deltaMs);
        return;
      }
      await gaze.update(elapsedMs);
    },
    onPersonalityChanged: (mode) => {
      personalityMode = mode;
      director.interrupt("personality");
      sleepController.reset();
      testPreview.stop();
      bodyPreview.stop();
      actor.gazeDirectionIndex = undefined;
      testActionLabel?.classList.remove("visible");
      if (testActionLabel) testActionLabel.textContent = "";
    },
    onPausedChanged: (paused) => {
      activityPaused = paused;
    },
  });
  runtime.setPaused(options.paused);
  runtime.setPersonality(options.personalityMode);

  const closeMenuSurface = async (): Promise<void> => {
    if (!menuSurface) return;
    bodyInteractionActive = false;
    registry.remove(menuSurface.id);
    menuSurface = undefined;
    delete interactionRoot.dataset.side;
    sleepController.restoreVisualState();
    await runtime.update(0);
    await native.lockInteraction(false);
  };

  const playInteractionScene = async (
    scene: SceneDefinition,
  ): Promise<boolean> => {
    director.interrupt("replace");
    runtime.setInteractionSceneActive(true);
    runtime.invalidateHitMask();
    try {
      const result = await director.play(scene);
      return result.status === "completed";
    } finally {
      runtime.setInteractionSceneActive(false);
      runtime.invalidateHitMask();
    }
  };

  const playButterfly = async (): Promise<boolean> => {
    const movement = movementWithinRoamingBounds(
      actor.transform.position,
      currentRoamingBounds(),
      220,
    );
    const distance =
      movement.distance >= 180 ? "mid" : "near";
    const scene = createPetChasesButterflyScene({
      petEntityId: actor.id,
      origin: { ...actor.transform.position },
      direction: movement.direction,
      distance,
      distancePx: movement.distance,
      pathVariant: Math.random() < 0.5 ? 1 : 2,
      endingVariant:
        Math.random() < 0.72 ? "escape" : "caught",
      motion: petSceneMotionProfileFor(pet.manifest.id),
    });
    return playInteractionScene(scene);
  };

  const playFood = async (food: PetFood): Promise<boolean> => {
    const movement = movementWithinRoamingBounds(
      actor.transform.position,
      currentRoamingBounds(),
      45,
    );
    return playInteractionScene(
      createPetEatsFoodScene({
        petEntityId: actor.id,
        origin: { ...actor.transform.position },
        direction: movement.direction,
        approachDistancePx: movement.distance,
        food,
      }),
    );
  };

  const playToy = async (toy: PetToy): Promise<boolean> => {
    const movement = movementWithinRoamingBounds(
      actor.transform.position,
      currentRoamingBounds(),
      18,
    );
    return playInteractionScene(
      createPetPlaysWithToyScene({
        petEntityId: actor.id,
        origin: { ...actor.transform.position },
        direction: movement.direction,
        toy,
      }),
    );
  };

  const playTreat = (): Promise<boolean> => playFood("treat");

  const previewFor = (
    resolved: ResolvedPetInteraction,
  ): TestActionEntry | undefined => {
    if (resolved.kind === "semantic") {
      return testActions.find(
        ({ id }) => id === resolved.actionId,
      );
    }
    if (resolved.kind === "phased") {
      return {
        id: resolved.actionId,
        label: resolved.actionId,
        kind: "interaction",
        steps: phasedSteps(pet.manifest, resolved.definition),
      };
    }
    if (resolved.kind === "timeline") {
      return {
        id: resolved.actionId,
        label: resolved.actionId,
        kind: "timeline",
        steps: resolved.definition.stages.map((stage) => ({
          clip: stage.animation,
          durationMs: stage.durationMs,
          loop: false,
        })),
      };
    }
    return undefined;
  };

  const playResolved = async (
    resolved: ResolvedPetInteraction,
  ): Promise<boolean> => {
    if (resolved.kind === "scene") {
      switch (resolved.scene) {
        case "feed-treat":
          return playFood("treat");
        case "feed-kibble":
          return playFood("kibble");
        case "feed-can":
          return playFood("can");
        case "play-butterfly":
          return playButterfly();
        case "play-ball":
          return playToy("ball");
        case "play-wand":
          return playToy("wand");
      }
    }
    const preview = previewFor(resolved);
    if (!preview) return false;
    bodyPreview.start(preview);
    runtime.invalidateHitMask();
    return true;
  };

  const performAction = async (
    action: PetMenuAction,
  ): Promise<boolean> => {
    if (action === "wake") {
      const accepted = await sleepController.wake();
      if (!accepted) return false;
      runtime.invalidateHitMask();
      return true;
    }
    if (action !== "sleep") {
      await sleepController.wakeBeforeInteraction();
    }
    if (action === "play") return playButterfly();
    if (action === "feed") return playTreat();
    if (action === "sleep") {
      const accepted = sleepController.sleep();
      runtime.invalidateHitMask();
      return accepted;
    }
    director.interrupt("interaction");
    actor.animation = {
      clip: "pet",
      loop: false,
      elapsedMs: 0,
    };
    runtime.invalidateHitMask();
    return true;
  };

  let wheel: InteractionWheelView;
  let testWheel: TestActionWheelView;
  const handleWheelClosed = (): void => {
    void closeMenuSurface();
  };
  wheel = new InteractionWheelView(interactionRoot, {
    isAvailable: (option) => {
      if (option === "sleep") return !sleepController.isSleeping;
      if (option === "wake") return sleepController.isSleeping;
      return true;
    },
    enterBodyInteraction: () => {
      bodyInteractionActive = true;
    },
    selectPrimary: async (option) => {
      if (option === "sleep" || option === "wake") {
        await performAction(option);
      }
    },
    select: async (option) => {
      const actionId = interactionActionIdForOption(option);
      wheel.close();
      await sleepController.wakeBeforeInteraction();
      await playResolved(
        resolvePetInteraction(pet.manifest, actionId),
      );
    },
    close: handleWheelClosed,
  });
  testWheel = new TestActionWheelView(interactionRoot, {
    select: async (action) => {
      testActionLabel?.classList.add("visible");
      if (testActionLabel) {
        testActionLabel.textContent = `${action.label} · ${action.id}`;
      }
      if (action.id === "play-butterfly") {
        await playButterfly();
        testActionLabel?.classList.remove("visible");
        return;
      }
      if (action.id === "feed-treat") {
        await playTreat();
        testActionLabel?.classList.remove("visible");
        return;
      }
      testPreview.start(action);
      runtime.invalidateHitMask();
    },
    close: handleWheelClosed,
  });

  const closeActiveMenu = (): void => {
    if (interactionRoot.dataset.phase === "test") {
      testWheel.close();
    } else {
      wheel.close();
    }
  };

  const showMenu = async (): Promise<void> => {
    if (menuSurface) {
      closeActiveMenu();
      return;
    }
    director.interrupt("menu");
    bodyPreview.stop();
    testPreview.stop();
    testActionLabel?.classList.remove("visible");
    if (testActionLabel) testActionLabel.textContent = "";
    actor.animation = {
      clip: pet.manifest.capabilities.idle,
      loop: true,
      elapsedMs: 0,
    };
    const actorBounds = actor.localBounds!;
    const roomOnRight =
      workArea.x + workArea.width - actor.transform.position.x;
    const side = roomOnRight >= 340 ? "right" : "left";
    const extraWidth = 270;
    menuSurface = {
      id: `${actor.id}-interaction-surface`,
      kind: "effect",
      layer: 100,
      transient: true,
      visible: true,
      localBounds: {
        x:
          side === "right"
            ? actorBounds.x
            : actorBounds.x - extraWidth,
        y: Math.min(actorBounds.y, -230),
        width: actorBounds.width + extraWidth,
        height: Math.max(actorBounds.height, 300),
      },
      transform: {
        position: { ...actor.transform.position },
        scale: { x: 1, y: 1 },
        rotation: 0,
        alpha: 0.001,
      },
    };
    interactionRoot.dataset.side = side;
    registry.add(menuSurface);
    await native.lockInteraction(true);
    await runtime.update(0);
    const viewport = coordinates.viewport;
    syncInteractionLayout(viewport);
    if (personalityMode === "test") {
      testWheel.open(testActions);
    } else {
      wheel.open();
    }
  };

  const removeInteractions = installStagePetInteractions(
    canvas,
    actor,
    {
      interrupt: (reason) => director.interrupt(reason),
      lockInteraction: (locked) =>
        native.lockInteraction(locked),
      openMenu: () => {
        void showMenu();
      },
      isMenuOpen: () => menuSurface !== undefined,
      closeMenu: closeActiveMenu,
      onClick: () =>
        personalityMode === "test"
          ? Promise.resolve(false)
          : performAction("pet"),
      bodyInteraction: {
        active: () =>
          personalityMode !== "test" &&
          bodyInteractionActive &&
          interactionRoot.dataset.phase === "body-interaction",
        normalize: (point) => ({
          x: (point.x - latestPetOrigin.x) / bounds.width,
          y: (point.y - latestPetOrigin.y) / bounds.height,
        }),
        onResult: async (result) => {
          bodyInteractionActive = false;
          const actionId = interactionActionIdForBody(result);
          wheel.close();
          await sleepController.wakeBeforeInteraction();
          await playResolved(
            resolvePetInteraction(pet.manifest, actionId),
          );
        },
      },
      positionChanged: (position) => {
        activityAnchor = { ...position };
        if (!menuSurface) return;
        menuSurface.transform.position = { ...position };
      },
      constrainPosition: (position) =>
        clampEntityPositionToWorkArea(actor, workArea, position),
      invalidate: () => runtime.invalidateHitMask(),
    },
  );
  await runtime.update(0);

  return {
    runtime,
    actor,
    director,
    position: () => ({ ...actor.transform.position }),
    playButterfly,
    performAction,
    isSleeping: () => sleepController.isSleeping,
    showMenu,
    dispose: () => {
      sleepController.dispose();
      bodyPreview.stop();
      removeInteractions();
      director.interrupt("dispose");
      if (interactionRoot.dataset.phase !== "closed") {
        closeActiveMenu();
      }
      void native.lockInteraction(false);
      runtime.destroy();
    },
  };
}
