import Image from "next/image";

interface PlayerCardBannerProps {
  wideArt: string;
  displayName: string;
}

export function PlayerCardBanner({ wideArt, displayName }: PlayerCardBannerProps) {
  return (
    <div className="angular-card relative w-[452px] h-[128px] overflow-hidden">
      <Image
        src={wideArt}
        alt={`${displayName} player card`}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 896px) 100vw, 896px"
      />
      {/* Gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-void-deep via-void-deep/40 to-transparent" />
    </div>
  );
}
