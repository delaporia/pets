export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WorkArea extends Point, Size {}

export interface VisualBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AnimationControls {
  play(capability: string, restart?: boolean): void;
  hasCapability(capability: string): boolean;
  durationMs(capability: string): number;
}

export interface PetContext {
  position: Point;
  workArea: WorkArea;
  windowSize: Size;
  visualBounds?: VisualBounds;
  footAnchor?: Point;
  velocity: Point;
  activityAnchor: Point | null;
  roamingHalfWidth: number;
  behaviorProfile: BehaviorProfile;
  careState: PetCareState;
  elapsedMs: number;
  cooldowns: CooldownLedger;
  personalityMode: import("../personality/profiles").PersonalityMode;
  paused: boolean;
  interactionActive?: boolean;
  drag: {
    active: boolean;
    pointer: Point;
    offset: Point;
  };
  animations: AnimationControls;
  random: () => number;
}

export function clampPosition(context: PetContext, point: Point): Point {
  const bounds = context.visualBounds ?? {
    left: 0,
    top: 0,
    right: context.windowSize.width,
    bottom: context.windowSize.height,
  };
  return {
    x: Math.min(
      context.workArea.x + context.workArea.width - bounds.right,
      Math.max(context.workArea.x - bounds.left, point.x),
    ),
    y: Math.min(
      context.workArea.y + context.workArea.height - bounds.bottom,
      Math.max(context.workArea.y - bounds.top, point.y),
    ),
  };
}

export function setActivityAnchor(
  context: PetContext,
  point: Point = context.position,
): void {
  context.activityAnchor = clampPosition(context, point);
}

export function clampActivityAnchor(context: PetContext): void {
  if (!context.activityAnchor) return;
  context.activityAnchor = clampPosition(context, context.activityAnchor);
}
import type { CooldownLedger } from "../behaviors/cooldown-ledger";
import type { BehaviorProfile } from "../pets/schemas";
import type { PetCareState } from "../care/care-state";
