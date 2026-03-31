import { Hono } from 'hono';
import { redis, context } from '@devvit/web/server';

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
      const topScores = await redis.zRange(`leaderboard:weekly:week:${weekId}`, 0, 49, { by: 'rank' });
      const entries = topScores.reverse().map((e: { member: string; score: number }) => ({
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

schedulerRoutes.post('/slack-daily-summary', async (c) => {
  // Only send for the main subreddit
  if (context.subredditName !== 'NerveShredder') {
    console.log(`[scheduler] slack-daily-summary skipped for r/${context.subredditName}`);
    return c.json({}, 200);
  }

  try {
    const EPOCH_START = new Date('2024-01-01T00:00:00Z');
    const now = new Date();
    const todayId = Math.floor((now.getTime() - EPOCH_START.getTime()) / 86400000);
    const dayId = (todayId - 1).toString(); // summarise the completed day
    const dayDate = new Date(EPOCH_START.getTime() + (todayId - 1) * 86400000);
    const dateLabel = dayDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
    });

    // Unique players (O(1))
    const uniquePlayers = await redis.zCard(`leaderboard:daily:day:${dayId}`);

    // All members for per-player lookups
    const members = await redis.zRange(`leaderboard:daily:day:${dayId}`, 0, -1, { by: 'rank' });
    const usernames = members.map((e: { member: string; score: number }) => e.member);

    // Perfect Day completions
    const weekId = getWeekId(dayDate);
    let perfectDayCount = 0;
    for (const username of usernames) {
      const str = await redis.get(`user:${username}:week:${weekId}:perfect_days`);
      if (str) {
        const arr = JSON.parse(str as string) as string[];
        if (arr.includes(dayId)) perfectDayCount++;
      }
    }

    // New players (first ever play was today)
    let newPlayerCount = 0;
    for (const username of usernames) {
      const firstSeen = await redis.get(`user:${username}:first_seen_day`);
      if (firstSeen === dayId) newPlayerCount++;
    }

    const perfectPct = uniquePlayers > 0
      ? Math.round((perfectDayCount / uniquePlayers) * 100)
      : 0;

    const message = [
      `:zap: *Nerve Shredder — Daily Summary*`,
      `*${dateLabel}*`,
      ``,
      `:busts_in_silhouette: *Players today:* ${uniquePlayers}`,
      `:star: *Perfect Days:* ${perfectDayCount} (${perfectPct}% of players)`,
      `:new: *New players:* ${newPlayerCount}`,
    ].join('\n');

    const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';

    try {
      const res = await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        }
      );
      if (!res.ok) {
        console.error(`[scheduler] Slack webhook returned ${res.status}: ${await res.text()}`);
      } else {
        console.log('[scheduler] Slack daily summary posted successfully');
      }
    } catch (fetchError) {
      // hooks.slack.com may not be on Devvit's fetch allowlist — log, don't crash
      console.error(`[scheduler] Failed to POST to Slack: ${fetchError}`);
    }

    return c.json({}, 200);
  } catch (error) {
    console.error(`[scheduler] Error in slack-daily-summary: ${error}`);
    return c.json({}, 500);
  }
});
