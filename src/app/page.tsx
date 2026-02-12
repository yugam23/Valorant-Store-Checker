import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="relative">
        <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-valorant-red to-rose-600 opacity-20 blur-xl"></div>
        <h1 className="relative text-5xl font-extrabold tracking-tight sm:text-7xl mb-6 text-white">
          Check your <span className="text-valorant-red">daily store</span>
        </h1>
      </div>
      
      <p className="max-w-2xl text-lg text-white/60 mb-10">
        Login with your Riot ID to see your personalized offers, Night Market, and more without launching the game.
      </p>
      
      <div className="flex gap-4">
        <Button size="lg" variant="valorant" className="text-lg px-8 py-6 h-auto" asChild>
          <Link href="/login">Login with Riot</Link>
        </Button>
        <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto border-white/10 hover:bg-white/5 text-white bg-transparent">
          View Demo
        </Button>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 text-left w-full max-w-5xl">
         {[
           { title: "Daily Store", desc: "View your 4 daily skins with prices." },
           { title: "Night Market", desc: "Check your Night Market discounts." },
           { title: "Bundle Info", desc: "See current detailed bundle info." }
         ].map((f) => (
           <div key={f.title} className="p-6 rounded-xl border border-white/5 bg-white/5 hover:border-valorant-red/50 transition-colors">
             <h3 className="font-bold text-xl mb-2 text-white">{f.title}</h3>
             <p className="text-white/50">{f.desc}</p>
           </div>
         ))}
      </div>
    </div>
  );
}
