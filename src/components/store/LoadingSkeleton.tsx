export function LoadingSkeleton({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-20 space-y-4" role="status" aria-label={text}>
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-valorant-red/20 angular-card-sm" />
        <div className="absolute inset-0 border-t-2 border-valorant-red animate-spin" style={{ borderRadius: "50%" }} />
      </div>
      <p className="text-zinc-400 font-display uppercase tracking-wider text-sm">{text}</p>
    </div>
  );
}
