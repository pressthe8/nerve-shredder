# Nerve Shredder

A daily nerve-testing game for Reddit. Can you keep your cool and bank at the right moment?

Play at [r/NerveShredder](https://www.reddit.com/r/NerveShredder/).

## How to play

Each day you get **3 runs**. In each run, a sequence of £ amounts ticks up on screen — one per second. Your job is simple: hit **BANK** before the sequence ends to lock in the current amount.

- Wait too long and you **bust** — scoring £0 for that run
- Bank too early and you leave money on the table
- Your score for each run is whatever amount was showing when you banked

Your **daily total** is the sum of all 3 runs. Play all 3 to unlock the leaderboard.

## Weekly multipliers

Complete all 3 runs without busting to earn a **Perfect Day**. Each Perfect Day you earn within a game week increases your multiplier — starting at 1.0× and climbing up to 1.5×. The multiplier applies to each day's total as you earn it, so chaining Perfect Days across the week significantly boosts your weekly score.

## Leaderboards

- **Daily leaderboard** — unlocks once you've completed all 3 runs for the day
- **Weekly leaderboard** — shows multiplied totals across the whole week

## For moderators

### Installing the app

1. Install Nerve Shredder from the [Reddit App Directory](https://developers.reddit.com/apps/nerve-shredder)
2. A weekly post will be created automatically on install
3. New posts are created every Monday at 00:00 UTC via a scheduled job

### Creating a post manually

Use the **"Create a new post"** option from the subreddit menu (three-dot menu → nerve-shredder → Create a new post). Moderator access required.

### Notes

- Each subreddit has its own isolated leaderboard — scores don't cross between communities
- Players get exactly 3 runs per day; the sequence is the same for all players on a given day
- Posts from previous weeks show a frozen leaderboard snapshot from that week
