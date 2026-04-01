export const OPTIMAL_BANK_COPY: Record<1 | 2 | 3, string[]> = {
  1: [
    'called the peak perfectly on one of their runs today. Nerves of steel.',
    'had the timing dialled in on one run today. A precision bank.',
    'hit the sweet spot on one of their runs today for a maximum score. Class act.',
  ],
  2: [
    'nailed the peak on two of their three runs today. Serious composure.',
    "called it right twice today. That can't just be luck...",
    'banked at the top on two separate runs today. Ice in their veins.',
  ],
  3: [
    'banked at the exact peak on all three runs today. Absolute perfection.',
    'hit the peak on every single run today. Flawless performance.',
    "called all three runs to perfection today. Can you give us the lottery numbers too?!",
  ],
};

export function buildOptimalBankComment(username: string, count: 1 | 2 | 3): string {
  const pool = OPTIMAL_BANK_COPY[count];
  const copy = pool[Math.floor(Math.random() * pool.length)]!;
  return `u/${username} ${copy}`;
}
