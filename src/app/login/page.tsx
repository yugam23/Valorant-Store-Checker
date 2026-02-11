/**
 * Login Page
 *
 * Entry point for user authentication.
 * Renders the LoginForm component centered on the screen
 * with the Void & Light design system aesthetic.
 */

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign In | Valorant Store Checker",
  description: "Sign in with your Riot Games account to check your Valorant store.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-zinc-950 to-zinc-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-valorant-red/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-valorant-red/5 rounded-full blur-3xl" />
      </div>

      {/* Login Form Container */}
      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
