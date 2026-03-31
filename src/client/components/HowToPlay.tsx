import { useState } from 'react';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const faqItems = [
  {
    q: 'Is it the same for everyone?',
    a: "Yes, the same 3 sequences daily, but in a random order per player.",
  },
  {
    q: 'Are the 3 runs completely random?',
    a: "Not quite. Each has its own personality. A mix of steady, volatile, or long but spiky.",
  },
  {
    q: "What's a Perfect Day?",
    a: 'Bank all 3 runs without busting. Unlocks a higher weekly multiplier.',
  },
  {
    q: 'How do multipliers work?',
    a: "Perfect Days raise your multiplier: 0=1.0x, 1=1.1x, 2=1.2x, 3=1.3x, 4=1.4x, 6+=1.5x.",
  },
  {
    q: 'When does the week reset?',
    a: 'Every Monday at midnight UTC.',
  },
];

export const HowToPlay = ({ isOpen, onClose }: HowToPlayProps) => {
  const [page, setPage] = useState<'game' | 'faq'>('game');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-neutral-900/95 backdrop-blur-md rounded-md max-w-md w-full border border-neutral-700/50 font-mono">
        <div className="bg-neutral-900/95 backdrop-blur-md border-b border-neutral-700/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black italic tracking-tighter text-white uppercase">How to Play</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setPage('game')}
                className={`text-xs font-bold px-2 py-0.5 rounded transition-colors ${page === 'game' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >Game</button>
              <button
                onClick={() => setPage('faq')}
                className={`text-xs font-bold px-2 py-0.5 rounded transition-colors ${page === 'faq' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >FAQ</button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          {page === 'game' ? (
            <div className="space-y-2">
              {[
                { icon: '🎰', bg: 'bg-emerald-950/50 border-emerald-700', title: 'The Run', text: "Amounts appear one per second starting at £10 — climbing, dipping, or spiking. You never know how many steps you'll get." },
                { icon: '💀', bg: 'bg-red-950/50 border-red-700', title: 'Bank or Bust', text: "Hit BANK to lock in the current amount. If the sequence ends before you bank, you score £0." },
                { icon: '📊', bg: 'bg-cyan-950/50 border-cyan-700', title: '3 Runs Per Day', text: "Your daily score is the total of 3 runs. Bank all 3 with no busts to earn a Perfect Day." },
                { icon: '🔥', bg: 'bg-orange-950/50 border-orange-700', title: 'Multipliers', text: "Perfect Days boost your multiplier (1.0x → 1.5x), applied to each day's score on the weekly leaderboard." },
              ].map((item) => (
                <div key={item.title} className="flex gap-2.5 items-start">
                  <div className={`flex-shrink-0 w-8 h-8 rounded ${item.bg} border flex items-center justify-center text-base`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-black text-xs tracking-wider uppercase leading-none mb-0.5">{item.title}</h3>
                    <p className="text-neutral-400 text-xs leading-snug">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {faqItems.map((item) => (
                <div key={item.q}>
                  <h4 className="text-xs font-bold text-neutral-300">{item.q}</h4>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{item.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
