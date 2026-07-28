import { describe, expect, it, vi } from "vitest";

import { RuntimeSessionSwitcher } from "../src/app/bootstrap/runtime-session-switcher";

function session(id: string, calls: string[]) {
  return {
    id,
    runtime: {
      start: vi.fn(() => calls.push(`${id}:start`)),
      stop: vi.fn(() => calls.push(`${id}:stop`)),
    },
    dispose: vi.fn(() => calls.push(`${id}:dispose`)),
  };
}

describe("RuntimeSessionSwitcher", () => {
  it("stops the old runtime before creating and starting its replacement", async () => {
    const calls: string[] = [];
    const oldSession = session("old", calls);
    const nextSession = session("next", calls);
    const switcher = new RuntimeSessionSwitcher(oldSession);

    await switcher.replace(async () => {
      calls.push("create");
      return nextSession;
    });

    expect(calls).toEqual([
      "old:stop",
      "create",
      "old:dispose",
      "next:start",
    ]);
    expect(switcher.current).toBe(nextSession);
  });

  it("restarts the old runtime if replacement creation fails", async () => {
    const calls: string[] = [];
    const oldSession = session("old", calls);
    const switcher = new RuntimeSessionSwitcher(oldSession);

    await expect(
      switcher.replace(async () => {
        throw new Error("bad pet");
      }),
    ).rejects.toThrow("bad pet");

    expect(calls).toEqual(["old:stop", "old:start"]);
    expect(oldSession.dispose).not.toHaveBeenCalled();
    expect(switcher.current).toBe(oldSession);
  });
});
