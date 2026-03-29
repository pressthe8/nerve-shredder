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
      <div className="bg-neutral-900/95 backdrop-blur-md rounded-md max-w-md w-full max-h-[90vh] overflow-y-auto border border-neutral-700/50 font-mono">
        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-700/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">Weekly Breakdown</h2>
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
          ) : !data || data.days.length === 0 ? (
            <div className="text-neutral-500 text-center py-8">No scores this week yet.</div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {data.days.map((day) => (
                  <div
                    key={day.dayId}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-md ${
                      day.isPerfectDay
                        ? 'bg-emerald-950/30 border border-emerald-700/50'
                        : 'bg-neutral-800/50 border border-neutral-700/50'
                    }`}
                  >
                    <div className="flex items-center shrink-0 mr-2">
                      <div className={`text-sm font-bold ${day.isPerfectDay ? 'text-emerald-400' : 'text-neutral-400'}`}>
                        {day.dayOfWeekName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                      <span className="text-xs text-neutral-500 font-mono w-10 sm:w-12 text-right shrink-0">£{day.rawScore}</span>
                      <div className="w-9 sm:w-12 flex justify-center shrink-0">
                        {day.multiplier > 1.0 && (
                          <span className="text-[10px] sm:text-xs text-orange-400 font-bold bg-orange-500/20 px-1 sm:px-1.5 py-0.5 rounded">
                            {day.multiplier.toFixed(1)}x
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-mono font-black italic tracking-tighter text-orange-400 w-12 sm:w-16 text-right shrink-0">
                        £{day.multipliedScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-700 pt-3">
                <div className="flex justify-between items-center px-3">
                  <div className="text-xs font-bold text-neutral-400 tracking-[.3em] uppercase">Weekly Total</div>
                  <div className="text-xl font-mono font-black italic tracking-tighter text-orange-400 text-glow-amber">
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
        </div>
      </div>
    </div>
  );
};
