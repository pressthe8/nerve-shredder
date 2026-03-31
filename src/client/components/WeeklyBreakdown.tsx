import { trpc } from '../lib/trpc.js';

interface WeeklyBreakdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyBreakdown = ({ isOpen, onClose }: WeeklyBreakdownProps) => {
  const { data, isLoading } = trpc.game.getWeeklyBreakdown.useQuery(undefined, {
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-neutral-900/95 backdrop-blur-md rounded-md max-w-md w-full border border-neutral-700/50 font-mono">
        <div className="bg-neutral-900/95 backdrop-blur-md border-b border-neutral-700/50 px-4 py-3 flex items-center justify-between">
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">Weekly Breakdown</h2>
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
          ) : !data || data.days.length === 0 ? (
            <div className="text-neutral-500 text-center py-6">No scores this week yet.</div>
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
                    <div className={`text-xs font-bold w-16 shrink-0 ${day.isPerfectDay ? 'text-emerald-400' : 'text-neutral-400'}`}>
                      {day.dayOfWeekName}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500 font-mono w-10 text-right shrink-0">£{day.rawScore}</span>
                      <div className="w-10 flex justify-center shrink-0">
                        {day.multiplier > 1.0 && (
                          <span className="text-[10px] text-orange-400 font-bold bg-orange-500/20 px-1 py-0.5 rounded">
                            {day.multiplier.toFixed(1)}x
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-black italic tracking-tighter text-orange-400 w-12 text-right shrink-0">
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
        </div>
      </div>
    </div>
  );
};
