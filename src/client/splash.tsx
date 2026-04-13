import './index.css';
import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';
import { useSound } from './lib/useSound.js';
import { HowToPlay } from './components/HowToPlay.js';
import { WeeklyBreakdown } from './components/WeeklyBreakdown.js';
import { PlayerBreakdown } from './components/PlayerBreakdown.js';
import { FrozenWeekView } from './components/FrozenWeekView.js';

const SplashContent = () => {
  const utils = trpc.useUtils();
  const { data: weekInfo, isLoading: weekInfoLoading } = trpc.game.getPostWeekInfo.useQuery();
  const { data, isLoading } = trpc.game.getGameState.useQuery(undefined, {
    enabled: weekInfo?.isActiveWeek !== false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: dailyLeaderboard } = trpc.game.getLeaderboard.useQuery(undefined, {
    enabled: weekInfo?.isActiveWeek !== false,
  });
  const { data: weeklyLeaderboard } = trpc.game.getWeeklyLeaderboard.useQuery(undefined, {
    enabled: weekInfo?.isActiveWeek !== false,
  });
  const { data: frozenLeaderboard } = trpc.game.getFrozenLeaderboard.useQuery(
    { weekId: weekInfo?.postWeekId ?? '' },
    { enabled: !!weekInfo && !weekInfo.isActiveWeek && weekInfo.postWeekId !== 'legacy' },
  );

  // Refetch all data when returning from expanded game view
  useEffect(() => {
    const onFocus = () => { void utils.invalidate(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [utils]);

  const { playSound, muted, toggleMute } = useSound();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'daily' | 'weekly'>('daily');
  const [manualPage, setManualPage] = useState<number | null>(null);
  const [manualPageMode, setManualPageMode] = useState<'daily' | 'weekly' | null>(null);
  const PAGE_SIZE = 7;
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showWeeklyBreakdown, setShowWeeklyBreakdown] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [msUntilMidnight, setMsUntilMidnight] = useState(Infinity);
  const [joinedLocally, setJoinedLocally] = useState(false);
  const joinSubreddit = trpc.game.joinSubreddit.useMutation();

  useEffect(() => {
    let prev = Infinity;
    const tick = () => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      setMsUntilMidnight(diff);
      if (diff <= 0 && prev > 0) {
        void utils.invalidate();
      }
      prev = diff;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [utils]);

  // Glitch effect on logo
  const [glitching, setGlitching] = useState(false);
  useEffect(() => {
    const triggerGlitch = () => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 200);
    };
    const interval = setInterval(triggerGlitch, 3000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  const currentLeaderboardData = leaderboardMode === 'daily' ? dailyLeaderboard : weeklyLeaderboard;
  const isLeaderboardLocked = leaderboardMode === 'daily' && (dailyLeaderboard?.locked ?? false);
  const isWeeklySnapshot = leaderboardMode === 'weekly' && (weeklyLeaderboard?.snapshot ?? false);
  const snapshotDayLabel = weeklyLeaderboard?.snapshotDayLabel;
  const currentLeaderboard = currentLeaderboardData?.entries;
  const currentUser = (currentLeaderboardData as { currentUser?: string | null } | undefined)?.currentUser ?? null;
  const currentUserRank = (currentLeaderboardData as { currentUserRank?: number | null } | undefined)?.currentUserRank ?? null;
  const currentUserScore = (currentLeaderboardData as { currentUserScore?: number | null } | undefined)?.currentUserScore ?? null;

  // Show loading while checking week info
  if (weekInfoLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-mono cursor-crosshair">
        <div className="scanline-overlay" />
        <div className="crt-vignette" />
        <div className="text-neutral-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Frozen week — show archived leaderboard + link to current week
  if (weekInfo && !weekInfo.isActiveWeek) {
    return (
      <FrozenWeekView
        weekLabel={weekInfo.weekLabel}
        activePostUrl={weekInfo.activePostUrl}
        leaderboard={frozenLeaderboard}
      />
    );
  }

  return (
    <div className={`flex flex-col items-center min-h-screen bg-neutral-950 text-white p-3 font-mono cursor-crosshair relative ${showLeaderboard ? 'justify-start pt-3' : 'justify-center'}`}>
      {/* CRT Overlays */}
      <div className="scanline-overlay" />
      <div className="crt-vignette" />
      {/* Background Glow Leaks */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />



      {/* Mute Toggle */}
      <button
        onClick={toggleMute}
        className={`absolute top-4 right-4 w-12 h-12 rounded-full bg-neutral-900/60 backdrop-blur-md border border-neutral-700/50 hover:bg-neutral-800/80 hover:border-neutral-600 transition-colors flex items-center justify-center z-40 ${showHowToPlay || showWeeklyBreakdown || !!selectedPlayer || showLeaderboard ? 'hidden' : ''}`}
      >
        {muted ? (
          <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9" />
          </svg>
        )}
      </button>

      {!showLeaderboard ? (
        <>
          {/* Hamburger Menu Button */}
          <button
            onClick={() => { setShowHowToPlay(true); }}
            className="absolute top-4 left-4 w-12 h-12 rounded-full bg-neutral-900/60 backdrop-blur-md border border-neutral-700/50 hover:bg-neutral-800/80 hover:border-neutral-600 transition-colors flex items-center justify-center z-40"
          >
            <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* How to Play Modal */}
          <HowToPlay isOpen={showHowToPlay} onClose={() => { setShowHowToPlay(false); }} />
          <WeeklyBreakdown isOpen={showWeeklyBreakdown} onClose={() => { setShowWeeklyBreakdown(false); }} />

          <img
            src="/Nerve Shredder 500x500.jpeg"
            alt="Nerve Shredder"
            className={`w-20 h-20 mb-1 rounded-lg transition-transform duration-100 ${
              glitching ? 'animate-[glitch-intense_0.2s_ease-in-out]' : ''
            }`}
          />
          <p className="text-neutral-400 mb-5 max-w-xs text-center font-medium text-sm tracking-wider uppercase">Risk it all. Beat the shredder.</p>

          {isLoading ? (
            <div className="text-neutral-500 animate-pulse">Loading Status...</div>
          ) : (
            <div className="flex flex-col items-center gap-5 w-full max-w-md">
              {/* Today's Attempts */}
              <div className="w-full">
                <h3 className="text-neutral-400 text-center text-xs font-bold tracking-[.3em] mb-3 uppercase">Today's Attempts</h3>
                <div className="flex gap-3 justify-center">
                  {[0, 1, 2].map((i) => {
                    const runIndex = data?.runOrder[i];
                    const score = runIndex !== undefined && data?.runScores ? data.runScores[runIndex] : null;
                    const isCompleted = runIndex !== undefined ? data?.runsCompleted[runIndex] : false;

                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-md p-3 text-center transition-all ${
                          isCompleted && score !== null && score !== undefined && score > 0
                            ? 'bg-emerald-950/30 border border-emerald-500/70 shadow-[0_0_8px_rgba(52,211,153,0.25)]'
                            : isCompleted && score === 0
                              ? 'bg-red-950/30 border border-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                              : 'bg-neutral-900/50 border border-neutral-600/70'
                        }`}
                      >
                        <div className="text-xs text-neutral-400 font-bold mb-1 tracking-[.3em]">RUN {i + 1}</div>
                        <div className={`text-lg font-mono font-black italic tracking-tighter ${
                          score !== null && score !== undefined && score > 0
                            ? 'text-emerald-400 text-glow-emerald'
                            : score === 0
                              ? 'text-neutral-500'
                              : 'text-neutral-500'
                        }`}>
                          {score !== null && score !== undefined ? `£${score}` : '---'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Today's Total + This Week's Total side by side */}
              <div className="flex gap-3 w-full">
                <div className="flex-1 bg-neutral-900/40 border border-neutral-600/70 rounded-md p-4 text-center backdrop-blur-sm">
                  <h2 className="text-neutral-400 text-xs font-bold uppercase tracking-[.3em] mb-1">Today's Total</h2>
                  <div className="text-2xl font-mono font-black italic tracking-tighter text-cyan-400 text-glow-cyan">£{data?.totalScore ?? 0}</div>
                </div>
                {data && data.weeklyScore > 0 && (
                  <button
                    onClick={() => { setShowWeeklyBreakdown(true); }}
                    className="flex-1 bg-gradient-to-br from-amber-950/40 to-amber-900/20 border border-amber-500/60 rounded-md p-4 text-center hover:from-amber-950/50 hover:to-amber-900/30 transition-colors shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                  >
                    <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-[.3em] mb-1">Weekly Total</h3>
                    <div className="text-2xl font-mono font-black italic tracking-tighter text-amber-400 text-glow-amber">£{data.weeklyScore.toLocaleString()}</div>
                    {data.weekPerfectDays > 0 && (
                      <div className="mt-1 text-xs text-amber-300/80">
                        {data.weekPerfectDays}/7 Perfect Days
                      </div>
                    )}
                  </button>
                )}
              </div>

              {data?.runsCompleted.includes(false) ? (
                <div className="flex flex-col items-center gap-2">
                  {msUntilMidnight < 5 * 60 * 1000 && (
                    <div className="text-amber-400 text-xs font-bold text-center px-4">
                      ⚠️ Less than 5 minutes until end of day — incomplete runs will receive a score of £0
                    </div>
                  )}
                  <button
                    className="bg-red-600 hover:bg-red-500 transition-all duration-200 text-white font-black text-lg py-4 px-12 skew-x-[-12deg] shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:shadow-[0_0_40px_rgba(220,38,38,0.7)] active:scale-95"
                    onClick={(e) => { playSound('start'); requestExpandedMode(e.nativeEvent, 'game'); }}
                  >
                    <span className="inline-block skew-x-[12deg] tracking-wider">PLAY NEXT RUN</span>
                  </button>
                </div>
              ) : (() => {
                const showCta = !joinedLocally && !data?.hasJoinedSub && !!data?.username && data.username !== 'anonymous';
                return showCta ? (
                  <div className="flex flex-col items-center gap-1 w-full mt-2">
                    <div className="text-neutral-500 text-xs font-medium tracking-wider mb-1">3 runs a day — don't miss tomorrow</div>
                    <button
                      onClick={() => {
                        setJoinedLocally(true);
                        joinSubreddit.mutate(undefined, {
                          onError: () => setJoinedLocally(false),
                        });
                      }}
                      disabled={joinSubreddit.isPending}
                      className="bg-amber-500 hover:bg-amber-400 transition-all duration-200 text-black font-black text-sm py-3 px-10 skew-x-[-12deg] shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] active:scale-95 disabled:opacity-60 mb-2"
                    >
                      <span className="inline-block skew-x-[12deg] tracking-wider">
                        {joinSubreddit.isPending ? 'JOINING...' : 'JOIN r/NERVESHREDDER'}
                      </span>
                    </button>
                    <div className="flex items-center gap-3 w-full justify-center">
                      <div className="text-neutral-500 text-xs font-mono tracking-widest uppercase">
                        Next: <span className="text-amber-400">{countdown}</span>
                      </div>
                      <div className="text-neutral-600">|</div>
                      <button
                        onClick={() => { setShowLeaderboard(true); }}
                        className="text-neutral-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1 tracking-[.2em] uppercase bg-neutral-800 hover:bg-neutral-700 px-3 py-1 skew-x-[-8deg]"
                      >
                        <span className="inline-block skew-x-[8deg]">🏆 Leaderboard</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-center">
                      <div className="text-neutral-500 text-xs font-mono tracking-widest uppercase mb-1">NEXT ATTEMPT IN</div>
                      <div className="text-4xl font-mono font-black italic text-amber-400 tracking-tighter">{countdown}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Leaderboard link — only shown when not in CTA mode (CTA mode has it inline) */}
              {(joinedLocally || !!data?.hasJoinedSub || !data?.username || data.username === 'anonymous') && (
                <button
                  onClick={() => { setShowLeaderboard(true); }}
                  className="text-neutral-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-2 tracking-[.2em] uppercase"
                >
                  🏆 View Leaderboard
                </button>
              )}

            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-md">
          <div className="relative flex items-center justify-center mb-3">
            {/* Centred tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => { setLeaderboardMode('daily'); }}
                className={`px-4 py-1.5 font-bold transition-all tracking-wider text-xs skew-x-[-8deg] ${
                  leaderboardMode === 'daily'
                    ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                <span className="inline-block skew-x-[8deg]">DAILY</span>
              </button>
              <button
                onClick={() => { setLeaderboardMode('weekly'); }}
                className={`px-4 py-1.5 font-bold transition-all tracking-wider text-xs skew-x-[-8deg] ${
                  leaderboardMode === 'weekly'
                    ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                <span className="inline-block skew-x-[8deg]">WEEKLY</span>
              </button>
            </div>
            {/* X close — absolute right */}
            <button
              onClick={() => { setShowLeaderboard(false); }}
              className="absolute right-0 text-neutral-400 hover:text-white text-2xl font-bold leading-none"
            >
              ×
            </button>
          </div>

          {/* Leaderboard List */}
          {(() => {
            const totalEntries = currentLeaderboard?.length ?? 0;
            const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));

            // Compute auto-page: land on user's page, or last page if outside top 200, or page 0
            let autoPage = 0;
            if (currentUser && currentLeaderboard) {
              const idx = currentLeaderboard.findIndex((e: { username: string }) => e.username === currentUser);
              if (idx >= 0) {
                autoPage = Math.floor(idx / PAGE_SIZE);
              } else if (currentUserRank !== null) {
                autoPage = totalPages - 1;
              }
            } else if (currentUserRank !== null) {
              autoPage = totalPages - 1;
            }

            // Use manual page if the user has explicitly navigated in this mode, otherwise auto
            const rawPage = (manualPageMode === leaderboardMode && manualPage !== null) ? manualPage : autoPage;
            const safePage = Math.min(rawPage, totalPages - 1);
            const pageEntries = currentLeaderboard?.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) ?? [];
            const pageOffset = safePage * PAGE_SIZE;

            const renderEntry = (entry: { username: string; score: number; playedToday?: boolean }, index: number) => {
              const globalIndex = pageOffset + index;
              const isCurrentUser = entry.username === currentUser;
              const isPodium = globalIndex <= 2;
              return (
                <button
                  key={entry.username}
                  onClick={() => { setSelectedPlayer(entry.username); }}
                  className={`flex items-center justify-between gap-3 p-2 rounded w-full text-left hover:brightness-110 transition-all ${
                    globalIndex === 0
                      ? 'bg-yellow-950/30 border border-yellow-700/50'
                      : globalIndex === 1
                        ? 'bg-neutral-800/50 border border-neutral-700'
                        : globalIndex === 2
                          ? 'bg-orange-950/30 border border-orange-900/50'
                          : isCurrentUser && leaderboardMode === 'daily'
                            ? 'bg-cyan-950/40 border border-cyan-800/60'
                            : isCurrentUser
                              ? 'bg-amber-950/40 border border-amber-800/60'
                              : 'bg-neutral-900/30 border border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`text-sm font-black italic tracking-tighter shrink-0 w-8 text-right ${
                      globalIndex === 0 ? 'text-yellow-400' : globalIndex === 1 ? 'text-neutral-300' : globalIndex === 2 ? 'text-orange-600' : 'text-neutral-500'
                    }`}>
                      #{globalIndex + 1}
                    </div>
                    <span className="font-bold text-white text-sm tracking-wide truncate">
                      {entry.username}{isCurrentUser && !isPodium && <span className="text-neutral-500 text-xs font-normal ml-1">(you)</span>}
                    </span>
                  </div>
                  <div className={`text-base font-mono font-black italic tracking-tighter shrink-0 ${
                    leaderboardMode === 'daily'
                      ? 'text-cyan-400 text-glow-cyan'
                      : entry.playedToday
                        ? 'text-amber-400 text-glow-amber'
                        : 'text-neutral-500'
                  }`}>
                    £{entry.score.toLocaleString()}
                  </div>
                </button>
              );
            };

            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-neutral-400 text-xs font-bold tracking-[.2em] uppercase">
                    {leaderboardMode === 'daily'
                      ? "Today"
                      : isWeeklySnapshot && snapshotDayLabel
                        ? `After ${snapshotDayLabel}`
                        : "This Week"}
                  </h3>
                  {leaderboardMode === 'weekly' && !isWeeklySnapshot && (
                    <div className="text-xs text-neutral-500">
                      <span className="text-amber-400">gold</span> = played today
                    </div>
                  )}
                </div>

                {isLeaderboardLocked ? (
                  <div className="text-center py-8 px-4">
                    <div className="text-4xl mb-3">🔒</div>
                    <div className="text-neutral-300 font-bold text-sm mb-2 tracking-wider uppercase">Leaderboard Locked</div>
                    <div className="text-neutral-500 text-sm max-w-xs mx-auto">Complete your 3 daily runs to reveal today's standings.</div>
                  </div>
                ) : isWeeklySnapshot && snapshotDayLabel ? (
                  <>
                    <div className="text-center text-neutral-500 text-xs mb-3 italic">
                      Standings before today's play — complete your runs to see live results.
                    </div>
                    {totalEntries > 0 ? pageEntries.map((entry: { username: string; score: number; playedToday?: boolean }, i: number) => renderEntry(entry, i)) : (
                      <div className="text-center text-neutral-500 py-8">No scores yet. Be the first!</div>
                    )}
                    {currentUser && currentUserRank !== null && currentUserScore !== null && safePage === totalPages - 1 && (
                      <>
                        <div className="text-center text-neutral-700 text-xs py-1">· · ·</div>
                        <div className="flex items-center justify-between gap-3 p-2 rounded w-full border border-dashed border-neutral-600 bg-neutral-900/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-sm font-black italic tracking-tighter shrink-0 w-8 text-right text-neutral-500">#{currentUserRank}</div>
                            <span className="font-bold text-neutral-400 text-sm tracking-wide truncate">{currentUser} <span className="text-neutral-600 text-xs font-normal">(you)</span></span>
                          </div>
                          <div className="text-base font-mono font-black italic tracking-tighter shrink-0 text-amber-700">
                            £{currentUserScore.toLocaleString()}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : totalEntries > 0 ? (
                  <>
                    {pageEntries.map((entry: { username: string; score: number; playedToday?: boolean }, i: number) => renderEntry(entry, i))}
                    {currentUser && currentUserRank !== null && currentUserScore !== null && safePage === totalPages - 1 && (
                      <>
                        <div className="text-center text-neutral-700 text-xs py-1">· · ·</div>
                        <div className="flex items-center justify-between gap-3 p-2 rounded w-full border border-dashed border-neutral-600 bg-neutral-900/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-sm font-black italic tracking-tighter shrink-0 w-8 text-right text-neutral-500">#{currentUserRank}</div>
                            <span className="font-bold text-neutral-400 text-sm tracking-wide truncate">{currentUser} <span className="text-neutral-600 text-xs font-normal">(you)</span></span>
                          </div>
                          <div className={`text-base font-mono font-black italic tracking-tighter shrink-0 ${leaderboardMode === 'daily' ? 'text-cyan-700' : 'text-amber-700'}`}>
                            £{currentUserScore.toLocaleString()}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center text-neutral-500 py-8">No scores yet. Be the first!</div>
                )}

                {/* Pagination controls */}
                {!isLeaderboardLocked && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => { setManualPage(0); setManualPageMode(leaderboardMode); }}
                      disabled={safePage === 0}
                      className="text-neutral-400 hover:text-white disabled:text-neutral-700 font-bold text-lg px-1"
                    >«</button>
                    <button
                      onClick={() => { setManualPage(Math.max(0, safePage - 1)); setManualPageMode(leaderboardMode); }}
                      disabled={safePage === 0}
                      className="text-neutral-400 hover:text-white disabled:text-neutral-700 font-bold text-lg px-1"
                    >‹</button>
                    <span className="text-xs text-neutral-500 font-mono tracking-wider px-1">
                      {safePage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => { setManualPage(Math.min(totalPages - 1, safePage + 1)); setManualPageMode(leaderboardMode); }}
                      disabled={safePage === totalPages - 1}
                      className="text-neutral-400 hover:text-white disabled:text-neutral-700 font-bold text-lg px-1"
                    >›</button>
                    <button
                      onClick={() => { setManualPage(totalPages - 1); setManualPageMode(leaderboardMode); }}
                      disabled={safePage === totalPages - 1}
                      className="text-neutral-400 hover:text-white disabled:text-neutral-700 font-bold text-lg px-1"
                    >»</button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Player Breakdown Modal */}
          {selectedPlayer && !isLeaderboardLocked && (
            <PlayerBreakdown
              isOpen={true}
              onClose={() => { setSelectedPlayer(null); }}
              username={selectedPlayer}
              mode={leaderboardMode}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const Splash = () => (
  <TRPCProvider>
    <SplashContent />
  </TRPCProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
