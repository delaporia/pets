import {
  applyCareAction,
  defaultPetCareState,
  settleCareState,
  type CareAction,
  type PetCareState,
} from "./care-state";

export class CareController {
  private readonly states = new Map<string, PetCareState>();

  constructor(
    initial: Record<string, PetCareState>,
    private readonly now: () => number = Date.now,
  ) {
    for (const [petId, state] of Object.entries(initial)) {
      this.states.set(petId, { ...state });
    }
  }

  get(petId: string): PetCareState {
    const nowMs = this.now();
    const current =
      this.states.get(petId) ?? defaultPetCareState(nowMs);
    const settled = settleCareState(current, nowMs);
    this.states.set(petId, settled);
    return { ...settled };
  }

  apply(petId: string, action: CareAction): PetCareState {
    const current = this.get(petId);
    const updated = applyCareAction(current, action, this.now());
    this.states.set(petId, updated);
    return { ...updated };
  }

  snapshot(): Record<string, PetCareState> {
    const result: Record<string, PetCareState> = {};
    for (const petId of this.states.keys()) {
      result[petId] = this.get(petId);
    }
    return result;
  }
}
