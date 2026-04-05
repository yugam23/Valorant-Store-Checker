import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { ShoppingCart, Moon, Package } from "lucide-react";

export default async function Home() {
  const isLoggedIn = (await getSession()) !== null;
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] pt-10 md:pt-10 pb-10 text-center px-4 overflow-hidden">
      {/* Animated background: diagonal grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
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

      {/* Floating orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-valorant-red/10 blur-3xl animate-subtle-float" />
      <div
        className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-valorant-red/5 blur-3xl animate-subtle-float"
        style={{ animationDelay: "3s" }}
      />

      {/* Hero content */}
      <div className="relative z-10">
        <div
          className="stagger-entrance"
          style={{ "--stagger-delay": "0ms" } as React.CSSProperties}
        >
          <h1 className="font-display text-6xl sm:text-8xl font-bold uppercase tracking-wider text-white leading-[0.9] mb-2">
            Check Your
          </h1>
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* Red slash decoration */}
            <div className="hidden sm:block w-12 h-[3px] bg-valorant-red -skew-x-12" />
            <h1 className="font-display text-6xl sm:text-8xl font-bold uppercase tracking-wider text-valorant-red leading-[0.9]">
              Daily Store
            </h1>
            <div className="hidden sm:block w-12 h-[3px] bg-valorant-red skew-x-12" />
          </div>
        </div>

        <p
          className="stagger-entrance max-w-2xl mx-auto text-[1.1rem] leading-[1.6] text-white/70 mb-10"
          style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
        >
          {isLoggedIn
            ? "Welcome back! Check your personalized offers, Night Market, and more."
            : "Login with your Riot ID to see your personalized offers, Night Market, and more without launching the game."}
        </p>

        <div
          className="stagger-entrance flex gap-4 justify-center"
          style={{ "--stagger-delay": "200ms" } as React.CSSProperties}
        >
          <Button
            size="lg"
            variant="valorant"
            className="text-lg px-10 py-5 h-auto transition-transform hover:scale-105"
            asChild
          >
            {isLoggedIn ? (
              <Link href="/store">VIEW MY STORE</Link>
            ) : (
              <Link href="/login">LOGIN WITH RIOT</Link>
            )}
          </Button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left w-full max-w-5xl">
        {[
          {
            title: "Daily Store",
            desc: "View your 4 daily skins with prices.",
            icon: ShoppingCart,
          },
          {
            title: "Night Market",
            desc: "Check your Night Market discounts.",
            icon: Moon,
          },
          {
            title: "Bundle Info",
            desc: "See current detailed bundle info.",
            icon: Package,
          },
        ].map((f, i) => (
          <div
            key={f.title}
            className="stagger-entrance angular-card bg-[#1A202C]/60 border border-white/10 p-6 hover:border-valorant-red/40 hover:shadow-[0_0_20px_rgba(255,70,85,0.15)] transition-all duration-300"
            style={
              { "--stagger-delay": `${300 + i * 100}ms` } as React.CSSProperties
            }
          >
            <div className="flex items-center gap-3 mb-2">
              <f.icon className="w-6 h-6 text-valorant-red" />
              <h3 className="font-display text-xl uppercase font-semibold text-white">
                {f.title}
              </h3>
            </div>
            <p className="text-white/70 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
