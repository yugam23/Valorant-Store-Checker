"use client";

import { useState } from "react";

export function LogoutButtonClient() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      className="angular-btn px-4 py-2 text-sm font-display uppercase tracking-wider text-zinc-400 bg-void-surface border border-white/5 hover:text-white hover:border-valorant-red/30 transition-all disabled:opacity-50"
    >
      {loggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
