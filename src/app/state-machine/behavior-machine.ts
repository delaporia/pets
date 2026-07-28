import type { PetBehavior } from "../behaviors/behavior";
interface BehaviorMachineEvents {
  behaviorError: { id: string; message: string };
}

interface BehaviorMachineEventSink {
  emit<TKey extends keyof BehaviorMachineEvents>(
    event: TKey,
    payload: BehaviorMachineEvents[TKey],
  ): void;
}

export interface BehaviorRequestOptions {
  restart?: boolean;
  source?: "autonomous" | "user" | "system";
}

export class BehaviorMachine<TContext> {
  private readonly behaviors = new Map<string, PetBehavior<TContext>>();
  private active: PetBehavior<TContext> | undefined;

  constructor(
    private readonly context: TContext,
    private readonly events: BehaviorMachineEventSink,
    private readonly fallbackId: string,
  ) {}

  get activeId(): string | undefined {
    return this.active?.id;
  }

  register(behavior: PetBehavior<TContext>): void {
    if (this.behaviors.has(behavior.id)) {
      throw new Error(`Behavior "${behavior.id}" is already registered`);
    }
    this.behaviors.set(behavior.id, behavior);
  }

  request(id: string, options: BehaviorRequestOptions = {}): boolean {
    const candidate = this.behaviors.get(id);
    if (!candidate || !candidate.canEnter(this.context)) {
      return false;
    }
    if (
      this.active &&
      candidate.priority < this.active.priority &&
      options.source !== "user"
    ) {
      return false;
    }
    this.transition(candidate, options.restart === true);
    return true;
  }

  update(deltaMs: number): void {
    const current = this.active;
    if (!current) {
      this.transitionToFallback();
      return;
    }
    try {
      const result = current.update(this.context, deltaMs);
      if (result.status === "complete") {
        this.transitionTo(result.next ?? this.fallbackId);
      }
    } catch (error) {
      this.events.emit("behaviorError", {
        id: current.id,
        message: error instanceof Error ? error.message : String(error),
      });
      this.transitionToFallback();
    }
  }

  private transitionTo(id: string): void {
    const target = this.behaviors.get(id);
    if (!target || !target.canEnter(this.context)) {
      this.transitionToFallback();
      return;
    }
    this.transition(target);
  }

  private transitionToFallback(): void {
    const fallback = this.behaviors.get(this.fallbackId);
    if (!fallback) {
      this.active?.exit(this.context);
      this.active = undefined;
      return;
    }
    this.transition(fallback);
  }

  private transition(
    target: PetBehavior<TContext>,
    restart = false,
  ): void {
    if (this.active?.id === target.id && !restart) {
      return;
    }
    this.active?.exit(this.context);
    this.active = target;
    target.enter(this.context);
  }
}
