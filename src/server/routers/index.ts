import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { context, redis, reddit } from '@devvit/web/server';

// Each run has a specific pre-computed personality
const RunPersonalitySchema = z.object({
  baseIncrementRange: z.tuple([z.number(), z.number()]),
  jumpChance: z.number(),
  dipChance: z.number(),
  initialSpikeChance: z.number(),
  runLengthMs: z.number()
});

export type RunPersonality = z.infer<typeof RunPersonalitySchema>;

// The backend adds the hidden bong time
const ServerRunSchema = z.object({
  personality: RunPersonalitySchema,
  bongTimeMs: z.number()
});

type ServerRun = z.infer<typeof ServerRunSchema>;

// We pre-compute 3 runs for the day
const generateDailyRuns = (): ServerRun[] => {
  // Hardcoded 3 distinct run personalities for V1
  return [
    {
      personality: { baseIncrementRange: [1, 5], jumpChance: 0.05, dipChance: 0.1, initialSpikeChance: 0.2, runLengthMs: 15000 },
      bongTimeMs: 7800
    },
    {
      personality: { baseIncrementRange: [3, 10], jumpChance: 0.15, dipChance: 0.2, initialSpikeChance: 0.05, runLengthMs: 12000 },
      bongTimeMs: 4200
    },
    {
      personality: { baseIncrementRange: [2, 6], jumpChance: 0.1, dipChance: 0.15, initialSpikeChance: 0.5, runLengthMs: 18000 },
      bongTimeMs: 11500
    }
  ];
};

const getDailyRuns = async (dayId: string): Promise<ServerRun[]> => {
  const runsStr = await redis.get(`global:day:${dayId}:runs`);
  if (runsStr) {
    return JSON.parse(runsStr) as ServerRun[];
  }
  const runs = generateDailyRuns();
  // Store them to ensure consistency
  await redis.set(`global:day:${dayId}:runs`, JSON.stringify(runs));
  return runs;
};

// Shuffles an array seedlessly for randomness per-player but deterministic order.
// Since the prompt said "same 3 runs, but in a random order", we can just shuffle them randomly per user on the fly and store the order, or just shuffle and rely on user state.
// Wait, we need to track WHICH run they are playing. The runs are indices 0, 1, 2.

const LATENCY_BUFFER_MS = 1000; // 1 second buffer for latency

// Week ID calculation - weeks since epoch (Monday as week start)
const getWeekId = (date: Date): string => {
  const epochStart = new Date('2024-01-01T00:00:00Z');
  const daysSinceEpoch = Math.floor((date.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24));
  // ISO 8601: Monday is first day of week
  // Adjust to get week number starting from Monday
  const epochDay = epochStart.getUTCDay(); // 1 = Monday for 2024-01-01
  const adjustedDays = daysSinceEpoch + (epochDay === 0 ? 6 : epochDay - 1);
  return Math.floor(adjustedDays / 7).toString();
};

// Get day of week (Monday = 0, Sunday = 6)
const getDayOfWeek = (date: Date): number => {
  const day = date.getUTCDay();
  return day === 0 ? 6 : day - 1;
};

// Get weekly multiplier based on day of week
const getWeeklyMultiplier = (dayOfWeek: number): number => {
  const multipliers = [1.0, 1.1, 1.2, 1.3, 1.4, 1.4, 1.5];
  return multipliers[dayOfWeek] ?? 1.0;
};

