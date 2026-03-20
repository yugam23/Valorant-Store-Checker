import { test, expect } from "playwright/test";

test.describe("Authentication Flow", () => {
  test("submitting mock credentials on login page redirects to store page", async ({ page }) => {
    await page.goto("/login");

    // Fill in mock auth URL
    const mockAuthUrl = "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token";
    await page.getByLabel("Paste URL or Cookies").fill(mockAuthUrl);

    // Submit form
    await page.getByRole("button", { name: "Complete Login" }).click();

    // Should redirect to store page
    await expect(page).toHaveURL(/\/store/, { timeout: 10000 });

    // Should see store content
    await expect(page.getByText("Your Store")).toBeVisible({ timeout: 10000 });
  });
});
