import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { context, redis, reddit } from '@devvit/web/server';
import { generateSequence, hashSeed, STEP_DISPLAY_MS } from '../../shared/scoreEngine.js';
import { bucketShredometerTier, type ShredometerTier } from '../../shared/shredometer.js';
import { getWeekId, getDayOfWeek, getGameDayLabel, getWeekLabel } from '../../shared/weekUtils.js';
import { awardBetaTesterFlairIfEligible } from '../core/flair.js';
import { buildOptimalBankComment } from '../core/commentCopy.js';
import type { T1, T3 } from '@devvit/shared-types/tid.js';

// Each run has a specific pre-computed personality
const RunPersonalitySchema = z.object({
  baseIncrementRange: z.tuple([z.number(), z.number()]),
  jumpChance: z.number(),
  dipChance: z.number(),
  initialSpikeChance: z.number(),
  jumpMultiplierRange: z.tuple([z.number(), z.number()]),
});

// The backend defines a step range; actual step count is determined by the PRNG
const ServerRunSchema = z.object({
  personality: RunPersonalitySchema,
  stepRange: z.tuple([z.number(), z.number()]),
});

type ServerRun = z.infer<typeof ServerRunSchema>;

// 3 distinct run personalities per day
const generateDailyRuns = (): ServerRun[] => {
  return [
    // Slow & Cautious
    {
      personality: {
        baseIncrementRange: [1, 5] as [number, number],
        jumpChance: 0.05,
        dipChance: 0.1,
        initialSpikeChance: 0.2,
        jumpMultiplierRange: [2, 6] as [number, number],
      },
      stepRange: [6, 20] as [number, number],
    },
    // Fast & Volatile
    {
      personality: {
        baseIncrementRange: [3, 10] as [number, number],
        jumpChance: 0.15,
        dipChance: 0.2,
        initialSpikeChance: 0.05,
        jumpMultiplierRange: [4, 12] as [number, number],
      },
      stepRange: [4, 16] as [number, number],
    },
    // Moderate & Spiky
    {
      personality: {
        baseIncrementRange: [2, 6] as [number, number],
        jumpChance: 0.1,
        dipChance: 0.15,
        initialSpikeChance: 0.5,
        jumpMultiplierRange: [3, 10] as [number, number],
      },
      stepRange: [8, 30] as [number, number],
    },
  ];
};

type DailyRunsBundle = { runs: ServerRun[]; peakSum: number };

const computePeakSum = (dayId: string, runs: ServerRun[]): number => {
  let sum = 0;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    const seed = hashSeed(dayId, i);
    const sequence = generateSequence(seed, run.personality, run.stepRange);
    sum += Math.max(...sequence);
  }
  return sum;
};

const getDailyRuns = async (dayId: string): Promise<DailyRunsBundle> => {
  const cachedStr = await redis.get(`global:day:${dayId}:runs`);
  if (cachedStr) {
    const parsed = JSON.parse(cachedStr) as Record<string, unknown>;
    // New bundle format: { runs, peakSum }
    const bundleRuns = (parsed as { runs?: unknown }).runs;
    const bundlePeak = (parsed as { peakSum?: unknown }).peakSum;
    if (Array.isArray(bundleRuns) && typeof bundlePeak === 'number') {
      const first = bundleRuns[0] as { personality?: { jumpMultiplierRange?: unknown } } | undefined;
      if (first?.personality?.jumpMultiplierRange) {
        return { runs: bundleRuns as ServerRun[], peakSum: bundlePeak };
      }
    }
    // Legacy array format (pre-bundle) or stale personality format — fall through to regenerate
  }
  const runs = generateDailyRuns();
  const peakSum = computePeakSum(dayId, runs);
  const bundle: DailyRunsBundle = { runs, peakSum };
  await redis.set(`global:day:${dayId}:runs`, JSON.stringify(bundle));
  return bundle;
};

// Shuffles an array seedlessly for randomness per-player but deterministic order.
// Since the prompt said "same 3 runs, but in a random order", we can just shuffle them randomly per user on the fly and store the order, or just shuffle and rely on user state.
// Wait, we need to track WHICH run they are playing. The runs are indices 0, 1, 2.

const LATENCY_BUFFER_MS = 1000; // 1 second buffer for latency

/** Check if a player has completed all 3 daily runs (score exists for each). */
const hasCompletedAllRuns = async (username: string, dayId: string): Promise<boolean> => {
  const scores = await Promise.all([
    redis.get(`user:${username}:day:${dayId}:run:0:score`),
    redis.get(`user:${username}:day:${dayId}:run:1:score`),
    redis.get(`user:${username}:day:${dayId}:run:2:score`),
  ]);
  return scores.every(s => s !== null && s !== undefined && s !== '');
};

