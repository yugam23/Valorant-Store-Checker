const REGION_LABELS: Record<string, string> = {
  na: "NA",
  eu: "EU",
  ap: "AP",
  kr: "KR",
};

function countryCodeToFlag(code: string): string {
  const twoLetter = code.slice(0, 2).toUpperCase();
  const base = 0x1f1e6 - 65;
  return [...twoLetter]
    .map((char) => String.fromCodePoint(base + char.charCodeAt(0)))
    .join("");
}

interface IdentityInfoProps {
  gameName?: string;
  tagLine?: string;
  titleText?: string;
  country?: string;
  region?: string;
}

export function IdentityInfo({
  gameName,
  tagLine,
  titleText,
  country,
  region,
}: IdentityInfoProps) {
  return (
    <div className="space-y-1">
      {/* Name row: flag + name#tag + region badge */}
      <div className="flex items-center gap-3 flex-wrap">
        {country && (
          <span className="text-2xl leading-none" aria-label={`Country: ${country}`}>
            {countryCodeToFlag(country)}
          </span>
        )}

        <h2 className="font-display text-3xl text-white leading-none">
          {gameName ?? "Unknown"}
          {tagLine && (
            <span className="text-zinc-500"> #{tagLine}</span>
          )}
        </h2>

        {region && (
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-void-surface border border-white/10 text-zinc-300">
            {REGION_LABELS[region.toLowerCase()] ?? region.toUpperCase()}
          </span>
        )}
      </div>

      {/* Player title */}
      {titleText && (
        <p className="text-sm uppercase tracking-wider text-zinc-400">{titleText}</p>
      )}
    </div>
  );
}
