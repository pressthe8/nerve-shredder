import { useState } from 'react';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const faqItems = [
  {
    q: 'Is it the same for everyone?',
    a: "Every player gets the same 3 sequences each day — but they're dealt in a random order. You might get the wild one first while someone else gets it last.",
  },
  {
    q: 'Are all 3 runs the same?',
    a: "No — each run has its own personality. Some climb slowly and steadily, others are short and volatile, and some are long with big spikes. You won't know which is which until you're in it.",
  },
  {
    q: "What's a Perfect Day?",
    a: 'Bank successfully on all 3 runs (no busts) and you earn a Perfect Day. These unlock higher multipliers for the rest of the week.',
  },
  {
    q: 'How do multipliers work?',
    a: "Each Perfect Day this week raises your multiplier: 0 = 1.0x, 1 = 1.1x, 2 = 1.2x, 3 = 1.3x, 4 = 1.4x, 6 = 1.5x. The multiplier applies to each day's score.",
  },
  {
    q: 'When does the week reset?',
    a: 'Every Monday. New week, fresh leaderboard, multiplier resets to 1.0x.',
  },
];

export const HowToPlay = ({ isOpen, onClose }: HowToPlayProps) => {
  const [faqOpen, setFaqOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-neutral-900/95 backdrop-blur-md rounded-md max-w-md w-full max-h-[90vh] overflow-y-auto border border-neutral-700/50 font-mono">
        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-700/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">How to Play</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center text-neutral-400 text-sm mb-6 tracking-wider">
            Three runs. One chance per second. Bank it or lose everything.
          </div>

          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-md bg-emerald-950/50 border-2 border-emerald-700 flex items-center justify-center text-2xl">
                🎰
              </div>
              <div>
                <h3 className="text-white font-black text-sm mb-1 tracking-wider uppercase">The Run</h3>
                <p className="text-neutral-400 text-sm">
                  Each run shows you amounts one at a time, starting at £10. Every second, a new
                  amount appears — it usually climbs, but can dip or spike at any moment. You never
                  know how many steps you'll get.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-md bg-red-950/50 border-2 border-red-700 flex items-center justify-center text-2xl">
                💀
              </div>
              <div>
                <h3 className="text-white font-black text-sm mb-1 tracking-wider uppercase">Bank or Bust</h3>
                <p className="text-neutral-400 text-sm">
                  Hit the red BANK button to lock in whatever's on screen — that's your score for
                  the run. But if the sequence ends before you bank, you crash out with £0. The
                  longer you hold, the more you risk.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-md bg-cyan-950/50 border-2 border-cyan-700 flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <h3 className="text-white font-black text-sm mb-1 tracking-wider uppercase">3 Runs Per Day</h3>
                <p className="text-neutral-400 text-sm">
                  You get exactly 3 runs each day. Your daily score is the total of all 3. Bank all
                  3 successfully and you earn a Perfect Day — which powers up your weekly multiplier.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-md bg-orange-950/50 border-2 border-orange-700 flex items-center justify-center text-2xl">
                🔥
              </div>
              <div>
                <h3 className="text-white font-black text-sm mb-1 tracking-wider uppercase">Weekly Multipliers</h3>
                <p className="text-neutral-400 text-sm">
                  Perfect Days stack multipliers on your daily scores — start at 1.0x, build up to
                  1.5x. Your multiplied daily totals add up to your weekly score, and that's what
                  the leaderboard ranks.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-neutral-700/50">
            <button
              onClick={() => setFaqOpen(!faqOpen)}
              className="w-full flex items-center justify-between text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              <span className="text-xs font-bold tracking-[.3em] uppercase">Good to Know</span>
              <span className="text-sm">{faqOpen ? '▾' : '▸'}</span>
            </button>
            {faqOpen && (
              <div className="mt-4 space-y-3">
                {faqItems.map((item) => (
                  <div key={item.q}>
                    <h4 className="text-sm font-bold text-neutral-300">{item.q}</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
