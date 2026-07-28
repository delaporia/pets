import type { CooldownLedger } from "../behaviors/cooldown-ledger";
import type { PersonalityMode } from "../personality/profiles";
import { personalityProfiles } from "../personality/profiles";
import type { BehaviorProfile } from "../pets/schemas";
import type {
  Point,
  Size,
  VisualBounds,
} from "../runtime/pet-context";

interface CursorMachine {
  request(
    id: string,
    options?: { restart?: boolean; source?: "user" },
  ): boolean;
}

interface CursorNative {
  cursorPosition(): Promise<Point>;
}

interface CursorGaze {
  look(directionIndex: number): void;
  clear(): void;
}

export interface CursorProximityState {
  nowMs: number;
  position: Point;
  windowSize: Size;
  visualBounds?: VisualBounds;
  dragging: boolean;
  interactionActive?: boolean;
  activeBehaviorId: string | undefined;
  personalityMode: PersonalityMode;
}

export class CursorProximityController {
  private lastPollMs: number | undefined;
  private inside = false;
  private lastGreetingMs: number | undefined;
  private resumeAfterMs = 0;

  constructor(
    private readonly profile: BehaviorProfile,
    private readonly cooldowns: CooldownLedger,
    private readonly machine: CursorMachine,
    private readonly native: CursorNative,
    private readonly gaze?: CursorGaze,
  ) {
    void this.cooldowns;
  }

  async update(state: CursorProximityState): Promise<boolean> {
    if (
      personalityProfiles[state.personalityMode].pointerInterest ===
        "disabled" ||
      state.dragging ||
      state.interactionActive
    ) {
      this.inside = false;
      this.gaze?.clear();
      return false;
    }
    if (!gazeEligible(state.activeBehaviorId)) {
      this.inside = false;
      this.resumeAfterMs = Math.max(this.resumeAfterMs, state.nowMs + 800);
      this.gaze?.clear();
      return false;
    }
    if (state.nowMs < this.resumeAfterMs) {
      this.inside = false;
      this.gaze?.clear();
      return false;
    }
    if (
      this.lastPollMs !== undefined &&
      state.nowMs - this.lastPollMs < this.profile.interaction.cursorPollMs
    ) {
      return false;
    }
    this.lastPollMs = state.nowMs;

    try {
      const cursor = await this.native.cursorPosition();
      const center = {
        x: state.position.x + state.windowSize.width / 2,
        y: state.position.y + state.windowSize.height / 2,
      };
      const dx = cursor.x - center.x;
      const dy = cursor.y - center.y;
      const bounds = state.visualBounds ?? {
        left: 0,
        top: 0,
        right: state.windowSize.width,
        bottom: state.windowSize.height,
      };
      const exclusionMargin = 20;
      const insideBodyExclusion =
        cursor.x >= state.position.x + bounds.left - exclusionMargin &&
        cursor.x <= state.position.x + bounds.right + exclusionMargin &&
        cursor.y >= state.position.y + bounds.top - exclusionMargin &&
        cursor.y <= state.position.y + bounds.bottom + exclusionMargin;
      if (insideBodyExclusion) {
        this.inside = false;
        this.gaze?.clear();
        return false;
      }
      if (
        dx * dx + dy * dy >
        this.profile.interaction.nearbyRadius ** 2
      ) {
        this.inside = false;
        this.gaze?.clear();
        return false;
      }
      const entered = !this.inside;
      this.inside = true;
      this.gaze?.look(directionIndex(dx, dy));
      const actionId = this.profile.interaction.nearbyAction;
      const pointerInterest =
        personalityProfiles[state.personalityMode].pointerInterest;
      const repeatMs = pointerInterest === "frequent" ? 12_000 : 30_000;
      const greetingDue =
        entered ||
        this.lastGreetingMs === undefined ||
        state.nowMs - this.lastGreetingMs >= repeatMs;
      if (actionId && greetingDue) {
        this.lastGreetingMs = state.nowMs;
        return this.machine.request(`action-${actionId}`, {
          restart: true,
          source: "user",
        });
      }
      return false;
    } catch {
      this.inside = false;
      this.gaze?.clear();
      return false;
    }
  }
}

function gazeEligible(activeBehaviorId: string | undefined): boolean {
  return (
    activeBehaviorId === undefined ||
    activeBehaviorId === "idle" ||
    activeBehaviorId === "walk-left" ||
    activeBehaviorId === "walk-right"
  );
}

function directionIndex(dx: number, dy: number): number {
  const clockwiseFromUp = Math.atan2(dx, -dy);
  const normalized = (clockwiseFromUp + Math.PI * 2) % (Math.PI * 2);
  return Math.round(normalized / (Math.PI / 8)) % 16;
}
