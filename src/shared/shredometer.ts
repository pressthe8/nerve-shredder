// Shared Shredometer tier definitions — ratio of dailyTotal / peakSum, bucketed.
// The server computes the ratio and returns only the tier label to the client.

export type ShredometerTier = 'FROZEN' | 'COLD' | 'WARM' | 'HOT' | 'MAXED';

export const bucketShredometerTier = (ratio: number): ShredometerTier => {
  if (ratio >= 0.80) return 'MAXED';
  if (ratio >= 0.50) return 'HOT';
  if (ratio >= 0.25) return 'WARM';
  if (ratio >= 0.10) return 'COLD';
  return 'FROZEN';
};
