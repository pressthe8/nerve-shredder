import { navigateTo } from '@devvit/web/client';

type FrozenWeekViewProps = {
  weekLabel: string;
  activePostUrl: string | null;
  leaderboard: Array<{ username: string; score: number }> | undefined;
};

export const FrozenWeekView = ({ weekLabel, activePostUrl, leaderboard }: FrozenWeekViewProps) => {
  return (
    <div className="flex flex-col items-center min-h-screen bg-neutral-950 text-white p-4 pt-8">
      <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-red-500 to-orange-400 bg-clip-text text-transparent mb-2">
        NERVE
      </h1>
      <div className="text-amber-400 font-bold text-lg mb-1">
        {weekLabel}
      </div>
      <div className="text-neutral-500 font-medium text-sm mb-6">
        Final Standings
      </div>

      {/* Frozen Leaderboard */}
      <div className="w-full max-w-md space-y-2 mb-8">
        {leaderboard && leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
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
                  {index === 0 && <span className="text-xl">&#x1F3C6;</span>}
                  {index === 1 && <span className="text-xl">&#x1F948;</span>}
                  {index === 2 && <span className="text-xl">&#x1F949;</span>}
                  <span className="font-bold text-white">{entry.username}</span>
                </div>
              </div>
              <div className="text-xl font-mono font-bold text-amber-400">
                ${entry.score.toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-neutral-500 py-8">
            No scores recorded this week.
          </div>
        )}
      </div>

      {/* Link to Current Week */}
      {activePostUrl && (
        <button
          onClick={() => navigateTo(activePostUrl)}
          className="bg-red-600 hover:bg-red-500 transition-all duration-200 text-white font-black text-lg py-4 px-10 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 active:shadow-none"
        >
          PLAY THIS WEEK
        </button>
      )}
    </div>
  );
};
