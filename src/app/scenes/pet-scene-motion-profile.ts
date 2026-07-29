export interface PetSceneMotionProfile {
  observeLean: number;
  crouchCompression: number;
  runBobPx: number;
  pounceStretch: number;
  landingCompression: number;
  strideScale: number;
}

const profiles: Record<string, PetSceneMotionProfile> = {
  wuyi: {
    observeLean: 0.018,
    crouchCompression: 0.96,
    runBobPx: 2,
    pounceStretch: 1.04,
    landingCompression: 0.96,
    strideScale: 0.92,
  },
  wuyiyi: {
    observeLean: 0.022,
    crouchCompression: 0.95,
    runBobPx: 2.5,
    pounceStretch: 1.05,
    landingCompression: 0.95,
    strideScale: 0.96,
  },
  ying: {
    observeLean: 0.032,
    crouchCompression: 0.92,
    runBobPx: 4,
    pounceStretch: 1.1,
    landingCompression: 0.92,
    strideScale: 1,
  },
  baitang: {
    observeLean: 0.014,
    crouchCompression: 0.96,
    runBobPx: 2.5,
    pounceStretch: 1.03,
    landingCompression: 0.97,
    strideScale: 0.88,
  },
  duobi: {
    observeLean: 0.026,
    crouchCompression: 0.94,
    runBobPx: 3.5,
    pounceStretch: 1.07,
    landingCompression: 0.94,
    strideScale: 1.08,
  },
};

const fallback = profiles.ying!;

export function petSceneMotionProfileFor(
  petId: string,
): PetSceneMotionProfile {
  return { ...(profiles[petId] ?? fallback) };
}
