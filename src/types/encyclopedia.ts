/**
 * Encyclopedia page types
 */

import type { WishlistItem } from "./wishlist";

/**
 * Content tier for encyclopedia display (mirrors ValorantContentTier)
 */
export interface EncyclopediaTier {
  uuid: string;
  displayName: string;
  highlightColor: string;
  displayIcon: string;
}

/**
 * Weapon skin enriched with computed weapon name and tier info
 */
export interface EncyclopediaSkin {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  wallpaper: string | null;
  weaponName: string;
  tierName: string;
  tierColor: string;
  contentTierUuid: string | null;
}

/**
 * Props passed from RSC page to EncyclopediaClient
 */
export interface EncyclopediaClientProps {
  skins: EncyclopediaSkin[];
  tiers: EncyclopediaTier[];
  tierMap: Map<string, EncyclopediaTier>;
}

/**
 * Props for EncyclopediaCard including wishlist state
 */
export interface EncyclopediaCardProps {
  skin: EncyclopediaSkin;
  isWishlisted: boolean;
  onWishlistToggle?: (skinUuid: string, skin: EncyclopediaSkin) => void;
}
