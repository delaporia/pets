import type { PersonalityMode } from "../personality/profiles";
import { personalityCategoryMultiplier } from "../personality/action-weights";
import type { BehaviorAction } from "../pets/schemas";

export type AutonomyWeights = Record<string, number>;

interface AutonomousSceneResult {
  status: "completed" | "interrupted";
}

export interface StageAutonomyDependencies {
  actions: readonly BehaviorAction[];
  getPersonality(): PersonalityMode;
  isBusy(): boolean;
  play(action: BehaviorAction): Promise<AutonomousSceneResult>;
  completed?(action: BehaviorAction): void | Promise<void>;
  random?: () => number;
  initialDelayMs?: number;
}

export function autonomyWeights(
  actions: readonly BehaviorAction[],
  mode: PersonalityMode,
): AutonomyWeights {
  return Object.fromEntries(
    actions.map((action) => [
      action.id,
      action.weight *
        personalityCategoryMultiplier(action.category, mode),
    ]),
  );
}

function intervalFor(
  mode: PersonalityMode,
  random: () => number,
): number {
  const [minimum, maximum] =
    mode === "quiet"
      ? [12_000, 22_000]
      : mode === "lively"
        ? [5_000, 10_000]
        : mode === "test"
          ? [1_000, 1_000]
          : [8_000, 15_000];
  return minimum + (maximum - minimum) * random();
}

export class StageAutonomyController {
  private nextAtMs: number;
  private currentNowMs = 0;
  private inFlight = false;
  private lastActionId: string | undefined;
  private readonly cooldownUntil = new Map<string, number>();
  private readonly random: () => number;

  constructor(private readonly dependencies: StageAutonomyDependencies) {
    this.random = dependencies.random ?? Math.random;
    this.nextAtMs = dependencies.initialDelayMs ?? 6_000;
  }

  update(nowMs: number): void {
    this.currentNowMs = nowMs;
    if (
      this.inFlight ||
      this.dependencies.isBusy() ||
      nowMs < this.nextAtMs
    ) {
      return;
    }
    const action = this.choose(nowMs);
    if (!action) {
      this.scheduleNext(nowMs);
      return;
    }
    this.inFlight = true;
    this.lastActionId = action.id;
    this.cooldownUntil.set(action.id, nowMs + action.cooldownMs);
    void this.dependencies
      .play(action)
      .then(async (result) => {
        if (result.status === "completed") {
          await this.dependencies.completed?.(action);
        }
      })
      .finally(() => {
        this.inFlight = false;
        this.scheduleNext(this.currentNowMs);
      });
  }

  private choose(nowMs: number): BehaviorAction | undefined {
    const weights = autonomyWeights(
      this.dependencies.actions,
      this.dependencies.getPersonality(),
    );
    const candidates = this.dependencies.actions
      .filter(
        (action) =>
          action.id !== this.lastActionId &&
          (this.cooldownUntil.get(action.id) ?? 0) <= nowMs,
      )
      .map((action) => ({ action, weight: weights[action.id] ?? 0 }))
      .filter(({ weight }) => weight > 0);
    const total = candidates.reduce(
      (sum, candidate) => sum + candidate.weight,
      0,
    );
    if (total <= 0) return undefined;
    let target = this.random() * total;
    for (const candidate of candidates) {
      target -= candidate.weight;
      if (target <= 0) return candidate.action;
    }
    return candidates.at(-1)?.action;
  }

  private scheduleNext(nowMs: number): void {
    this.nextAtMs =
      nowMs +
      intervalFor(
        this.dependencies.getPersonality(),
        this.random,
      );
  }
}