// Calculate weekly total with multipliers
const calculateWeeklyTotal = async (username: string, weekId: string): Promise<number> => {
  const dailyScoresStr = await redis.hGetAll(`user:${username}:week:${weekId}:daily_scores`) as Record<string, string>;

  let total = 0;
  for (const [dayId, scoreStr] of Object.entries(dailyScoresStr)) {
    const daysSinceEpoch = parseInt(dayId, 10);
    const epochStart = new Date('2024-01-01T00:00:00Z');
    const date = new Date(epochStart.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
    const dayOfWeek = getDayOfWeek(date);
    const multiplier = getWeeklyMultiplier(dayOfWeek);
    total += Math.floor(parseInt(scoreStr, 10) * multiplier);
  }

  return total;
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
    const weekMultiplier = getWeeklyMultiplier(dayOfWeek);

    // Get the user's run state
    const states = await Promise.all([
      redis.get(`user:${username}:day:${dayId}:run:0:score`),
      redis.get(`user:${username}:day:${dayId}:run:1:score`),
      redis.get(`user:${username}:day:${dayId}:run:2:score`)
    ]);

    const totalScore = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');

    // Convert states to scores (for display)
    const runScores = states.map(s => s !== null && s !== undefined ? parseInt(s, 10) : null);

    // Get weekly stats
    const lifetimePerfectDaysStr = await redis.get(`user:${username}:stats:lifetime_perfect_days`);
    // Note: Devvit Redis may not have sCard - using workaround
    const perfectDaysSet = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
    const weekPerfectDaysCount = perfectDaysSet ? JSON.parse(perfectDaysSet as string).length : 0;

    const weeklyScore = await calculateWeeklyTotal(username, weekId);

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
      runsCompleted: states.map((s: string | null | undefined) => s !== undefined && s !== null),
      runScores,
      runOrder,
      weekId,
      dayOfWeek,
      weekMultiplier,
      lifetimePerfectDays: lifetimePerfectDaysStr ? parseInt(lifetimePerfectDaysStr, 10) : 0,
      weekPerfectDays: weekPerfectDaysCount,
      weeklyScore
    };
  }),

  startRun: publicProcedure
    .input(z.object({ runIndex: z.number().int().min(0).max(2) }))
    .mutation(async ({ input }) => {
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

      // Record start time
      const startTime = Date.now();
      await redis.set(`user:${username}:day:${dayId}:run:${input.runIndex}:startTime`, startTime.toString());

      // Get daily runs and return the personality for this run
      const runs = await getDailyRuns(dayId);
      const run = runs[input.runIndex];

      if (!run) throw new Error("Run data not found");

      return {
        personality: run.personality,
        serverStartTime: startTime
      };
    }),

  bankRun: publicProcedure
    .input(z.object({ 
      runIndex: z.number().int().min(0).max(2),
      clientElapsedMs: z.number(),
      bankAmount: z.number()
    }))
    .mutation(async ({ input }) => {
      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Check if completed
      const existingScore = await redis.get(`user:${username}:day:${dayId}:run:${input.runIndex}:score`);
      if (existingScore !== undefined && existingScore !== null) {
        throw new Error("Run already completed");
      }

      const startTimeStr = await redis.get(`user:${username}:day:${dayId}:run:${input.runIndex}:startTime`);
      if (!startTimeStr) {
        throw new Error("Run not started");
      }

      const runs = await getDailyRuns(dayId);
      const run = runs[input.runIndex];

      if (!run) throw new Error("Run data not found");

      const startTime = parseInt(startTimeStr, 10);
      const serverElapsedMs = Date.now() - startTime;

      let finalScore = 0;

      // Validate against bong time
      if (serverElapsedMs > run.bongTimeMs + LATENCY_BUFFER_MS) {
        // Bust! The server tracked more time than the bong time.
        finalScore = 0;
      } else if (input.clientElapsedMs > run.bongTimeMs) {
        // Bust! The client claimed a time later than the bong time.
        finalScore = 0;
      } else {
        // Valid bank
        finalScore = input.bankAmount;
      }

      // Record score
      await redis.set(`user:${username}:day:${dayId}:run:${input.runIndex}:score`, finalScore.toString());
      
      // Update totals
      const currentTotalStr = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');
      const newTotal = (currentTotalStr ? parseInt(currentTotalStr, 10) : 0) + finalScore;
      await redis.hSet(`user:${username}:day:${dayId}:totals`, { score: newTotal.toString() });

      // Update daily leaderboard
      await redis.zAdd(`leaderboard:daily:day:${dayId}`, { member: username, score: newTotal });

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
        // Store Perfect Days as JSON array (Redis sets not available)
        const existingPerfectDays = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
        const perfectDaysArray = existingPerfectDays ? JSON.parse(existingPerfectDays as string) : [];
        if (!perfectDaysArray.includes(dayId)) {
          perfectDaysArray.push(dayId);
          await redis.set(`user:${username}:week:${weekId}:perfect_days`, JSON.stringify(perfectDaysArray));
          await redis.incrBy(`user:${username}:stats:lifetime_perfect_days`, 1);
        }
      }

      // Update weekly leaderboard
      const weekId = getWeekId(now);

      // Store unmultiplied daily score for weekly calculation
      await redis.hSet(`user:${username}:week:${weekId}:daily_scores`, { [dayId]: newTotal.toString() });

      // Recalculate weekly total with multipliers
      const weeklyTotal = await calculateWeeklyTotal(username, weekId);
      await redis.zAdd(`leaderboard:weekly:week:${weekId}`, { member: username, score: weeklyTotal });

      // Calculate percentile rank for feedback
      let percentile: number | null = null;
      if (finalScore > 0) {
        const userRank = await redis.zRank(`leaderboard:daily:day:${dayId}`, username);
        const totalPlayers = await redis.zCard(`leaderboard:daily:day:${dayId}`);

        if (userRank !== null && userRank !== undefined && totalPlayers > 0) {
          // zRank returns 0-indexed rank where 0 is lowest score
          // Percentile: what percentage of players scored lower than this user
          percentile = Math.round((1 - userRank / totalPlayers) * 100);
        }
      }

      return { finalScore, bust: finalScore === 0, percentile };
    }),

    getLeaderboard: publicProcedure.query(async () => {
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Get top scores in descending order (highest first)
      const topScores = await redis.zRange(`leaderboard:daily:day:${dayId}`, 0, 49, { by: 'rank' });
      // Reverse the array since zRange returns ascending order
      return topScores.reverse().map((entry: { member: string; score: number }) => ({
        username: entry.member,
        score: entry.score
      }));
    }),

    getWeeklyLeaderboard: publicProcedure.query(async () => {
      const now = new Date();
      const weekId = getWeekId(now);

      // Get top scores in descending order (highest first)
      const topScores = await redis.zRange(`leaderboard:weekly:week:${weekId}`, 0, 49, { by: 'rank' });
      // Reverse the array since zRange returns ascending order
      return topScores.reverse().map((entry: { member: string; score: number }) => ({
        username: entry.member,
        score: entry.score
      }));
    }),

    clearDailyStats: publicProcedure.mutation(async () => {
      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();

      // Delete all daily keys for current user
      await Promise.all([
        redis.del(`user:${username}:day:${dayId}:run:0:score`),
        redis.del(`user:${username}:day:${dayId}:run:1:score`),
        redis.del(`user:${username}:day:${dayId}:run:2:score`),
        redis.del(`user:${username}:day:${dayId}:run:0:startTime`),
        redis.del(`user:${username}:day:${dayId}:run:1:startTime`),
        redis.del(`user:${username}:day:${dayId}:run:2:startTime`),
        redis.del(`user:${username}:day:${dayId}:totals`)
      ]);

      // Remove from daily leaderboard
      await redis.zRem(`leaderboard:daily:day:${dayId}`, [username]);

      return { success: true, message: `Cleared daily stats for ${username} on day ${dayId}` };
    }),

    clearWeeklyStats: publicProcedure.mutation(async () => {
      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const weekId = getWeekId(now);

      // Delete all weekly keys for current user
      await Promise.all([
        redis.del(`user:${username}:week:${weekId}:perfect_days`),
        redis.del(`user:${username}:week:${weekId}:daily_scores`),
        redis.del(`user:${username}:stats:lifetime_perfect_days`)
      ]);

      // Remove from weekly leaderboard
      await redis.zRem(`leaderboard:weekly:week:${weekId}`, [username]);

      return { success: true, message: `Cleared weekly stats for ${username} in week ${weekId}` };
    }),

    clearAllStats: publicProcedure.mutation(async () => {
      const user = await reddit.getCurrentUser();
      const username = user?.username ?? 'anonymous';
      const now = new Date();
      const epochStart = new Date('2024-01-01T00:00:00Z');
      const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
      const weekId = getWeekId(now);

      // Delete all keys for current user
      await Promise.all([
        // Daily
        redis.del(`user:${username}:day:${dayId}:run:0:score`),
        redis.del(`user:${username}:day:${dayId}:run:1:score`),
        redis.del(`user:${username}:day:${dayId}:run:2:score`),
        redis.del(`user:${username}:day:${dayId}:run:0:startTime`),
        redis.del(`user:${username}:day:${dayId}:run:1:startTime`),
        redis.del(`user:${username}:day:${dayId}:run:2:startTime`),
        redis.del(`user:${username}:day:${dayId}:totals`),
        // Weekly
        redis.del(`user:${username}:week:${weekId}:perfect_days`),
        redis.del(`user:${username}:week:${weekId}:daily_scores`),
        redis.del(`user:${username}:stats:lifetime_perfect_days`)
      ]);

      // Remove from leaderboards
      await Promise.all([
        redis.zRem(`leaderboard:daily:day:${dayId}`, [username]),
        redis.zRem(`leaderboard:weekly:week:${weekId}`, [username])
      ]);

      return { success: true, message: `Cleared all stats for ${username}` };
    })
});

export const appRouter = router({
  game: gameRouter
});

export type AppRouter = typeof appRouter;
