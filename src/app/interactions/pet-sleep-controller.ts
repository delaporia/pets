import type { PhasedActionDefinition } from "../pets/schemas";

export type PetSleepState =
  | "awake"
  | "entering"
  | "sleeping"
  | "waking";

export interface PetSleepControllerDependencies {
  play(clip: string, loop: boolean): void;
  durationMs(clip: string): number;
  changed(state: PetSleepState): void;
  schedule(callback: () => void, delayMs: number): number;
  cancel(handle: number): void;
}

export class PetSleepController {
  private currentState: PetSleepState = "awake";
  private timer: number | undefined;

  constructor(
    private readonly definition: PhasedActionDefinition,
    private readonly dependencies: PetSleepControllerDependencies,
  ) {}

  get state(): PetSleepState {
    return this.currentState;
  }

  get isSleeping(): boolean {
    return (
      this.currentState === "entering" ||
      this.currentState === "sleeping"
    );
  }

  sleep(): boolean {
    if (this.currentState !== "awake") return false;
    this.cancelTimer();
    if (!this.definition.enter) {
      this.enterSleepingLoop();
      return true;
    }
    this.setState("entering");
    this.dependencies.play(this.definition.enter, false);
    this.timer = this.dependencies.schedule(
      () => this.enterSleepingLoop(),
      this.dependencies.durationMs(this.definition.enter),
    );
    return true;
  }

  async wake(): Promise<boolean> {
    if (
      this.currentState === "awake" ||
      this.currentState === "waking"
    ) {
      return false;
    }
    this.cancelTimer();
    this.setState("waking");
    if (!this.definition.exit) {
      this.finishWake();
      return true;
    }
    this.dependencies.play(this.definition.exit, false);
    await new Promise<void>((resolve) => {
      this.timer = this.dependencies.schedule(() => {
        this.finishWake();
        resolve();
      }, this.dependencies.durationMs(this.definition.exit!));
    });
    return true;
  }

  async wakeBeforeInteraction(): Promise<void> {
    if (this.isSleeping) {
      await this.wake();
    }
  }

  reset(): void {
    this.cancelTimer();
    this.setState("awake");
    this.dependencies.play("idle", true);
  }

  restoreVisualState(): void {
    if (this.currentState === "entering" && this.definition.enter) {
      this.dependencies.play(this.definition.enter, false);
      return;
    }
    if (this.currentState === "sleeping") {
      this.dependencies.play(this.definition.loop, true);
      return;
    }
    if (this.currentState === "waking" && this.definition.exit) {
      this.dependencies.play(this.definition.exit, false);
      return;
    }
    this.dependencies.play("idle", true);
  }

  dispose(): void {
    this.cancelTimer();
  }

  private enterSleepingLoop(): void {
    this.timer = undefined;
    this.setState("sleeping");
    this.dependencies.play(this.definition.loop, true);
  }

  private finishWake(): void {
    this.timer = undefined;
    this.setState("awake");
    this.dependencies.play("idle", true);
  }

  private setState(state: PetSleepState): void {
    this.currentState = state;
    this.dependencies.changed(state);
  }

  private cancelTimer(): void {
    if (this.timer === undefined) return;
    this.dependencies.cancel(this.timer);
    this.timer = undefined;
  }
}
