// Shared deterministic score engine — used by both client and server
// ZERO dependencies. Must remain pure TypeScript with no platform imports.

export type RunPersonality = {
  baseIncrementRange: [number, number];
  jumpChance: number;
  dipChance: number;
  initialSpikeChance: number;
  jumpMultiplierRange: [number, number];
};

/** How long each step is displayed in the sequence-based mechanic */
export const STEP_DISPLAY_MS = 1000;

/** Per-step scaling applied to base increment after a 1-step warm-up */
export const ACCEL_BASE_PER_STEP = 0.15;
/** Per-step additive bump applied to jump chance after a 1-step warm-up */
export const ACCEL_JUMP_PER_STEP = 0.02;
/** Hard cap so jump chance never runs away on very long runs */
export const JUMP_CHANCE_CAP = 0.60;

/**
 * mulberry32: deterministic 32-bit PRNG.
 * Returns a function that produces uniform floats in [0, 1).
 */
export const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministic seed from dayId + runIndex using djb2 hash.
 */
export const hashSeed = (dayId: string, runIndex: number): number => {
  const str = `${dayId}:${runIndex}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
};

/**
 * Generate a pre-determined sequence of scores for a run.
 *
 * The step count is randomized within stepRange using a triangular distribution
 * (average of 2 PRNG rolls) so most runs cluster toward the middle of the range.
 * Because the PRNG is seeded deterministically, every player gets the same
 * sequence for the same day/run.
 *
 * Late-run acceleration: starting at step 2 (k = t - 1), each step's base
 * increment and jump chance scale up. Step 1 is a neutral warm-up.
 *
 * RNG consumption order (do not change — determinism depends on it):
 *   2 calls for step-count (triangular distribution)
 *   2 calls for initial spike check (step 0)
 *   3 calls per subsequent step (branch selector, increment size, magnitude)
 */
export const generateSequence = (
  seed: number,
  personality: RunPersonality,
  stepRange: [number, number]
): number[] => {
  const rng = mulberry32(seed);

  // Determine step count using triangular distribution (2 rolls averaged)
  const [minSteps, maxSteps] = stepRange;
  const roll1 = rng();
  const roll2 = rng();
  const avg = (roll1 + roll2) / 2;
  const stepCount = Math.round(minSteps + avg * (maxSteps - minSteps));

  const sequence: number[] = [];
  let score = 10;

  // Step 0: initial spike check (always consumes exactly 2 RNG calls)
  const spikeRoll = rng();
  if (spikeRoll < personality.initialSpikeChance) {
    score = Math.floor(score * (3 + rng() * 5));
  } else {
    rng(); // consume to keep RNG in sync
  }
  sequence.push(score);

  // Steps 1..stepCount-1 (each consumes exactly 3 RNG calls)
  const [lo, hi] = personality.baseIncrementRange;
  const [jumpLo, jumpHi] = personality.jumpMultiplierRange;
  for (let t = 1; t < stepCount; t++) {
    const roll = rng();
    const baseIncrement = lo + rng() * (hi - lo);
    const roll3 = rng();

    // k = 0 on step 1 (warm-up), k = 1 on step 2, etc.
    const k = t - 1;
    const effectiveBase = baseIncrement * (1 + ACCEL_BASE_PER_STEP * k);
    const effectiveJumpChance = Math.min(
      JUMP_CHANCE_CAP,
      personality.jumpChance + ACCEL_JUMP_PER_STEP * k
    );

    if (roll < personality.dipChance) {
      score -= effectiveBase * (0.5 + roll3 * 1.5);
    } else if (roll < personality.dipChance + effectiveJumpChance) {
      const jumpMultiplier = jumpLo + roll3 * (jumpHi - jumpLo);
      score += effectiveBase * jumpMultiplier;
    } else {
      score += effectiveBase;
    }
    if (score < 1) score = 1;
    sequence.push(Math.floor(score));
  }

  return sequence;
};
