import './index.css';
import { exitExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState, useRef, useCallback } from 'react';
import { useSound } from './lib/useSound.js';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';
import { HowToPlay } from './components/HowToPlay.js';
import { STEP_DISPLAY_MS } from '../shared/scoreEngine.js';

const GameContent = () => {
  const { data: weekInfo } = trpc.game.getPostWeekInfo.useQuery();
  const { data: gameState, refetch } = trpc.game.getGameState.useQuery(undefined, {
    enabled: weekInfo?.isActiveWeek !== false,
  });
  const startRun = trpc.game.startRun.useMutation();
  const bankRun = trpc.game.bankRun.useMutation();

  const [phase, setPhase] = useState<'IDLE' | 'RUNNING' | 'FINISHED' | 'BUSTED' | 'BANKED'>('IDLE');
  const [amount, setAmount] = useState(0);
  const [activeRunIndex, setActiveRunIndex] = useState<number | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isLastRun, setIsLastRun] = useState(false);
  const [nextResetCountdown, setNextResetCountdown] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setNextResetCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIndexRef = useRef<number>(0);
  const sequenceRef = useRef<number[]>([]);
  const bankingRef = useRef(false);
  const { playSound, muted, toggleMute } = useSound();

  const clearRunInterval = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startNextRun = useCallback(() => {
    if (!gameState) return;
    const nextRun = gameState.runOrder.find((runIndex) => !gameState.runsCompleted[runIndex]);
    if (nextRun === undefined) {
      setPhase('FINISHED');
      return;
    }

    setActiveRunIndex(nextRun);
    setAmount(0);
    setIsLastRun(false);
    setPhase('IDLE');
  }, [gameState]);

  const finishRun = useCallback(async (runIndex: number, stepIndex: number, skipBustSound = false) => {
    if (bankingRef.current) return;
    bankingRef.current = true;
    clearRunInterval();

    try {
      const res = await bankRun.mutateAsync({ runIndex, stepIndex });

      if (res.bust) {
        if (!skipBustSound) playSound('bust');
        setPhase('BUSTED');
        setPercentile(null);
      } else {
        playSound('bank');
        setPhase('BANKED');
        setAmount(res.finalScore);
        setPercentile(res.percentile ?? null);
      }
      if (gameState) {
        const completedCount = gameState.runsCompleted.filter((c, idx) => c || idx === runIndex).length;
        setIsLastRun(completedCount >= 3);
      }
      void refetch();
    } catch (e) {
      console.error(e);
      playSound('bust');
      setPhase('BUSTED');
    } finally {
      bankingRef.current = false;
    }
  }, [bankRun, gameState, playSound, refetch]);

  const executeRun = async () => {
    if (activeRunIndex === null) return;
    try {
      const result = await startRun.mutateAsync({ runIndex: activeRunIndex });
      const sequence = result.sequence;

      sequenceRef.current = sequence;
      stepIndexRef.current = 0;
      bankingRef.current = false;
      setAmount(sequence[0] ?? 0);
      setPhase('RUNNING');
      playSound('tick');

      const runIndex = activeRunIndex;

      const interval = setInterval(() => {
        const nextStep = stepIndexRef.current + 1;
        if (nextStep >= sequence.length) {
          // Auto-bust: sequence exhausted
          clearInterval(interval);
          intervalRef.current = null;
          playSound('bust');
          void finishRun(runIndex, sequence.length, true);
          return;
        }
        stepIndexRef.current = nextStep;
        setAmount(sequence[nextStep] ?? 0);
        playSound('tick');
      }, STEP_DISPLAY_MS);

      intervalRef.current = interval;
    } catch (e) {
      console.error(e);
      // If the run is already completed, refetch state to advance
      void refetch().then(() => {
        setActiveRunIndex(null);
        setPhase('IDLE');
      });
    }
  };

  const handleBank = () => {
    if (phase !== 'RUNNING' || activeRunIndex === null) return;
    void finishRun(activeRunIndex, stepIndexRef.current);
  };

  useEffect(() => {
    setTimeout(() => {
      if (gameState && phase === 'IDLE' && activeRunIndex === null) {
        startNextRun();
      }
    }, 0);
  }, [gameState, phase, activeRunIndex, startNextRun]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => clearRunInterval();
  }, []);

  // Block gameplay on expired posts
  if (weekInfo && !weekInfo.isActiveWeek) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4 font-mono cursor-crosshair">
        <div className="scanline-overlay" />
        <div className="crt-vignette" />
        <h2 className="text-2xl font-black italic tracking-tighter text-neutral-400 mb-4">This game week has ended</h2>
        <p className="text-neutral-500 mb-8">Visit the current week's post to play.</p>
        <button
          onClick={(e) => exitExpandedMode(e.nativeEvent)}
          className="px-10 py-4 rounded-full bg-neutral-800 text-white font-black hover:bg-neutral-700 active:scale-95 transition-transform"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center min-h-screen p-4 transition-colors duration-100 font-mono cursor-crosshair relative ${phase === 'BUSTED' ? 'bg-red-950/90 animate-[flash_0.2s_ease-in-out,shake_0.5s_ease-in-out]' : 'bg-neutral-950 text-white'}`}>
      {/* CRT Overlays */}
      <div className="scanline-overlay" />
      <div className="crt-vignette" />
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-600/8 rounded-full blur-[150px] pointer-events-none" />

      {/* Mute Toggle */}
      <button
        onClick={toggleMute}
        className={`absolute top-4 right-4 w-12 h-12 rounded-full bg-neutral-900/60 backdrop-blur-md border border-neutral-700/50 hover:bg-neutral-800/80 hover:border-neutral-600 transition-colors flex items-center justify-center z-40 ${showHowToPlay ? 'hidden' : ''}`}
      >
        {muted ? (
          <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9" />
          </svg>
        )}
      </button>

      {/* Hamburger Menu Button */}
      <button
        onClick={() => { setShowHowToPlay(true); }}
        className="absolute top-4 left-4 w-12 h-12 rounded-full bg-neutral-900/60 backdrop-blur-md border border-neutral-700/50 hover:bg-neutral-800/80 hover:border-neutral-600 transition-colors flex items-center justify-center z-40"
      >
        <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* How to Play Modal */}
      <HowToPlay isOpen={showHowToPlay} onClose={() => { setShowHowToPlay(false); }} />

      {/* Today's Attempts Section */}
      {gameState && (
        <div className="w-full max-w-md mt-6 mb-2">
          <h3 className="text-neutral-400 text-center text-xs font-bold tracking-[.3em] mb-3 uppercase">Today's Attempts</h3>
          <div className="flex gap-3 justify-center">
            {[0, 1, 2].map(i => {
              const runIndex = gameState.runOrder[i];
              const score = runIndex !== undefined && gameState.runScores ? gameState.runScores[runIndex] : null;
              const isCompleted = runIndex !== undefined ? gameState.runsCompleted[runIndex] : false;
              const isCurrent = runIndex === activeRunIndex;

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-md p-4 text-center transition-all ${
                    isCurrent && phase === 'RUNNING'
                      ? 'bg-blue-950/50 border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                      : isCompleted && score !== null && score !== undefined && score > 0
                        ? 'bg-emerald-950/30 border border-emerald-500/40 shadow-[0_0_8px_rgba(52,211,153,0.15)]'
                        : isCompleted && score === 0
                          ? 'bg-red-950/30 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                          : 'bg-neutral-900/50 border border-neutral-700/50'
                  }`}
                >
                  <div className="text-xs text-neutral-400 font-bold mb-1 tracking-[.3em]">RUN {i + 1}</div>
                  <div className={`text-xl font-mono font-black italic tracking-tighter ${
                    score !== null && score !== undefined && score > 0
                      ? 'text-emerald-400 text-glow-emerald'
                      : score === 0
                        ? 'text-neutral-500'
                        : 'text-neutral-500'
                  }`}>
                    {score !== null && score !== undefined ? `£${score}` : '---'}
                  </div>
                </div>
              );
            })}
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
             <h2 className="text-3xl font-black italic tracking-tighter mb-12 text-neutral-300">Ready for Run {gameState ? gameState.runOrder.indexOf(activeRunIndex!) + 1 : 1}?</h2>
             <button onClick={() => void executeRun()} disabled={startRun.isPending} className="w-48 h-48 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-4xl shadow-[0_0_50px_rgba(37,99,235,0.6)] hover:shadow-[0_0_60px_rgba(37,99,235,0.8)] transition-all active:scale-90">START</button>
           </div>
        )}

        {phase === 'RUNNING' && (
          <div className="flex flex-col flex-1 w-full justify-between py-12">
            <div className="text-center flex-1 flex flex-col justify-center">
              <div className="text-neutral-400 font-bold tracking-[.3em] text-xs mb-4">POTENTIAL WINNINGS</div>
              <div
                key={stepIndexRef.current}
                className="text-7xl md:text-8xl py-4 font-mono font-black italic text-emerald-400 tracking-tighter drop-shadow-2xl animate-[pulse_0.3s_ease-in-out] text-glow-emerald"
              >
                £{amount.toLocaleString()}
              </div>
            </div>
            <button onClick={handleBank} disabled={bankRun.isPending} className="w-full py-8 bg-red-600 hover:bg-red-500 text-white font-black text-4xl tracking-widest shadow-[0_0_50px_rgba(220,38,38,0.5)] active:scale-95 transition-transform flex items-center justify-center skew-x-[-12deg]">
              <span className="inline-block skew-x-[12deg]">BANK</span>
            </button>
          </div>
        )}

        {phase === 'BANKED' && (
          <div className="text-center animate-in zoom-in duration-300">
             <h2 className="text-5xl font-black italic text-emerald-500 mb-4 tracking-tighter drop-shadow-xl text-glow-emerald">BANKED!</h2>
             <div className="text-4xl font-mono font-black italic text-white mb-4 tracking-tighter">+£{amount.toLocaleString()}</div>
             {percentile !== null && (
               <div className="text-emerald-400 font-bold text-xl mb-8 animate-in fade-in-50 duration-500 delay-300">
                 Top {percentile}% of players
               </div>
             )}
             <button onClick={startNextRun} className="px-10 py-4 w-full rounded-full bg-white text-black font-black hover:bg-neutral-200 active:scale-95 transition-transform">{isLastRun ? 'View Results' : 'Continue to Next Run'}</button>
          </div>
        )}

        {phase === 'BUSTED' && (
          <div className="text-center animate-in zoom-in duration-100">
             <h2 className="text-6xl font-black italic text-red-500 mb-4 tracking-tighter text-glow-red">CRASH!</h2>
             <div className="text-lg text-red-300/80 mb-12 font-medium">You waited too long and lost it all.</div>
             <button onClick={startNextRun} className="px-10 py-4 w-full rounded-full bg-white/10 border border-white/20 text-white font-black hover:bg-white/20 active:scale-95 transition-transform">{isLastRun ? 'View Results' : 'Continue'}</button>
          </div>
        )}

        {phase === 'FINISHED' && (
          <div className="text-center animate-in fade-in duration-500">
             <h2 className="text-2xl font-black italic tracking-tighter text-neutral-400 mb-6">Daily Runs Complete</h2>
             <div className="text-6xl font-mono font-black italic text-cyan-400 mb-4 tracking-tighter drop-shadow-2xl text-glow-cyan">£{gameState?.totalScore.toLocaleString()}</div>
             {gameState && gameState.runScores.every(s => s !== null && s > 0) && (
               <div className="mt-4 mb-6 text-cyan-400 font-bold text-lg">
                 🔥 Perfect Day!
               </div>
             )}

             {/* Weekly Summary - Secondary */}
             {gameState && gameState.weeklyScore > 0 && (
               <div className="mt-2 mb-8 bg-gradient-to-br from-amber-950/30 to-amber-900/15 border border-amber-700/20 rounded-md p-4">
                 <h3 className="text-neutral-400 text-xs font-bold tracking-[.3em] mb-2 uppercase">THIS WEEK</h3>
                 <div className="text-2xl font-mono font-black italic text-amber-400 tracking-tighter text-glow-amber">
                   £{gameState.weeklyScore.toLocaleString()}
                 </div>
                 {gameState.weekPerfectDays > 0 && (
                   <div className="mt-1 text-xs text-amber-300/70">
                     {gameState.weekPerfectDays}/7 Perfect Days this week
                   </div>
                 )}
               </div>
             )}

             <div className="text-neutral-500 text-xs font-mono tracking-widest uppercase mb-2">
               Next attempt: <span className="text-amber-400">{nextResetCountdown}</span>
             </div>
             <button onClick={(e) => exitExpandedMode(e.nativeEvent)} className="px-10 py-4 w-full rounded-full bg-neutral-800 text-white font-black hover:bg-neutral-700 active:scale-95 transition-transform">Back to Home</button>
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
