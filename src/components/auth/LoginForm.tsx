"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Info } from "lucide-react";

interface AuthResponse {
  success: boolean;
  error?: string;
  data?: {
    puuid: string;
    region: string;
  };
}

export function LoginForm() {
  const router = useRouter();

  // State
  const [pastedValue, setPastedValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Determine if input is a URL (Browser Auth) or Cookie string (Session Auth)
      const isUrl = pastedValue.trim().startsWith("http");
      
      const payload = isUrl 
        ? { type: "url", url: pastedValue }
        : { type: "cookie", cookie: pastedValue };

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Ensure cookies are received and saved
        body: JSON.stringify(payload),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        // Force a hard navigation to ensure session state is picked up
        window.location.href = "/store";
      } else {
        setError(data.error || "Authentication failed. Please check your input.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchBrowser = () => {
    const RIOT_LOGIN_URL =
      "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";
    window.open(RIOT_LOGIN_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="w-full max-w-md">
      {/* Login Card */}
      <div className="angular-card bg-void-surface/80 backdrop-blur-sm border border-white/5 p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl uppercase font-bold text-light mb-2">
            Sign In
          </h1>
          <p className="text-zinc-400 text-sm">
            Access your Valorant Store
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 border-l-2 border-red-500 bg-red-500/10 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            {/* Steps */}
            <div className="p-4 bg-void-deep border-l-2 border-valorant-red/30 text-sm text-zinc-300 rounded-sm">
              <p className="mb-3">
                1. Click{" "}
                <button
                  type="button"
                  onClick={handleLaunchBrowser}
                  className="text-valorant-red hover:text-valorant-red/80 hover:underline font-bold transition-colors"
                >
                  Launch Riot Login
                </button>{" "}
                (Opens browser window).
              </p>
              <p className="mb-3">2. Log in with your Riot account.</p>
              <p>
                3. <strong>Copy the entire URL</strong> from the address bar (starts with https://playvalorant.com/opt_in...) <strong>OR</strong> paste your full cookie string (must include <code>ssid</code>, <code>tdid</code>, <code>clid</code>, <code>csid</code>).
              </p>
            </div>

            {/* Input Field */}
            <div>
              <label htmlFor="pastedValue" className="block text-sm font-display uppercase tracking-wider text-zinc-300 mb-2">
                Paste URL or Cookies
              </label>
              <input
                id="pastedValue"
                type="text"
                value={pastedValue}
                onChange={(e) => setPastedValue(e.target.value)}
                placeholder="https://playvalorant.com... OR ssid=...; tdid=..."
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-void-deep border-l-2 border-transparent text-light placeholder-zinc-500 focus:outline-none focus:border-valorant-red disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono text-sm"
              />
            </div>
            <div className="pt-4 border-t border-white/5">
              <details className="group text-sm text-zinc-400">
                <summary className="cursor-pointer font-medium hover:text-valorant-red transition-colors list-none flex items-center gap-2">
                  <span className="text-xs">▶</span> How to get your full cookie string?
                </summary>
                <div className="mt-3 pl-4 space-y-2 text-zinc-500 border-l border-white/10">
                  <p>1. In the opened Riot Login window, press <strong>F12</strong> to open Developer Tools.</p>
                  <p>2. Go to the <strong>Application</strong> tab (you may need to click &apos;&gt;&apos; to find it).</p>
                  <p>3. In the left sidebar, expand <strong>Cookies</strong> and select <code>https://auth.riotgames.com</code>.</p>
                  <p>4. You will see a list of cookies. You can either:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Type <code>document.cookie</code> in the <strong>Console</strong> tab and copy the result (Easiest).</li>
                    <li>Or manually copy <code>ssid</code>, <code>tdid</code>, <code>clid</code>, <code>csid</code> values.</li>
                  </ul>
                  <p className="mt-2 text-xs italic text-zinc-600">
                    Note: The easiest way is to just copy the **URL** from the address bar after logging in, but cookies last longer.
                  </p>
                </div>
              </details>
            </div>
          </div>

          <Button
            type="submit"
            variant="valorant"
            size="lg"
            disabled={isLoading || !pastedValue}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Complete Login"
            )}
          </Button>
        </form>

        {/* Cookie Info */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <details className="group">
            <summary className="flex items-center justify-center gap-2 py-2 text-xs text-zinc-500 hover:text-zinc-300 font-display uppercase tracking-widest cursor-pointer list-none transition-colors">
              <Info className="w-3 h-3" /> 
              <span>Why paste cookies?</span>
            </summary>
            <div className="mt-2 text-xs text-zinc-400 leading-relaxed px-2 text-center animate-in fade-in slide-in-from-top-1">
              Pasting your <strong>ssid</strong>, <strong>tdid</strong>, or other Riot cookies allows you to stay logged in for longer (up to 30 days) without needing to re-authenticate daily. You can find these in your browser&apos;s developer tools (Application &gt; Cookies) after logging in on the Riot website.
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
