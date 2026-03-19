import './index.css';
import { navigateTo } from '@devvit/web/client';
import { StrictMode, useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';
import { HowToPlay } from './components/HowToPlay.js';

const GameContent = () => {
  const { data: gameState, refetch } = trpc.game.getGameState.useQuery();
  const startRun = trpc.game.startRun.useMutation();
  const bankRun = trpc.game.bankRun.useMutation();

  const [phase, setPhase] = useState<'IDLE' | 'RUNNING' | 'FINISHED' | 'BUSTED' | 'BANKED'>('IDLE');
  const [amount, setAmount] = useState(0);
  const [activeRunIndex, setActiveRunIndex] = useState<number | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  const reqRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const startNextRun = useCallback(() => {
    if (!gameState) return;
    const nextRun = gameState.runOrder.find((runIndex) => !gameState.runsCompleted[runIndex]);
    if (nextRun === undefined) {
      setPhase('FINISHED');
      return;
    }
    
    setActiveRunIndex(nextRun);
    setAmount(0);
    setPhase('IDLE');
  }, [gameState]);

  const executeRun = async () => {
    if (activeRunIndex === null) return;
    try {
      await startRun.mutateAsync({ runIndex: activeRunIndex });
      setPhase('RUNNING');
      startTimeRef.current = performance.now();
      
      const loop = (time: number) => {
        const elapsed = time - startTimeRef.current;
        const val = Math.floor(10 * Math.pow(1.0003, elapsed));
        setAmount(val);
        reqRef.current = requestAnimationFrame(loop);
      };
      
      reqRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBank = async () => {
    if (phase !== 'RUNNING' || activeRunIndex === null) return;
    
    cancelAnimationFrame(reqRef.current);
    const elapsed = performance.now() - startTimeRef.current;
    const bankedValue = amount;
    
    try {
      const res = await bankRun.mutateAsync({ 
        runIndex: activeRunIndex, 
        clientElapsedMs: elapsed,
        bankAmount: bankedValue
      });
      
      if (res.bust) {
        setPhase('BUSTED');
        setPercentile(null);
      } else {
        setPhase('BANKED');
        setAmount(res.finalScore);
        setPercentile(res.percentile ?? null);
      }
      void refetch();
    } catch (e) {
      console.error(e);
      setPhase('BUSTED');
    }
  };

  useEffect(() => {
    setTimeout(() => {
      if (gameState && phase === 'IDLE' && activeRunIndex === null) {
        startNextRun();
      }
    }, 0);
  }, [gameState, phase, activeRunIndex, startNextRun]);

  return (
    <div className={`flex flex-col items-center min-h-screen p-4 transition-colors duration-100 ${phase === 'BUSTED' ? 'bg-red-950/90 animate-[flash_0.2s_ease-in-out,shake_0.5s_ease-in-out]' : 'bg-neutral-950 text-white'}`}>

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

      {/* Today's Attempts Section */}
      {gameState && (
        <div className="w-full max-w-md mt-6 mb-2">
          <h3 className="text-neutral-400 text-center text-sm font-bold tracking-wide mb-3">Today's Attempts</h3>
          <div className="flex gap-3 justify-center">
            {[0, 1, 2].map(i => {
              const runIndex = gameState.runOrder[i];
              const score = runIndex !== undefined && gameState.runScores ? gameState.runScores[runIndex] : null;
              const isCompleted = runIndex !== undefined ? gameState.runsCompleted[runIndex] : false;
              const isCurrent = runIndex === activeRunIndex;

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-xl p-4 text-center transition-all ${
                    isCurrent && phase === 'RUNNING'
                      ? 'bg-blue-950/50 border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                      : isCompleted && score !== null && score !== undefined && score > 0
                        ? 'bg-emerald-950/30 border border-emerald-700/50'
                        : isCompleted && score === 0
                          ? 'bg-red-950/30 border border-red-700/50'
                          : 'bg-neutral-900/50 border border-neutral-800'
                  }`}
                >
                  <div className="text-xs text-neutral-500 font-bold mb-1">{i + 1}</div>
                  <div className={`text-xl font-mono font-bold ${
                    score !== null && score !== undefined && score > 0
                      ? 'text-emerald-400'
                      : score === 0
                        ? 'text-neutral-600'
                        : 'text-neutral-700'
                  }`}>
                    {score !== null && score !== undefined ? `$${score}` : '$0'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* This Week's Total */}
          <div className="mt-6 bg-gradient-to-br from-orange-950/40 to-orange-900/20 border border-orange-700/30 rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-neutral-400 text-xs font-bold tracking-wider">This Week's Total</h3>
              {gameState.weekMultiplier && gameState.weekMultiplier > 1.0 && (
                <span className="text-orange-400 text-xs font-bold bg-orange-500/20 px-2 py-0.5 rounded">
                  {gameState.weekMultiplier.toFixed(1)}x
                </span>
              )}
            </div>
            <div className="text-4xl font-mono font-black text-orange-400 tracking-tight">
              ${gameState.weeklyScore?.toLocaleString() ?? 0}
            </div>
            {gameState.weekPerfectDays > 0 && (
              <div className="mt-2 text-xs text-orange-300/80">
                {gameState.weekPerfectDays}/7 Perfect Days
              </div>
            )}
          </div>
        </div>
      )}

      {/* Old run indicator dots - keeping for now but could remove */}
      {gameState && (
        <div className="absolute top-6 flex gap-2">
          {[0,1,2].map(i => {
             const runIndex = gameState.runOrder[i];
             const isCompleted = runIndex !== undefined ? gameState.runsCompleted[runIndex] : false;
             const isCurrent = runIndex === activeRunIndex;
             return (
               <div key={i} className={`w-3 h-3 rounded-full transition-all ${isCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : isCurrent && phase === 'RUNNING' ? 'bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.9)]' : 'bg-neutral-800'}`} />
             )
          })}
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        {phase === 'IDLE' && (
           <div className="text-center animate-in fade-in zoom-in duration-300">
             <h2 className="text-3xl font-bold mb-12 text-neutral-300">Ready for Run {gameState ? gameState.runOrder.indexOf(activeRunIndex!) + 1 : 1}?</h2>
             <button onClick={() => void executeRun()} disabled={startRun.isPending} className="w-48 h-48 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-4xl shadow-[0_0_40px_rgba(37,99,235,0.6)] transition-transform active:scale-90">START</button>
           </div>
        )}
        
        {phase === 'RUNNING' && (
          <div className="flex flex-col flex-1 w-full justify-between py-12">
            <div className="text-center flex-1 flex flex-col justify-center animate-in slide-in-from-bottom-8">
              <div className="text-neutral-500 font-bold tracking-widest text-sm mb-4">POTENTIAL WINNINGS</div>
              <div className="text-7xl md:text-8xl py-4 font-mono font-bold text-emerald-400 tracking-tighter shadow-emerald-500/20 drop-shadow-2xl">£{amount.toLocaleString()}</div>
            </div>
            <button onClick={() => void handleBank()} disabled={bankRun.isPending} className="w-full py-8 rounded-[2rem] bg-red-600 hover:bg-red-500 text-white font-black text-4xl tracking-widest shadow-[0_0_50px_rgba(220,38,38,0.5)] active:scale-95 transition-transform flex items-center justify-center">BANK</button>
          </div>
        )}

        {phase === 'BANKED' && (
          <div className="text-center animate-in zoom-in duration-300">
             <h2 className="text-5xl font-black text-emerald-500 mb-4 tracking-tight drop-shadow-xl">BANKED!</h2>
             <div className="text-4xl font-mono text-white mb-4">+£{amount.toLocaleString()}</div>
             {percentile !== null && (
               <div className="text-emerald-400 font-bold text-xl mb-8 animate-in fade-in-50 duration-500 delay-300">
                 Top {percentile}% of players
               </div>
             )}
             <button onClick={startNextRun} className="px-10 py-4 w-full rounded-full bg-white text-black font-black hover:bg-neutral-200 active:scale-95 transition-transform">Continue to Next Run</button>
          </div>
        )}

        {phase === 'BUSTED' && (
          <div className="text-center animate-in zoom-in duration-100">
             <h2 className="text-6xl font-black text-red-500 mb-4 tracking-tighter">CRASH!</h2>
             <div className="text-lg text-red-300/80 mb-12 font-medium">You waited too long and lost it all.</div>
             <button onClick={startNextRun} className="px-10 py-4 w-full rounded-full bg-white/10 border border-white/20 text-white font-black hover:bg-white/20 active:scale-95 transition-transform">Continue</button>
          </div>
        )}

        {phase === 'FINISHED' && (
          <div className="text-center animate-in fade-in duration-500">
             <h2 className="text-2xl font-bold text-neutral-400 mb-6">Daily Runs Complete</h2>
             <div className="text-6xl font-mono font-bold text-emerald-400 mb-4 shadow-emerald-500/20 drop-shadow-2xl">£{gameState?.totalScore.toLocaleString()}</div>
             {gameState && gameState.lifetimePerfectDays > 0 && (
               <div className="mt-4 mb-8 text-emerald-400 font-bold text-lg">
                 🔥 {gameState.lifetimePerfectDays} Perfect Days Total
               </div>
             )}
             <button onClick={() => navigateTo('https://www.reddit.com/')} className="px-10 py-4 w-full rounded-full bg-neutral-800 text-white font-black hover:bg-neutral-700 active:scale-95 transition-transform">Close Game</button>
          </div>
        )}
      </div>
    </div>
  );
};

export const App = () => (
  <TRPCProvider>
    <GameContent />
  </TRPCProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
