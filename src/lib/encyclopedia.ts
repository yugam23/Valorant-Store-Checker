/**
 * Encyclopedia utility: weapon name extraction
 *
 * Pure standalone function — no server-only dependencies.
 * Mirrors the logic from riot-inventory.ts extractWeaponName.
 */

const KNOWN_WEAPONS = [
  "Vandal", "Phantom", "Operator", "Sheriff", "Ghost", "Frenzy",
  "Classic", "Shorty", "Marshal", "Guardian", "Bulldog", "Spectre",
  "Stinger", "Bucky", "Judge", "Ares", "Odin", "Knife", "Dagger",
  "Karambit", "Sword", "Axe", "Claws", "Butterfly", "Blade", "Scythe"
] as const;

/**
 * Extracts weapon name from skin display name.
 * E.g., "Prime Vandal" -> "Vandal", "Glitchpop Phantom" -> "Phantom"
 */
export function extractWeaponName(displayName: string): string {
  // Edge case: melee weapons
  if (displayName.toLowerCase().includes("melee")) {
    return "Melee";
  }

  const words = displayName.trim().split(/\s+/);

  // Single word — treat as weapon name itself
  if (words.length === 1) {
    return displayName;
  }

  const weaponName = words[words.length - 1] ?? displayName;

  // Validate against known weapons
  if (KNOWN_WEAPONS.some(w => w.toLowerCase() === weaponName.toLowerCase())) {
    return weaponName;
  }

  return weaponName;
}
