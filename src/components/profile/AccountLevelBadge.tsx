interface AccountLevelBadgeProps {
  accountLevel?: number;
  henrikAccountLevel?: number;
  hideAccountLevel?: boolean;
}

export function AccountLevelBadge({
  accountLevel,
  henrikAccountLevel,
  hideAccountLevel,
}: AccountLevelBadgeProps) {
  const level = accountLevel ?? henrikAccountLevel;

  if (level === undefined) {
    return (
      <div className="angular-card-sm bg-void-surface/30 p-4">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Account Level</span>
        <p className="font-display text-sm text-zinc-600 mt-1">Unavailable</p>
      </div>
    );
  }

  return (
    <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400">Account Level</span>
        {hideAccountLevel && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 border border-zinc-700 px-1">
            Hidden
          </span>
        )}
      </div>
      <p className="font-display text-2xl text-light">{level}</p>
    </div>
  );
}
