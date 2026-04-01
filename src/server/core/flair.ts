import { context, reddit, redis } from '@devvit/web/server';

export type FlairKey =
  | 'beta_tester'
  | 'daily_podium'
  | 'daily_winner'
  | 'weekly_podium'
  | 'weekly_winner';

const FLAIR_TEMPLATE_IDS: Record<FlairKey, string> = {
  beta_tester: 'ee8be736-2d60-11f1-ba39-225489d62581',
  daily_podium: '685a037c-2d61-11f1-8721-bad5627891fe',
  daily_winner: '8943b9ac-2d61-11f1-b979-b2117c83b329',
  weekly_podium: 'b3677d4a-2d61-11f1-b485-5a2c1b7caac0',
  weekly_winner: 'd5d4a0ec-2d61-11f1-aa7d-423977847342',
};

/** Record a flair as earned in Redis. Returns true if it was newly added. */
export async function awardFlair(username: string, flair: FlairKey): Promise<boolean> {
  const key = `user:${username}:earned_flairs`;
  const existing = await redis.zScore(key, flair);
  if (existing !== null) return false;
  await redis.zAdd(key, { member: flair, score: Date.now() });
  return true;
}

/** Attempt to set flair on Reddit. Silent-fail if user is not a subreddit member. */
async function trySetFlair(username: string, flair: FlairKey): Promise<void> {
  try {
    await reddit.setUserFlair({
      subredditName: context.subredditName!,
      username,
      flairTemplateId: FLAIR_TEMPLATE_IDS[flair],
    });
  } catch {
    // User is not a subreddit member — will retry next time they earn this flair
  }
}

/** Award flair (record in Redis) and attempt to apply it on Reddit. */
export async function awardAndApplyFlair(username: string, flair: FlairKey): Promise<void> {
  await awardFlair(username, flair);
  await trySetFlair(username, flair);
}

// Beta tester cutoff: end of Week 3 (2026-04-07 00:00 UTC)
const BETA_TESTER_CUTOFF = new Date('2026-04-07T00:00:00Z');

export async function awardBetaTesterFlairIfEligible(username: string): Promise<void> {
  if (new Date() >= BETA_TESTER_CUTOFF) return;
  await awardAndApplyFlair(username, 'beta_tester');
}
