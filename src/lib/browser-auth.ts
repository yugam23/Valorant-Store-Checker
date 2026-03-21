import { spawn } from "child_process";
import { createLogger } from "@/lib/logger";

const log = createLogger("BrowserAuth");

const RIOT_LOGIN_URL =
  "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

export async function launchBasicBrowser(): Promise<{ success: boolean; error?: string }> {
  try {
    // Open the Riot login page in the user's default system browser.
    // This avoids bot detection that blocks Playwright/Puppeteer.
    const { platform } = process;
    let program: string;
    let args: string[];

    if (platform === "win32") {
      // Windows: use cmd.exe /c start to open default browser
      program = "cmd.exe";
      args = ["/c", "start", "", RIOT_LOGIN_URL];
    } else if (platform === "darwin") {
      // macOS: use open command
      program = "open";
      args = [RIOT_LOGIN_URL];
    } else {
      // Linux: use xdg-open
      program = "xdg-open";
      args = [RIOT_LOGIN_URL];
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(program, args);
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Exited with code ${code}`));
      });
    });

    log.info("Opened Riot login in default browser");
    return { success: true };
  } catch (e) {
    log.error("Failed to open browser:", e);
    return { success: false, error: `Failed to launch browser: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function authenticateWithBrowser(
  _username: string,
  _pass: string
) {
  return { success: false as const, error: "Automated browser login is deprecated. Please use the 'Launch Riot Login' button." };
}
