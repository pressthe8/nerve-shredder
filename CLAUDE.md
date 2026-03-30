# Claude Code Instructions

## Project Guidelines

**IMPORTANT**: All code written for this project must follow the guidelines in [AGENTS.md](AGENTS.md).

## Recent Changes

### Implemented Features (Phases 1-3)
- ✅ Post-run percentile feedback
- ✅ Visual BONG animations (flash + shake)
- ✅ Today's Attempts display (3 individual run scores)
- ✅ This Week's Total with multiplier badge
- ✅ How to Play modal
- ✅ Weekly streak system with Perfect Days tracking
- ✅ Weekly multipliers (Monday 1.0x → Sunday 1.5x)
- ✅ Weekly leaderboard with proper sorting
- ✅ Lifetime Perfect Days counter

## Core Game Mechanic

### How It Works
Players get **3 runs per day**. Each run shows a sequence of £ amounts one at a time (1 per second). The player must hit BANK to lock in the current amount. If they don't bank before the sequence ends, they auto-bust and score £0.

### Sequence Generation (`src/shared/scoreEngine.ts`)
- Sequences are **deterministic**: seeded by `hashSeed(dayId, runIndex)` using mulberry32 PRNG
- Every player sees the **same sequence** for the same run on the same day
- Step count is **randomized per run** within a `stepRange` using triangular distribution (average of 2 PRNG rolls — most runs cluster mid-range, with occasional short/long outliers)
- Each step: score can go up (normal increment), spike (jump), or dip — controlled by the run's personality parameters
- Score starts at £10, floored at £1

### Run Personalities (hardcoded in `src/server/routers/index.ts`)
There are exactly **3 fixed personalities** — one of each is used every day:

| Personality | Step Range | Increment | Jump% | Dip% | Initial Spike% | Feel |
|-------------|-----------|-----------|-------|------|----------------|------|
| Slow & Cautious | 6–14 | £1–5 | 5% | 10% | 20% | Steady climb |
| Fast & Volatile | 4–10 | £3–10 | 15% | 20% | 5% | Wild swings |
| Moderate & Spiky | 8–18 | £2–6 | 10% | 15% | 50% | Long game |

**Personalities are NOT randomized per day** — the same 3 are always used. What changes daily is the number sequence (via the day-based seed) and the step count (via PRNG within the step range).

**Player run order IS randomized** — each player gets the 3 runs shuffled into a random order (stored in Redis for consistency).

### Client-Server Protocol
1. `startRun(runIndex)` → server generates the full sequence, returns `{ sequence: number[] }`
2. Client steps through the array with `setInterval` (1 second per step via `STEP_DISPLAY_MS`)
3. Auto-bust triggers when the client reaches the end of the sequence
4. `bankRun(runIndex, stepIndex)` → server regenerates the sequence for validation, checks timing, returns score

### Anti-Cheat
- **Timing validation**: server checks `serverElapsed >= stepIndex * STEP_DISPLAY_MS - buffer`
- **Authoritative scoring**: server regenerates the sequence independently — client can't fake a score
- **Soft-flagging**: tracks bong proximity (banking on last step), top percentile frequency, new accounts

### Key Constants
- `STEP_DISPLAY_MS = 1000` — 1 second per step (in `src/shared/scoreEngine.ts`)
- `LATENCY_BUFFER_MS = 1000` — timing tolerance (in `src/server/routers/index.ts`)

### Known Issues to Monitor
- Weekly leaderboard may appear empty if no users have completed runs this week
- Leaderboards use `.reverse()` to show highest scores first (Redis zRange returns ascending order)
- Individual run scores show £0 for runs completed before the code was deployed (expected behavior - new runs will display correctly)

### CRITICAL: No .js files in src/
**Never create `.js` files in `src/`.** This project uses TypeScript with `.js` import extensions (e.g. `from './routers/index.js'`). If a real `.js` file exists next to its `.ts` counterpart, Vite resolves to the `.js` file and silently bundles stale code — the `.ts` file is completely ignored. This previously caused all features added after the initial commit to never be deployed. The `.gitignore` now blocks `src/**/*.js` as a safeguard.

