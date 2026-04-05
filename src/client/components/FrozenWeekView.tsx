import { navigateTo } from '@devvit/web/client';

type FrozenLeaderboard = {
  top3: Array<{ username: string; score: number }>;
  totalPlayers: number;
  currentUser: string | null;
  currentUserRank: number | null;
  currentUserScore: number | null;
};

type FrozenWeekViewProps = {
  weekLabel: string;
  activePostUrl: string | null;
  leaderboard: FrozenLeaderboard | undefined;
};

const MEDALS = ['🏆', '🥈', '🥉'];

export const FrozenWeekView = ({ weekLabel, activePostUrl, leaderboard }: FrozenWeekViewProps) => {
  const top3 = leaderboard?.top3 ?? [];
  const totalPlayers = leaderboard?.totalPlayers ?? 0;

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
      <div className="flex items-center gap-2 text-neutral-400 font-bold text-xs mb-6 tracking-[.3em] uppercase">
        <span>Final Standings</span>
        {totalPlayers > 0 && (
          <>
            <span className="text-neutral-600">·</span>
            <span>{totalPlayers.toLocaleString()} Players</span>
          </>
        )}
      </div>

      {/* Top 3 */}
      <div className="w-full max-w-md space-y-1.5 mb-4">
        {top3.length > 0 ? (
          top3.map((entry, i) => (
            <div
              key={entry.username}
              className={`flex items-center justify-between p-3 rounded-md ${
                i === 0
                  ? 'bg-yellow-950/30 border border-yellow-700/50'
                  : i === 1
                    ? 'bg-neutral-800/50 border border-neutral-700'
                    : 'bg-orange-950/30 border border-orange-900/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`text-base font-black italic tracking-tighter w-8 text-right ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-neutral-300' : 'text-orange-600'
                }`}>
                  #{i + 1}
                </div>
                <div className="flex items-center gap-1.5">
                  <span>{MEDALS[i]}</span>
                  <span className="font-bold text-white text-sm tracking-wide">{entry.username}</span>
                </div>
              </div>
              <div className="text-base font-mono font-black italic tracking-tighter text-amber-400 text-glow-amber">
                £{entry.score.toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-neutral-500 py-8">
            No scores recorded this week.
          </div>
        )}

        {/* Current user if outside top 3 */}
        {leaderboard?.currentUserRank !== null && leaderboard?.currentUserRank !== undefined && leaderboard.currentUserScore !== null && (
          <>
            <div className="text-center text-neutral-700 text-xs py-1">· · ·</div>
            <div className="flex items-center justify-between p-3 rounded-md border border-dashed border-neutral-600 bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <div className="text-sm font-black italic tracking-tighter w-8 text-right text-neutral-500">
                  #{leaderboard.currentUserRank}
                </div>
                <span className="font-bold text-neutral-400 text-sm tracking-wide">
                  {leaderboard.currentUser} <span className="text-neutral-600 text-xs font-normal">(you)</span>
                </span>
              </div>
              <div className="text-base font-mono font-black italic tracking-tighter text-amber-700">
                £{leaderboard.currentUserScore.toLocaleString()}
              </div>
            </div>
          </>
        )}
      </div>

      {activePostUrl && (
        <button
          onClick={() => navigateTo(activePostUrl)}
          className="bg-red-600 hover:bg-red-500 transition-all duration-200 text-white font-black text-lg py-4 px-12 skew-x-[-12deg] shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:shadow-[0_0_40px_rgba(220,38,38,0.7)] active:scale-95"
        >
          <span className="inline-block skew-x-[12deg] tracking-wider">PLAY ACTIVE WEEK NOW</span>
        </button>
      )}
    </div>
  );
};
