import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './index.css';
import { navigateTo } from '@devvit/web/client';
import { StrictMode, useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { TRPCProvider } from './lib/TRPCProvider.js';
import { trpc } from './lib/trpc.js';
const GameContent = () => {
    const { data: gameState, refetch } = trpc.game.getGameState.useQuery();
    const startRun = trpc.game.startRun.useMutation();
    const bankRun = trpc.game.bankRun.useMutation();
    const [phase, setPhase] = useState('IDLE');
    const [amount, setAmount] = useState(0);
    const [activeRunIndex, setActiveRunIndex] = useState(null);
    const reqRef = useRef(0);
    const startTimeRef = useRef(0);
    const startNextRun = async () => {
        if (!gameState)
            return;
        const nextRun = gameState.runOrder.find((runIndex) => !gameState.runsCompleted[runIndex]);
        if (nextRun === undefined) {
            setPhase('FINISHED');
            return;
        }
        setActiveRunIndex(nextRun);
        setAmount(0);
        setPhase('IDLE');
    };
    const executeRun = async () => {
        if (activeRunIndex === null)
            return;
        try {
            await startRun.mutateAsync({ runIndex: activeRunIndex });
            setPhase('RUNNING');
            startTimeRef.current = performance.now();
            const loop = (time) => {
                const elapsed = time - startTimeRef.current;
                const val = Math.floor(10 * Math.pow(1.0003, elapsed));
                setAmount(val);
                reqRef.current = requestAnimationFrame(loop);
            };
            reqRef.current = requestAnimationFrame(loop);
        }
        catch (e) {
            console.error(e);
        }
    };
    const handleBank = async () => {
        if (phase !== 'RUNNING' || activeRunIndex === null)
            return;
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
            }
            else {
                setPhase('BANKED');
                setAmount(res.finalScore);
            }
            refetch();
        }
        catch (e) {
            console.error(e);
            setPhase('BUSTED');
        }
    };
    useEffect(() => {
        if (gameState && phase === 'IDLE' && activeRunIndex === null) {
            startNextRun();
        }
    }, [gameState, phase, activeRunIndex]);
    return (_jsxs("div", { className: `flex flex-col items-center justify-center min-h-screen p-4 transition-colors duration-100 ${phase === 'BUSTED' ? 'bg-red-950/90' : 'bg-neutral-950 text-white'}`, children: [gameState && (_jsx("div", { className: "absolute top-6 flex gap-2", children: [0, 1, 2].map(i => {
                    const isCompleted = gameState.runsCompleted[gameState.runOrder[i]];
                    const isCurrent = gameState.runOrder[i] === activeRunIndex;
                    return (_jsx("div", { className: `w-3 h-3 rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : isCurrent && phase === 'RUNNING' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-800'}` }, i));
                }) })), _jsxs("div", { className: "flex-1 flex flex-col items-center justify-center w-full max-w-sm", children: [phase === 'IDLE' && (_jsxs("div", { className: "text-center animate-in fade-in zoom-in duration-300", children: [_jsxs("h2", { className: "text-3xl font-bold mb-12 text-neutral-300", children: ["Ready for Run ", gameState ? gameState.runOrder.indexOf(activeRunIndex) + 1 : 1, "?"] }), _jsx("button", { onClick: executeRun, disabled: startRun.isPending, className: "w-48 h-48 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-4xl shadow-[0_0_40px_rgba(37,99,235,0.6)] transition-transform active:scale-90", children: "START" })] })), phase === 'RUNNING' && (_jsxs("div", { className: "flex flex-col flex-1 w-full justify-between py-12", children: [_jsxs("div", { className: "text-center flex-1 flex flex-col justify-center animate-in slide-in-from-bottom-8", children: [_jsx("div", { className: "text-neutral-500 font-bold tracking-widest text-sm mb-4", children: "POTENTIAL WINNINGS" }), _jsxs("div", { className: "text-7xl md:text-8xl py-4 font-mono font-bold text-emerald-400 tracking-tighter shadow-emerald-500/20 drop-shadow-2xl", children: ["\u00A3", amount.toLocaleString()] })] }), _jsx("button", { onClick: handleBank, disabled: bankRun.isPending, className: "w-full py-8 rounded-[2rem] bg-red-600 hover:bg-red-500 text-white font-black text-4xl tracking-widest shadow-[0_0_50px_rgba(220,38,38,0.5)] active:scale-95 transition-transform flex items-center justify-center", children: "BANK" })] })), phase === 'BANKED' && (_jsxs("div", { className: "text-center animate-in zoom-in duration-300", children: [_jsx("h2", { className: "text-5xl font-black text-emerald-500 mb-4 tracking-tight drop-shadow-xl", children: "BANKED!" }), _jsxs("div", { className: "text-4xl font-mono text-white mb-12", children: ["+\u00A3", amount.toLocaleString()] }), _jsx("button", { onClick: startNextRun, className: "px-10 py-4 w-full rounded-full bg-white text-black font-black hover:bg-neutral-200 active:scale-95 transition-transform", children: "Continue to Next Run" })] })), phase === 'BUSTED' && (_jsxs("div", { className: "text-center animate-in zoom-in duration-100", children: [_jsx("h2", { className: "text-6xl font-black text-red-500 mb-4 tracking-tighter", children: "CRASH!" }), _jsx("div", { className: "text-lg text-red-300/80 mb-12 font-medium", children: "You waited too long and lost it all." }), _jsx("button", { onClick: startNextRun, className: "px-10 py-4 w-full rounded-full bg-white/10 border border-white/20 text-white font-black hover:bg-white/20 active:scale-95 transition-transform", children: "Continue" })] })), phase === 'FINISHED' && (_jsxs("div", { className: "text-center animate-in fade-in duration-500", children: [_jsx("h2", { className: "text-2xl font-bold text-neutral-400 mb-6", children: "Daily Runs Complete" }), _jsxs("div", { className: "text-6xl font-mono font-bold text-emerald-400 mb-12 shadow-emerald-500/20 drop-shadow-2xl", children: ["\u00A3", gameState?.totalScore.toLocaleString()] }), _jsx("button", { onClick: () => navigateTo('https://www.reddit.com/'), className: "px-10 py-4 w-full rounded-full bg-neutral-800 text-white font-black hover:bg-neutral-700 active:scale-95 transition-transform", children: "Close Game" })] }))] })] }));
};
export const App = () => (_jsx(TRPCProvider, { children: _jsx(GameContent, {}) }));
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
//# sourceMappingURL=game.js.map