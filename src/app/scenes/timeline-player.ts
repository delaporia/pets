import type {
  EntityTransform,
  StageEntity,
} from "../stage/entity";
import { sampleCubicBezier } from "./bezier-path";
import type {
  AnimationKeyframe,
  SceneDefinition,
  SceneEvent,
  TimelineEasing,
  TransformKeyframe,
} from "./timeline";

export type EntityResolver = (
  entityId: string,
) => StageEntity | undefined;

export type SceneEventListener = (event: SceneEvent) => void;

function easingValue(easing: TimelineEasing, progress: number): number {
  switch (easing) {
    case "linear":
      return progress;
    case "easeIn":
      return progress ** 2;
    case "easeOut":
      return 1 - (1 - progress) ** 2;
    case "easeInOut":
      return progress < 0.5
        ? 2 * progress ** 2
        : 1 - (-2 * progress + 2) ** 2 / 2;
  }
}

function interpolate(
  start: number,
  end: number,
  progress: number,
): number {
  return start + (end - start) * progress;
}

function sampleTransform(
  keyframes: readonly TransformKeyframe[],
  elapsedMs: number,
): EntityTransform | undefined {
  const first = keyframes[0];
  if (!first) return undefined;
  if (elapsedMs <= first.atMs) {
    return {
      ...first.value,
      position: { ...first.value.position },
      scale: { ...first.value.scale },
    };
  }
  const last = keyframes.at(-1)!;
  if (elapsedMs >= last.atMs) {
    return {
      ...last.value,
      position: { ...last.value.position },
      scale: { ...last.value.scale },
    };
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index]!;
    const end = keyframes[index + 1]!;
    if (elapsedMs > end.atMs) continue;
    const segmentDuration = end.atMs - start.atMs;
    const rawProgress =
      segmentDuration === 0
        ? 1
        : (elapsedMs - start.atMs) / segmentDuration;
    const progress = easingValue(start.easing, rawProgress);
    const position = start.positionPath
      ? sampleCubicBezier(start.positionPath, progress)
      : {
          x: interpolate(
            start.value.position.x,
            end.value.position.x,
            progress,
          ),
          y: interpolate(
            start.value.position.y,
            end.value.position.y,
            progress,
          ),
        };
    return {
      position,
      scale: {
        x: interpolate(
          start.value.scale.x,
          end.value.scale.x,
          progress,
        ),
        y: interpolate(
          start.value.scale.y,
          end.value.scale.y,
          progress,
        ),
      },
      rotation: interpolate(
        start.value.rotation,
        end.value.rotation,
        progress,
      ),
      alpha: interpolate(
        start.value.alpha,
        end.value.alpha,
        progress,
      ),
    };
  }
  return undefined;
}

function animationAt(
  keyframes: readonly AnimationKeyframe[],
  elapsedMs: number,
): AnimationKeyframe | undefined {
  let active: AnimationKeyframe | undefined;
  for (const keyframe of keyframes) {
    if (keyframe.atMs > elapsedMs) break;
    active = keyframe;
  }
  return active;
}

export class TimelinePlayer {
  private currentElapsedMs = 0;
  private eventCursorMs = -1;

  constructor(
    private readonly scene: SceneDefinition,
    private readonly resolveEntity: EntityResolver,
    private readonly onEvent: SceneEventListener = () => undefined,
  ) {
    if (scene.durationMs <= 0) {
      throw new Error("Scene duration must be positive");
    }
  }

  get elapsedMs(): number {
    return this.currentElapsedMs;
  }

  get complete(): boolean {
    return this.currentElapsedMs >= this.scene.durationMs;
  }

  update(deltaMs: number): void {
    this.currentElapsedMs = Math.min(
      this.scene.durationMs,
      this.currentElapsedMs + Math.max(0, deltaMs),
    );

    for (const track of this.scene.transformTracks) {
      const entity = this.resolveEntity(track.entityId);
      const sampled = sampleTransform(
        track.keyframes,
        this.currentElapsedMs,
      );
      if (!entity || !sampled) continue;
      entity.transform.position = { ...sampled.position };
      entity.transform.scale = { ...sampled.scale };
      entity.transform.rotation = sampled.rotation;
      entity.transform.alpha = sampled.alpha;
    }

    for (const track of this.scene.animationTracks) {
      const entity = this.resolveEntity(track.entityId);
      const keyframe = animationAt(
        track.keyframes,
        this.currentElapsedMs,
      );
      if (!entity || !keyframe) continue;
      entity.animation = {
        clip: keyframe.clip,
        loop: keyframe.loop,
        elapsedMs: this.currentElapsedMs - keyframe.atMs,
      };
    }

    for (const event of this.scene.events) {
      if (
        event.atMs > this.eventCursorMs &&
        event.atMs <= this.currentElapsedMs
      ) {
        this.onEvent(event);
      }
    }
    this.eventCursorMs = this.currentElapsedMs;
  }
}
