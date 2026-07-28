import type { PhasedActionDefinition } from "../pets/schemas";

export type PhasedPlayback = "once" | "timed" | "until-stopped";
export type PhasedPlaybackStatus = "running" | "complete";
export type PhasedActionPhase = "enter" | "loop" | "exit";

export interface PhasedAnimationControls {
  play(animationId: string, restart: boolean): void;
  durationMs(animationId: string): number;
}

export class PhasedActionPlayer {
  private activePhase: PhasedActionPhase = "loop";
  private elapsedMs = 0;
  private phaseDurationMs = 0;
  private complete = true;
  private playback: PhasedPlayback = "once";

  constructor(
    private readonly definition: PhasedActionDefinition,
    private readonly animations: PhasedAnimationControls,
    private readonly random: () => number,
  ) {}

  get phase(): PhasedActionPhase {
    return this.activePhase;
  }

  start(playback: PhasedPlayback): void {
    this.playback = playback;
    this.complete = false;
    if (this.definition.enter) {
      this.enterPhase("enter", this.definition.enter);
    } else {
      this.beginLoop();
    }
  }

  update(deltaMs: number): PhasedPlaybackStatus {
    if (this.complete) return "complete";
    let remainingMs = Math.max(0, deltaMs);
    while (!this.complete) {
      const untilBoundary = Math.max(
        0,
        this.phaseDurationMs - this.elapsedMs,
      );
      if (remainingMs < untilBoundary) {
        this.elapsedMs += remainingMs;
        break;
      }
      this.elapsedMs += untilBoundary;
      remainingMs -= untilBoundary;
      if (!this.advance()) break;
      if (remainingMs === 0) break;
    }
    return this.complete ? "complete" : "running";
  }

  stop(): PhasedPlaybackStatus {
    if (this.complete) return "complete";
    if (this.definition.exit && this.activePhase !== "exit") {
      this.enterPhase("exit", this.definition.exit);
      return "running";
    }
    this.complete = true;
    return "complete";
  }

  private advance(): boolean {
    if (this.activePhase === "enter") {
      this.beginLoop();
      return true;
    }
    if (this.activePhase === "loop") {
      if (this.playback === "until-stopped") {
        this.elapsedMs = 0;
        return false;
      }
      if (this.definition.exit) {
        this.enterPhase("exit", this.definition.exit);
        return true;
      }
      this.complete = true;
      return false;
    }
    this.complete = true;
    return false;
  }

  private beginLoop(): void {
    this.activePhase = "loop";
    this.elapsedMs = 0;
    this.phaseDurationMs = this.loopDurationMs();
    this.animations.play(this.definition.loop, true);
  }

  private loopDurationMs(): number {
    if (this.playback === "until-stopped") {
      return Number.POSITIVE_INFINITY;
    }
    if (this.playback === "timed" && this.definition.loopDuration) {
      const { minMs, maxMs } = this.definition.loopDuration;
      return minMs + this.sample() * (maxMs - minMs);
    }
    return this.animations.durationMs(this.definition.loop);
  }

  private sample(): number {
    return Math.min(1, Math.max(0, this.random()));
  }

  private enterPhase(
    phase: Exclude<PhasedActionPhase, "loop">,
    animationId: string,
  ): void {
    this.activePhase = phase;
    this.elapsedMs = 0;
    this.phaseDurationMs = this.animations.durationMs(animationId);
    this.animations.play(animationId, true);
  }
}
