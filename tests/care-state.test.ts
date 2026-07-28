import { describe, expect, it } from "vitest";

import {
  applyCareAction,
  defaultPetCareState,
  settleCareState,
} from "../src/app/care/care-state";

const hourMs = 60 * 60 * 1_000;

describe("pet care state", () => {
  it("starts a newly met pet at zero affection", () => {
    expect(defaultPetCareState(1_000).affection).toBe(0);
  });

  it("settles bounded offline satiety and energy decay", () => {
    const settled = settleCareState(
      {
        satiety: 100,
        energy: 100,
        affection: 100,
        lastUpdatedAt: 0,
      },
      hourMs,
    );

    expect(settled).toEqual({
      satiety: 98,
      energy: 99,
      affection: 100,
      lastUpdatedAt: hourMs,
    });
  });

  it("caps offline settlement at seven days but advances the timestamp", () => {
    const thirtyDays = 30 * 24 * hourMs;
    const settled = settleCareState(defaultPetCareState(0), thirtyDays);

    expect(settled.satiety).toBe(0);
    expect(settled.energy).toBe(0);
    expect(settled.lastUpdatedAt).toBe(thirtyDays);
  });

  it("clamps interaction effects to the zero-to-one-hundred range", () => {
    const fed = applyCareAction(
      {
        satiety: 95,
        energy: 100,
        affection: 99,
        lastUpdatedAt: hourMs,
      },
      "feed",
      hourMs,
    );
    const played = applyCareAction(
      {
        satiety: 2,
        energy: 3,
        affection: 98,
        lastUpdatedAt: hourMs,
      },
      "play",
      hourMs,
    );

    expect(fed).toMatchObject({ satiety: 100, affection: 100 });
    expect(played).toMatchObject({
      satiety: 0,
      energy: 0,
      affection: 100,
    });
  });

  it("does not reduce long-term affection while the app is closed", () => {
    const settled = settleCareState(
      {
        satiety: 80,
        energy: 80,
        affection: 63,
        lastUpdatedAt: 0,
      },
      24 * hourMs,
    );

    expect(settled.affection).toBe(63);
  });
});
