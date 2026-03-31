import { Hono } from 'hono';
import { redis } from '@devvit/web/server';

import { createWeeklyPost } from '../core/post.js';
import { getWeekId } from '../../shared/weekUtils.js';

export const schedulerRoutes = new Hono();

schedulerRoutes.post('/weekly-post', async (c) => {
  const body = await c.req.json<{ name: string }>();
  console.log(`[scheduler] weekly-post task fired: ${body.name}`);

  try {
    const result = await createWeeklyPost();
    console.log(`[scheduler] Weekly post ${result.alreadyExisted ? 'already existed' : 'created'}: ${result.id}`);
    return c.json({}, 200);
  } catch (error) {
    console.error(`[scheduler] Error creating weekly post: ${error}`);
    return c.json({}, 500);
  }
});

schedulerRoutes.post('/daily-snapshot', async (c) => {
  console.log('[scheduler] daily-snapshot task fired');
  try {
    const EPOCH_START = new Date('2024-01-01T00:00:00Z');
    const now = new Date();
    // At midnight, dayId has just incremented — write snapshot for the new dayId
    const dayId = Math.floor((now.getTime() - EPOCH_START.getTime()) / 86400000).toString();
    const weekId = getWeekId(now);

    const snapshotKey = `leaderboard:weekly:week:${weekId}:snapshot_day:${dayId}`;
    const alreadyExists = await redis.get(snapshotKey);
    if (!alreadyExists) {
      const topScores = await redis.zRange(`leaderboard:weekly:week:${weekId}`, 0, 49, { by: 'rank', reverse: true });
      const entries = topScores.map((e: { member: string; score: number }) => ({
        username: e.member,
        score: e.score,
      }));
      await redis.set(snapshotKey, JSON.stringify(entries));
      console.log(`[scheduler] daily-snapshot written for dayId ${dayId}, ${entries.length} entries`);
    } else {
      console.log(`[scheduler] daily-snapshot already exists for dayId ${dayId}, skipping`);
    }
    return c.json({}, 200);
  } catch (error) {
    console.error(`[scheduler] Error in daily-snapshot: ${error}`);
    return c.json({}, 500);
  }
});

