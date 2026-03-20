import { test, expect } from "playwright/test";

test.describe("Wishlist", () => {
  test("clicking wishlist button on store card persists state across reload", async ({ page }) => {
    // Login first
    await page.goto("/login");
    const mockAuthUrl = "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token";
    await page.getByLabel("Paste URL or Cookies").fill(mockAuthUrl);
    await page.getByRole("button", { name: "Complete Login" }).click();

    // Wait for store page to load
    await expect(page).toHaveURL(/\/store/, { timeout: 10000 });
    await expect(page.getByText("Daily Store")).toBeVisible({ timeout: 15000 });

    // Find the first wishlist button on a store card
    const wishlistButton = page.getByRole("button", { name: /Add to wishlist|Remove from wishlist/i }).first();
    await expect(wishlistButton).toBeVisible({ timeout: 10000 });

    // Get the initial state
    const initialAriaLabel = await wishlistButton.getAttribute("aria-label");
    const isInitiallyWishlisted = initialAriaLabel?.includes("Remove");

    // Click the wishlist button
    await wishlistButton.click();

    // Wait for the UI to update - aria-label should change
    await expect(wishlistButton).toHaveAttribute(
      "aria-label",
      isInitiallyWishlisted ? "Add to wishlist" : "Remove from wishlist",
      { timeout: 5000 }
    );

    // Reload the page
    await page.reload();

    // Wait for store to re-load
    await expect(page.getByText("Daily Store")).toBeVisible({ timeout: 15000 });

    // Assert the wishlist state is the same as after the toggle (persisted)
    const wishlistButtonAfterReload = page.getByRole("button", { name: /Add to wishlist|Remove from wishlist/i }).first();
    const ariaLabelAfterReload = await wishlistButtonAfterReload.getAttribute("aria-label");
    const isWishlistedAfterReload = ariaLabelAfterReload?.includes("Remove");

    expect(isWishlistedAfterReload).toBe(!isInitiallyWishlisted);
  });
});