### Important: Redis Data Partitioning
**Redis data is partitioned per subreddit installation** ([docs](https://developers.reddit.com/docs/capabilities/server/redis)):
- Each subreddit that installs the app gets its own isolated Redis instance
- No cross-subreddit data access is possible
- Leaderboards are inherently per-subreddit only
- User stats (lifetime Perfect Days, etc.) are per-subreddit installation
- A user playing in multiple subreddits will have separate stats in each

The AGENTS.md file contains:
- Tech stack specifications (React 19, Tailwind CSS 4, Vite, Node.js v22, Hono, tRPC v11)
- Project architecture and folder structure
- Frontend rules and limitations specific to Devvit web applications
- Code style preferences
- Available commands for testing and linting

## Development Workflow

### How Versioning Works

Understanding the pipeline:

```
npm run build  →  npm run deploy  →  npx devvit install <subreddit>
```

- **`npm run build`** — compiles TypeScript to JavaScript in `dist/`. Nothing goes to Reddit yet.
- **`npm run deploy`** — runs type-check + lint, then uploads `dist/` to Reddit's servers. Bumps the version number (e.g. 0.0.6 → 0.0.7). Uploaded versions are only visible to you and can only be installed on subreddits with **under 200 subscribers**. Use this instead of `npx devvit upload` directly.
- **`npx devvit install <subreddit>`** — installs the latest uploaded version onto a specific subreddit you moderate. Each subreddit independently tracks which version it's running. **Uploading does NOT auto-update installed subreddits.**
- **`devvit publish`** — submits the app for Reddit's review. After approval, the app can be installed on any subreddit of any size and appears in the public app directory. Required once r/NerveShredder grows past 200 subscribers.

This means you can do staged rollouts: upload once, then install to dev sub first, confirm it works, then install to main sub.

**Subreddits:**
- Dev: `nerve_shredder_dev`
- Main: `NerveShredder`

### Standard Development Process

**ALWAYS follow this two-stage rollout for any change:**

1. **Make changes** to the code
2. **Build & deploy**: `npm run build && npm run deploy`
4. **Test on dev sub first**: `npx devvit install nerve_shredder_dev`
5. ⚠️ **PROMPT THE USER**: "Ready to test on r/nerve_shredder_dev — please verify the changes work before I install to the main sub."
6. Once confirmed working — **install to main**: `npx devvit install NerveShredder`
7. ⚠️ **PROMPT THE USER**: "Installed on r/NerveShredder. Please verify on the main sub."

**Never install directly to the main sub without testing on dev first**, unless the user explicitly asks to skip.

### When Upload + Install is Required

**ALWAYS upload + install after:**
- Adding/modifying tRPC queries or mutations
- Changing backend game logic
- Adding new Redis keys or data structures
- Updating return types from server procedures
- Any frontend changes (React components, CSS, assets)

**Red flags you forgot to deploy:**
- Console errors: "No procedure found on path 'game.xyz'"
- 404 errors on tRPC endpoints
- Features working locally but not on Reddit
- No `console.log` output that should be there (means old code is still running)

### Quick Reference
- `npm run build` - Build only (no upload)
- `npm run deploy` - Type-check + lint + upload to Reddit (bumps version)
- `npx devvit install nerve_shredder_dev` - Install on dev sub
- `npx devvit install NerveShredder` - Install on main sub
- `npm run dev` - Development server with hot reload (live development on Reddit)
- `npm run type-check` - Type checks, lints, and prettifies your app
- `npm run login` - Logs your CLI into Reddit

## Key Reminders

1. **Read AGENTS.md first** before writing any new code
2. This is a Devvit web application that runs on Reddit.com
3. Follow the established patterns in `/src/server` for backend and `/src/client` for frontend
4. Use tRPC for type-safe communication between client and server
5. Refer to https://developers.reddit.com/docs/llms.txt for additional documentation

## Before Starting Work

- Review [AGENTS.md](AGENTS.md) for architectural decisions
- Run `npm run type-check` to verify TypeScript types
- Run `npm run lint` to check code style
- Use `npm run test -- <filename>` to run relevant tests
