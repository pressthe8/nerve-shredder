import './index.css';
import { navigateTo } from '@devvit/web/client';
import { StrictMode, useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';

const GameContent = () => {
  const { data: gameState, refetch } = trpc.game.getGameState.useQuery();
  const startRun = trpc.game.startRun.useMutation();
  const bankRun = trpc.game.bankRun.useMutation();

  const [phase, setPhase] = useState<'IDLE' | 'RUNNING' | 'FINISHED' | 'BUSTED' | 'BANKED'>('IDLE');
  const [amount, setAmount] = useState(0);
  const [activeRunIndex, setActiveRunIndex] = useState<number | null>(null);
  
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
      } else {
        setPhase('BANKED');
        setAmount(res.finalScore);
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
    <div className={`flex flex-col items-center justify-center min-h-screen p-4 transition-colors duration-100 ${phase === 'BUSTED' ? 'bg-red-950/90' : 'bg-neutral-950 text-white'}`}>
      
      {gameState && (
        <div className="absolute top-6 flex gap-2">
          {[0,1,2].map(i => {
             const runIndex = gameState.runOrder[i];
             const isCompleted = runIndex !== undefined ? gameState.runsCompleted[runIndex] : false;
             const isCurrent = runIndex === activeRunIndex;
             return (
               <div key={i} className={`w-3 h-3 rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : isCurrent && phase === 'RUNNING' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-800'}`} />
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
             <div className="text-4xl font-mono text-white mb-12">+£{amount.toLocaleString()}</div>
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
             <div className="text-6xl font-mono font-bold text-emerald-400 mb-12 shadow-emerald-500/20 drop-shadow-2xl">£{gameState?.totalScore.toLocaleString()}</div>
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
