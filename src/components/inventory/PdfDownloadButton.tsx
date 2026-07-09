"use client";

import { useState, useCallback } from "react";
import type { OwnedSkin } from "@/types/inventory";

interface PdfDownloadButtonProps {
  skins: OwnedSkin[];
}

type ButtonState = "idle" | "loading" | "error";

/**
 * Self-contained PDF export button for the inventory page.
 *
 * Owns the full download lifecycle: idle → loading (spinner) → success/error.
 * Dynamically imports the heavy pdf utility so it never bloats the main bundle.
 */
export function PdfDownloadButton({ skins }: PdfDownloadButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleDownload = useCallback(async () => {
    if (state === "loading") return;

    setState("loading");
    setErrorMsg("");

    try {
      const { generateCollectionPdf } = await import("@/lib/pdf");
      await generateCollectionPdf(skins);
      setState("idle");
    } catch (err) {
      console.error("PDF generation failed:", err);
      const message = err instanceof Error ? err.message : "Failed to generate PDF";
      setErrorMsg(message);
      setState("error");

      // Auto-dismiss error after 3 seconds
      setTimeout(() => {
        setState("idle");
        setErrorMsg("");
      }, 3000);
    }
  }, [skins, state]);

  return (
    <div className="relative">
      <button
        id="pdf-download-btn"
        onClick={handleDownload}
        disabled={state === "loading" || skins.length === 0}
        className={`
          flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide
          angular-card-sm transition-all duration-200
          ${state === "error"
            ? "bg-red-900/30 border border-red-500/50 text-red-400"
            : state === "loading"
              ? "bg-void-deep border border-valorant-red/30 text-zinc-500 cursor-wait"
              : skins.length === 0
                ? "bg-void-deep border border-white/5 text-zinc-600 cursor-not-allowed"
                : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light hover:shadow-[0_0_12px_rgba(255,70,85,0.15)]"
          }
        `}
        title={
          skins.length === 0
            ? "No skins to export"
            : state === "loading"
              ? "Generating PDF..."
              : "Download collection as PDF"
        }
      >
        {/* Icon: spinner when loading, download arrow when idle, X when error */}
        {state === "loading" ? (
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : state === "error" ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}

        {/* Label */}
        <span>
          {state === "loading"
            ? "Generating..."
            : state === "error"
              ? "Error"
              : "Export PDF"}
        </span>
      </button>

      {/* Error tooltip */}
      {state === "error" && errorMsg && (
        <div className="absolute top-full mt-2 right-0 z-20 px-3 py-2 bg-red-900/80 border border-red-500/30 angular-card-sm text-xs text-red-300 max-w-[240px] animate-fade-slide-up">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
