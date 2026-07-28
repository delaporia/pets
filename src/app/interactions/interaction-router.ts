import type { CooldownLedger } from "../behaviors/cooldown-ledger";
import type { BehaviorProfile } from "../pets/schemas";

interface InteractionMachine {
  request(
    id: string,
    options?: { restart?: boolean; source?: "user" },
  ): boolean;
}

export class InteractionRouter {
  private clickCount = 0;
  private lastClickMs: number | undefined;
  private lastDispatchedClickMs: number | undefined;

  constructor(
    private readonly profile: BehaviorProfile,
    _cooldowns: CooldownLedger,
    private readonly machine: InteractionMachine,
  ) {
    void _cooldowns;
  }

  onClick(nowMs: number): boolean {
    if (
      this.lastDispatchedClickMs !== undefined &&
      nowMs - this.lastDispatchedClickMs < 150
    ) {
      return false;
    }
    this.lastDispatchedClickMs = nowMs;
    const windowMs = this.profile.interaction.multiClickWindowMs;
    if (
      this.lastClickMs === undefined ||
      nowMs - this.lastClickMs > windowMs
    ) {
      this.clickCount = 1;
    } else {
      this.clickCount += 1;
    }
    this.lastClickMs = nowMs;

    if (
      this.clickCount >= this.profile.interaction.multiClickThreshold
    ) {
      this.clickCount = 0;
      this.lastClickMs = undefined;
      return this.requestAction(
        this.profile.interaction.multiClickAction,
      );
    }
    return this.requestAction(
      this.profile.interaction.singleClickAction,
    );
  }

  onDragStart(): boolean {
    this.resetClicks();
    return this.machine.request("drag-and-drop", {
      restart: true,
      source: "user",
    });
  }

  onDragEnd(): boolean {
    return this.machine.request("landing", {
      restart: true,
      source: "user",
    });
  }

  private requestAction(
    actionId: string | undefined,
  ): boolean {
    if (!actionId) return false;
    return this.machine.request(`action-${actionId}`, {
      restart: true,
      source: "user",
    });
  }

  private resetClicks(): void {
    this.clickCount = 0;
    this.lastClickMs = undefined;
    this.lastDispatchedClickMs = undefined;
  }
}