// Get weekly multiplier based on perfect days earned this week
const getWeeklyMultiplier = (perfectDayCount: number): number => {
  const multipliers = [1.0, 1.1, 1.2, 1.3, 1.4, 1.4, 1.5];
  return multipliers[Math.min(perfectDayCount, 6)] ?? 1.0;
};

// Calculate weekly total by summing already-multiplied daily scores
const calculateWeeklyTotal = async (username: string, weekId: string): Promise<number> => {
  const multipliedScores = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores_multiplied`) as Record<string, string>;

  // Fallback to raw scores for days without multiplied data (legacy/pre-multiplier)
  const rawScores = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores`) as Record<string, string>;

  let total = 0;
  const allDayIds = new Set([...Object.keys(multipliedScores), ...Object.keys(rawScores)]);
  for (const dayId of allDayIds) {
    if (multipliedScores[dayId]) {
      total += parseInt(multipliedScores[dayId], 10);
    } else if (rawScores[dayId]) {
      total += parseInt(rawScores[dayId], 10); // 1.0x fallback for legacy data
    }
  }

  return total;
};

/**
 * Resolve the weekId for the current post.
 * Checks context.postData first, then Redis fallback, then legacy handling.
 */
const resolvePostWeekId = async (): Promise<string | null> => {
  const { postId, postData } = context;
  if (!postId) return null;

  // Primary: postData set at post creation time
  if (postData && typeof postData === 'object' && 'weekId' in postData) {
    return String(postData.weekId);
  }

  // Fallback: Redis mapping (for posts created before postData was available)
  const redisWeekId = await redis.get(`post:${postId}:week_id`);
  if (redisWeekId) return redisWeekId;

  return null;
};

/**
 * Guard that throws if the current post belongs to an expired week.
 * Legacy posts (no weekId) are allowed unless the weekly system is active.
 */
const assertActiveWeek = async (): Promise<void> => {
  const postWeekId = await resolvePostWeekId();
  const currentWeekId = getWeekId(new Date());

  if (postWeekId) {
    if (postWeekId !== currentWeekId) {
      throw new Error('This game week has ended. Visit the current week\'s post to play.');
    }
    return;
  }

  // No weekId on this post — check if the weekly system is active
  const weeklySystemActive = await redis.get('first_weekly_post_created');
  if (weeklySystemActive) {
    throw new Error('This game week has ended. Visit the current week\'s post to play.');
  }
  // Pre-weekly-system legacy post — allow
};

