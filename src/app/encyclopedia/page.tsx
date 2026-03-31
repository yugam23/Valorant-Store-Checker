/**
 * Encyclopedia page
 *
 * Fetches all Valorant weapon skins and content tiers from Valorant-API,
 * enriches each skin with computed weapon name and tier info, then passes
 * to EncyclopediaClient for client-side filtering.
 */

import dynamic from 'next/dynamic';
import { getWeaponSkins, getContentTiers } from "@/lib/valorant-api";
import { extractWeaponName } from "@/lib/encyclopedia";
import { LoadingSkeleton } from '@/components/store/LoadingSkeleton';
import type { EncyclopediaClientProps, EncyclopediaSkin, EncyclopediaTier } from "@/types/encyclopedia";
import { TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";

const EncyclopediaClient = dynamic(
  () => import('@/components/encyclopedia/EncyclopediaClient').then(m => m.EncyclopediaClient),
  {
    loading: () => <LoadingSkeleton text="Loading Encyclopedia..." />,
  }
);

export default async function EncyclopediaPage() {
  const [skins, tiers] = await Promise.all([
    getWeaponSkins(),
    getContentTiers(),
  ]);

  // Build tier lookup map by UUID
  const tierMap = new Map<string, EncyclopediaTier>(
    tiers.map((t) => [
      t.uuid,
      {
        uuid: t.uuid,
        displayName: t.displayName,
        highlightColor: `#${t.highlightColor.slice(0, 6)}`,
        displayIcon: t.displayIcon,
      },
    ])
  );

  // Enrich each skin with computed weapon name and tier info
  const skinsWithWeaponAndTier: EncyclopediaSkin[] = skins.map((skin) => {
    const weaponName = extractWeaponName(skin.displayName);
    const tier = skin.contentTierUuid ? tierMap.get(skin.contentTierUuid) : null;
    const tierColor = tier
      ? TIER_COLORS[tier.displayName.replace(" Edition", "")] ?? tier.highlightColor
      : DEFAULT_TIER_COLOR;

    return {
      uuid: skin.uuid,
      displayName: skin.displayName,
      displayIcon: skin.displayIcon,
      wallpaper: skin.wallpaper,
      weaponName,
      tierName: tier?.displayName ?? "Unknown",
      tierColor,
      contentTierUuid: skin.contentTierUuid,
    };
  });

  // Sort alphabetically by weapon, then skin name
  skinsWithWeaponAndTier.sort((a, b) => {
    if (a.weaponName !== b.weaponName) {
      return a.weaponName.localeCompare(b.weaponName);
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const props: EncyclopediaClientProps = {
    skins: skinsWithWeaponAndTier,
    tiers: Array.from(tierMap.values()),
    tierMap,
  };

  return <EncyclopediaClient {...props} />;
}
