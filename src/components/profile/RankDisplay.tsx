import Image from "next/image";

interface RankDisplayProps {
  competitiveTierName?: string;
  competitiveTierIcon?: string;
  peakTierName?: string;
}

export function RankDisplay({
  competitiveTierName,
  competitiveTierIcon,
  peakTierName,
}: RankDisplayProps) {
  if (competitiveTierName === undefined) {
    return (
      <div className="angular-card-sm bg-void-surface/30 p-4 text-center">
        <p className="text-zinc-500 text-xs uppercase tracking-wider font-display">Rank unavailable</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Current Rank card */}
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <span className="text-xs uppercase tracking-wider text-zinc-400">Current Rank</span>
        <div className="flex items-center gap-3">
          {competitiveTierIcon && (
            <Image src={competitiveTierIcon} alt={competitiveTierName} width={40} height={40} className="object-contain" />
          )}
          <p className="font-display text-xl text-light">{competitiveTierName}</p>
        </div>
      </div>

      {/* Peak Rank card — text only, no img (highest_rank.images unreliable in v2) */}
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <span className="text-xs uppercase tracking-wider text-zinc-400">Peak Rank</span>
        <p className="font-display text-xl text-light">
          {peakTierName ?? <span className="text-zinc-600 text-sm">Unknown</span>}
        </p>
      </div>
    </div>
  );
}
