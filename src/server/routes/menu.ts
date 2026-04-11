import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { createWeeklyPost } from '../core/post';
import { getWeekId, getDayOfWeek, getGameDayLabel } from '../../shared/weekUtils.js';

export const menu = new Hono();


menu.post('/activity-stats', async (c) => {
  try {
    const now = new Date();
    const epochStart = new Date('2024-01-01T00:00:00Z');
    const dayId = Math.floor((now.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)).toString();
    const weekId = getWeekId(now);
    const dayLabel = getGameDayLabel(getDayOfWeek(now));

    const [dailyPlayers, weeklyPlayers] = await Promise.all([
      redis.zCard(`leaderboard:daily:day:${dayId}`),
      redis.zCard(`leaderboard:weekly:week:${weekId}`),
    ]);

    await reddit.modMail.createConversation({
      subredditName: context.subredditName ?? 'NerveShredder',
      subject: 'Nerve Shredder: Activity Snapshot',
      body: `**Nerve Shredder – Activity Snapshot**\n\nToday (${dayLabel}): **${dailyPlayers} players**\nThis week so far: **${weeklyPlayers} players**\n\n_${now.toUTCString()}_`,
      isAuthorHidden: false,
    });

    return c.json<UiResponse>({ showToast: 'Stats sent to modmail' }, 200);
  } catch (error) {
    console.error(`Error fetching activity stats: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to fetch stats' }, 400);
  }
});

menu.post('/post-create', async (c) => {
  try {
    const result = await createWeeklyPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${result.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});
