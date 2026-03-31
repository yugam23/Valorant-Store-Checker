/**
 * Blur placeholder utilities for next/image components
 */

/**
 * Default blur placeholder: tiny 1x1 solid gray (#1a1a1a) base64 PNG
 * Used as fallback for all skin images and as the initial blur before
 * wallpaper-based blur is fetched asynchronously in EncyclopediaCard.
 */
export const DEFAULT_BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAADklEQVQI12NkYGD4DwABBAEAWjR/WQAAAABJRU5ErkJggg==";

/**
 * Module-level cache for wallpaper blur data URLs.
 * Prevents duplicate fetches when the same wallpaper is used by multiple cards.
 * Only populated client-side via fetchAndCacheBlurDataURL.
 */
const blurCache = new Map<string, string>();

/**
 * Get blurDataURL for next/image placeholder="blur" prop.
 * Returns DEFAULT_BLUR immediately (sync) — use fetchAndCacheBlurDataURL for async wallpaper blur.
 *
 * For EncyclopediaCard (1000+ items): call fetchAndCacheBlurDataURL in a useEffect
 * after mount to lazily replace DEFAULT_BLUR with the real wallpaper blur without
 * blocking the initial render or causing 1000+ concurrent network requests.
 *
 * @param wallpaper - The wallpaper URL from Valorant-API (unused in sync path)
 * @returns DEFAULT_BLUR (sync) or a real wallpaper blur (via fetchAndCacheBlurDataURL)
 */
export function getBlurDataURL(wallpaper: string | null): string {
  return DEFAULT_BLUR;
}

/**
 * Fetch a remote wallpaper image, resize to 8x8, and encode as a tiny JPEG base64 string.
 * This is the "real low-res source" for EncyclopediaCard blur placeholders.
 *
 * @param wallpaper - Remote HTTPS URL of the wallpaper image
 * @param signal - AbortSignal for request cancellation
 * @returns base64 data URL of tiny blurred wallpaper, or DEFAULT_BLUR on failure
 */
async function fetchWallpaperBlur(wallpaper: string, signal: AbortSignal): Promise<string> {
  try {
    const response = await fetch(wallpaper, { signal });
    if (!response.ok) return DEFAULT_BLUR;

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(8, 8);
    const ctx = canvas.getContext("2d");
    if (!ctx) return DEFAULT_BLUR;

    ctx.drawImage(bitmap, 0, 0, 8, 8);
    bitmap.close();

    // Convert to tiny JPEG base64 (8x8 at quality 0.3 = ~200 bytes)
    const resultBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.3 });
    const arrayBuffer = await resultBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = String.fromCharCode(...bytes);
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } catch {
    return DEFAULT_BLUR;
  }
}

/**
 * Async wallpaper blur fetcher with module-level caching.
 * Call this in a useEffect to lazily replace DEFAULT_BLUR with the real wallpaper blur.
 *
 * Flow: EncyclopediaCard mounts → useEffect calls this → wallpaper fetched, resized, base64'd →
 * cached + returned → component re-renders with real wallpaper blur → next/image shows blur
 *
 * Only one fetch per unique wallpaper URL (cached in module-level Map).
 * 1000+ EncyclopediaCards → only ~20-30 wallpapers fetched at a time (virtualized viewport).
 *
 * @param wallpaper - The wallpaper URL from Valorant-API
 * @returns base64 data URL string (cached after first fetch)
 */
export async function fetchAndCacheBlurDataURL(wallpaper: string | null): Promise<string> {
  if (!wallpaper) return DEFAULT_BLUR;
  if (blurCache.has(wallpaper)) return blurCache.get(wallpaper)!;

  const abortController = new AbortController();
  const result = await fetchWallpaperBlur(wallpaper, abortController.signal);
  blurCache.set(wallpaper, result);
  return result;
}
