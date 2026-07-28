export type BehaviorResult =
  | { status: "running" }
  | { status: "complete"; next?: string };

export interface PetBehavior<TContext> {
  readonly id: string;
  readonly priority: number;
  canEnter(context: TContext): boolean;
  enter(context: TContext): void;
  update(context: TContext, deltaMs: number): BehaviorResult;
  exit(context: TContext): void;
}
