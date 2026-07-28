import type { Point, Size } from "../runtime/pet-context";
import type {
  YingBodyFeedback,
  YingPropCue,
} from "./ying-interaction-profile";
import type { BodyZone } from "./body-interaction";
import bowlIcon from "../../icons/twemoji/1f963.svg";
import canIcon from "../../icons/twemoji/1f96b.svg";
import yarnIcon from "../../icons/twemoji/1f9f6.svg";
import butterflyIcon from "../../icons/twemoji/1f98b.svg";
import wandIcon from "../../icons/twemoji/1fa84.svg";

export interface PropOverlayLayout {
  petOrigin: Point;
  petSize: Size;
  side: "left" | "right";
}

const cueDurations: Record<YingPropCue, number> = {
  treat: 4_200,
  kibble: 7_200,
  can: 5_600,
  ball: 4_400,
  butterfly: 4_800,
  wand: 4_600,
};

const propMarkup: Record<YingPropCue, string> = {
  treat:
    '<span class="treat-tube"><svg viewBox="0 0 80 120"><path class="prop-fill prop-fill--pink" d="m24 8 36 7-14 96-36-7L24 8Z"/><path d="m21 31 35 7M13 91l35 7"/><path class="prop-fill prop-fill--cream" d="M25 58c10-12 27-3 20 11-12 9-27 2-20-11Z"/></svg></span><span class="cat-tongue" data-effect="tongue"></span>',
  kibble:
    `<img class="food-bowl" data-effect="bowl" src="${bowlIcon}" alt=""><span class="kibble-bag"><b>CAT</b></span><span class="kibble-stream" data-effect="pour"><i></i><i></i><i></i><i></i><i></i></span>`,
  can:
    `<img class="food-can" src="${canIcon}" alt=""><span class="can-plate"></span><span class="food-heart" data-effect="heart">♥</span>`,
  ball:
    `<img src="${yarnIcon}" alt="">`,
  butterfly:
    `<img src="${butterflyIcon}" alt="">`,
  wand:
    `<img src="${wandIcon}" alt="">`,
};

const feedbackSvg: Record<YingBodyFeedback, string> = {
  pleased:
    '<svg viewBox="0 0 64 64"><path class="prop-fill prop-fill--pink" d="M32 54C5 38 10 15 24 17c5 1 8 5 8 9 1-6 6-10 12-9 14 3 15 24-12 37Z"/></svg>',
  curious:
    '<svg viewBox="0 0 64 64"><path class="prop-fill prop-fill--blue" d="M14 38c4-20 32-25 39-7 7 17-14 29-30 19l-10 4 4-11c-2-2-3-3-3-5Z"/><circle cx="25" cy="35" r="2"/><circle cx="34" cy="32" r="2"/><circle cx="43" cy="35" r="2"/></svg>',
  mischief:
    '<svg viewBox="0 0 64 64"><path class="prop-fill prop-fill--yellow" d="m32 7 7 15 17 2-12 12 3 17-15-8-15 8 3-17L8 24l17-2 7-15Z"/><path d="m24 33 5 4M40 33l-5 4"/></svg>',
  surprised:
    '<svg viewBox="0 0 64 64"><path class="prop-fill prop-fill--cream" d="M13 31C13 14 25 8 32 8s19 6 19 23-10 25-19 25-19-8-19-25Z"/><circle cx="24" cy="28" r="3"/><circle cx="40" cy="28" r="3"/><ellipse cx="32" cy="41" rx="5" ry="7"/></svg>',
};

export class PropOverlayView {
  private timer: number | undefined;
  private resolve: (() => void) | undefined;
  private timelineCue: YingPropCue | undefined;

  constructor(private readonly root: HTMLElement) {}

  beginTimeline(
    cue: YingPropCue,
    layout: PropOverlayLayout,
  ): void {
    this.cancel();
    this.applyLayout(layout);
    this.root.setAttribute("aria-hidden", "false");
    this.timelineCue = cue;
    document.body.dataset.interactionSide = layout.side;
    this.root.dataset.cue = cue;
    this.root.innerHTML = this.renderProp(cue, layout);
  }

