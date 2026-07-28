import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  publicDir: "src/assets",
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
