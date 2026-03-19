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
// The backend adds the hidden bong time
const ServerRunSchema = z.object({
    personality: RunPersonalitySchema,
    bongTimeMs: z.number()
});
// We pre-compute 3 runs for the day
const generateDailyRuns = () => {
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
const getDailyRuns = async (dayId) => {
    const runsStr = await redis.get(`global:day:${dayId}:runs`);
    if (runsStr) {
        return JSON.parse(runsStr);
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
export const gameRouter = router({
    getGameState: publicProcedure.query(async () => {
        const { postId } = context;
        if (!postId)
            throw new Error("postId is missing in context");
        const user = await reddit.getCurrentUser();
        const username = user?.username ?? 'anonymous';
        const now = new Date();
        // Use an arbitrary day epoch (e.g. Days since Jan 1 2024)
        const epochStart = new Date('2024-01-01T00:00:00Z');
        const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
        // Get the user's run state
        const states = await Promise.all([
            redis.get(`user:${username}:day:${dayId}:run:0:score`),
            redis.get(`user:${username}:day:${dayId}:run:1:score`),
            redis.get(`user:${username}:day:${dayId}:run:2:score`)
        ]);
        const totalScore = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');
        // We also need to determine the user's run order. If missing, generate one.
        let runOrderStr = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'runOrder');
        let runOrder = [0, 1, 2];
        if (runOrderStr) {
            runOrder = JSON.parse(runOrderStr);
        }
        else {
            // Shuffle 0, 1, 2
            runOrder.sort(() => Math.random() - 0.5);
            await redis.hSet(`user:${username}:day:${dayId}:totals`, { runOrder: JSON.stringify(runOrder) });
        }
        return {
            dayId,
            username,
            totalScore: totalScore ? parseInt(totalScore, 10) : 0,
            runsCompleted: states.map((s) => s !== undefined && s !== null),
            runOrder
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
        if (!run)
            throw new Error("Run data not found");
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
        if (!run)
            throw new Error("Run data not found");
        const startTime = parseInt(startTimeStr, 10);
        const serverElapsedMs = Date.now() - startTime;
        let finalScore = 0;
        // Validate against bong time
        if (serverElapsedMs > run.bongTimeMs + LATENCY_BUFFER_MS) {
            // Bust! The server tracked more time than the bong time.
            finalScore = 0;
        }
        else if (input.clientElapsedMs > run.bongTimeMs) {
            // Bust! The client claimed a time later than the bong time.
            finalScore = 0;
        }
        else {
            // Valid bank
            finalScore = input.bankAmount;
        }
        // Record score
        await redis.set(`user:${username}:day:${dayId}:run:${input.runIndex}:score`, finalScore.toString());
        // Update totals
        const currentTotalStr = await redis.hGet(`user:${username}:day:${dayId}:totals`, 'score');
        const newTotal = (currentTotalStr ? parseInt(currentTotalStr, 10) : 0) + finalScore;
        await redis.hSet(`user:${username}:day:${dayId}:totals`, { score: newTotal.toString() });
        // Update leaderboard
        await redis.zAdd(`leaderboard:daily:day:${dayId}`, { member: username, score: newTotal });
        return { finalScore, bust: finalScore === 0 };
    }),
    getLeaderboard: publicProcedure.query(async () => {
        const now = new Date();
        const epochStart = new Date('2024-01-01T00:00:00Z');
        const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
        const topScores = await redis.zRange(`leaderboard:daily:day:${dayId}`, 0, 49, { by: 'rank' });
        return topScores.map((entry) => ({
            username: entry.member,
            score: entry.score
        }));
    })
});
export const appRouter = router({
    game: gameRouter
});
//# sourceMappingURL=index.js.map