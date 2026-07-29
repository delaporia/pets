import type { TestActionEntry } from "./test-action-catalog";

export interface TestActionWheelViewOptions {
  select(action: TestActionEntry): void | Promise<void>;
  close(): void;
}

const pageSize = 6;
const placements = [
  { x: 8, y: -100 },
  { x: 44, y: -64 },
  { x: 68, y: -23 },
  { x: 68, y: 23 },
  { x: 44, y: 64 },
  { x: 8, y: 100 },
];

export class TestActionWheelView {
  private actions: TestActionEntry[] = [];
  private page = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly options: TestActionWheelViewOptions,
  ) {}

  open(actions: readonly TestActionEntry[]): void {
    this.actions = [...actions];
    this.page = 0;
    this.render();
  }

  close(): void {
    this.root.dataset.phase = "closed";
    this.root.setAttribute("aria-hidden", "true");
    this.root.replaceChildren();
    this.options.close();
  }

  private render(): void {
    this.root.dataset.phase = "test";
    this.root.setAttribute("aria-hidden", "false");
    this.root.replaceChildren();
    const start = this.page * pageSize;
    const pageActions = this.actions.slice(start, start + pageSize);
    const side = this.root.dataset.side === "left" ? -1 : 1;

    pageActions.forEach((action, index) => {
      const placement = placements[index]!;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "interaction-orb interaction-orb--test";
      button.dataset.testAction = action.id;
      button.dataset.option = action.id;
      button.style.setProperty("--orb-index", String(index));
      button.style.setProperty("--orb-x", `${placement.x * side}px`);
      button.style.setProperty("--orb-y", `${placement.y}px`);
      button.title = `${action.label} · ${action.id}`;
      button.setAttribute("aria-label", action.label);
      const glyph = document.createElement("span");
      glyph.className = "test-action-glyph";
      glyph.textContent = action.label.slice(0, 1);
      button.append(glyph);
      button.addEventListener("click", () => {
        this.close();
        void Promise.resolve(this.options.select(action))
          .catch(() => undefined);
      });
      this.root.append(button);
    });

    if (this.page > 0) {
      this.root.append(this.pageButton("上一页", "previous", -22));
    }
    if (start + pageSize < this.actions.length) {
      this.root.append(this.pageButton("下一页", "next", 22));
    }
  }

  private pageButton(
    label: string,
    role: "previous" | "next",
    y: number,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "interaction-orb interaction-orb--utility interaction-orb--test-page";
    button.dataset.role = role;
    button.title = label;
    button.setAttribute("aria-label", label);
    const direction = role === "next" ? 1 : -1;
    const side = this.root.dataset.side === "left" ? -1 : 1;
    button.style.setProperty("--orb-x", `${108 * side}px`);
    button.style.setProperty("--orb-y", `${y}px`);
    button.innerHTML = `<svg viewBox="0 0 38 38" aria-hidden="true"><path d="m${direction > 0 ? 16 : 22} 10 ${direction > 0 ? 25 : 13} 19 ${direction > 0 ? 16 : 22} 28"/><path d="M${direction > 0 ? 24 : 14} 19H${direction > 0 ? 11 : 27}"/></svg>`;
    button.addEventListener("click", () => {
      this.page += direction;
      this.render();
    });
    return button;
  }
}
