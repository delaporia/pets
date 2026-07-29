import { describe, expect, it } from "vitest";

import { InteractionWheelModel } from "../src/app/interactions/interaction-wheel-model";

describe("InteractionWheelModel", () => {
  it("replaces the primary wheel with food choices", () => {
    const wheel = new InteractionWheelModel();

    wheel.open();
    wheel.choosePrimary("feed");

    expect(wheel.snapshot()).toEqual({
      phase: "secondary",
      primary: "feed",
      options: ["treat", "kibble", "can"],
    });
  });

  it("opens every feeding and play choice without progression locks", () => {
    const wheel = new InteractionWheelModel();

    wheel.open();
    wheel.choosePrimary("feed");
    expect(wheel.snapshot().options).toEqual(["treat", "kibble", "can"]);

    wheel.back();
    wheel.choosePrimary("play");
    expect(wheel.snapshot().options).toEqual(["butterfly", "ball", "wand"]);
  });

  it("hides unfinished primary groups and secondary actions", () => {
    const available = new Set(["feed", "play", "treat", "butterfly"]);
    const wheel = new InteractionWheelModel((option) => available.has(option));

    wheel.open();
    expect(wheel.snapshot().options).toEqual(["feed", "play"]);

    wheel.choosePrimary("feed");
    expect(wheel.snapshot().options).toEqual(["treat"]);

    wheel.back();
    wheel.choosePrimary("play");
    expect(wheel.snapshot().options).toEqual(["butterfly"]);
  });

  it("enters direct body interaction instead of showing touch submenus", () => {
    const wheel = new InteractionWheelModel();

    wheel.open();
    wheel.choosePrimary("touch");

    expect(wheel.snapshot()).toEqual({
      phase: "body-interaction",
      primary: "touch",
      options: [],
    });
  });

  it("returns from a secondary wheel to the primary wheel", () => {
    const wheel = new InteractionWheelModel();

    wheel.open();
    wheel.choosePrimary("play");
    wheel.back();

    expect(wheel.snapshot()).toEqual({
      phase: "primary",
      primary: null,
      options: ["touch", "feed", "play", "sleep"],
    });
  });

  it("can expose one direct sleep-state command in the primary wheel", () => {
    let sleeping = false;
    const wheel = new InteractionWheelModel(
      (option) =>
        option === "sleep"
          ? !sleeping
          : option === "wake"
            ? sleeping
            : true,
    );

    wheel.open();
    expect(wheel.snapshot().options).toEqual([
      "touch",
      "feed",
      "play",
      "sleep",
    ]);

    sleeping = true;
    expect(wheel.snapshot().options).toEqual([
      "touch",
      "feed",
      "play",
      "wake",
    ]);
  });

  it("hides every menu option while a selected interaction performs", () => {
    const wheel = new InteractionWheelModel();

    wheel.open();
    wheel.choosePrimary("play");
    wheel.perform();

    expect(wheel.snapshot()).toEqual({
      phase: "performing",
      primary: "play",
      options: [],
    });
  });

  it("closes every active interaction phase", () => {
    const wheel = new InteractionWheelModel();

    wheel.open();
    wheel.choosePrimary("touch");
    wheel.close();

    expect(wheel.snapshot()).toEqual({
      phase: "closed",
      primary: null,
      options: [],
    });
  });
});
