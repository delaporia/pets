import { describe, expect, it, vi } from "vitest";

import { PetMenuController } from "../src/app/interactions/pet-menu-controller";
import { defaultPetCareState } from "../src/app/care/care-state";

function fixture() {
  const care = defaultPetCareState(1_000);
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
      care,
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
    applyCare: vi.fn(() => care),
    persist: vi.fn(async () => undefined),
  };
  return {
    dependencies,
    controller: new PetMenuController(dependencies),
  };
}

describe("PetMenuController", () => {
  it("shows the native menu with current care and sleep state", async () => {
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
      care: defaultPetCareState(1_000),
    });
  });

  it("runs and persists a feeding interaction", async () => {
    const { controller, dependencies } = fixture();

    expect(await controller.handle("feed")).toBe(true);

    expect(dependencies.requestAction).toHaveBeenCalledWith("feed");
    expect(dependencies.applyCare).toHaveBeenCalledWith("feed");
    expect(dependencies.persist).toHaveBeenCalledOnce();
  });

  it("can apply feeding care while requesting a variant behavior", async () => {
    const { controller, dependencies } = fixture();

    expect(await controller.handle("feed", "feed-treat")).toBe(true);

    expect(dependencies.requestAction).toHaveBeenCalledWith("feed-treat");
    expect(dependencies.applyCare).toHaveBeenCalledWith("feed");
    expect(dependencies.persist).toHaveBeenCalledOnce();
  });

  it("keeps sleep active until a wake command requests its exit", async () => {
    const { controller, dependencies } = fixture();

    expect(await controller.handle("sleep")).toBe(true);
    expect(controller.sleeping).toBe(true);
    expect(dependencies.applyCare).toHaveBeenCalledWith("sleep");

    expect(await controller.handle("wake")).toBe(true);
    expect(controller.sleeping).toBe(false);
    expect(dependencies.requestWake).toHaveBeenCalledOnce();
  });

  it("does not change care when an interaction cannot start", async () => {
    const { controller, dependencies } = fixture();
    dependencies.requestAction.mockReturnValue(false);

    expect(await controller.handle("play")).toBe(false);
    expect(dependencies.applyCare).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
  });
});
