import type { CareAction, PetCareState } from "../care/care-state";
import type { PersonalityMode } from "../personality/profiles";

export type PetMenuAction = CareAction | "wake";

export interface PetMenuPet {
  id: string;
  displayName: string;
}

export interface PetMenuState {
  pets: PetMenuPet[];
  selectedPetId: string;
  personalityMode: PersonalityMode;
  testModeEnabled: boolean;
  paused: boolean;
  sleeping: boolean;
  care: PetCareState;
}

export interface PetMenuControllerDependencies {
  getMenuState(): Omit<PetMenuState, "sleeping">;
  showMenu(state: PetMenuState): Promise<void>;
  requestAction(action: string): boolean;
  requestWake(): boolean;
  isSleeping(): boolean;
  applyCare(action: CareAction): PetCareState;
  persist(): Promise<void>;
}

export class PetMenuController {
  constructor(
    private readonly dependencies: PetMenuControllerDependencies,
  ) {}

  get sleeping(): boolean {
    return this.dependencies.isSleeping();
  }

  async show(): Promise<void> {
    await this.dependencies.showMenu({
      ...this.dependencies.getMenuState(),
      sleeping: this.sleeping,
    });
  }

  async handle(
    action: PetMenuAction,
    behaviorId: string = action,
  ): Promise<boolean> {
    if (action === "wake") {
      if (!this.sleeping || !this.dependencies.requestWake()) {
        return false;
      }
      return true;
    }
    if (action === "sleep" && this.sleeping) return false;
    if (this.sleeping) {
      this.dependencies.requestWake();
    }
    if (!this.dependencies.requestAction(behaviorId)) return false;

    this.dependencies.applyCare(action);
    await this.dependencies.persist();
    return true;
  }
}

export function interactionBehaviorId(
  action: string,
): `interaction-${string}` {
  return `interaction-${action}`;
}
