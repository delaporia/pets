import type { PetCareState } from "../care/care-state";
import type { Point } from "../runtime/pet-context";

const rounded = (value: number): number => Math.round(value);

export class CareStatusView {
  constructor(private readonly root: HTMLElement) {}

  show(state: PetCareState, origin: Point, width: number): void {
    const hunger = 100 - state.satiety;
    this.root.hidden = false;
    this.root.style.setProperty("--status-x", `${origin.x}px`);
    this.root.style.setProperty("--status-y", `${origin.y}px`);
    this.root.style.setProperty("--status-width", `${width}px`);
    this.root.innerHTML = [
      this.stat("energy", "⚡", rounded(state.energy)),
      this.stat("hunger", "🍽️", rounded(hunger)),
      this.stat("affection", "♥", rounded(state.affection)),
    ].join("");
  }

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private stat(id: string, icon: string, value: number): string {
    return `<span class="care-stat" data-stat="${id}" title="${value}"><i>${icon}</i><b>${value}</b><span><em style="width:${value}%"></em></span></span>`;
  }
}
