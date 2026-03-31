import { useState } from 'react';
import { navigateTo } from '@devvit/web/client';

type FrozenWeekViewProps = {
  weekLabel: string;
  activePostUrl: string | null;
  leaderboard: Array<{ username: string; score: number }> | undefined;
};

const PAGE_SIZE = 10;

export const FrozenWeekView = ({ weekLabel, activePostUrl, leaderboard }: FrozenWeekViewProps) => {
  const [page, setPage] = useState(0);
  const totalEntries = leaderboard?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = leaderboard?.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) ?? [];
  const pageOffset = safePage * PAGE_SIZE;

  return (
    <div className="flex flex-col items-center min-h-screen bg-neutral-950 text-white p-4 pt-8 font-mono cursor-crosshair relative">
      {/* CRT Overlays */}
      <div className="scanline-overlay" />
      <div className="crt-vignette" />
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />

      <img
        src="/Nerve Shredder 500x500.jpeg"
        alt="Nerve Shredder"
        className="w-20 h-20 mb-2 rounded-lg"
      />
      <div className="text-amber-400 font-bold text-lg mb-1 text-glow-amber">
        {weekLabel}
      </div>
      <div className="text-neutral-400 font-bold text-xs mb-6 tracking-[.3em] uppercase">
        Final Standings
      </div>

      {/* Frozen Leaderboard */}
      <div className="w-full max-w-md space-y-1.5 mb-4">
        {totalEntries > 0 ? (
          pageEntries.map((entry, i) => {
            const globalIndex = pageOffset + i;
            return (
              <div
                key={entry.username}
                className={`flex items-center justify-between p-3 rounded-md ${
                  globalIndex === 0
                    ? 'bg-yellow-950/30 border border-yellow-700/50'
                    : globalIndex === 1
                      ? 'bg-neutral-800/50 border border-neutral-700'
                      : globalIndex === 2
                        ? 'bg-orange-950/30 border border-orange-900/50'
                        : 'bg-neutral-900/30 border border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`text-base font-black italic tracking-tighter w-8 text-right ${
                    globalIndex === 0 ? 'text-yellow-400' : globalIndex === 1 ? 'text-neutral-300' : globalIndex === 2 ? 'text-orange-600' : 'text-neutral-500'
                  }`}>
                    #{globalIndex + 1}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {globalIndex === 0 && <span>🏆</span>}
                    {globalIndex === 1 && <span>🥈</span>}
                    {globalIndex === 2 && <span>🥉</span>}
                    <span className="font-bold text-white text-sm tracking-wide">{entry.username}</span>
                  </div>
                </div>
                <div className="text-base font-mono font-black italic tracking-tighter text-amber-400 text-glow-amber">
                  £{entry.score.toLocaleString()}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-neutral-500 py-8">
            No scores recorded this week.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="text-neutral-400 hover:text-white disabled:text-neutral-700 font-bold text-lg px-2"
          >‹</button>
          <span className="text-xs text-neutral-500 font-mono tracking-wider">{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage === totalPages - 1}
            className="text-neutral-400 hover:text-white disabled:text-neutral-700 font-bold text-lg px-2"
          >›</button>
        </div>
      )}

      {activePostUrl && (
        <button
          onClick={() => navigateTo(activePostUrl)}
          className="bg-red-600 hover:bg-red-500 transition-all duration-200 text-white font-black text-lg py-4 px-12 skew-x-[-12deg] shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:shadow-[0_0_40px_rgba(220,38,38,0.7)] active:scale-95"
        >
          <span className="inline-block skew-x-[12deg] tracking-wider">PLAY THIS WEEK</span>
        </button>
      )}
    </div>
  );
};
