import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] text-center px-4 overflow-hidden">
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
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-valorant-red/5 blur-3xl animate-subtle-float" style={{ animationDelay: "3s" }} />

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
          className="stagger-entrance max-w-2xl mx-auto text-lg text-white/50 mb-10"
          style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
        >
          Login with your Riot ID to see your personalized offers, Night Market, and more without launching the game.
        </p>

        <div
          className="stagger-entrance flex gap-4 justify-center"
          style={{ "--stagger-delay": "200ms" } as React.CSSProperties}
        >
          <Button size="lg" variant="valorant" className="text-lg px-8 py-6 h-auto" asChild>
            <Link href="/login">Login with Riot</Link>
          </Button>
          <Button size="lg" variant="angular-outline" className="text-lg px-8 py-6 h-auto">
            View Demo
          </Button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left w-full max-w-5xl">
        {[
          { title: "Daily Store", desc: "View your 4 daily skins with prices." },
          { title: "Night Market", desc: "Check your Night Market discounts." },
          { title: "Bundle Info", desc: "See current detailed bundle info." },
        ].map((f, i) => (
          <div
            key={f.title}
            className="stagger-entrance angular-card bg-void-surface/50 border border-white/5 p-6 hover:border-valorant-red/30 hover:shadow-[0_0_20px_rgba(255,70,85,0.1)] transition-all duration-300"
            style={{ "--stagger-delay": `${300 + i * 100}ms` } as React.CSSProperties}
          >
            <h3 className="font-display text-xl uppercase font-semibold mb-2 text-white">{f.title}</h3>
            <p className="text-white/40 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
