import { test, expect } from "playwright/test";

test.describe("Store Page", () => {
  test("authenticated user visiting /store sees store cards with skin names rendered", async ({ page }) => {
    // First login with mock credentials
    await page.goto("/login");
    const mockAuthUrl = "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token";
    await page.getByLabel("Paste URL or Cookies").fill(mockAuthUrl);
    await page.getByRole("button", { name: "Complete Login" }).click();

    // Wait for redirect to store
    await expect(page).toHaveURL(/\/store/, { timeout: 10000 });

    // Wait for store content to load
    await expect(page.getByText("Daily Store")).toBeVisible({ timeout: 15000 });

    // Should see skin names rendered (from mock data)
    await expect(page.getByText("Prime Vandal")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Reaver Vandal")).toBeVisible({ timeout: 15000 });

    // Should see wallet balance visible (VP and RP amounts from mock wallet data)
    await expect(page.getByText("5,000")).toBeVisible({ timeout: 10000 });
  });
});
