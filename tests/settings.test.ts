import { describe, expect, it, vi } from "vitest";

import {
  defaultUserSettings,
  migrateUserSettings,
  parseUserSettings,
} from "../src/app/config/settings";
import { SettingsClient } from "../src/app/config/settings-client";
import { NativeWindow } from "../src/app/native/native-window";

describe("user settings", () => {
  it("accepts schema version one and rejects later versions", () => {
    const defaults = parseUserSettings(defaultUserSettings());
    expect(defaults.schemaVersion).toBe(1);
    expect(defaults.selectedPetId).toBe("");
    expect(defaults.personalityMode).toBe("balanced");
    expect(defaults.petScale).toBe(1);
    expect(
      parseUserSettings({
        ...defaultUserSettings(),
        personalityMode: "test",
      }).personalityMode,
    ).toBe("test");
    expect(() =>
      parseUserSettings({ ...defaultUserSettings(), schemaVersion: 2 }),
    ).toThrow(/schemaVersion/);
  });

  it("migrates legacy settings to balanced mode", () => {
    const legacy = { ...defaultUserSettings() } as Record<string, unknown>;
    delete legacy.personalityMode;
    delete legacy.careByPet;
    delete legacy.petScale;
    delete legacy.careModelVersion;

    expect(parseUserSettings(legacy)).toMatchObject({
      personalityMode: "balanced",
      careByPet: {},
      petScale: 1,
      careModelVersion: 1,
    });
  });

  it("resets the old provisional affection baseline only once", () => {
    const legacy = parseUserSettings({
      ...defaultUserSettings(),
      careModelVersion: 1,
      careByPet: {
        ying: {
          satiety: 80,
          energy: 80,
          affection: 50,
          lastUpdatedAt: 1_000,
        },
      },
    });

    const migrated = migrateUserSettings(legacy);

    expect(migrated.careModelVersion).toBe(2);
    expect(migrated.careByPet.ying?.affection).toBe(0);
    expect(migrateUserSettings(migrated)).toBe(migrated);
  });

  it("accepts supported pet scales and rejects arbitrary values", () => {
    expect(
      parseUserSettings({ ...defaultUserSettings(), petScale: 1.25 }).petScale,
    ).toBe(1.25);
    expect(() =>
      parseUserSettings({ ...defaultUserSettings(), petScale: 9 }),
    ).toThrow(/petScale/);
  });

  it("persists valid care state independently for each pet", () => {
    const parsed = parseUserSettings({
      ...defaultUserSettings(),
      careByPet: {
        wuyi: {
          satiety: 72,
          energy: 64,
          affection: 81,
          lastUpdatedAt: 1234,
        },
        ying: {
          satiety: 45,
          energy: 90,
          affection: 55,
          lastUpdatedAt: 5678,
        },
      },
    });

    expect(parsed.careByPet.wuyi?.affection).toBe(81);
    expect(parsed.careByPet.ying?.satiety).toBe(45);
  });

  it("rejects care values outside the supported range", () => {
    expect(() =>
      parseUserSettings({
        ...defaultUserSettings(),
        careByPet: {
          wuyi: {
            satiety: 101,
            energy: 50,
            affection: 50,
            lastUpdatedAt: 0,
          },
        },
      }),
    ).toThrow(/careByPet\.wuyi\.satiety/);
  });
});

describe("Tauri adapters", () => {
  it("validates settings returned from Rust", async () => {
    const invoke = vi.fn(async (): Promise<unknown> =>
      defaultUserSettings(),
    );
    const client = new SettingsClient(invoke);

    expect(await client.read()).toEqual(defaultUserSettings());
    expect(invoke).toHaveBeenCalledWith("read_settings");
    invoke.mockResolvedValueOnce(true);
    expect(await client.readTestModeEnabled()).toBe(true);
    expect(invoke).toHaveBeenLastCalledWith("read_test_mode_enabled");
  });

  it("sends typed window commands", async () => {
    const invoke = vi.fn(async () => undefined);
    const window = new NativeWindow(invoke);

    await window.move(12, 34);
    await window.resize(96, 104);
    await window.setVisible(false);
    await window.updateHitMask({
      width: 2,
      height: 1,
      threshold: 128,
      pixels: [0, 255],
    });
    await window.lockInteraction(true);
    await window.showPetMenu({
      pets: [{ id: "wuyi", displayName: "五一" }],
      selectedPetId: "wuyi",
      personalityMode: "balanced",
      testModeEnabled: false,
      paused: false,
      sleeping: false,
      care: {
        satiety: 80,
        energy: 70,
        affection: 60,
        lastUpdatedAt: 1000,
      },
    });

    expect(invoke).toHaveBeenNthCalledWith(1, "move_pet_window", {
      x: 12,
      y: 34,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "resize_pet_window", {
      width: 96,
      height: 104,
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "set_pet_visible", {
      visible: false,
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "update_hit_mask", {
      mask: {
        width: 2,
        height: 1,
        threshold: 128,
        pixels: [0, 255],
      },
    });
    expect(invoke).toHaveBeenNthCalledWith(5, "lock_pet_interaction", {
      locked: true,
    });
    expect(invoke).toHaveBeenNthCalledWith(6, "show_pet_menu", {
      state: {
        pets: [{ id: "wuyi", displayName: "五一" }],
        selectedPetId: "wuyi",
        personalityMode: "balanced",
        testModeEnabled: false,
        paused: false,
        sleeping: false,
        care: {
          satiety: 80,
          energy: 70,
          affection: 60,
          lastUpdatedAt: 1000,
        },
      },
    });
  });
});
