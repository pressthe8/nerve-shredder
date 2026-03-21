import { reddit, redis } from '@devvit/web/server';
import { getWeekId, getWeekLabel } from '../../shared/weekUtils.js';

/**
 * Create a weekly post for the current game week.
 * Idempotent — if a post already exists for this weekId, returns it without creating a new one.
 */
export const createWeeklyPost = async (): Promise<{ id: string; alreadyExisted: boolean }> => {
  const now = new Date();
  const weekId = getWeekId(now);

  // Idempotency check
  const existingPostId = await redis.get(`week:${weekId}:post_id`);
  if (existingPostId) {
    return { id: existingPostId, alreadyExisted: true };
  }

  const weekLabel = getWeekLabel(weekId);

  const post = await reddit.submitCustomPost({
    title: `Nerve Shredder — ${weekLabel}`,
    postData: { weekId },
  });

  // Store bidirectional mappings
  await redis.set(`week:${weekId}:post_id`, post.id);
  await redis.set(`post:${post.id}:week_id`, weekId);
  await redis.set('active_post_id', post.id);

  // Mark that the weekly system is now active (for legacy post detection)
  await redis.set('first_weekly_post_created', 'true');

  return { id: post.id, alreadyExisted: false };
};

/** Alias for backward compatibility with existing imports. */
export const createPost = createWeeklyPost;
