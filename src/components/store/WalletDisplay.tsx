import Image from "next/image";
import { WalletBalance } from "@/types/store";

interface WalletDisplayProps {
  wallet: WalletBalance;
  className?: string;
}

export function WalletDisplay({ wallet, className = "" }: WalletDisplayProps) {
  return (
    <div
      className={`flex gap-6 angular-card-sm bg-void-surface/80 backdrop-blur-sm px-6 py-4 border border-white/5 shadow-lg ${className}`}
    >
      {/* Valorant Points */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 angular-card-sm bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center border border-yellow-500/30">
          <Image src="/icons/Valorant_Points.webp" alt="VP" width={24} height={24} />
        </div>
        <div>
          <p className="text-xs text-zinc-500 font-display uppercase tracking-wider">
            VP
          </p>
          <p className="text-lg font-bold text-white font-mono tracking-wider">
            {wallet.vp.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Radianite Points */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 angular-card-sm bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center border border-green-500/30">
          <Image src="/icons/Radianite_Points.webp" alt="RP" width={24} height={24} />
        </div>
        <div>
          <p className="text-xs text-zinc-500 font-display uppercase tracking-wider">
            RP
          </p>
          <p className="text-lg font-bold text-white font-mono tracking-wider">
            {wallet.rp.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Kingdom Credits (optional) */}
      {wallet.kc !== undefined && wallet.kc > 0 && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 angular-card-sm bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <Image src="/icons/Kingdom_Credits.webp" alt="KC" width={24} height={24} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-display uppercase tracking-wider">
              KC
            </p>
            <p className="text-lg font-bold text-white font-mono tracking-wider">
              {wallet.kc.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
