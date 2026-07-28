import "./styles.css";
import { bootDesktopPet } from "./app/bootstrap/app";

export async function boot(): Promise<void> {
  await bootDesktopPet();
}

void boot().catch((error: unknown) => {
  console.error("Desktop pet failed to start", error);
});
