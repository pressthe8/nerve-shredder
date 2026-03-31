import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createWeeklyPost } from '../core/post.js';
import { getWeekId } from '../../shared/weekUtils.js';

// Lazy import to avoid client tsconfig browser-condition resolution issue
// with @devvit/scheduler. At runtime this always resolves on the server.
const getScheduler = async () => {
  const mod = await import('@devvit/web/server');
  return (mod as unknown as { scheduler: { runJob: (job: { name: string; cron: string }) => Promise<string> } }).scheduler;
};

export const triggers = new Hono();

/**
 * Schedule the weekly cron job if it doesn't already exist.
 * Fires every Monday at 00:00 UTC to create a new weekly post.
 */
const ensureWeeklyCronScheduled = async (): Promise<void> => {
  const existingJobId = await redis.get('scheduler:weekly_post_job_id');
  if (existingJobId) return;

  const sched = await getScheduler();
  const jobId = await sched.runJob({
    name: 'weekly-post',
    cron: '0 0 * * MON',
  });
  await redis.set('scheduler:weekly_post_job_id', jobId);
  console.log(`[triggers] Scheduled weekly-post cron job: ${jobId}`);
};

/**
 * Schedule the daily snapshot cron job if it doesn't already exist.
 * Fires every day at 00:00 UTC to write the weekly leaderboard snapshot for the new day.
 */
const ensureDailySnapshotCronScheduled = async (): Promise<void> => {
  const existingJobId = await redis.get('scheduler:daily_snapshot_job_id');
  if (existingJobId) return;

  const sched = await getScheduler();
  const jobId = await sched.runJob({
    name: 'daily-snapshot',
    cron: '0 0 * * *',
  });
  await redis.set('scheduler:daily_snapshot_job_id', jobId);
  console.log(`[triggers] Scheduled daily-snapshot cron job: ${jobId}`);
};

triggers.post('/on-app-install', async (c) => {
  try {
    const result = await createWeeklyPost();
    await ensureWeeklyCronScheduled();
    await ensureDailySnapshotCronScheduled();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${result.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error in on-app-install: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

triggers.post('/on-app-upgrade', async (c) => {
  try {
    // Ensure the cron jobs exist for pre-existing installations
    await ensureWeeklyCronScheduled();
    await ensureDailySnapshotCronScheduled();

    // If no post exists for the current week, create one
    const weekId = getWeekId(new Date());
    const existingPostId = await redis.get(`week:${weekId}:post_id`);
    if (!existingPostId) {
      await createWeeklyPost();
    }

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `App upgrade processed in subreddit ${context.subredditName}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error in on-app-upgrade: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to process upgrade',
      },
      400
    );
  }
});