export const gameRouter = router({
  getGameState: publicProcedure.query(async () => {
    const { postId } = context;
    if (!postId) throw new Error("postId is missing in context");
    
    const user = await reddit.getCurrentUser();
    const username = user?.username ?? 'anonymous';
    
    const now = new Date();
    // Use an arbitrary day epoch (e.g. Days since Jan 1 2024)
    const epochStart = new Date('2024-01-01T00:00:00Z');
    const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
    const weekId = getWeekId(now);
    const dayOfWeek = getDayOfWeek(now);

    // Get the user's run state
    const states = await Promise.all([
      redis.get(`user:${username}:day:${dayId}:run:0:score`),
      redis.get(`user:${username}:day:${dayId}:run:1:score`),
      redis.get(`user:${username}:day:${dayId}:run:2:score`)
    ]);

    const totalScore = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');

    // Convert states to scores (for display) - guard against empty strings and NaN
    const runScores = states.map(s => {
      if (s === null || s === undefined || s === '') return null;
      const parsed = parseInt(s, 10);
      return isNaN(parsed) ? null : parsed;
    });

    // Get weekly stats
    const lifetimePerfectDaysStr = await redis.get(`user:${username}:stats:lifetime_perfect_days`);
    // Note: Devvit Redis may not have sCard - using workaround
    const perfectDaysSet = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
    const weekPerfectDaysCount = perfectDaysSet ? JSON.parse(perfectDaysSet as string).length : 0;

    // Multiplier is based on perfect days earned, not day of week
    const weekMultiplier = getWeeklyMultiplier(weekPerfectDaysCount);

    const weeklyScore = await calculateWeeklyTotal(username, weekId);
    const joinedSub = await redis.get(`user:${username}:joined_sub`);

    // We also need to determine the user's run order. If missing, generate one.
    const runOrderStr = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'runOrder');
    let runOrder = [0, 1, 2];
    if (runOrderStr) {
      runOrder = JSON.parse(runOrderStr);
    } else {
      // Shuffle 0, 1, 2
      runOrder.sort(() => Math.random() - 0.5);
      await redis.hSet(`user:${username}:day:${dayId}:totals`, { runOrder: JSON.stringify(runOrder) });
    }

    return {
      dayId,
      username,
      totalScore: totalScore ? parseInt(totalScore, 10) : 0,
      runsCompleted: states.map((s: string | null | undefined) => s !== undefined && s !== null && s !== ''),
      serverTimestamp: now.toISOString(),
      runScores,
      runOrder,
      weekId,
      dayOfWeek,
      weekMultiplier,
      lifetimePerfectDays: lifetimePerfectDaysStr ? parseInt(lifetimePerfectDaysStr, 10) : 0,
      weekPerfectDays: weekPerfectDaysCount,
      weeklyScore,
      hasJoinedSub: joinedSub === '1'
    };
  }),

  getDailyVerdict: publicProcedure.query(async () => {
    const user = await reddit.getCurrentUser();
    const username = user?.username ?? 'anonymous';
    const now = new Date();
    const epochStart = new Date('2024-01-01T00:00:00Z');
    const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

    if (!(await hasCompletedAllRuns(username, dayId))) {
      return { tier: null as ShredometerTier | null };
    }

    const totalScoreStr = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');
    const dailyTotal = totalScoreStr ? parseInt(totalScoreStr, 10) : 0;

    const { peakSum } = await getDailyRuns(dayId);
    if (peakSum <= 0) {
      return { tier: null as ShredometerTier | null };
    }

    const ratio = dailyTotal / peakSum;
    const tier = bucketShredometerTier(ratio);
    console.log(`[verdict] verdict_key=${username}:${dayId} dailyTotal=${dailyTotal} peakSum=${peakSum} ratio=${ratio.toFixed(3)} tier=${tier}`);
    return { tier };
  }),

  startRun: publicProcedure
    .input(z.object({ runIndex: z.number().int().min(0).max(2) }))
    .mutation(async ({ input }) => {
      await assertActiveWeek();

      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Check if already completed
      const existingScore = await redis.get(`user:${username}:day:${dayId}:run:${input.runIndex}:score`);
      if (existingScore !== undefined && existingScore !== null) {
        throw new Error("Run already completed");
      }

      // If a startTime already exists, this is a restart — soft-flag it
      const existingStartTime = await redis.get(`user:${username}:day:${dayId}:run:${input.runIndex}:startTime`);
      if (existingStartTime) {
        void redis.incrBy(`flags:${username}:run_restarts`, 1);
      }

      // Record start time (2-day TTL — ephemeral, only needed for anti-cheat timing during the run)
      const startTime = Date.now();
      const startTimeKey = `user:${username}:day:${dayId}:run:${input.runIndex}:startTime`;
      await redis.set(startTimeKey, startTime.toString());
      void redis.expire(startTimeKey, 172800);

      // Get daily runs and generate the deterministic sequence
      const { runs } = await getDailyRuns(dayId);
      const run = runs[input.runIndex];

      if (!run) throw new Error("Run data not found");

      const seed = hashSeed(dayId, input.runIndex);
      const sequence = generateSequence(seed, run.personality, run.stepRange);

      return { sequence };
    }),

  bankRun: publicProcedure
    .input(z.object({
      runIndex: z.number().int().min(0).max(2),
      stepIndex: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      await assertActiveWeek();

      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Track first-ever play day for new player counting (permanent, no TTL)
      void (async () => {
        try {
          const firstSeenKey = `user:${username}:first_seen_day`;
          const alreadySeen = await redis.get(firstSeenKey);
          if (!alreadySeen) {
            await redis.set(firstSeenKey, dayId);
          }
        } catch { /* never break the bank flow */ }
      })();

      // Check if completed
      const existingScore = await redis.get(`user:${username}:day:${dayId}:run:${input.runIndex}:score`);
      if (existingScore !== undefined && existingScore !== null) {
        throw new Error("Run already completed");
      }

      const startTimeStr = await redis.get(`user:${username}:day:${dayId}:run:${input.runIndex}:startTime`);
      if (!startTimeStr) {
        throw new Error("Run not started");
      }

      const { runs } = await getDailyRuns(dayId);
      const run = runs[input.runIndex];

      if (!run) throw new Error("Run data not found");

      // Regenerate the authoritative sequence server-side
      const seed = hashSeed(dayId, input.runIndex);
      const sequence = generateSequence(seed, run.personality, run.stepRange);

      const startTime = parseInt(startTimeStr, 10);
      const serverElapsedMs = Date.now() - startTime;

      let finalScore = 0;
      const isBust = input.stepIndex >= sequence.length;

      if (isBust) {
        // Bust — player didn't bank before sequence ended
        finalScore = 0;
      } else {
        // Timing validation: player must have waited through each step
        const expectedMinMs = input.stepIndex * STEP_DISPLAY_MS - LATENCY_BUFFER_MS;
        if (serverElapsedMs < expectedMinMs) {
          // Suspicious — banked too fast for the claimed step
          finalScore = 0;
        } else {
          finalScore = sequence[input.stepIndex] ?? 0;
        }
      }

      // Detect optimal bank (banked at exact sequence peak, not a bust)
      const peakScore = Math.max(...sequence);
      const bankedAtPeak = finalScore > 0 && sequence[input.stepIndex] === peakScore;

      // Record score and optimal flag
      await redis.set(`user:${username}:day:${dayId}:run:${input.runIndex}:score`, finalScore.toString());
      await redis.set(`user:${username}:day:${dayId}:run:${input.runIndex}:optimal`, bankedAtPeak ? '1' : '0');

      // Update totals
      const currentTotalStr = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');
      const newTotal = (currentTotalStr ? parseInt(currentTotalStr, 10) : 0) + finalScore;
      await redis.hSet(`user:${username}:day:${dayId}:totals`, { score: newTotal.toString() });

      // Update daily leaderboard (cumulative total)
      await redis.zAdd(`leaderboard:daily:day:${dayId}`, { member: username, score: newTotal });

      // Update per-run leaderboard (individual run score, for percentile feedback)
      if (finalScore > 0) {
        await redis.zAdd(`leaderboard:daily:day:${dayId}:run:${input.runIndex}`, { member: username, score: finalScore });
      }

      // Check if all 3 runs are complete and successful (Perfect Day logic)
      const allScores = await Promise.all([
        redis.get(`user:${username}:day:${dayId}:run:0:score`),
        redis.get(`user:${username}:day:${dayId}:run:1:score`),
        redis.get(`user:${username}:day:${dayId}:run:2:score`)
      ]);

      const allComplete = allScores.every(s => s !== null && s !== undefined);
      const allSuccessful = allScores.every(s => s && parseInt(s, 10) > 0);

      if (allComplete && allSuccessful) {
        // Perfect Day achieved! Track it
        const weekId = getWeekId(now);
        const existingPerfectDays = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
        const perfectDaysArray = existingPerfectDays ? JSON.parse(existingPerfectDays as string) : [];
        if (!perfectDaysArray.includes(dayId)) {
          perfectDaysArray.push(dayId);
          await redis.set(`user:${username}:week:${weekId}:perfect_days`, JSON.stringify(perfectDaysArray));
          await redis.incrBy(`user:${username}:stats:lifetime_perfect_days`, 1);
        }
      }

      if (allComplete) {
        // Check how many runs the player banked at the exact sequence peak
        const optimalFlags = await Promise.all([
          redis.get(`user:${username}:day:${dayId}:run:0:optimal`),
          redis.get(`user:${username}:day:${dayId}:run:1:optimal`),
          redis.get(`user:${username}:day:${dayId}:run:2:optimal`),
        ]);
        const optimalCount = optimalFlags.filter(f => f === '1').length;

        if (optimalCount >= 1 && context.postId) {
          void (async () => {
            try {
              const resultsCommentId = await redis.get(`day:${dayId}:results_comment_id`);
              const targetId = (resultsCommentId ?? context.postId) as T1 | T3;
              const text = buildOptimalBankComment(username, optimalCount as 1 | 2 | 3);
              await reddit.submitComment({ id: targetId, text, runAs: 'APP' });
              console.log(`[bankRun] Highlight comment posted for ${username} (${optimalCount} optimal banks)`);
            } catch (err) {
              console.error(`[bankRun] Failed to post highlight comment: ${err}`);
            }
          })();
        }
      }

      // Update weekly leaderboard
      const weekId = getWeekId(now);

      // Snapshot weekly leaderboard before any today updates (lazy: once per day)
      const snapshotKey = `leaderboard:weekly:week:${weekId}:snapshot_day:${dayId}`;
      const snapshotExists = await redis.get(snapshotKey);
      if (!snapshotExists) {
        const currentTopScores = await redis.zRange(`leaderboard:weekly:week:${weekId}`, 0, 199, { by: 'rank', reverse: true });
        const snapshotEntries = currentTopScores.map((e: { member: string; score: number }) => ({
          username: e.member,
          score: e.score,
        }));
        await redis.set(snapshotKey, JSON.stringify(snapshotEntries));
      }

      const currentPerfectDaysStr = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
      const currentPerfectDaysCount = currentPerfectDaysStr ? JSON.parse(currentPerfectDaysStr as string).length : 0;
      const multiplier = getWeeklyMultiplier(currentPerfectDaysCount);
      const multipliedScore = Math.floor(newTotal * multiplier);

      await redis.hSet(`user:${username}:week:${weekId}:daily_scores`, { [dayId]: newTotal.toString() });
      await redis.hSet(`user:${username}:week:${weekId}:daily_scores_multiplied`, { [dayId]: multipliedScore.toString() });
      await redis.hSet(`user:${username}:week:${weekId}:daily_multipliers`, { [dayId]: multiplier.toString() });

      const weeklyTotal = await calculateWeeklyTotal(username, weekId);
      await redis.zAdd(`leaderboard:weekly:week:${weekId}`, { member: username, score: weeklyTotal });

      // Calculate percentile rank for feedback (per-run leaderboard, bucketed)
      let percentile: number | null = null;
      if (finalScore > 0) {
        const runLbKey = `leaderboard:daily:day:${dayId}:run:${input.runIndex}`;
        const userRank = await redis.zRank(runLbKey, username);
        const totalPlayers = await redis.zCard(runLbKey);

        if (userRank !== null && userRank !== undefined && totalPlayers >= 5) {
          const rawPercentile = Math.max(1, Math.round((1 - userRank / totalPlayers) * 100));
          const BUCKETS = [5, 10, 20, 30, 40, 50];
          percentile = BUCKETS.find(b => rawPercentile <= b) ?? null;
        }
      }

      // --- Soft-flagging: cumulative suspicion counters (fire-and-forget) ---
      const flagOps: Promise<unknown>[] = [
        redis.incrBy(`flags:${username}:total_runs`, 1)
      ];

      if (percentile !== null && percentile >= 99) {
        flagOps.push(redis.incrBy(`flags:${username}:top_percentile_runs`, 1));
      }

      // Flag if banked on the very last step (bong proximity)
      if (finalScore > 0 && input.stepIndex >= sequence.length - 1) {
        flagOps.push(redis.incrBy(`flags:${username}:bong_proximity_runs`, 1));
      }

      if (percentile !== null && percentile >= 99) {
        try {
          const fullUser = await reddit.getCurrentUser();
          if (fullUser?.createdAt) {
            const accountAgeMs = Date.now() - fullUser.createdAt.getTime();
            if (accountAgeMs < 48 * 60 * 60 * 1000) {
              flagOps.push(redis.incrBy(`flags:${username}:new_account_top_runs`, 1));
            }
          }
        } catch {
          // Silently ignore — flag check must never break the bank flow
        }
      }

      void Promise.allSettled(flagOps);

      // Award beta tester flair (fire-and-forget — silent fail if not a sub member)
      void awardBetaTesterFlairIfEligible(username).catch(() => {});

      // TTLs for user-keyed data — ensures data is auto-purged after inactivity
      // (onAccountDelete is not yet available on the Devvit Web platform)
      const TWO_DAYS = 172800;
      const TWO_WEEKS = 1209600;
      const THIRTY_DAYS = 2592000;
      void Promise.allSettled([
        // Per-day keys (2-day TTL — only relevant today)
        redis.expire(`user:${username}:day:${dayId}:run:0:score`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:1:score`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:2:score`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:0:startTime`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:1:startTime`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:2:startTime`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:0:optimal`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:1:optimal`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:run:2:optimal`, TWO_DAYS),
        redis.expire(`user:${username}:day:${dayId}:totals`, TWO_DAYS),
        // Per-run leaderboard keys (2-week TTL — same as daily leaderboard)
        redis.expire(`leaderboard:daily:day:${dayId}:run:0`, TWO_WEEKS),
        redis.expire(`leaderboard:daily:day:${dayId}:run:1`, TWO_WEEKS),
        redis.expire(`leaderboard:daily:day:${dayId}:run:2`, TWO_WEEKS),
        // Per-week keys (2-week TTL — relevant until week ends + a few days)
        redis.expire(`user:${username}:week:${weekId}:perfect_days`, TWO_WEEKS),
        redis.expire(`user:${username}:week:${weekId}:daily_scores`, TWO_WEEKS),
        redis.expire(`user:${username}:week:${weekId}:daily_scores_multiplied`, TWO_WEEKS),
        redis.expire(`user:${username}:week:${weekId}:daily_multipliers`, TWO_WEEKS),
        // Flag keys (30-day TTL — anti-cheat counters)
        redis.expire(`flags:${username}:total_runs`, THIRTY_DAYS),
        redis.expire(`flags:${username}:top_percentile_runs`, THIRTY_DAYS),
        redis.expire(`flags:${username}:bong_proximity_runs`, THIRTY_DAYS),
        redis.expire(`flags:${username}:new_account_top_runs`, THIRTY_DAYS),
        redis.expire(`flags:${username}:run_restarts`, THIRTY_DAYS),
      ]);

      return { finalScore, bust: finalScore === 0, percentile };
    }),


    getLeaderboard: publicProcedure.query(async () => {
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Lock: only show daily leaderboard after the player completes all 3 runs
      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const completed = await hasCompletedAllRuns(username, dayId);

      if (!completed) {
        return { locked: true as const, entries: [] };
      }

      const topScores = await redis.zRange(`leaderboard:daily:day:${dayId}`, 0, 199, { by: 'rank', reverse: true });
      const entries = topScores.map((entry: { member: string; score: number }) => ({
        username: entry.member,
        score: entry.score,
      }));
      const inList = entries.some((e: { username: string; score: number }) => e.username === username);
      let currentUserRank: number | null = null;
      let currentUserScore: number | null = null;
      if (!inList) {
        const rankAsc = await redis.zRank(`leaderboard:daily:day:${dayId}`, username);
        const score = await redis.zScore(`leaderboard:daily:day:${dayId}`, username);
        const total = await redis.zCard(`leaderboard:daily:day:${dayId}`);
        if (rankAsc !== null && rankAsc !== undefined && score !== null && score !== undefined) {
          currentUserRank = total - rankAsc;
          currentUserScore = score;
        }
      }
      return {
        locked: false as const,
        entries,
        currentUser: username,
        currentUserRank,
        currentUserScore,
      };
    }),

    getWeeklyLeaderboard: publicProcedure.query(async () => {
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
      const weekId = getWeekId(now);
      const dayOfWeek = getDayOfWeek(now);

      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const completed = await hasCompletedAllRuns(username, dayId);

      if (!completed) {
        // Serve the previous-day snapshot so players can see where they stand
        const snapshotKey = `leaderboard:weekly:week:${weekId}:snapshot_day:${dayId}`;
        const snapshotData = await redis.get(snapshotKey);
        if (snapshotData) {
          const entries = JSON.parse(snapshotData) as Array<{ username: string; score: number }>;
          const inList = entries.some((e) => e.username === username);
          let currentUserRank: number | null = null;
          let currentUserScore: number | null = null;
          if (!inList) {
            const rankAsc = await redis.zRank(`leaderboard:weekly:week:${weekId}`, username);
            const score = await redis.zScore(`leaderboard:weekly:week:${weekId}`, username);
            const total = await redis.zCard(`leaderboard:weekly:week:${weekId}`);
            if (rankAsc !== null && rankAsc !== undefined && score !== null && score !== undefined) {
              currentUserRank = total - rankAsc;
              currentUserScore = score;
            }
          }
          return {
            locked: false as const,
            snapshot: true as const,
            snapshotDayLabel: dayOfWeek === 0 ? null : getGameDayLabel(dayOfWeek - 1),
            entries,
            currentUser: username,
            currentUserRank,
            currentUserScore,
          };
        }
        // No snapshot yet (first day of week or nobody has played today)
        return { locked: false as const, snapshot: false as const, snapshotDayLabel: null, entries: [] };
      }

      // Player completed all runs — show live data with played-today indicator
      const topScores = await redis.zRange(`leaderboard:weekly:week:${weekId}`, 0, 199, { by: 'rank', reverse: true });
      const entriesWithStatus = await Promise.all(
        topScores.map(async (entry: { member: string; score: number }) => {
          const dailyScore = await redis.zScore(`leaderboard:daily:day:${dayId}`, entry.member);
          return {
            username: entry.member,
            score: entry.score,
            playedToday: dailyScore !== null && dailyScore !== undefined,
          };
        })
      );
      const inList = entriesWithStatus.some((e) => e.username === username);
      let currentUserRank: number | null = null;
      let currentUserScore: number | null = null;
      if (!inList) {
        const rankAsc = await redis.zRank(`leaderboard:weekly:week:${weekId}`, username);
        const score = await redis.zScore(`leaderboard:weekly:week:${weekId}`, username);
        const total = await redis.zCard(`leaderboard:weekly:week:${weekId}`);
        if (rankAsc !== null && rankAsc !== undefined && score !== null && score !== undefined) {
          currentUserRank = total - rankAsc;
          currentUserScore = score;
        }
      }
      return {
        locked: false as const,
        snapshot: false as const,
        snapshotDayLabel: null,
        entries: entriesWithStatus,
        currentUser: username,
        currentUserRank,
        currentUserScore,
      };
    }),

    getPostWeekInfo: publicProcedure.query(async () => {
      const now = new Date();
      const currentWeekId = getWeekId(now);
      const postWeekId = await resolvePostWeekId();

      let effectiveWeekId: string;
      let isActiveWeek: boolean;
      let isLegacyPost = false;

      if (postWeekId) {
        effectiveWeekId = postWeekId;
        isActiveWeek = postWeekId === currentWeekId;
      } else {
        // No weekId — check if the weekly system is active
        const weeklySystemActive = await redis.get('first_weekly_post_created');
        if (weeklySystemActive) {
          // Legacy post after weekly system launched — treat as expired
          effectiveWeekId = 'legacy';
          isActiveWeek = false;
          isLegacyPost = true;
        } else {
          // Pre-weekly-system — treat as current
          effectiveWeekId = currentWeekId;
          isActiveWeek = true;
          isLegacyPost = true;
        }
      }

      // Get active post URL if this post is expired
      let activePostUrl: string | null = null;
      if (!isActiveWeek) {
        const activePostId = await redis.get('active_post_id');
        if (activePostId) {
          const cleanId = activePostId.replace('t3_', '');
          activePostUrl = `https://reddit.com/r/${context.subredditName}/comments/${cleanId}`;
        }
      }

      return {
        postWeekId: effectiveWeekId,
        currentWeekId,
        isActiveWeek,
        isLegacyPost,
        activePostUrl,
        weekLabel: effectiveWeekId === 'legacy' ? 'Legacy' : getWeekLabel(effectiveWeekId),
      };
    }),

    getFrozenLeaderboard: publicProcedure
      .input(z.object({ weekId: z.string() }))
      .query(async ({ input }) => {
        const user = await reddit.getCurrentUser();
        const username = user?.username ?? 'anonymous';

        const weekKey = `leaderboard:weekly:week:${input.weekId}`;
        const [topScores, totalPlayers] = await Promise.all([
          redis.zRange(weekKey, -3, -1, { by: 'rank' }),
          redis.zCard(weekKey),
        ]);

        const top3 = topScores.reverse().map((entry: { member: string; score: number }) => ({
          username: entry.member,
          score: entry.score,
        }));

        const inTop3 = top3.some((e: { username: string }) => e.username === username);
        let currentUserRank: number | null = null;
        let currentUserScore: number | null = null;

        if (!inTop3 && username !== 'anonymous') {
          const [rankAsc, score] = await Promise.all([
            redis.zRank(weekKey, username),
            redis.zScore(weekKey, username),
          ]);
          if (rankAsc !== null && rankAsc !== undefined && score !== null && score !== undefined) {
            currentUserRank = (totalPlayers ?? 0) - rankAsc;
            currentUserScore = score;
          }
        }

        return {
          top3,
          totalPlayers: totalPlayers ?? 0,
          currentUser: inTop3 ? null : username,
          currentUserRank,
          currentUserScore,
        };
      }),

    getWeeklyBreakdown: publicProcedure.query(async () => {
      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const weekId = getWeekId(now);
      const epochStart = new Date('2024-01-01T00:00:00Z');

      const rawScores = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores`) as Record<string, string>;
      const multipliedScores = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores_multiplied`) as Record<string, string>;
      const multipliers = await redis.hGetAll(`user:${username}:week:${weekId}:daily_multipliers`) as Record<string, string>;
      const perfectDaysStr = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
      const perfectDaysArray: string[] = perfectDaysStr ? JSON.parse(perfectDaysStr as string) : [];

      const days = Object.keys(rawScores).sort().map(dayId => {
        const daysSinceEpoch = parseInt(dayId, 10);
        const date = new Date(epochStart.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
        const dayOfWeek = getDayOfWeek(date);
        const rawScore = parseInt(rawScores[dayId] ?? '0', 10);
        const multScoreStr = multipliedScores[dayId];
        const multipliedScore = multScoreStr ? parseInt(multScoreStr, 10) : rawScore;
        const multStr = multipliers[dayId];
        const multiplier = multStr ? parseFloat(multStr) : 1.0;

        return {
          dayId,
          dayOfWeekName: getGameDayLabel(dayOfWeek),
          rawScore,
          multiplier,
          multipliedScore,
          isPerfectDay: perfectDaysArray.includes(dayId),
        };
      });

      const totalRaw = days.reduce((sum, d) => sum + d.rawScore, 0);
      const totalMultiplied = days.reduce((sum, d) => sum + d.multipliedScore, 0);

      return { days, totalRaw, totalMultiplied, perfectDayCount: perfectDaysArray.length };
    }),

    getPlayerBreakdown: publicProcedure
      .input(z.object({
        username: z.string(),
        mode: z.enum(['daily', 'weekly']),
      }))
      .query(async ({ input }) => {
        const now = new Date();
        const epochStart = new Date('2024-01-01T00:00:00Z');

        // Guard: requesting player must have completed all runs to view daily breakdowns
        if (input.mode === 'daily') {
          const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
          const requestingUser = await reddit.getCurrentUser();
          const requestingUsername = requestingUser?.username ?? 'anonymous';
          const completed = await hasCompletedAllRuns(requestingUsername, dayId);
          if (!completed) {
            throw new Error('Complete all 3 runs to view player breakdowns');
          }
        }

        const { username, mode } = input;

        if (mode === 'daily') {
          const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
          const [score0, score1, score2, totals] = await Promise.all([
            redis.get(`user:${username}:day:${dayId}:run:0:score`),
            redis.get(`user:${username}:day:${dayId}:run:1:score`),
            redis.get(`user:${username}:day:${dayId}:run:2:score`),
            redis.hGetAll(`user:${username}:day:${dayId}:totals`),
          ]);

          const scores = [score0, score1, score2];
          const runOrderRaw = (totals as Record<string, string>)?.runOrder;
          const runOrder: number[] = runOrderRaw ? JSON.parse(runOrderRaw) : [0, 1, 2];

          // Sort runs by the order the player actually played them
          const runs = runOrder.map((runIndex) => ({
            runIndex,
            score: scores[runIndex] !== null && scores[runIndex] !== undefined
              ? parseInt(scores[runIndex] as string, 10)
              : null,
          }));

          const totalScore = runs.reduce((sum, r) => sum + (r.score ?? 0), 0);
          return { username, mode: 'daily' as const, runs, totalScore };
        }

        // Weekly mode
        const weekId = getWeekId(now);
        const rawScores = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores`) as Record<string, string>;
        const multipliedScores = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores_multiplied`) as Record<string, string>;
        const multipliers = await redis.hGetAll(`user:${username}:week:${weekId}:daily_multipliers`) as Record<string, string>;
        const perfectDaysStr = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
        const perfectDaysArray: string[] = perfectDaysStr ? JSON.parse(perfectDaysStr as string) : [];

        const days = Object.keys(rawScores).sort().map(dayId => {
          const daysSinceEpoch = parseInt(dayId, 10);
          const date = new Date(epochStart.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
          const dayOfWeek = getDayOfWeek(date);
          const rawScore = parseInt(rawScores[dayId] ?? '0', 10);
          const multScoreStr = multipliedScores[dayId];
          const multipliedScore = multScoreStr ? parseInt(multScoreStr, 10) : rawScore;
          const multStr = multipliers[dayId];
          const multiplier = multStr ? parseFloat(multStr) : 1.0;

          return {
            dayId,
            dayOfWeekName: getGameDayLabel(dayOfWeek),
            rawScore,
            multiplier,
            multipliedScore,
            isPerfectDay: perfectDaysArray.includes(dayId),
          };
        });

        const totalMultiplied = days.reduce((sum, d) => sum + d.multipliedScore, 0);
        return { username, mode: 'weekly' as const, days, totalMultiplied, perfectDayCount: perfectDaysArray.length };
      }),

    getSuspiciousPlayers: publicProcedure.query(async () => {
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Get today's leaderboard players to check their flags
      const topPlayers = await redis.zRange(`leaderboard:daily:day:${dayId}`, 0, 99, { by: 'rank', reverse: true });

      const results: Array<{
        username: string;
        leaderboardScore: number;
        totalRuns: number;
        topPercentileRuns: number;
        bongProximityRuns: number;
        newAccountTopRuns: number;
        runRestarts: number;
      }> = [];

      for (const entry of topPlayers) {
        const [totalStr, topStr, proxStr, newAccStr, restartsStr] = await Promise.all([
          redis.get(`flags:${entry.member}:total_runs`),
          redis.get(`flags:${entry.member}:top_percentile_runs`),
          redis.get(`flags:${entry.member}:bong_proximity_runs`),
          redis.get(`flags:${entry.member}:new_account_top_runs`),
          redis.get(`flags:${entry.member}:run_restarts`),
        ]);

        const totalRuns = totalStr ? parseInt(totalStr, 10) : 0;
        const topPercentileRuns = topStr ? parseInt(topStr, 10) : 0;
        const bongProximityRuns = proxStr ? parseInt(proxStr, 10) : 0;
        const newAccountTopRuns = newAccStr ? parseInt(newAccStr, 10) : 0;
        const runRestarts = restartsStr ? parseInt(restartsStr, 10) : 0;

        // Only include players with any flags
        if (topPercentileRuns > 0 || bongProximityRuns > 0 || newAccountTopRuns > 0 || runRestarts > 0) {
          results.push({
            username: entry.member,
            leaderboardScore: entry.score,
            totalRuns,
            topPercentileRuns,
            bongProximityRuns,
            newAccountTopRuns,
            runRestarts,
          });
        }
      }

      // Sort by highest suspicion (top percentile ratio)
      results.sort((a, b) => {
        const ratioA = a.totalRuns > 0 ? a.topPercentileRuns / a.totalRuns : 0;
        const ratioB = b.totalRuns > 0 ? b.topPercentileRuns / b.totalRuns : 0;
        return ratioB - ratioA;
      });

      return results;
    })
});

export const appRouter = router({
  game: gameRouter
});

export type AppRouter = typeof appRouter;
