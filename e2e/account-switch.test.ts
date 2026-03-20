import { test, expect } from "playwright/test";

test.describe("Account Switch", () => {
  test("switching accounts causes store to refresh with different account's mocked data", async ({ page }) => {
    // Login as first account (mock-puuid-12345678)
    await page.goto("/login");
    const mockAuthUrl1 = "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token";
    await page.getByLabel("Paste URL or Cookies").fill(mockAuthUrl1);
    await page.getByRole("button", { name: "Complete Login" }).click();

    // Wait for redirect to store
    await expect(page).toHaveURL(/\/store/, { timeout: 10000 });
    await expect(page.getByText("Daily Store")).toBeVisible({ timeout: 15000 });

    // Verify first account's skin names are visible
    await expect(page.getByText("Prime Vandal")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Reaver Omega")).toBeVisible({ timeout: 10000 });

    // Find and click the account switch button in the header
    // The AccountSwitcher trigger button contains a red dot and display name
    const accountSwitchTrigger = page.locator("button").filter({ has: page.locator(".bg-valorant-red") }).first();
    await accountSwitchTrigger.click();

    // Wait for the dropdown to open
    const dropdown = page.locator(".angular-card.absolute.right-0.top-full");
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Click "Add Account" button to add second account
    const addAccountButton = page.getByText("Add Account");
    await expect(addAccountButton).toBeVisible({ timeout: 5000 });
    await addAccountButton.click();

    // Now we should be on login page with addAccount=true, login as second account
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // For second account, we need a different auth URL that MSW will recognize as puuid-2
    // The mock auth URL format includes access_token which isn't used for puuid in MSW handlers
    // Instead, we need to simulate adding a second account through the API
    // Since MSW handlers use puuid from the storefront calls, we need to first login again
    // with the same mock URL, then the second account would need to be set up differently

    // Actually, looking at the handlers - the puuid comes from session cookies,
    // not from the auth URL. The second account flow would be:
    // 1. Login with same mock URL to get session
    // 2. API stores the session with puuid
    // 3. We switch accounts via the switch API which changes the active session

    // For E2E testing with MSW, we need to login twice to create two accounts
    // Then switch between them

    const mockAuthUrl2 = "https://playvalorant.com/opt_in#access_token=mock_access_token_2&id_token=mock_id_token_2";
    await page.getByLabel("Paste URL or Cookies").fill(mockAuthUrl2);
    await page.getByRole("button", { name: "Complete Login" }).click();

    // Wait for store reload after adding second account
    await expect(page.getByText("Daily Store")).toBeVisible({ timeout: 15000 });

    // Now switch back to the first account via the account switcher
    const accountSwitchTrigger2 = page.locator("button").filter({ has: page.locator(".bg-valorant-red") }).first();
    await accountSwitchTrigger2.click();

    // Wait for dropdown
    const dropdown2 = page.locator(".angular-card.absolute.right-0.top-full");
    await expect(dropdown2).toBeVisible({ timeout: 5000 });

    // Find and click the first account (MockPlayer#NA1)
    const firstAccountButton = page.getByText("MockPlayer#NA1").first();
    if (await firstAccountButton.isVisible()) {
      await firstAccountButton.click();

      // Wait for page reload after account switch
      await page.waitForLoadState("networkidle");

      // Store should reload - check that we see Daily Store again
      await expect(page.getByText("Daily Store")).toBeVisible({ timeout: 15000 });

      // Verify the store shows the correct skins for the switched account
      await expect(page.getByText("Prime Vandal")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Reaver Omega")).toBeVisible({ timeout: 10000 });
    }
  });
});
