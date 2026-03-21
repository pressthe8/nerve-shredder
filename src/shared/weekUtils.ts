// Shared week utilities — used by both client and server
// ZERO platform-specific dependencies. Must remain pure TypeScript.

/** The weekId for Game Week 1 (Apr 13, 2026) */
export const GAME_WEEK_1_ID = 119;

/** The weekId for Beta Week 1 (Mar 23, 2026) */
export const BETA_WEEK_1_ID = 116;

const EPOCH_START = new Date('2024-01-01T00:00:00Z');

/**
 * Week ID calculation — weeks since epoch (Monday as week start).
 * Produces a raw epoch-based number as a string.
 */
export const getWeekId = (date: Date): string => {
  const daysSinceEpoch = Math.floor(
    (date.getTime() - EPOCH_START.getTime()) / (1000 * 60 * 60 * 24)
  );
  const epochDay = EPOCH_START.getUTCDay(); // 1 = Monday for 2024-01-01
  const adjustedDays = daysSinceEpoch + (epochDay === 0 ? 6 : epochDay - 1);
  return Math.floor(adjustedDays / 7).toString();
};

/**
 * Get day of week within the game week (0 = first day, 6 = last day).
 */
export const getDayOfWeek = (date: Date): number => {
  const day = date.getUTCDay();
  return day === 0 ? 6 : day - 1;
};

/**
 * Get human-readable game day label: "Day 1" through "Day 7".
 */
export const getGameDayLabel = (dayOfWeek: number): string => {
  return `Day ${dayOfWeek + 1}`;
};

/**
 * Returns true if the given weekId falls before Game Week 1.
 */
export const isBetaWeek = (weekId: string): boolean => {
  return parseInt(weekId, 10) < GAME_WEEK_1_ID;
};

/**
 * Get display label for a week: "Beta Week N" or "Game Week N".
 */
export const getWeekLabel = (weekId: string): string => {
  const id = parseInt(weekId, 10);
  if (id < GAME_WEEK_1_ID) {
    return `Beta Week ${id - BETA_WEEK_1_ID + 1}`;
  }
  return `Game Week ${id - GAME_WEEK_1_ID + 1}`;
};
