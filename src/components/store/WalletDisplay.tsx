/**
 * WalletDisplay Component
 *
 * Displays the player's currency balances (VP, RP, KC).
 * Uses glassmorphism styling per "Void & Light" design system.
 */

import { WalletBalance } from "@/types/store";

interface WalletDisplayProps {
  wallet: WalletBalance;
  className?: string;
}

export function WalletDisplay({ wallet, className = "" }: WalletDisplayProps) {
  return (
    <div
      className={`flex gap-6 bg-zinc-900/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-zinc-800/50 shadow-lg ${className}`}
    >
      {/* Valorant Points */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl flex items-center justify-center border border-yellow-500/30">
          <span className="text-xl">💎</span>
        </div>
        <div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
            VP
          </p>
          <p className="text-lg font-bold text-white tabular-nums">
            {wallet.vp.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Radianite Points */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl flex items-center justify-center border border-green-500/30">
          <span className="text-xl">⚡</span>
        </div>
        <div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
            RP
          </p>
          <p className="text-lg font-bold text-white tabular-nums">
            {wallet.rp.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Kingdom Credits (optional) */}
      {wallet.kc !== undefined && wallet.kc > 0 && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <span className="text-xl">🪙</span>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
              KC
            </p>
            <p className="text-lg font-bold text-white tabular-nums">
              {wallet.kc.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
