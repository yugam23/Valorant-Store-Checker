"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createLogger } from "@/lib/logger";

const log = createLogger("AccountSwitcher");

interface Account {
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  addedAt: number;
  isActive: boolean;
}

export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  async function fetchAccounts() {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
      log.info(`Loaded ${data.accounts?.length || 0} accounts`);
    } catch (error) {
      log.error("Failed to fetch accounts:", error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchAccount(puuid: string) {
    if (switchingTo) return; // Prevent double-clicks

    setSwitchingTo(puuid);
    log.info(`Switching to account ${puuid.substring(0, 8)}`);

    try {
      const response = await fetch("/api/accounts/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puuid }),
      });

      if (!response.ok) {
        throw new Error(`Failed to switch account: ${response.statusText}`);
      }

      // Reload the page to refresh session state
      window.location.reload();
    } catch (error) {
      log.error("Failed to switch account:", error);
      setSwitchingTo(null);
    }
  }

  async function handleRemoveAccount(puuid: string, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent account switch on remove click

    if (!confirm("Remove this account from the switcher?")) {
      return;
    }

    log.info(`Removing account ${puuid.substring(0, 8)}`);

    try {
      const response = await fetch(`/api/accounts?puuid=${puuid}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to remove account: ${response.statusText}`);
      }

      // If removing the active account, reload page (auto-switches)
      const removedAccount = accounts.find((a) => a.puuid === puuid);
      if (removedAccount?.isActive) {
        window.location.reload();
      } else {
        // Just refetch accounts
        await fetchAccounts();
      }
    } catch (error) {
      log.error("Failed to remove account:", error);
    }
  }

  function handleAddAccount() {
    router.push("/login");
  }

  // Get the active account for display
  const activeAccount = accounts.find((a) => a.isActive);
  const displayName = activeAccount
    ? activeAccount.gameName && activeAccount.tagLine
      ? `${activeAccount.gameName}#${activeAccount.tagLine}`
      : activeAccount.puuid.substring(0, 8) + "..."
    : "No Account";

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-valorant-red" />
        Loading...
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="angular-card group flex items-center gap-2 border border-white/10 bg-void-deep px-3 py-1.5 text-sm font-display uppercase tracking-wider text-white transition-all hover:border-valorant-red/50 hover:bg-void-surface"
      >
        <div className="flex items-center gap-2">
          {/* Active indicator dot */}
          <div className="h-2 w-2 rounded-full bg-valorant-red shadow-[0_0_8px_rgba(255,70,85,0.8)]" />
          <span className="max-w-[120px] truncate">{displayName}</span>
        </div>
        {/* Chevron icon */}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="angular-card absolute right-0 top-full mt-2 w-64 border border-white/10 bg-void-deep shadow-2xl">
          {/* Accounts List */}
          <div className="max-h-80 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                No accounts found
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.puuid}
                  onClick={() =>
                    !account.isActive && handleSwitchAccount(account.puuid)
                  }
                  disabled={account.isActive || switchingTo === account.puuid}
                  className={`relative w-full border-b border-white/5 px-4 py-3 text-left transition-all ${
                    account.isActive
                      ? "border-l-2 border-l-valorant-red bg-void-surface/50"
                      : "hover:bg-void-surface"
                  } ${
                    switchingTo === account.puuid
                      ? "cursor-wait opacity-50"
                      : account.isActive
                        ? "cursor-default"
                        : "cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Account Name/PUUID */}
                      <div className="font-display text-sm uppercase tracking-wider text-white truncate">
                        {account.gameName && account.tagLine
                          ? `${account.gameName}#${account.tagLine}`
                          : account.puuid.substring(0, 8) + "..."}
                      </div>

                      {/* Region Badge */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium uppercase text-zinc-400">
                          {account.region}
                        </span>
                        {account.isActive && (
                          <span className="text-xs font-medium uppercase text-valorant-red">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remove Button */}
                    {!account.isActive && (
                      <button
                        onClick={(e) => handleRemoveAccount(account.puuid, e)}
                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        aria-label="Remove account"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Switching indicator */}
                  {switchingTo === account.puuid && (
                    <div className="absolute inset-0 flex items-center justify-center bg-void-deep/80">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-valorant-red" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Add Account Button */}
          {accounts.length < 5 && (
            <button
              onClick={handleAddAccount}
              className="w-full border-t border-white/10 px-4 py-3 text-left font-display text-sm uppercase tracking-wider text-valorant-red transition-all hover:bg-void-surface"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Account
              </div>
            </button>
          )}

          {/* Account limit reached message */}
          {accounts.length >= 5 && (
            <div className="border-t border-white/10 px-4 py-3 text-center text-xs text-zinc-500">
              Maximum 5 accounts reached
            </div>
          )}
        </div>
      )}
    </div>
  );
}
