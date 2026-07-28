import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop pet shell", () => {
  it("runs tests in a DOM environment", () => {
    const canvas = document.createElement("canvas");
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("configures family-installable macOS and Windows bundles", async () => {
    const tauriRoot = join(process.cwd(), "src-tauri");
    const config = JSON.parse(
      await readFile(join(tauriRoot, "tauri.conf.json"), "utf8"),
    );

    expect(config.bundle.targets).toBe("all");
    expect(config.bundle.macOS.signingIdentity).toBe("-");
    expect(config.bundle.windows.webviewInstallMode.type).toBe(
      "downloadBootstrapper",
    );
    expect(config.bundle.windows.nsis).toMatchObject({
      installMode: "currentUser",
      languages: expect.arrayContaining(["SimpChinese", "English"]),
    });
    await Promise.all(
      [...config.bundle.icon, "icons/tray-32.png"].map((path: string) =>
        access(join(tauriRoot, path)),
      ),
    );
  });

  it("uses the Windows GUI subsystem in release builds", async () => {
    const mainSource = await readFile(
      join(process.cwd(), "src-tauri", "src", "main.rs"),
      "utf8",
    );

    expect(mainSource).toContain(
      '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]',
    );
  });

  it("prevents duplicate app processes and duplicate tray icons", async () => {
    const tauriRoot = join(process.cwd(), "src-tauri");
    const [cargo, libSource] = await Promise.all([
      readFile(join(tauriRoot, "Cargo.toml"), "utf8"),
      readFile(join(tauriRoot, "src", "lib.rs"), "utf8"),
    ]);

    expect(cargo).toContain("tauri-plugin-single-instance");
    expect(libSource).toContain("tauri_plugin_single_instance::init");
  });
});
