"use client";

/**
 * Login Form Component
 *
 * Handles user authentication with Riot Games credentials.
 * Supports two-factor authentication (MFA) flow.
 *
 * Security:
 * - Credentials sent to secure backend API
 * - No token handling on client side
 * - Automatic redirect to store on success
 */

import { useState, FormEvent } from "react";
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
  const [mfaCode, setMfaCode] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCookie, setMfaCookie] = useState<string | null>(null);
  const [mfaEmail, setMfaEmail] = useState<string | null>(null);

  /**
   * Handles initial authentication with username and password
   */
  const handleInitialAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "auth",
          username,
          password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.requiresMfa) {
        // MFA required - show MFA input
        setShowMfa(true);
        setMfaCookie(data.cookie || null);
        setMfaEmail(data.multifactor?.email || null);
      } else if (data.success) {
        // Authentication successful - redirect to store
        router.push("/store");
      } else {
        // Authentication failed
        setError(data.error || "Authentication failed. Please check your credentials.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      console.error("Auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles MFA code submission
   */
  const handleMfaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "multifactor",
          code: mfaCode,
          cookie: mfaCookie,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        // MFA successful - redirect to store
        router.push("/store");
      } else {
        // MFA failed
        setError(data.error || "Invalid verification code. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      console.error("MFA error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resets form to initial state (for MFA back button)
   */
  const handleBackToLogin = () => {
    setShowMfa(false);
    setMfaCode("");
    setMfaCookie(null);
    setMfaEmail(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-md">
      {/* Login Card */}
      <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">
            {showMfa ? "Verify Your Identity" : "Sign In"}
          </h1>
          <p className="text-zinc-400 text-sm">
            {showMfa
              ? `Enter the code sent to ${mfaEmail || "your email"}`
              : "Enter your Riot Games credentials"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Initial Auth Form */}
        {!showMfa && (
          <form onSubmit={handleInitialAuth} className="space-y-6">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
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
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-valorant-red focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
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
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-valorant-red focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="valorant"
              size="lg"
              disabled={isLoading}
              className="w-full"
            >
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

        {/* MFA Form */}
        {showMfa && (
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            {/* MFA Code Input */}
            <div>
              <label htmlFor="mfaCode" className="block text-sm font-medium text-zinc-300 mb-2">
                Verification Code
              </label>
              <input
                id="mfaCode"
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                disabled={isLoading}
                maxLength={6}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 text-center text-2xl tracking-widest placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-valorant-red focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            {/* Submit Button */}
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

            {/* Back Button */}
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

        {/* Security Notice */}
        <div className="mt-6 pt-6 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            Your credentials are securely transmitted and never stored on our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
