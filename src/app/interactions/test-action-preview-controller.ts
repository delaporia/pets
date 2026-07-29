import type { TestActionEntry } from "./test-action-catalog";

export interface TestActionPreviewDependencies {
  play(clip: string, loop: boolean): void;
  completed(action: TestActionEntry): void;
  schedule?(
    callback: () => void,
    delayMs: number,
  ): unknown;
  cancel?(handle: unknown): void;
}

export class TestActionPreviewController {
  private action: TestActionEntry | undefined;
  private stepIndex = 0;
  private elapsedMs = 0;
  private fallbackHandle: unknown;

  constructor(
    private readonly dependencies: TestActionPreviewDependencies,
  ) {}

  get active(): boolean {
    return this.action !== undefined;
  }

  start(action: TestActionEntry): void {
    this.cancelFallback();
    this.action = action;
    this.stepIndex = 0;
    this.elapsedMs = 0;
    this.playCurrentStep();
    const durationMs = action.steps.reduce(
      (total, step) => total + step.durationMs,
      0,
    );
    this.fallbackHandle = this.dependencies.schedule?.(
      () => {
        if (this.action !== action) return;
        this.finish(action);
      },
      durationMs + 250,
    );
  }

  update(deltaMs: number): void {
    if (!this.action) return;
    this.elapsedMs += Math.max(0, deltaMs);
    while (this.action) {
      const step = this.action.steps[this.stepIndex];
      if (!step || this.elapsedMs < step.durationMs) return;
      this.elapsedMs -= step.durationMs;
      this.stepIndex += 1;
      if (this.stepIndex >= this.action.steps.length) {
        this.finish(this.action);
        return;
      }
      this.playCurrentStep();
    }
  }

  stop(): void {
    this.cancelFallback();
    this.action = undefined;
    this.stepIndex = 0;
    this.elapsedMs = 0;
    this.dependencies.play("idle", true);
  }

  private finish(action: TestActionEntry): void {
    this.cancelFallback();
    this.action = undefined;
    this.stepIndex = 0;
    this.elapsedMs = 0;
    this.dependencies.play("idle", true);
    this.dependencies.completed(action);
  }

  private cancelFallback(): void {
    if (this.fallbackHandle === undefined) return;
    this.dependencies.cancel?.(this.fallbackHandle);
    this.fallbackHandle = undefined;
  }

  private playCurrentStep(): void {
    const step = this.action?.steps[this.stepIndex];
    if (!step) {
      this.stop();
      return;
    }
    this.dependencies.play(step.clip, step.loop);
  }
}
