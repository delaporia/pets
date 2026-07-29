export type PrimaryInteraction =
  | "touch"
  | "feed"
  | "play"
  | "sleep"
  | "wake";

export type SecondaryInteraction =
  | "treat"
  | "kibble"
  | "can"
  | "ball"
  | "butterfly"
  | "wand";

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
  "sleep",
  "wake",
];

const secondaryOptions: Record<
  Extract<PrimaryInteraction, "feed" | "play">,
  SecondaryInteraction[]
> = {
  feed: ["treat", "kibble", "can"],
  play: ["butterfly", "ball", "wand"],
};

export class InteractionWheelModel {
  private phase: InteractionWheelPhase = "closed";
  private primary: PrimaryInteraction | null = null;

  constructor(
    private readonly isAvailable: (
      option: PrimaryInteraction | SecondaryInteraction,
    ) => boolean = (option) => option !== "wake",
  ) {}

  open(): void {
    this.phase = "primary";
    this.primary = null;
  }

  choosePrimary(primary: PrimaryInteraction): void {
    if (this.phase !== "primary") return;
    this.primary = primary;
    this.phase =
      primary === "touch"
        ? "body-interaction"
        : primary === "sleep" || primary === "wake"
          ? "performing"
          : "secondary";
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
        options: primaryOptions.filter(this.isAvailable),
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
        this.primary as Extract<PrimaryInteraction, "feed" | "play">
      ].filter(this.isAvailable),
    };
  }
}
