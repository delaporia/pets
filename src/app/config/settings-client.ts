import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { InvokeFn } from "../native/native-window";
import {
  parseUserSettings,
  type UserSettings,
} from "./settings";

const defaultInvoke: InvokeFn = (command, args) =>
  tauriInvoke(command, args);

export class SettingsClient {
  constructor(private readonly invoke: InvokeFn = defaultInvoke) {}

  async read(): Promise<UserSettings> {
    return parseUserSettings(await this.invoke("read_settings"));
  }

  async write(settings: UserSettings): Promise<void> {
    await this.invoke("write_settings", { settings });
  }

  async readTestModeEnabled(): Promise<boolean> {
    return Boolean(await this.invoke("read_test_mode_enabled"));
  }
}
