import {
  InteractionWheelModel,
  type PrimaryInteraction,
  type SecondaryInteraction,
} from "./interaction-wheel-model";
import pawIcon from "../../icons/twemoji/1f43e.svg";
import bowlIcon from "../../icons/twemoji/1f963.svg";
import yarnIcon from "../../icons/twemoji/1f9f6.svg";
import moonIcon from "../../icons/twemoji/1f319.svg";
import treatIcon from "../../icons/twemoji/1f365.svg";
import canIcon from "../../icons/twemoji/1f96b.svg";
import butterflyIcon from "../../icons/twemoji/1f98b.svg";
import wandIcon from "../../icons/twemoji/1fa84.svg";
import sunIcon from "../../icons/twemoji/2600.svg";

export interface InteractionWheelViewOptions {
  enterBodyInteraction?(): void;
  select?(option: SecondaryInteraction): void | Promise<void>;
  close?(): void;
  getAffection?(): number;
}

const labels: Record<PrimaryInteraction | SecondaryInteraction, string> = {
  touch: "亲近",
  feed: "喂食",
  play: "玩耍",
  companion: "陪伴",
  treat: "猫条",
  kibble: "猫粮",
  can: "罐罐",
  ball: "玩球",
  butterfly: "追蝴蝶",
  wand: "逗猫棒",
  sleep: "睡觉",
  wake: "唤醒",
};

const iconUrls: Record<PrimaryInteraction | SecondaryInteraction, string> = {
  touch: pawIcon,
  feed: bowlIcon,
  play: yarnIcon,
  companion: moonIcon,
  treat: treatIcon,
  kibble: bowlIcon,
  can: canIcon,
  ball: yarnIcon,
  butterfly: butterflyIcon,
  wand: wandIcon,
  sleep: moonIcon,
  wake: sunIcon,
};

export class InteractionWheelView {
  private readonly model: InteractionWheelModel;
  private transitionTimer: number | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly options: InteractionWheelViewOptions = {},
  ) {
    this.model = new InteractionWheelModel(
      options.getAffection ?? (() => 0),
    );
  }

  open(): void {
    this.clearTimer();
    this.model.open();
    this.render();
  }

  close(): void {
    this.clearTimer();
    this.model.close();
    this.render();
    this.options.close?.();
  }

  back(): void {
    this.clearTimer();
    this.root.dataset.transition = "leaving";
    this.transitionTimer = window.setTimeout(() => {
      this.model.back();
      this.render("entering");
    }, 240);
  }

  private choosePrimary(primary: PrimaryInteraction): void {
    this.root.dataset.transition = "leaving";
    this.transitionTimer = window.setTimeout(() => {
      this.model.choosePrimary(primary);
      this.render("entering");
      if (primary === "touch") {
        this.options.enterBodyInteraction?.();
      }
    }, 240);
  }

  private chooseSecondary(option: SecondaryInteraction): void {
    this.clearTimer();
    this.model.perform();
    this.render();
    Promise.resolve(this.options.select?.(option))
      .catch(() => undefined)
      .finally(() => {
        if (this.model.snapshot().phase === "performing") {
          this.close();
        }
      });
  }

  private render(transition?: "entering"): void {
    const snapshot = this.model.snapshot();
    this.root.dataset.phase = snapshot.phase;
    if (transition) {
      this.root.dataset.transition = transition;
      window.setTimeout(() => {
        if (this.root.dataset.transition === transition) {
          delete this.root.dataset.transition;
        }
      }, 460);
    } else {
      delete this.root.dataset.transition;
    }
    this.root.replaceChildren();
    if (snapshot.phase === "closed") {
      this.root.setAttribute("aria-hidden", "true");
      return;
    }
    this.root.setAttribute("aria-hidden", "false");
    if (snapshot.phase === "body-interaction") {
      const exit = this.makeUtilityButton("返回", "back");
      exit.addEventListener("click", () => this.back());
      this.root.append(exit);
      return;
    }
    if (snapshot.phase === "secondary") {
      const back = this.makeUtilityButton("返回", "back");
      back.addEventListener("click", () => this.back());
      this.root.append(back);
    }
    snapshot.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "interaction-orb";
      button.dataset.option = option;
      button.style.setProperty("--orb-index", String(index));
      button.setAttribute("aria-label", labels[option]);
      button.title = labels[option];
      const icon = document.createElement("img");
      icon.alt = "";
      icon.draggable = false;
      icon.src = iconUrls[option];
      button.append(icon);
      if (snapshot.phase === "primary") {
        button.addEventListener("click", () =>
          this.choosePrimary(option as PrimaryInteraction),
        );
      } else {
        button.addEventListener("click", () =>
          this.chooseSecondary(option as SecondaryInteraction),
        );
      }
      this.root.append(button);
    });
  }

  private makeUtilityButton(
    label: string,
    role: string,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interaction-orb interaction-orb--utility";
    button.dataset.role = role;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML =
      '<svg viewBox="0 0 38 38" aria-hidden="true"><path d="m22 10-9 9 9 9"/><path d="M14 19h13"/></svg>';
    return button;
  }

  private clearTimer(): void {
    if (this.transitionTimer !== undefined) {
      window.clearTimeout(this.transitionTimer);
    }
    this.transitionTimer = undefined;
  }
}
