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

### Known Issues to Monitor
- Weekly leaderboard may appear empty if no users have completed runs this week
- Leaderboards use `.reverse()` to show highest scores first (Redis zRange returns ascending order)
- Individual run scores show £0 for runs completed before the code was deployed (expected behavior - new runs will display correctly)

### CRITICAL: No .js files in src/
**Never create `.js` files in `src/`.** This project uses TypeScript with `.js` import extensions (e.g. `from './routers/index.js'`). If a real `.js` file exists next to its `.ts` counterpart, Vite resolves to the `.js` file and silently bundles stale code — the `.ts` file is completely ignored. This previously caused all features added after the initial commit to never be deployed. The `.gitignore` now blocks `src/**/*.js` as a safeguard.

### Testing Controls
**Temporary buttons added to splash screen for development:**
- "Clear Daily" - Removes all daily stats and scores for current user
- "Clear Weekly" - Removes all weekly stats, Perfect Days, and weekly leaderboard entry for current user
- "Clear All" - Removes both daily and weekly stats for current user
- **IMPORTANT**: Remove these buttons before production deployment (marked with comment in code)

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

### Complete Build & Deploy Workflow

**Every time you make backend changes (tRPC procedures, server logic), follow this workflow:**

1. **Make changes** to server code (`src/server/routers/`)
2. **Build**: Run `npm run build` (generates tRPC types)
3. **Deploy**: Run `npm run deploy` (uploads to Reddit)
4. **Test**: Open the app on Reddit to verify changes

**Why this is required:**
- tRPC generates types at build time - frontend won't know about new backend procedures without rebuilding
- Local builds are NOT automatically deployed - you must upload to Devvit explicitly
- Without deploying, your changes won't appear on Reddit (you'll see tRPC procedure not found errors)

### When Deployment is Required

**ALWAYS deploy after:**
- Adding/modifying tRPC queries or mutations
- Changing backend game logic
- Adding new Redis keys or data structures
- Updating return types from server procedures

**NOT required for:**
- Frontend-only changes (React components, CSS)
- Documentation updates
- Comment changes

**Red flags you forgot to deploy:**
- Console errors: "No procedure found on path 'game.xyz'"
- 404 errors on tRPC endpoints
- Features working locally but not on Reddit

### Quick Reference
- `npm run build` - Build the project (required after backend changes)
- `npm run deploy` - Deploy to Reddit Devvit (required after building)
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
