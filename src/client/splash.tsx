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
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showWeeklyBreakdown, setShowWeeklyBreakdown] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

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
    <div className={`flex flex-col items-center min-h-screen bg-neutral-950 text-white p-3 font-mono cursor-crosshair relative ${showLeaderboard ? 'justify-start pt-8' : 'justify-center'}`}>
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
                <button
                  className="bg-red-600 hover:bg-red-500 transition-all duration-200 text-white font-black text-lg py-4 px-12 skew-x-[-12deg] shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:shadow-[0_0_40px_rgba(220,38,38,0.7)] active:scale-95"
                  onClick={(e) => { playSound('start'); requestExpandedMode(e.nativeEvent, 'game'); }}
                >
                  <span className="inline-block skew-x-[12deg] tracking-wider">PLAY NEXT RUN</span>
                </button>
              ) : (
                <div className="text-cyan-400 font-bold bg-cyan-500/10 px-8 py-3 skew-x-[-12deg] border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  <span className="inline-block skew-x-[12deg] tracking-wider text-sm">ALL RUNS COMPLETED</span>
                </div>
              )}

              <button
                onClick={() => { setShowLeaderboard(true); }}
                className="text-neutral-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-2 tracking-[.2em] uppercase"
              >
                🏆 View Leaderboard
              </button>

            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black italic tracking-tighter flex items-center gap-2">
              🏆 LEADERBOARD
            </h2>
            <button
              onClick={() => { setShowLeaderboard(false); }}
              className="text-neutral-400 hover:text-white text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setLeaderboardMode('daily'); }}
              className={`flex-1 py-3 font-bold transition-all tracking-wider text-sm skew-x-[-8deg] ${
                leaderboardMode === 'daily'
                  ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              <span className="inline-block skew-x-[8deg]">DAILY</span>
            </button>
            <button
              onClick={() => { setLeaderboardMode('weekly'); }}
              className={`flex-1 py-3 font-bold transition-all tracking-wider text-sm skew-x-[-8deg] ${
                leaderboardMode === 'weekly'
                  ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              <span className="inline-block skew-x-[8deg]">WEEKLY</span>
            </button>
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2">
            <h3 className="text-neutral-400 text-xs font-bold text-center mb-4 tracking-[.3em] uppercase">
              {leaderboardMode === 'daily'
                ? "Today's Top Players"
                : isWeeklySnapshot && snapshotDayLabel
                  ? `Top Players after ${snapshotDayLabel}`
                  : "This Week's Top Players"}
            </h3>
            {isLeaderboardLocked ? (
              <div className="text-center py-12 px-4">
                <div className="text-4xl mb-4">🔒</div>
                <div className="text-neutral-300 font-bold text-sm mb-2 tracking-wider uppercase">
                  Leaderboard Locked
                </div>
                <div className="text-neutral-500 text-sm max-w-xs mx-auto">
                  Complete your 3 daily runs to reveal today's standings.
                </div>
              </div>
            ) : isWeeklySnapshot && snapshotDayLabel ? (
              <>
                <div className="text-center text-neutral-500 text-xs mb-4 italic">
                  Standings before today's play — complete your runs to see live results.
                </div>
                {currentLeaderboard && currentLeaderboard.length > 0 ? (
                  currentLeaderboard.map((entry: { username: string; score: number }, index: number) => (
                    <button
                      key={entry.username}
                      onClick={() => { setSelectedPlayer(entry.username); }}
                      className={`flex items-center justify-between p-4 rounded-md w-full text-left hover:brightness-110 transition-all ${
                        index === 0
                          ? 'bg-yellow-950/30 border border-yellow-700/50'
                          : index === 1
                            ? 'bg-neutral-800/50 border border-neutral-700'
                            : index === 2
                              ? 'bg-orange-950/30 border border-orange-900/50'
                              : 'bg-neutral-900/30 border border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl font-black italic tracking-tighter ${
                          index === 0 ? 'text-yellow-400' : index === 1 ? 'text-neutral-300' : index === 2 ? 'text-orange-600' : 'text-neutral-500'
                        }`}>
                          #{index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-xl">🏆</span>}
                          {index === 1 && <span className="text-xl">🥈</span>}
                          {index === 2 && <span className="text-xl">🥉</span>}
                          <span className="font-bold text-white tracking-wide">{entry.username}</span>
                        </div>
                      </div>
                      <div className="text-xl font-mono font-black italic tracking-tighter text-amber-400 text-glow-amber">
                        ${entry.score.toLocaleString()}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-neutral-500 py-8">
                    No scores yet. Be the first!
                  </div>
                )}
              </>
            ) : currentLeaderboard && currentLeaderboard.length > 0 ? (
              currentLeaderboard.map((entry: { username: string; score: number }, index: number) => (
                <button
                  key={entry.username}
                  onClick={() => { setSelectedPlayer(entry.username); }}
                  className={`flex items-center justify-between p-4 rounded-md w-full text-left hover:brightness-110 transition-all ${
                    index === 0
                      ? 'bg-yellow-950/30 border border-yellow-700/50'
                      : index === 1
                        ? 'bg-neutral-800/50 border border-neutral-700'
                        : index === 2
                          ? 'bg-orange-950/30 border border-orange-900/50'
                          : 'bg-neutral-900/30 border border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-black italic tracking-tighter ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-neutral-300' : index === 2 ? 'text-orange-600' : 'text-neutral-500'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      {index === 0 && <span className="text-xl">🏆</span>}
                      {index === 1 && <span className="text-xl">🥈</span>}
                      {index === 2 && <span className="text-xl">🥉</span>}
                      <span className="font-bold text-white tracking-wide">{entry.username}</span>
                    </div>
                  </div>
                  <div className={`text-xl font-mono font-black italic tracking-tighter ${
                    leaderboardMode === 'daily' ? 'text-cyan-400 text-glow-cyan' : 'text-amber-400 text-glow-amber'
                  }`}>
                    ${entry.score.toLocaleString()}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-neutral-500 py-8">
                No scores yet. Be the first!
              </div>
            )}
          </div>

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
