
import {  chromium, Browser } from "playwright"; 

interface AuthTokens {
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
}

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
    
    // Riot Auth URL
    const authUrl = "https://auth.riotgames.com/authorize?redirect_uri=https://playvalorant.com/opt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid%20ban%20link%20lol_region%20lol%20summoner%20offline_access";

    await page.goto(authUrl);

    // Set a timeout to close the browser after 10 minutes
    setTimeout(async () => {
      try {
        await browser.close();
      } catch (e) {
        // Ignore if already closed
      }
    }, 600000); // 10 minutes

    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to launch browser: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function authenticateWithBrowser(
  username: string,
  pass: string
) {
  return { success: false, error: "Automated browser login is deprecated. Please use the 'Launch Riot Login' button." };
}

function extractTokensFromUri(uri: string): { accessToken: string; idToken: string } | null {
  try {
    const url = new URL(uri);
    // Handle both hash and search params if Riot changes things
    let params = new URLSearchParams(url.hash.substring(1));
    if (!params.get("access_token")) {
        params = new URLSearchParams(url.search);
    }
    
    let accessToken = params.get("access_token");
    let idToken = params.get("id_token");

    // Fallback to regex if URL parsing fails but tokens are present in string
    // (e.g. if hash/search logic is weird or URL structure is non-standard)
    if (!accessToken || !idToken) {
        console.log("[Browser Auth] URL parsing failed, trying regex fallback...");
        const accessMatch = uri.match(/access_token=([^&]+)/);
        const idMatch = uri.match(/id_token=([^&]+)/);
        
        if (accessMatch && accessMatch[1]) accessToken = accessMatch[1];
        if (idMatch && idMatch[1]) idToken = idMatch[1];
    }

    if (!accessToken || !idToken) {
        console.log("[Browser Auth] Failed to extract tokens. URL sample:", uri.substring(0, 50) + "...");
        return null; // Both required
    }
    
    return { accessToken, idToken };
  } catch (e) {
    console.log("[Browser Auth] Parse error:", e);
    return null;
  }
}

async function fetchEntitlements(accessToken: string): Promise<string | null> {
    try {
        const res = await fetch("https://entitlements.auth.riotgames.com/api/token/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({})
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.entitlements_token;
    } catch { return null; }
}

async function fetchUserInfo(accessToken: string): Promise<any | null> {
    try {
        const res = await fetch("https://auth.riotgames.com/userinfo", {
             headers: { "Authorization": `Bearer ${accessToken}` }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

function determineRegion(userInfo: any): string {
    if (userInfo.affinity) {
        const shard = userInfo.affinity.pp || userInfo.affinity.live || Object.values(userInfo.affinity)[0];
        if (shard) return shard;
    }
    return "na"; // Fallback
}
