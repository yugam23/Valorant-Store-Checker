const EDITION_ICON_MAP: Record<string, string> = {
  "Select Edition": "/icons/edition icons/Select-edition-icon.webp",
  "Deluxe Edition": "/icons/edition icons/Deluxe-edition-icon.webp",
  "Premium Edition": "/icons/edition icons/Premium-edition-icon.webp",
  "Exclusive Edition": "/icons/edition icons/Exclusive-edition-icon.webp",
  "Ultra Edition": "/icons/edition icons/Ultra-edition-icon.webp",
};

export function getEditionIconPath(tierName: string | null): string | null {
  if (!tierName) return null;
  return EDITION_ICON_MAP[tierName] ?? null;
}
