// Throwaway sanity-check script. Not part of the built app.
// Run with: npx tsx scripts/simulateRuns.ts
//
// Generates N days of sequences for all 3 personalities, prints raw arrays
// + summary stats so we can eyeball the post-acceleration economy.

import {
  generateSequence,
  hashSeed,
  type RunPersonality,
} from '../src/shared/scoreEngine.js';

type NamedRun = {
  name: string;
  personality: RunPersonality;
  stepRange: [number, number];
};

const RUNS: NamedRun[] = [
  {
    name: 'Slow & Cautious',
    personality: {
      baseIncrementRange: [1, 5],
      jumpChance: 0.05,
      dipChance: 0.1,
      initialSpikeChance: 0.2,
      jumpMultiplierRange: [2, 6],
    },
    stepRange: [6, 20],
  },
  {
    name: 'Fast & Volatile',
    personality: {
      baseIncrementRange: [3, 10],
      jumpChance: 0.15,
      dipChance: 0.2,
      initialSpikeChance: 0.05,
      jumpMultiplierRange: [4, 12],
    },
    stepRange: [4, 16],
  },
  {
    name: 'Moderate & Spiky',
    personality: {
      baseIncrementRange: [2, 6],
      jumpChance: 0.1,
      dipChance: 0.15,
      initialSpikeChance: 0.5,
      jumpMultiplierRange: [3, 10],
    },
    stepRange: [8, 30],
  },
];

const N_DAYS = 30;
const START_DATE = new Date('2026-04-18');

const dayId = (offset: number): string => {
  const d = new Date(START_DATE);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

// Detect jumps by looking for step-over-step multiples too large to be a normal add.
// Normal add at step t is at most baseHi * (1 + 0.15 * (t - 1)).
// Anything bigger is a jump (or late-run acceleration of a jump).
const countJumpsAndDips = (
  seq: number[],
  personality: RunPersonality
): { jumps: number; dips: number } => {
  let jumps = 0;
  let dips = 0;
  const [, baseHi] = personality.baseIncrementRange;
  const [jumpLo] = personality.jumpMultiplierRange;
  for (let i = 1; i < seq.length; i++) {
    const delta = seq[i]! - seq[i - 1]!;
    const k = i - 1;
    const scale = 1 + 0.15 * k;
    const maxNormal = baseHi * scale;
    const minJump = baseHi * scale * jumpLo * 0.5; // fudge for floor
    if (delta < 0) dips++;
    else if (delta > maxNormal && delta >= minJump) jumps++;
  }
  return { jumps, dips };
};

type RunStats = {
  name: string;
  stepCounts: number[];
  peaks: number[];
  finalScores: number[];
  jumpCounts: number[];
  dipCounts: number[];
};

const statsByPersonality: Record<string, RunStats> = {};
for (const run of RUNS) {
  statsByPersonality[run.name] = {
    name: run.name,
    stepCounts: [],
    peaks: [],
    finalScores: [],
    jumpCounts: [],
    dipCounts: [],
  };
}

console.log('=== RAW SEQUENCES ===\n');
for (let day = 0; day < N_DAYS; day++) {
  const id = dayId(day);
  console.log(`--- Day ${id} ---`);
  for (let runIdx = 0; runIdx < RUNS.length; runIdx++) {
    const run = RUNS[runIdx]!;
    const seed = hashSeed(id, runIdx);
    const seq = generateSequence(seed, run.personality, run.stepRange);
    const peak = Math.max(...seq);
    const finalScore = seq[seq.length - 1]!;
    const { jumps, dips } = countJumpsAndDips(seq, run.personality);

    const stats = statsByPersonality[run.name]!;
    stats.stepCounts.push(seq.length);
    stats.peaks.push(peak);
    stats.finalScores.push(finalScore);
    stats.jumpCounts.push(jumps);
    stats.dipCounts.push(dips);

    const formatted = seq.map(v => `£${v}`).join(' → ');
    console.log(
      `  ${run.name.padEnd(18)} [${seq.length.toString().padStart(2)} steps, peak £${peak}, jumps ~${jumps}, dips ~${dips}]`
    );
    console.log(`    ${formatted}`);
  }
  console.log();
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
};

console.log('=== SUMMARY STATS (over ' + N_DAYS + ' days) ===\n');
for (const run of RUNS) {
  const s = statsByPersonality[run.name]!;
  console.log(`${run.name}`);
  console.log(`  stepRange config:  [${run.stepRange[0]}, ${run.stepRange[1]}]`);
  console.log(
    `  step count:        min=${Math.min(...s.stepCounts)} max=${Math.max(...s.stepCounts)} mean=${mean(s.stepCounts).toFixed(1)} median=${median(s.stepCounts)}`
  );
  console.log(
    `  peak £:            min=${Math.min(...s.peaks)} max=${Math.max(...s.peaks)} mean=${mean(s.peaks).toFixed(0)} median=${median(s.peaks)}`
  );
  console.log(
    `  final £ (bust):    min=${Math.min(...s.finalScores)} max=${Math.max(...s.finalScores)} mean=${mean(s.finalScores).toFixed(0)}`
  );
  console.log(
    `  jumps / run:       min=${Math.min(...s.jumpCounts)} max=${Math.max(...s.jumpCounts)} mean=${mean(s.jumpCounts).toFixed(2)}`
  );
  console.log(
    `  dips / run:        min=${Math.min(...s.dipCounts)} max=${Math.max(...s.dipCounts)} mean=${mean(s.dipCounts).toFixed(2)}`
  );
  console.log();
}
