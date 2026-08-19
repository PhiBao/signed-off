/**
 * Timing for the demo video.
 *
 * The hackathon judges stop watching at 3:00, so the running order is ruthless:
 * the interesting thing — a green test suite on a broken product — happens in the
 * first fifteen seconds, and everything after it is consequence.
 */
export const FPS = 30;

export const seconds = (n: number): number => Math.round(n * FPS);

/** Scene lengths in seconds, in order. Total must stay under 180. */
export const SCENES = {
  hook: 15,
  falsePass: 27,
  problem: 13,
  init: 26,
  verify: 22,
  handover: 24,
  brief: 20,
  green: 18,
  accept: 13,
} as const;

export const SCENE_ORDER = [
  'hook',
  'falsePass',
  'problem',
  'init',
  'verify',
  'handover',
  'brief',
  'green',
  'accept',
] as const satisfies readonly (keyof typeof SCENES)[];

export const TOTAL_SECONDS = SCENE_ORDER.reduce((sum, key) => sum + SCENES[key], 0);
export const DURATION_IN_FRAMES = seconds(TOTAL_SECONDS);

/** Frame at which each scene starts. */
export function sceneStart(name: keyof typeof SCENES): number {
  let total = 0;
  for (const key of SCENE_ORDER) {
    if (key === name) break;
    total += SCENES[key];
  }
  return seconds(total);
}
