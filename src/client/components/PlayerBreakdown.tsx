import { trpc } from '../lib/trpc.js';

interface PlayerBreakdownProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  mode: 'daily' | 'weekly';
}

export const PlayerBreakdown = ({ isOpen, onClose, username, mode }: PlayerBreakdownProps) => {
  const { data, isLoading } = trpc.game.getPlayerBreakdown.useQuery(
    { username, mode },
    { enabled: isOpen },
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{username}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="text-neutral-500 text-center py-8 animate-pulse">Loading...</div>
          ) : !data ? (
            <div className="text-neutral-500 text-center py-8">No data available.</div>
          ) : data.mode === 'daily' ? (
            /* Daily: Show 3 run cards */
            <>
              <h3 className="text-neutral-400 text-xs font-bold tracking-wider text-center mb-3">Today's Runs</h3>
              <div className="flex gap-3 mb-4">
                {data.runs.map((run) => (
                  <div
                    key={run.runIndex}
                    className={`flex-1 rounded-xl p-4 text-center ${
                      run.score !== null && run.score > 0
                        ? 'bg-emerald-950/30 border border-emerald-700/50'
                        : run.score === 0
                          ? 'bg-red-950/30 border border-red-700/50'
                          : 'bg-neutral-900/50 border border-neutral-800'
                    }`}
                  >
                    <div className="text-xs text-neutral-500 font-bold mb-1">{run.runIndex + 1}</div>
                    <div className={`text-xl font-mono font-bold ${
                      run.score !== null && run.score > 0
                        ? 'text-emerald-400'
                        : run.score === 0
                          ? 'text-red-400'
                          : 'text-neutral-700'
                    }`}>
                      {run.score !== null ? `£${run.score}` : '---'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-neutral-700 pt-3">
                <div className="flex justify-between items-center px-3">
                  <div className="text-sm font-bold text-neutral-400">Total</div>
                  <div className="text-xl font-mono font-black text-emerald-400">
                    £{data.totalScore}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Weekly: Show day-by-day breakdown */
            <>
              <h3 className="text-neutral-400 text-xs font-bold tracking-wider text-center mb-3">This Week</h3>
              {data.days.length === 0 ? (
                <div className="text-neutral-500 text-center py-4">No scores this week.</div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {data.days.map((day) => (
                      <div
                        key={day.dayId}
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          day.isPerfectDay
                            ? 'bg-emerald-950/30 border border-emerald-700/50'
                            : 'bg-neutral-800/50 border border-neutral-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-bold text-neutral-400 w-20">{day.dayOfWeekName}</div>
                          {day.isPerfectDay && <span className="text-xs">&#x2B50;</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-500 font-mono">£{day.rawScore}</span>
                          {day.multiplier > 1.0 && (
                            <span className="text-xs text-orange-400 font-bold bg-orange-500/20 px-1.5 py-0.5 rounded">
                              {day.multiplier.toFixed(1)}x
                            </span>
                          )}
                          <span className="text-sm font-mono font-bold text-orange-400 w-16 text-right">
                            £{day.multipliedScore}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-neutral-700 pt-3">
                    <div className="flex justify-between items-center px-3">
                      <div className="text-sm font-bold text-neutral-400">Weekly Total</div>
                      <div className="text-xl font-mono font-black text-orange-400">
                        £{data.totalMultiplied}
                      </div>
                    </div>
                    {data.perfectDayCount > 0 && (
                      <div className="text-center mt-2 text-xs text-orange-300/80">
                        {data.perfectDayCount}/7 Perfect Days
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
