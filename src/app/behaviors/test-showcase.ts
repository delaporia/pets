import {
  PhasedActionPlayer,
  type PhasedAnimationControls,
} from "../animation/phased-action-player";
import {
  semanticActionIds,
  type PhasedActionDefinition,
  type SemanticActionId,
} from "../pets/schemas";

const actionLabels: Record<SemanticActionId, string> = {
  idle: "待机",
  walkLeft: "向左走",
  walkRight: "向右走",
  look: "观察",
  pet: "抚摸回应",
  feed: "吃饭",
  sleep: "睡觉",
  groom: "舔毛",
  stretch: "伸展",
  play: "玩耍",
  pickedUp: "被抱起",
  land: "落地",
};

export interface TestShowcaseDisplay {
  show(text: string): void;
  hide(): void;
}

export class TestShowcase {
  private actionIndex = 0;
  private phase: "action" | "idle-gap" = "action";
  private gapElapsedMs = 0;
  private player: PhasedActionPlayer | undefined;
  private running = false;

  constructor(
    private readonly actions: Record<
      SemanticActionId,
      PhasedActionDefinition
    >,
    private readonly animations: PhasedAnimationControls,
    private readonly display: TestShowcaseDisplay,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.actionIndex = 0;
    this.beginAction();
  }

  stop(): void {
    this.running = false;
    this.player = undefined;
    this.display.hide();
  }

  update(deltaMs: number): void {
    if (!this.running) this.start();
    const delta = Math.max(0, deltaMs);
    if (this.phase === "idle-gap") {
      this.gapElapsedMs += delta;
      if (this.gapElapsedMs >= 2_000) {
        this.actionIndex =
          (this.actionIndex + 1) % semanticActionIds.length;
        this.beginAction();
      }
      return;
    }
    if (this.player?.update(delta) === "complete") {
      this.beginIdleGap();
    }
  }

  private beginAction(): void {
    this.phase = "action";
    const actionId = semanticActionIds[this.actionIndex]!;
    const definition = {
      ...this.actions[actionId],
      loopDuration: { minMs: 2_500, maxMs: 2_500 },
    };
    this.player = new PhasedActionPlayer(
      definition,
      this.animations,
      () => 0,
    );
    this.display.show(`${actionLabels[actionId]} · ${actionId}`);
    this.player.start("timed");
  }

  private beginIdleGap(): void {
    this.phase = "idle-gap";
    this.gapElapsedMs = 0;
    this.player = undefined;
    this.animations.play(this.actions.idle.loop, true);
    this.display.show("待机 · idle（2 秒）");
  }
}
