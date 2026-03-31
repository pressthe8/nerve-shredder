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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-neutral-900/95 backdrop-blur-md rounded-md max-w-md w-full border border-neutral-700/50 font-mono">
        <div className="bg-neutral-900/95 backdrop-blur-md border-b border-neutral-700/50 px-4 py-3 flex items-center justify-between">
          <h2 className="text-xl font-black italic tracking-tighter text-white">{username}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          {isLoading ? (
            <div className="text-neutral-500 text-center py-6 animate-pulse">Loading...</div>
          ) : !data ? (
            <div className="text-neutral-500 text-center py-6">No data available.</div>
          ) : data.mode === 'daily' ? (
            /* Daily: Show 3 run cards */
            <>
              <h3 className="text-neutral-400 text-xs font-bold tracking-[.3em] text-center mb-2 uppercase">Today's Runs</h3>
              <div className="flex gap-2 mb-3">
                {data.runs.map((run) => (
                  <div
                    key={run.runIndex}
                    className={`flex-1 rounded-md p-3 text-center ${
                      run.score !== null && run.score > 0
                        ? 'bg-emerald-950/30 border border-emerald-500/40 shadow-[0_0_8px_rgba(52,211,153,0.15)]'
                        : run.score === 0
                          ? 'bg-red-950/30 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                          : 'bg-neutral-900/50 border border-neutral-700/50'
                    }`}
                  >
                    <div className="text-xs text-neutral-400 font-bold mb-1 tracking-[.3em]">RUN {run.runIndex + 1}</div>
                    <div className={`text-xl font-mono font-black italic tracking-tighter ${
                      run.score !== null && run.score > 0
                        ? 'text-emerald-400 text-glow-emerald'
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
                  <div className="text-xs font-bold text-neutral-400 tracking-[.3em] uppercase">Total</div>
                  <div className="text-xl font-mono font-black italic tracking-tighter text-emerald-400 text-glow-emerald">
                    £{data.totalScore}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Weekly: Show day-by-day breakdown */
            <>
              <h3 className="text-neutral-400 text-xs font-bold tracking-[.3em] text-center mb-2 uppercase">This Week</h3>
              {data.days.length === 0 ? (
                <div className="text-neutral-500 text-center py-4">No scores this week.</div>
              ) : (
                <>
                  <div className="space-y-1 mb-2">
                    {data.days.map((day) => (
                      <div
                        key={day.dayId}
                        className={`flex items-center justify-between px-2 py-1.5 rounded ${
                          day.isPerfectDay
                            ? 'bg-emerald-950/30 border border-emerald-700/50'
                            : 'bg-neutral-800/50 border border-neutral-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={`text-xs font-bold w-16 ${day.isPerfectDay ? 'text-emerald-400' : 'text-neutral-400'}`}>{day.dayOfWeekName}</div>
                          {day.isPerfectDay && <span className="text-xs">⭐</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500 font-mono">£{day.rawScore}</span>
                          {day.multiplier > 1.0 && (
                            <span className="text-[10px] text-orange-400 font-bold bg-orange-500/20 px-1 py-0.5 rounded">
                              {day.multiplier.toFixed(1)}x
                            </span>
                          )}
                          <span className="text-xs font-mono font-black italic tracking-tighter text-orange-400 w-14 text-right">
                            £{day.multipliedScore}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-neutral-700 pt-2">
                    <div className="flex justify-between items-center px-2">
                      <div className="text-xs font-bold text-neutral-400 tracking-[.3em] uppercase">Weekly Total</div>
                      <div className="text-lg font-mono font-black italic tracking-tighter text-orange-400 text-glow-amber">
                        £{data.totalMultiplied}
                      </div>
                    </div>
                    {data.perfectDayCount > 0 && (
                      <div className="text-center mt-1 text-xs text-orange-300/80">
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
