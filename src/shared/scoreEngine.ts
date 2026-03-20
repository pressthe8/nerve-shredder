// Shared deterministic score engine — used by both client and server
// ZERO dependencies. Must remain pure TypeScript with no platform imports.

export type RunPersonality = {
  baseIncrementRange: [number, number];
  jumpChance: number;
  dipChance: number;
  initialSpikeChance: number;
};

/** Tick quantization interval in milliseconds (legacy — kept for backward compat) */
export const TICK_MS = 50;

/** How long each step is displayed in the new sequence-based mechanic */
export const STEP_DISPLAY_MS = 1000;

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
 * Compute the exact score at a given elapsed time.
 *
 * Both client and server call this with identical inputs to get identical output.
 * The PRNG is advanced the same number of times regardless of which branch is taken
 * at each tick (critical for determinism).
 *
 * Algorithm:
 * - Start at score = 10
 * - Tick 0: initial spike check (consumes 2 RNG calls)
 * - Each subsequent tick consumes exactly 3 RNG calls:
 *   Roll 1 = branch selector, Roll 2 = base increment, Roll 3 = branch magnitude
 * - Dip: subtract baseIncrement * (0.5 + roll3 * 1.5)
 * - Jump: add baseIncrement * (2 + roll3 * 4)
 * - Normal: add baseIncrement (roll3 consumed but unused)
 * - Floor at 1 after every tick
 */
export const computeScoreAtMs = (
  seed: number,
  personality: RunPersonality,
  elapsedMs: number
): number => {
  const tickCount = Math.floor(elapsedMs / TICK_MS);
  const rng = mulberry32(seed);
  let score = 10;

  // --- Tick 0: initial spike (always consumes exactly 2 RNG calls) ---
  const spikeRoll = rng();
  if (spikeRoll < personality.initialSpikeChance) {
    const spikeMultiplier = 3 + rng() * 5; // 3x to 8x
    score = Math.floor(score * spikeMultiplier);
  } else {
    rng(); // consume to keep RNG in sync
  }

  // --- Ticks 1..N (each consumes exactly 3 RNG calls) ---
  const [lo, hi] = personality.baseIncrementRange;
  for (let t = 1; t <= tickCount; t++) {
    const roll = rng();                       // Roll 1: branch selector
    const baseIncrement = lo + rng() * (hi - lo); // Roll 2: increment size
    const roll3 = rng();                      // Roll 3: branch magnitude

    if (roll < personality.dipChance) {
      // Dip — counter drops
      const dipAmount = baseIncrement * (0.5 + roll3 * 1.5);
      score -= dipAmount;
    } else if (roll < personality.dipChance + personality.jumpChance) {
      // Jump — large upward spike
      const jumpMultiplier = 2 + roll3 * 4;
      score += baseIncrement * jumpMultiplier;
    } else {
      // Normal — steady increment
      score += baseIncrement;
    }

    // Floor at 1
    if (score < 1) score = 1;
  }

  return Math.floor(score);
};

/**
 * Generate a pre-determined sequence of scores for a run.
 *
 * The step count is randomized within stepRange using a triangular distribution
 * (average of 2 PRNG rolls) so most runs cluster toward the middle of the range.
 * Because the PRNG is seeded deterministically, every player gets the same
 * sequence for the same day/run.
 *
 * RNG consumption order:
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
  for (let t = 1; t < stepCount; t++) {
    const roll = rng();
    const baseIncrement = lo + rng() * (hi - lo);
    const roll3 = rng();

    if (roll < personality.dipChance) {
      score -= baseIncrement * (0.5 + roll3 * 1.5);
    } else if (roll < personality.dipChance + personality.jumpChance) {
      score += baseIncrement * (2 + roll3 * 4);
    } else {
      score += baseIncrement;
    }
    if (score < 1) score = 1;
    sequence.push(Math.floor(score));
  }

  return sequence;
};
