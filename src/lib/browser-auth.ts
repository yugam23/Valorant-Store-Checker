import { chromium } from "playwright";
import { getRiotLoginUrl } from "./riot-auth";

const BROWSER_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-first-run",
  "--disable-notifications",
  "--disable-infobars",
];

export async function launchBasicBrowser(): Promise<{ success: boolean; error?: string }> {
  try {
    const browser = await chromium.launch({
      headless: false,
      args: [
        ...BROWSER_ARGS,
        "--window-size=1280,720",
        "--app=https://auth.riotgames.com",
      ],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    await page.goto(getRiotLoginUrl());

    // Close the browser after 10 minutes
    setTimeout(async () => {
      try {
        await browser.close();
      } catch {
        // Ignore if already closed
      }
    }, 600000);

    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to launch browser: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function authenticateWithBrowser(
  username: string,
  pass: string
) {
  return { success: false as const, error: "Automated browser login is deprecated. Please use the 'Launch Riot Login' button." };
}
