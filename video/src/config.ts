/**
 * Timing for the demo video.
 *
 * The judges stop watching at 3:00, so the running order is ruthless: the
 * interesting thing — a green test suite on a broken product — lands in the
 * first fifteen seconds, and everything after it is consequence.
 *
 * Two scenes are real screen recordings rather than composed cards:
 *   terminal  36.1s of a genuine Kane session, captured with asciinema
 *   browser   19.8s of the real handover page, captured over Chrome DevTools
 * Their scene lengths must stay at or above those durations.
 */
export const FPS = 30;

export const seconds = (n: number): number => Math.round(n * FPS);

/** Scene lengths in seconds, in order. Total must stay under 180. */
export const SCENES = {
  hook: 16,
  falsePass: 27,
  problem: 11,
  document: 13,
  /** Real recording: 36.1s. */
  terminal: 38,
  /** Real recording: 19.8s. */
  browser: 21,
  green: 15,
  accept: 12,
} as const;

export const SCENE_ORDER = [
  'hook',
  'falsePass',
  'problem',
  'document',
  'terminal',
  'browser',
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
