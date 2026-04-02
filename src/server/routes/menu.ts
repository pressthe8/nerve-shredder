import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { createWeeklyPost } from '../core/post';
import { getDayOfWeek, getGameDayLabel } from '../../shared/weekUtils.js';
import type { T3 } from '@devvit/shared-types/tid.js';

export const menu = new Hono();

menu.post('/debug-daily-anchor', async (c) => {
  try {
    const EPOCH_START = new Date('2024-01-01T00:00:00Z');
    const now = new Date();
    const dayId = Math.floor((now.getTime() - EPOCH_START.getTime()) / 86400000).toString();

    const alreadyExists = await redis.get(`day:${dayId}:results_comment_id`);
    if (alreadyExists) {
      return c.json<UiResponse>({ showToast: `Anchor already exists for day ${dayId}: ${alreadyExists}` }, 200);
    }

    const postId = await redis.get('active_post_id');
    if (!postId) {
      return c.json<UiResponse>({ showToast: 'No active_post_id found in Redis' }, 200);
    }

    const comment = await reddit.submitComment({
      id: postId as T3,
      text: `${getGameDayLabel(getDayOfWeek(now))} Highlights`,
      runAs: 'APP',
    });
    await redis.set(`day:${dayId}:results_comment_id`, comment.id);
    await redis.expire(`day:${dayId}:results_comment_id`, 172800);

    return c.json<UiResponse>({ showToast: `Day ${dayId} anchor created: ${comment.id}` }, 200);
  } catch (error) {
    console.error(`[menu] debug-daily-anchor error: ${error}`);
    return c.json<UiResponse>({ showToast: `Failed: ${error}` }, 400);
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