  setTimelineStage(stage: string): void {
    if (!this.timelineCue) return;
    this.root.dataset.stage = stage;
    const prop = this.root.querySelector<HTMLElement>("[data-prop]");
    if (prop) prop.dataset.stage = stage;
    if (this.timelineCue) {
      document.body.dataset.interactionStage =
        `${this.timelineCue}:${stage}`;
    }
  }

  endTimeline(): void {
    this.clear();
  }

  play(cue: YingPropCue, layout: PropOverlayLayout): Promise<void> {
    this.cancel();
    this.applyLayout(layout);
    this.root.setAttribute("aria-hidden", "false");
    this.root.dataset.cue = cue;
    this.root.innerHTML = this.renderProp(cue, layout);
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
      this.timer = window.setTimeout(() => {
        this.clear();
        resolve();
      }, cueDurations[cue]);
    });
  }

  showBodyFeedback(
    feedback: YingBodyFeedback,
    zone: BodyZone,
    layout: PropOverlayLayout,
  ): void {
    this.cancel();
    this.applyLayout(layout);
    this.root.innerHTML =
      `<div class="body-feedback body-feedback--${feedback}" data-feedback="${feedback}" data-zone="${zone}">${feedbackSvg[feedback]}</div>`;
    this.timer = window.setTimeout(() => this.clear(), 900);
  }

  cancel(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    const resolve = this.resolve;
    this.clear();
    resolve?.();
  }

  private applyLayout(layout: PropOverlayLayout): void {
    this.root.dataset.side = layout.side;
    this.root.style.setProperty("--pet-origin-x", `${layout.petOrigin.x}px`);
    this.root.style.setProperty("--pet-origin-y", `${layout.petOrigin.y}px`);
    this.root.style.setProperty("--pet-width", `${layout.petSize.width}px`);
    this.root.style.setProperty("--pet-height", `${layout.petSize.height}px`);
    const x = layout.petOrigin.x;
    const y = layout.petOrigin.y;
    const width = layout.petSize.width;
    const height = layout.petSize.height;
    for (const [name, value] of Object.entries({
      "--pet-mouth-x": x + width * 0.6,
      "--pet-mouth-y": y + height * 0.3,
      "--pet-ground-prop-x": x + width * 0.58,
      "--pet-head-feedback-x": x + width * 0.57,
      "--pet-head-feedback-y": y + height * 0.04,
      "--pet-chin-feedback-x": x + width * 0.6,
      "--pet-chin-feedback-y": y + height * 0.34,
      "--pet-belly-feedback-x": x + width * 0.48,
      "--pet-belly-feedback-y": y + height * 0.58,
      "--pet-tail-feedback-x": x + width * 0.82,
      "--pet-tail-feedback-y": y + height * 0.64,
    })) {
      this.root.style.setProperty(name, `${value}px`);
    }
  }

  private renderProp(
    cue: YingPropCue,
    layout: PropOverlayLayout,
  ): string {
    const { x, y } = this.propPosition(cue, layout);
    return `<div class="interaction-prop interaction-prop--${cue}" data-prop="${cue}" role="img" aria-label="${cue}" style="left:${x}px;top:${y}px">${propMarkup[cue]}</div>`;
  }

  private propPosition(
    cue: YingPropCue,
    layout: PropOverlayLayout,
  ): Point {
    const { x, y } = layout.petOrigin;
    const { width, height } = layout.petSize;
    switch (cue) {
      case "treat":
        return { x: x + width * 0.6, y: y + height * 0.3 };
      case "kibble":
        return { x: x + width * 0.58, y: y + height - 54 };
      case "can":
        return { x: x + width * 0.58, y: y + height - 55 };
      case "ball":
        return { x: x + width + 22, y: y + height - 44 };
      case "butterfly":
        return { x: x + width + 18, y: y + 12 };
      case "wand":
        return { x: x + width + 2, y: y + 2 };
    }
  }

  private clear(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.resolve = undefined;
    this.timelineCue = undefined;
    delete document.body.dataset.interactionStage;
    delete document.body.dataset.interactionSide;
    delete this.root.dataset.cue;
    delete this.root.dataset.stage;
    delete this.root.dataset.side;
    this.root.setAttribute("aria-hidden", "true");
    this.root.replaceChildren();
  }
}
