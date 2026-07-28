export type PrimaryInteraction =
  | "touch"
  | "feed"
  | "play"
  | "companion";

export type SecondaryInteraction =
  | "treat"
  | "kibble"
  | "can"
  | "ball"
  | "butterfly"
  | "wand"
  | "sleep"
  | "wake";

export type InteractionWheelPhase =
  | "closed"
  | "primary"
  | "secondary"
  | "body-interaction"
  | "performing";

export interface InteractionWheelSnapshot {
  phase: InteractionWheelPhase;
  primary: PrimaryInteraction | null;
  options: Array<PrimaryInteraction | SecondaryInteraction>;
}

const primaryOptions: PrimaryInteraction[] = [
  "touch",
  "feed",
  "play",
  "companion",
];

const secondaryOptions: Record<
  Exclude<PrimaryInteraction, "touch">,
  SecondaryInteraction[]
> = {
  feed: ["treat", "kibble", "can"],
  play: ["ball", "wand", "butterfly"],
  companion: ["sleep", "wake"],
};

const unlockAt: Partial<Record<SecondaryInteraction, number>> = {
  kibble: 10,
  wand: 20,
  can: 30,
  butterfly: 30,
};

export class InteractionWheelModel {
  private phase: InteractionWheelPhase = "closed";
  private primary: PrimaryInteraction | null = null;

  constructor(private readonly getAffection: () => number = () => 0) {}

  open(): void {
    this.phase = "primary";
    this.primary = null;
  }

  choosePrimary(primary: PrimaryInteraction): void {
    if (this.phase !== "primary") return;
    this.primary = primary;
    this.phase =
      primary === "touch" ? "body-interaction" : "secondary";
  }

  back(): void {
    if (
      this.phase !== "secondary" &&
      this.phase !== "body-interaction"
    ) {
      return;
    }
    this.phase = "primary";
    this.primary = null;
  }

  perform(): void {
    if (this.phase !== "secondary") return;
    this.phase = "performing";
  }

  close(): void {
    this.phase = "closed";
    this.primary = null;
  }

  snapshot(): InteractionWheelSnapshot {
    if (this.phase === "closed") {
      return { phase: this.phase, primary: null, options: [] };
    }
    if (this.phase === "primary") {
      return {
        phase: this.phase,
        primary: null,
        options: [...primaryOptions],
      };
    }
    if (
      this.phase === "body-interaction" ||
      this.phase === "performing" ||
      !this.primary
    ) {
      return {
        phase: this.phase,
        primary: this.primary,
        options: [],
      };
    }
    return {
      phase: this.phase,
      primary: this.primary,
      options: secondaryOptions[
        this.primary as Exclude<PrimaryInteraction, "touch">
      ].filter((option) => this.getAffection() >= (unlockAt[option] ?? 0)),
    };
  }
}
