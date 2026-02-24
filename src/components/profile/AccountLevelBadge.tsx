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
  if (hideAccountLevel === true) {
    return (
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <span className="text-xs uppercase tracking-wider text-zinc-400">Account Level</span>
        <p className="font-display text-2xl text-light">Hidden</p>
      </div>
    );
  }

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
      <span className="text-xs uppercase tracking-wider text-zinc-400">Account Level</span>
      <p className="font-display text-2xl text-light">{level}</p>
    </div>
  );
}
