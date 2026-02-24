interface RRProgressBarProps {
  rankingInTier?: number;
}

export function RRProgressBar({ rankingInTier }: RRProgressBarProps) {
  if (rankingInTier === undefined) {
    return null;
  }

  const clampedRR = Math.max(0, Math.min(100, rankingInTier));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs uppercase tracking-wider text-zinc-400">RR Progress</span>
        <span className="font-display text-sm text-zinc-300">{clampedRR} / 100</span>
      </div>
      <div
        className="w-full h-1.5 bg-void-surface angular-card-sm overflow-hidden"
      >
        <div
          className="h-full bg-valorant-red transition-all duration-500"
          style={{ width: `${clampedRR}%` }}
          role="progressbar"
          aria-valuenow={clampedRR}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${clampedRR} RR toward next rank`}
        />
      </div>
    </div>
  );
}
