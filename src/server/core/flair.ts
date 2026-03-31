import { context, reddit, redis } from '@devvit/web/server';

export type FlairKey =
  | 'beta_tester'
  | 'daily_podium'
  | 'daily_winner'
  | 'weekly_podium'
  | 'weekly_winner';

const FLAIR_DISPLAY: Record<FlairKey, string> = {
  beta_tester: '🧪 Beta Tester',
  daily_podium: '🥉 Daily Podium',
  daily_winner: '🥇 Daily Winner',
  weekly_podium: '🏅 Weekly Podium',
  weekly_winner: '🏆 Weekly Winner',
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
      text: FLAIR_DISPLAY[flair],
      cssClass: flair,
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
