import type { UserSettings } from "../config/settings";
import type { PetScale, TrayHandlers } from "../native/tray-client";
import type { PersonalityMode } from "../personality/profiles";

export interface TrayHandlerDependencies {
  getSettings(): UserSettings;
  saveSettings(settings: UserSettings): Promise<void>;
  switchPet(id: string): Promise<void>;
  setPaused(paused: boolean): void;
  setVisible(visible: boolean): Promise<void>;
  setAutostart(enabled: boolean): Promise<void>;
  setPersonality(mode: PersonalityMode): void;
  setScale(scale: PetScale): Promise<void>;
  refreshTray(): Promise<void>;
}

export function createTrayHandlers(
  dependencies: TrayHandlerDependencies,
): TrayHandlers {
  let petSelectionQueue = Promise.resolve();
  const saveAndRefresh = async (settings: UserSettings): Promise<void> => {
    await dependencies.saveSettings(settings);
    await dependencies.refreshTray();
  };

  return {
    selectPet(id) {
      const operation = petSelectionQueue.then(async () => {
        if (dependencies.getSettings().selectedPetId === id) return;
        await dependencies.switchPet(id);
        await saveAndRefresh({
          ...dependencies.getSettings(),
          selectedPetId: id,
        });
      });
      petSelectionQueue = operation.catch(() => undefined);
      return operation;
    },
    async selectPersonality(personalityMode) {
      if (dependencies.getSettings().personalityMode === personalityMode) return;
      dependencies.setPersonality(personalityMode);
      await saveAndRefresh({
        ...dependencies.getSettings(),
        personalityMode,
      });
    },
    async selectScale(petScale) {
      if (dependencies.getSettings().petScale === petScale) return;
      await dependencies.setScale(petScale);
      await saveAndRefresh({
        ...dependencies.getSettings(),
        petScale,
      });
    },
    async pause() {
      const activityPaused = !dependencies.getSettings().activityPaused;
      dependencies.setPaused(activityPaused);
      await saveAndRefresh({
        ...dependencies.getSettings(),
        activityPaused,
      });
    },
    async visibility() {
      const visible = !dependencies.getSettings().visible;
      await dependencies.setVisible(visible);
      await saveAndRefresh({
        ...dependencies.getSettings(),
        visible,
      });
    },
    async autostart() {
      const autostart = !dependencies.getSettings().autostart;
      await dependencies.setAutostart(autostart);
      await saveAndRefresh({
        ...dependencies.getSettings(),
        autostart,
      });
    },
  };
}
