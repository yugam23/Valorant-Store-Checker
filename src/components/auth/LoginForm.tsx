"use client";

import { useState, useRef, useCallback, FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

interface AuthResponse {
  success: boolean;
  requiresMfa?: boolean;
  cookie?: string;
  multifactor?: {
    email?: string;
    method?: string;
    multiFactorCodeLength?: number;
  };
  data?: {
    puuid: string;
    region: string;
  };
  error?: string;
}

export function LoginForm() {
  const router = useRouter();

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaDigits, setMfaDigits] = useState<string[]>(["", "", "", "", "", ""]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCookie, setMfaCookie] = useState<string | null>(null);
  const [mfaEmail, setMfaEmail] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<"credentials" | "browser">("credentials");
  const [pastedUrl, setPastedUrl] = useState("");

  // MFA digit refs
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;
      const newDigits = [...mfaDigits];
      newDigits[index] = value.slice(-1);
      setMfaDigits(newDigits);

      // Auto-advance to next input
      if (value && index < 5) {
        digitRefs.current[index + 1]?.focus();
      }
    },
    [mfaDigits]
  );

  const handleDigitKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !mfaDigits[index] && index > 0) {
        digitRefs.current[index - 1]?.focus();
      }
    },
    [mfaDigits]
  );

  const handleDigitPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      const newDigits = [...mfaDigits];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setMfaDigits(newDigits);
      // Focus the next empty or last
      const nextEmpty = newDigits.findIndex((d) => !d);
      digitRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    },
    [mfaDigits]
  );

  const mfaCode = mfaDigits.join("");

  const handleInitialAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "auth", username, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.requiresMfa) {
        setShowMfa(true);
        setMfaCookie(data.cookie || null);
        setMfaEmail(data.multifactor?.email || null);
        // Focus first digit after render
        setTimeout(() => digitRefs.current[0]?.focus(), 100);
      } else if (data.success) {
        router.push("/store");
      } else {
        setError(data.error || "Authentication failed. Please check your credentials.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      console.error("Auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowserAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url: pastedUrl }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        router.push("/store");
      } else {
        setError(data.error || "Failed to process the URL. Please make sure you copied the entire URL.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Browser auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "multifactor", code: mfaCode, cookie: mfaCookie }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        router.push("/store");
      } else {
        setError(data.error || "Invalid verification code. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      console.error("MFA error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowMfa(false);
    setMfaDigits(["", "", "", "", "", ""]);
    setMfaCookie(null);
    setMfaEmail(null);
    setError(null);
  };

  const RIOT_AUTH_URL = "https://auth.riotgames.com/authorize?client_id=play-valorant-web-prod&redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&response_type=token%20id_token&scope=account%20openid&nonce=1";

  return (
    <div className="w-full max-w-md">
      {/* Login Card */}
      <div className="angular-card bg-void-surface/80 backdrop-blur-sm border border-white/5 p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl uppercase font-bold text-light mb-2">
            {showMfa ? "Verify Identity" : "Sign In"}
          </h1>
          <p className="text-zinc-400 text-sm">
            {showMfa
              ? `Enter the code sent to ${mfaEmail || "your email"}`
              : "Access your Valorant Store"}
          </p>
        </div>

        {/* Method Toggle — angular tabs */}
        {!showMfa && (
          <div className="flex gap-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMethod("credentials")}
              className={`flex-1 py-2 text-sm font-display uppercase tracking-wider transition-all angular-card-sm ${
                loginMethod === "credentials"
                  ? "bg-valorant-red text-white shadow-[0_0_15px_rgba(255,70,85,0.3)]"
                  : "bg-void-deep text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Riot ID
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("browser")}
              className={`flex-1 py-2 text-sm font-display uppercase tracking-wider transition-all angular-card-sm ${
                loginMethod === "browser"
                  ? "bg-valorant-red text-white shadow-[0_0_15px_rgba(255,70,85,0.3)]"
                  : "bg-void-deep text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Browser Login
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 border-l-2 border-red-500 bg-red-500/10 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Credentials Form */}
        {!showMfa && loginMethod === "credentials" && (
          <form onSubmit={handleInitialAuth} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-display uppercase tracking-wider text-zinc-300 mb-2">
                Riot ID
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username#TAG"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-void-deep border-l-2 border-transparent text-light placeholder-zinc-500 focus:outline-none focus:border-valorant-red disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-display uppercase tracking-wider text-zinc-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-void-deep border-l-2 border-transparent text-light placeholder-zinc-500 focus:outline-none focus:border-valorant-red disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            <Button type="submit" variant="valorant" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        )}

        {/* Browser Auth Form */}
        {!showMfa && loginMethod === "browser" && (
          <form onSubmit={handleBrowserAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-void-deep border-l-2 border-valorant-red/30 text-sm text-zinc-300">
                <p className="mb-3">
                  1. Click{" "}
                  <a href={RIOT_AUTH_URL} target="_blank" rel="noopener noreferrer" className="text-valorant-red hover:underline font-bold">
                    Riot Login Link
                  </a>{" "}
                  (Opens in new tab).
                </p>
                <p className="mb-3">2. Log in with your account.</p>
                <p>
                  3. <strong>Copy the entire URL</strong> from your browser address bar (starts with https://playvalorant.com/opt_in...).
                </p>
              </div>

              <div>
                <label htmlFor="pastedUrl" className="block text-sm font-display uppercase tracking-wider text-zinc-300 mb-2">
                  Paste URL here
                </label>
                <input
                  id="pastedUrl"
                  type="text"
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  placeholder="https://playvalorant.com/opt_in#access_token=..."
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-void-deep border-l-2 border-transparent text-light placeholder-zinc-500 focus:outline-none focus:border-valorant-red disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="valorant"
              size="lg"
              disabled={isLoading || !pastedUrl.includes("access_token")}
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
        )}

        {/* MFA Form — individual digit boxes */}
        {showMfa && (
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-display uppercase tracking-wider text-zinc-300 mb-4 text-center">
                Verification Code
              </label>
              <div className="flex justify-center gap-2" onPaste={handleDigitPaste}>
                {mfaDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { digitRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    disabled={isLoading}
                    className="w-12 h-14 text-center text-2xl font-mono font-bold bg-void-deep border-b-2 border-zinc-700 text-light focus:outline-none focus:border-valorant-red disabled:opacity-50 transition-all angular-card-sm"
                  />
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="valorant"
              size="lg"
              disabled={isLoading || mfaCode.length !== 6}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleBackToLogin}
              disabled={isLoading}
              className="w-full text-zinc-400 hover:text-zinc-100"
            >
              Back to Login
            </Button>
          </form>
        )}

        {/* Security divider */}
        <div className="mt-6 pt-6">
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
          <p className="text-xs text-zinc-500 text-center">
            Your credentials are securely transmitted and never stored on our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
