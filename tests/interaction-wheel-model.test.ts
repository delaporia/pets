import { describe, expect, it } from "vitest";

import { InteractionWheelModel } from "../src/app/interactions/interaction-wheel-model";

describe("InteractionWheelModel", () => {
  it("replaces the primary wheel with food choices", () => {
    const wheel = new InteractionWheelModel(() => 100);

    wheel.open();
    wheel.choosePrimary("feed");

    expect(wheel.snapshot()).toEqual({
      phase: "secondary",
      primary: "feed",
      options: ["treat", "kibble", "can"],
    });
  });

  it("starts with one feeding and one play choice", () => {
    const wheel = new InteractionWheelModel(() => 0);

    wheel.open();
    wheel.choosePrimary("feed");
    expect(wheel.snapshot().options).toEqual(["treat"]);

    wheel.back();
    wheel.choosePrimary("play");
    expect(wheel.snapshot().options).toEqual(["ball"]);
  });

  it("unlocks props at affection 10, 20 and 30", () => {
    let affection = 9;
    const wheel = new InteractionWheelModel(() => affection);

    wheel.open();
    wheel.choosePrimary("feed");
    expect(wheel.snapshot().options).toEqual(["treat"]);
    affection = 10;
    expect(wheel.snapshot().options).toEqual(["treat", "kibble"]);
    affection = 30;
    expect(wheel.snapshot().options).toEqual(["treat", "kibble", "can"]);

    wheel.back();
    wheel.choosePrimary("play");
    expect(wheel.snapshot().options).toEqual(["ball", "wand", "butterfly"]);
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
      options: ["touch", "feed", "play", "companion"],
    });
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
