"use client";
import { useState } from "react";
import type { BundleData } from "@/types/store";
import { FeaturedBundleCard } from "./bundle/index";

interface FeaturedBundleCarouselProps {
  bundles: BundleData[];
}

export function FeaturedBundleCarousel({ bundles }: FeaturedBundleCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = bundles.length > 0 ? Math.min(activeIndex, bundles.length - 1) : 0;

  if (bundles.length === 0) return null;
  if (bundles.length === 1) {
    return (
      <div className="stagger-entrance">
        <FeaturedBundleCard bundle={bundles[0]!} />
      </div>
    );
  }

  const goToPrev = () => setActiveIndex((prev) => (prev === 0 ? bundles.length - 1 : prev - 1));
  const goToNext = () => setActiveIndex((prev) => (prev === bundles.length - 1 ? 0 : prev + 1));

  return (
    <div className="stagger-entrance space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-sm uppercase tracking-wider text-zinc-400">Featured Bundles</h2>
          <span className="text-xs text-zinc-600 font-mono">{safeIndex + 1} / {bundles.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToPrev} className="group w-10 h-10 flex items-center justify-center angular-card-sm bg-void-surface border border-white/5 hover:border-[#F0B232]/40 transition-all duration-200" aria-label="Previous bundle">
            <svg className="w-5 h-5 text-zinc-400 group-hover:text-[#F0B232] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToNext} className="group w-10 h-10 flex items-center justify-center angular-card-sm bg-void-surface border border-white/5 hover:border-[#F0B232]/40 transition-all duration-200" aria-label="Next bundle">
            <svg className="w-5 h-5 text-zinc-400 group-hover:text-[#F0B232] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
          {bundles.map((bundle) => (
            <div key={bundle.bundleUuid} className="w-full flex-shrink-0">
              <FeaturedBundleCard bundle={bundle} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2">
        {bundles.map((bundle, index) => (
          <button
            key={bundle.bundleUuid}
            onClick={() => setActiveIndex(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${index === safeIndex ? "w-8 bg-[#F0B232]" : "w-3 bg-zinc-600 hover:bg-zinc-500"}`}
            aria-label={`Go to bundle ${index + 1}: ${bundle.displayName}`}
          />
        ))}
      </div>
    </div>
  );
}
