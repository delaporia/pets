import { describe, expect, it, vi } from "vitest";

import { EventBus } from "../src/app/events/event-bus";
import type { PetBehavior } from "../src/app/behaviors/behavior";
import { BehaviorMachine } from "../src/app/state-machine/behavior-machine";

interface Context {
  trace: string[];
}

interface Events {
  behaviorError: { id: string; message: string };
}

function behavior(
  id: string,
  priority: number,
  update: PetBehavior<Context>["update"] = vi.fn<
    PetBehavior<Context>["update"]
  >(() => ({ status: "running" })),
): PetBehavior<Context> {
  return {
    id,
    priority,
    canEnter: () => true,
    enter: (context) => context.trace.push(`enter:${id}`),
    update,
    exit: (context) => context.trace.push(`exit:${id}`),
  };
}

describe("BehaviorMachine", () => {
  it("enters a requested registered behavior", () => {
    const context = { trace: [] };
    const machine = new BehaviorMachine(context, new EventBus<Events>(), "idle");
    machine.register(behavior("idle", 0));

    expect(machine.request("idle")).toBe(true);
    expect(context.trace).toEqual(["enter:idle"]);
  });

  it("allows a higher priority behavior to preempt", () => {
    const context = { trace: [] };
    const machine = new BehaviorMachine(context, new EventBus<Events>(), "idle");
    machine.register(behavior("walk", 10));
    machine.register(behavior("drag", 100));
    machine.request("walk");

    expect(machine.request("drag")).toBe(true);
    expect(context.trace).toEqual(["enter:walk", "exit:walk", "enter:drag"]);
  });

  it("restarts the active behavior when a user interaction requests it", () => {
    const context = { trace: [] };
    const machine = new BehaviorMachine(context, new EventBus<Events>(), "idle");
    machine.register(behavior("reaction", 10));
    machine.request("reaction");

    expect(
      machine.request("reaction", { restart: true, source: "user" }),
    ).toBe(true);
    expect(context.trace).toEqual([
      "enter:reaction",
      "exit:reaction",
      "enter:reaction",
    ]);
  });

  it("rejects lower priority preemption", () => {
    const context = { trace: [] };
    const machine = new BehaviorMachine(context, new EventBus<Events>(), "idle");
    machine.register(behavior("walk", 10));
    machine.register(behavior("drag", 100));
    machine.request("drag");

    expect(machine.request("walk")).toBe(false);
    expect(context.trace).toEqual(["enter:drag"]);
  });

  it("falls back to idle and emits when update throws", () => {
    const context = { trace: [] };
    const events = new EventBus<Events>();
    const errorHandler = vi.fn();
    events.on("behaviorError", errorHandler);
    const machine = new BehaviorMachine(context, events, "idle");
    machine.register(behavior("idle", 0));
    machine.register(
      behavior("broken", 10, vi.fn(() => { throw new Error("boom"); })),
    );
    machine.request("broken");

    machine.update(16);

    expect(errorHandler).toHaveBeenCalledWith({ id: "broken", message: "boom" });
    expect(machine.activeId).toBe("idle");
  });

  it("transitions once to the requested next behavior", () => {
    const context = { trace: [] };
    const machine = new BehaviorMachine(context, new EventBus<Events>(), "idle");
    machine.register(behavior("idle", 0));
    machine.register(
      behavior(
        "fall",
        80,
        vi.fn<PetBehavior<Context>["update"]>(() => ({
          status: "complete",
          next: "idle",
        })),
      ),
    );
    machine.request("fall");

    machine.update(16);
    machine.update(16);

    expect(context.trace).toEqual(["enter:fall", "exit:fall", "enter:idle"]);
  });
});
