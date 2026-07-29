import { describe, expect, it, vi } from "vitest";

import { PetMenuController } from "../src/app/interactions/pet-menu-controller";

function fixture() {
  let sleeping = false;
  const dependencies = {
    getMenuState: vi.fn(() => ({
      pets: [
        { id: "wuyi", displayName: "五一" },
        { id: "ying", displayName: "瑛" },
      ],
      selectedPetId: "wuyi",
      personalityMode: "balanced" as const,
      testModeEnabled: false,
      paused: false,
    })),
    showMenu: vi.fn(async () => undefined),
    requestAction: vi.fn((action: string) => {
      if (action === "sleep") sleeping = true;
      return true;
    }),
    requestWake: vi.fn(() => {
      sleeping = false;
      return true;
    }),
    isSleeping: vi.fn(() => sleeping),
  };
  return {
    dependencies,
    controller: new PetMenuController(dependencies),
  };
}

describe("PetMenuController", () => {
  it("shows the native menu with current runtime state", async () => {
    const { controller, dependencies } = fixture();

    await controller.show();

    expect(dependencies.showMenu).toHaveBeenCalledWith({
      pets: [
        { id: "wuyi", displayName: "五一" },
        { id: "ying", displayName: "瑛" },
      ],
      selectedPetId: "wuyi",
      personalityMode: "balanced",
      testModeEnabled: false,
      paused: false,
      sleeping: false,
    });
  });

  it("requests the selected interaction without progression side effects", async () => {
    const { controller, dependencies } = fixture();

    expect(await controller.handle("feed", "feed-treat")).toBe(true);
    expect(dependencies.requestAction).toHaveBeenCalledWith("feed-treat");
  });

  it("keeps sleep active until a wake command requests its exit", async () => {
    const { controller, dependencies } = fixture();

    expect(await controller.handle("sleep")).toBe(true);
    expect(controller.sleeping).toBe(true);

    expect(await controller.handle("wake")).toBe(true);
    expect(controller.sleeping).toBe(false);
    expect(dependencies.requestWake).toHaveBeenCalledOnce();
  });

  it("reports when an interaction cannot start", async () => {
    const { controller, dependencies } = fixture();
    dependencies.requestAction.mockReturnValue(false);

    expect(await controller.handle("play")).toBe(false);
  });
});
