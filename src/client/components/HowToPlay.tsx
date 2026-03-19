interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlay = ({ isOpen, onClose }: HowToPlayProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">How to Play</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center text-neutral-300 text-sm mb-6">
            Watch the money tick up (and sometimes down!). Your goal is to cash out before you bust.
          </div>

          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-950/50 border-2 border-emerald-700 flex items-center justify-center text-2xl">
                💰
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">3 Attempts Daily</h3>
                <p className="text-neutral-400 text-sm">
                  You get three chances each day to maximize your score
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-950/50 border-2 border-yellow-700 flex items-center justify-center text-2xl">
                ⚡
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Random Changes</h3>
                <p className="text-neutral-400 text-sm">
                  Money can jump up, down, or make big leaps
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-950/50 border-2 border-red-700 flex items-center justify-center text-2xl">
                🎯
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Hidden Bust Point</h3>
                <p className="text-neutral-400 text-sm">
                  You won't know when you'll bust until it's too late
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-950/50 border-2 border-orange-700 flex items-center justify-center text-2xl">
                🏆
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Compete Weekly</h3>
                <p className="text-neutral-400 text-sm">
                  Track your progress and compete on the leaderboard
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-800 text-center text-neutral-500 text-xs">
            Made with ❤️ for risk-takers everywhere
          </div>
        </div>
      </div>
    </div>
  );
};
