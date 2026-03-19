import './index.css';
import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';
import { HowToPlay } from './components/HowToPlay.js';

const SplashContent = () => {
  const { data, isLoading } = trpc.game.getGameState.useQuery();
  const { data: dailyLeaderboard } = trpc.game.getLeaderboard.useQuery();
  const { data: weeklyLeaderboard } = trpc.game.getWeeklyLeaderboard.useQuery();
  const clearDaily = trpc.game.clearDailyStats.useMutation();
  const clearWeekly = trpc.game.clearWeeklyStats.useMutation();
  const clearAll = trpc.game.clearAllStats.useMutation();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'daily' | 'weekly'>('daily');
  const [showHowToPlay, setShowHowToPlay] = useState(false);

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
                          {score !== null && score !== undefined ? `£${score}` : '£0'}
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
                <div className="w-full bg-gradient-to-br from-orange-950/40 to-orange-900/20 border border-orange-700/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <h3 className="text-neutral-400 text-xs font-bold tracking-wider">This Week's Total</h3>
                    {data.weekMultiplier && data.weekMultiplier > 1.0 && (
                      <span className="text-orange-400 text-xs font-bold bg-orange-500/20 px-2 py-0.5 rounded">
                        {data.weekMultiplier.toFixed(1)}x
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-mono font-black text-orange-400">£{data.weeklyScore.toLocaleString()}</div>
                  {data.weekPerfectDays > 0 && (
                    <div className="mt-2 text-xs text-orange-300/80">
                      {data.weekPerfectDays}/7 Perfect Days
                    </div>
                  )}
                </div>
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
                    await clearDaily.mutateAsync();
                    window.location.reload();
                  }}
                  className="text-xs px-3 py-1 rounded bg-yellow-900/30 border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/50 transition-colors"
                >
                  Clear Daily
                </button>
                <button
                  onClick={async () => {
                    await clearWeekly.mutateAsync();
                    window.location.reload();
                  }}
                  className="text-xs px-3 py-1 rounded bg-orange-900/30 border border-orange-700/50 text-orange-400 hover:bg-orange-900/50 transition-colors"
                >
                  Clear Weekly
                </button>
                <button
                  onClick={async () => {
                    await clearAll.mutateAsync();
                    window.location.reload();
                  }}
                  className="text-xs px-3 py-1 rounded bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50 transition-colors"
                >
                  Clear All
                </button>
              </div>
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
                <div
                  key={entry.username}
                  className={`flex items-center justify-between p-4 rounded-xl ${
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
                </div>
              ))
            ) : (
              <div className="text-center text-neutral-500 py-8">
                No scores yet. Be the first!
              </div>
            )}
          </div>
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
