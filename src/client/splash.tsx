import './index.css';
import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';
import { HowToPlay } from './components/HowToPlay.js';
import { WeeklyBreakdown } from './components/WeeklyBreakdown.js';
import { PlayerBreakdown } from './components/PlayerBreakdown.js';

const SplashContent = () => {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.game.getGameState.useQuery();
  const { data: dailyLeaderboard } = trpc.game.getLeaderboard.useQuery();
  const { data: weeklyLeaderboard } = trpc.game.getWeeklyLeaderboard.useQuery();

  // Refetch all data when returning from expanded game view
  useEffect(() => {
    const onFocus = () => { void utils.invalidate(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [utils]);
  const clearDaily = trpc.game.clearDailyStats.useMutation();
  const clearWeekly = trpc.game.clearWeeklyStats.useMutation();
  const clearAll = trpc.game.clearAllStats.useMutation();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'daily' | 'weekly'>('daily');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showWeeklyBreakdown, setShowWeeklyBreakdown] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const { data: debugData, refetch: refetchDebug } = trpc.game.debugInspect.useQuery(undefined, {
    enabled: showDebug,
  });

  const currentLeaderboard = leaderboardMode === 'daily' ? dailyLeaderboard : weeklyLeaderboard;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
      {!showLeaderboard ? (
        <>
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setShowHowToPlay(true)}
            className="absolute top-4 left-4 w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-700 hover:bg-neutral-800 transition-colors flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* How to Play Modal */}
          <HowToPlay isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
          <WeeklyBreakdown isOpen={showWeeklyBreakdown} onClose={() => setShowWeeklyBreakdown(false)} />

          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-red-500 to-orange-400 bg-clip-text text-transparent mb-2">NERVE</h1>
          <p className="text-neutral-400 mb-10 max-w-xs text-center font-medium">Push your luck. Bank before the crash.</p>

          {isLoading ? (
            <div className="text-neutral-500 animate-pulse font-mono">Loading Status...</div>
          ) : (
            <div className="flex flex-col items-center gap-8 w-full max-w-md">
              {/* Today's Attempts */}
              <div className="w-full">
                <h3 className="text-neutral-400 text-center text-xs font-bold tracking-wide mb-3">Today's Attempts</h3>
                <div className="flex gap-3 justify-center mb-4">
                  {[0, 1, 2].map((i) => {
                    const runIndex = data?.runOrder[i];
                    const score = runIndex !== undefined && data?.runScores ? data.runScores[runIndex] : null;
                    const isCompleted = runIndex !== undefined ? data?.runsCompleted[runIndex] : false;

                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-xl p-3 text-center transition-all ${
                          isCompleted && score !== null && score !== undefined && score > 0
                            ? 'bg-emerald-950/30 border border-emerald-700/50'
                            : isCompleted && score === 0
                              ? 'bg-red-950/30 border border-red-700/50'
                              : 'bg-neutral-900/50 border border-neutral-800'
                        }`}
                      >
                        <div className="text-xs text-neutral-500 font-bold mb-1">{i + 1}</div>
                        <div className={`text-lg font-mono font-bold ${
                          score !== null && score !== undefined && score > 0
                            ? 'text-emerald-400'
                            : score === 0
                              ? 'text-neutral-600'
                              : 'text-neutral-700'
                        }`}>
                          {score !== null && score !== undefined ? `£${score}` : '---'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Today's Total */}
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-center">
                  <h2 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Today's Total</h2>
                  <div className="text-3xl font-mono font-bold text-emerald-400">£{data?.totalScore ?? 0}</div>
                </div>
              </div>

              {/* Weekly Total */}
              {data && data.weeklyScore > 0 && (
                <button
                  onClick={() => setShowWeeklyBreakdown(true)}
                  className="w-full bg-gradient-to-br from-orange-950/40 to-orange-900/20 border border-orange-700/30 rounded-xl p-4 text-center hover:from-orange-950/50 hover:to-orange-900/30 transition-colors"
                >
                  <h3 className="text-neutral-400 text-xs font-bold tracking-wider mb-1">This Week's Total</h3>
                  <div className="text-3xl font-mono font-black text-orange-400">£{data.weeklyScore.toLocaleString()}</div>
                  {data.weekPerfectDays > 0 && (
                    <div className="mt-2 text-xs text-orange-300/80">
                      {data.weekPerfectDays}/7 Perfect Days
                    </div>
                  )}
                </button>
              )}

              {data?.runsCompleted.includes(false) ? (
                <button
                  className="bg-red-600 hover:bg-red-500 transition-all duration-200 text-white font-black text-lg py-4 px-10 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 active:shadow-none"
                  onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
                >
                  PLAY NEXT RUN
                </button>
              ) : (
                <div className="text-emerald-500 font-bold bg-emerald-500/10 px-6 py-3 rounded-full border border-emerald-500/20">All runs completed for today!</div>
              )}

              <button
                onClick={() => setShowLeaderboard(true)}
                className="text-neutral-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-2"
              >
                🏆 View Leaderboard
              </button>

              {/* Testing Controls - Remove before production */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={async () => {
                    try {
                      const result = await clearDaily.mutateAsync();
                      console.log('[Clear Daily]', result);
                    } catch (e) {
                      console.error('[Clear Daily] Error:', e);
                    }
                    window.location.reload();
                  }}
                  className="text-xs px-3 py-1 rounded bg-yellow-900/30 border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/50 transition-colors"
                >
                  Clear Daily
                </button>
                <button
                  onClick={async () => {
                    try {
                      const result = await clearWeekly.mutateAsync();
                      console.log('[Clear Weekly]', result);
                    } catch (e) {
                      console.error('[Clear Weekly] Error:', e);
                    }
                    window.location.reload();
                  }}
                  className="text-xs px-3 py-1 rounded bg-orange-900/30 border border-orange-700/50 text-orange-400 hover:bg-orange-900/50 transition-colors"
                >
                  Clear Weekly
                </button>
                <button
                  onClick={async () => {
                    try {
                      const result = await clearAll.mutateAsync();
                      console.log('[Clear All]', result);
                    } catch (e) {
                      console.error('[Clear All] Error:', e);
                    }
                    window.location.reload();
                  }}
                  className="text-xs px-3 py-1 rounded bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="text-xs px-3 py-1 rounded bg-purple-900/30 border border-purple-700/50 text-purple-400 hover:bg-purple-900/50 transition-colors"
                >
                  {showDebug ? 'Hide Debug' : 'Debug'}
                </button>
              </div>

              {/* Debug Panel - Remove before production */}
              {showDebug && debugData && (
                <div className="w-full bg-neutral-900/80 border border-neutral-700 rounded-xl p-4 text-left font-mono text-xs overflow-auto max-h-96">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-purple-400 font-bold text-sm">Redis Debug Inspector</h4>
                    <button
                      onClick={() => void refetchDebug()}
                      className="text-xs px-2 py-1 rounded bg-purple-800/50 text-purple-300 hover:bg-purple-700/50"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-neutral-400 font-bold mb-1">Meta</div>
                      <div className="text-neutral-300">User: {debugData.meta.username}</div>
                      <div className="text-neutral-300">Server Time: {debugData.meta.serverTime}</div>
                      <div className="text-neutral-300">Day ID: {debugData.meta.dayId} | Week ID: {debugData.meta.weekId}</div>
                      <div className="text-neutral-300">Day: {debugData.meta.dayOfWeekName}</div>
                    </div>
                    <div>
                      <div className="text-emerald-400 font-bold mb-1">Today (Day {debugData.meta.dayId})</div>
                      {([0, 1, 2] as const).map(i => {
                        const run = debugData.today.runs[`run${i}` as keyof typeof debugData.today.runs];
                        const config = debugData.today.runConfigs?.[i];
                        return (
                          <div key={i} className="text-neutral-300">
                            <div>Run {i}: score={String(run.score ?? 'undefined')} startTime={String(run.startTime ?? 'undefined')}</div>
                            {config && (
                              <div className="text-neutral-500 ml-4">
                                inc=[{config.baseIncrementRange.join(',')}] jump={config.jumpChance} dip={config.dipChance} spike={config.initialSpikeChance}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="text-neutral-300">Totals: score={String(debugData.today.totals.score ?? 'undefined')} runOrder={String(debugData.today.totals.runOrder ?? 'undefined')}</div>
                      <div className="text-neutral-300">Daily LB: {String(debugData.today.dailyLeaderboardScore ?? 'undefined')}</div>
                    </div>
                    <div>
                      <div className="text-yellow-400 font-bold mb-1">Yesterday (Day {debugData.meta.yesterdayDayId})</div>
                      <div className="text-neutral-300">Total: {String(debugData.yesterday.totalScore ?? 'undefined')}</div>
                      <div className="text-neutral-300">RunOrder: {String(debugData.yesterday.runOrder ?? 'undefined')}</div>
                    </div>
                    <div>
                      <div className="text-orange-400 font-bold mb-1">Weekly (Week {debugData.meta.weekId})</div>
                      <div className="text-neutral-300">Perfect Days ({debugData.meta.perfectDaysThisWeek}): {String(debugData.weekly.perfectDays ?? 'undefined')}</div>
                      <div className="text-neutral-300">Current Multiplier: {debugData.meta.weekMultiplier}x</div>
                      <div className="text-neutral-300">Daily Scores (raw): {JSON.stringify(debugData.weekly.dailyScores)}</div>
                      <div className="text-neutral-300">Daily Scores (mult): {JSON.stringify(debugData.weekly.dailyScoresMultiplied)}</div>
                      <div className="text-neutral-300">Daily Multipliers: {JSON.stringify(debugData.weekly.dailyMultipliers)}</div>
                      <div className="text-neutral-300">Weekly LB: {String(debugData.weekly.weeklyLeaderboardScore ?? 'undefined')}</div>
                      <div className="text-neutral-300">Lifetime Perfect Days: {String(debugData.weekly.lifetimePerfectDays ?? 'undefined')}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              🏆 Leaderboard
            </h2>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="text-neutral-400 hover:text-white text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setLeaderboardMode('daily')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                leaderboardMode === 'daily'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setLeaderboardMode('weekly')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                leaderboardMode === 'weekly'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              Weekly
            </button>
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2">
            <h3 className="text-neutral-400 text-sm font-bold text-center mb-4">
              {leaderboardMode === 'daily' ? "Today's Top Players" : "This Week's Top Players"}
            </h3>
            {currentLeaderboard && currentLeaderboard.length > 0 ? (
              currentLeaderboard.map((entry: { username: string; score: number }, index: number) => (
                <button
                  key={entry.username}
                  onClick={() => setSelectedPlayer(entry.username)}
                  className={`flex items-center justify-between p-4 rounded-xl w-full text-left hover:brightness-110 transition-all ${
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
                    <div className={`text-2xl font-bold ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-neutral-300' : index === 2 ? 'text-orange-600' : 'text-neutral-500'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      {index === 0 && <span className="text-xl">🏆</span>}
                      {index === 1 && <span className="text-xl">🥈</span>}
                      {index === 2 && <span className="text-xl">🥉</span>}
                      <span className="font-bold text-white">{entry.username}</span>
                    </div>
                  </div>
                  <div className={`text-xl font-mono font-bold ${
                    leaderboardMode === 'daily' ? 'text-emerald-400' : 'text-orange-400'
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
          {selectedPlayer && (
            <PlayerBreakdown
              isOpen={true}
              onClose={() => setSelectedPlayer(null)}
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
