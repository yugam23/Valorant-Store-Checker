/**
 * Blur placeholder utilities for next/image components
 */

/**
 * Default blur placeholder: tiny 1x1 solid gray (#1a1a1a) base64 PNG
 * Used as fallback for all skin images since fetching individual wallpaper
 * data URLs at hydration time would require 1000+ network requests.
 */
export const DEFAULT_BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAADklEQVQI12NkYGD4DwABBAEAWjR/WQAAAABJRU5ErkJggg==";

/**
 * Get blurDataURL for next/image placeholder="blur" prop.
 *
 * Currently returns DEFAULT_BLUR for all cases. This is the pragmatic v1 approach
 * since Valorant-API wallpaper is a remote HTTPS URL that cannot be used directly
 * as a blurDataURL without fetching and converting each image.
 *
 * For daily store (4-6 items) and inventory (user's owned skins), individual
 * wallpaper fetching could be added in a future enhancement.
 *
 * @param wallpaper - The wallpaper URL from Valorant-API (currently unused)
 * @returns A base64 data URL for use as next/image blurDataURL
 */
export function getBlurDataURL(wallpaper: string | null): string {
  // Always return DEFAULT_BLUR since wallpaper is a remote HTTPS URL,
  // not a base64 data URL that next/image expects
  return DEFAULT_BLUR;
}
