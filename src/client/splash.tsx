import './index.css';
import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';

const SplashContent = () => {
  const { data, isLoading } = trpc.game.getGameState.useQuery();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
      <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-red-500 to-orange-400 bg-clip-text text-transparent mb-2">NERVE</h1>
      <p className="text-neutral-400 mb-10 max-w-xs text-center font-medium">Push your luck. Bank before the crash.</p>
      
      {isLoading ? (
        <div className="text-neutral-500 animate-pulse font-mono">Loading Status...</div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 w-64 text-center shadow-xl">
            <h2 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">Today's Score</h2>
            <div className="text-4xl font-mono font-bold text-emerald-400">£{data?.totalScore ?? 0}</div>
            <div className="mt-4 flex justify-center gap-2">
              {[0, 1, 2].map((i) => {
                const runIndex = data?.runOrder[i];
                const isCompleted = runIndex !== undefined ? data?.runsCompleted[runIndex] : false;
                return (
                  <div key={i} className={`w-3 h-3 rounded-full shadow-inner ${isCompleted ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-neutral-800'}`} />
                );
              })}
            </div>
          </div>
          
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
