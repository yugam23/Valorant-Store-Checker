import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign In | Valorant Store Checker",
  description: "Sign in with your Riot Games account to check your Valorant store.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ addAccount?: string }>;
}) {
  const params = await searchParams;

  // If user has a valid session (cookie + store), redirect to /store
  // Skip this check for multi-account flow
  if (!params.addAccount) {
    const session = await getSession();
    if (session) {
      redirect("/store");
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Animated scan line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-valorant-red/20 to-transparent animate-scanline" />
      </div>

      {/* Diagonal grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.5) 40px,
            rgba(255,255,255,0.5) 41px
          )`,
        }}
      />

      {/* Dramatic red orbs */}
      <div className="absolute top-1/3 -left-40 w-96 h-96 bg-valorant-red/8 rounded-full blur-3xl animate-subtle-float" />
      <div className="absolute bottom-1/3 -right-40 w-96 h-96 bg-valorant-red/6 rounded-full blur-3xl animate-subtle-float" style={{ animationDelay: "3s" }} />

      {/* Login Form Container */}
      <div
        className="relative z-10 w-full max-w-md stagger-entrance"
        style={{ "--stagger-delay": "0ms" } as React.CSSProperties}
      >
        <LoginForm />
      </div>
    </div>
  );
}
