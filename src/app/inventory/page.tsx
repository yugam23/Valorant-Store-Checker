"use client";

import { useEffect, useState } from "react";
import { InventoryGrid } from "@/components/inventory/InventoryGrid";
import type { InventoryData } from "@/types/inventory";

type LoadingState = "idle" | "loading" | "success" | "error";

export default function InventoryPage() {
  const [state, setState] = useState<LoadingState>("idle");
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fetchInventory = async () => {
    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/inventory");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch inventory");
      }

      const data: InventoryData = await response.json();
      setInventoryData(data);
      setState("success");
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      setState("error");
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  return (
    <div className="min-h-screen bg-void p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="font-display text-4xl md:text-5xl uppercase font-bold text-light tracking-wide">
            My Collection
          </h1>
          {inventoryData && (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-valorant-red/20 border border-valorant-red angular-card-sm">
                <span className="text-valorant-red font-bold text-lg">
                  {inventoryData.totalCount} Skins
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-valorant-red/20 border-t-valorant-red rounded-full animate-spin" />
            </div>
            <p className="text-zinc-400 text-lg">Loading your collection...</p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="text-valorant-red">
              <svg
                className="h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-zinc-400 text-center max-w-md">
              {errorMessage || "Failed to load inventory"}
            </p>
            <button
              onClick={fetchInventory}
              className="px-6 py-3 bg-valorant-red hover:bg-valorant-red/90 text-white font-semibold uppercase tracking-wide angular-card transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Success State */}
        {state === "success" && inventoryData && (
          <InventoryGrid
            skins={inventoryData.skins}
            weaponCategories={inventoryData.weaponCategories}
          />
        )}
      </div>
    </div>
  );
}
