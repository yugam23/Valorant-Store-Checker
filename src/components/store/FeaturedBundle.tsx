"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { BundleData } from "@/types/store";

interface FeaturedBundleProps {
  bundle: BundleData;
}

/** Countdown timer for bundle expiration */
function BundleCountdownTimer({ expiresAt }: { expiresAt: string | Date }) {
  const [timeLeft, setTimeLeft] = useState({ h: "00", m: "00", s: "00" });

  const calcTime = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { h: "00", m: "00", s: "00" };
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    return { h, m, s };
  }, [expiresAt]);

  useEffect(() => {
    setTimeLeft(calcTime());
    const id = setInterval(() => setTimeLeft(calcTime()), 1000);
    return () => clearInterval(id);
  }, [calcTime]);

  const DigitCard = ({ value }: { value: string }) => (
    <span className="inline-block w-10 h-12 leading-[3rem] text-center text-2xl font-mono font-bold text-light bg-void-deep angular-card-sm">
      {value}
    </span>
  );

  const Separator = () => (
    <span className="text-[#F0B232] text-2xl font-bold mx-0.5 animate-pulse-glow">:</span>
  );

  return (
    <div className="flex items-center gap-0.5" role="timer" aria-live="polite" aria-label={`${timeLeft.h} hours ${timeLeft.m} minutes ${timeLeft.s} seconds remaining`}>
      <DigitCard value={timeLeft.h[0]} />
      <DigitCard value={timeLeft.h[1]} />
      <Separator />
      <DigitCard value={timeLeft.m[0]} />
      <DigitCard value={timeLeft.m[1]} />
      <Separator />
      <DigitCard value={timeLeft.s[0]} />
      <DigitCard value={timeLeft.s[1]} />
    </div>
  );
}

export function FeaturedBundle({ bundle }: FeaturedBundleProps) {
  return (
    <div className="stagger-entrance">
      <div
        className="glow-border angular-card"
        style={{ "--glow-color": "#F0B232" } as React.CSSProperties}
      >
        <div className="relative overflow-hidden angular-card bg-void-deep">
          {/* Premium glow effect */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none z-0"
            style={{
              background: `radial-gradient(ellipse at center, #F0B23220 0%, transparent 70%)`,
            }}
          />

          {/* Content */}
          <div className="relative z-10">
            {/* Hero banner image */}
            {bundle.displayIcon2 && (
              <div className="relative w-full aspect-[21/9] overflow-hidden bg-void/50">
                <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.8)_100%)]" />
                <Image
                  src={bundle.displayIcon2}
                  alt={bundle.displayName}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority
                />
              </div>
            )}

            {/* Bundle info section */}
            <div className="p-6 space-y-6">
              {/* Header with name and timer */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold uppercase tracking-wider px-3 py-1 angular-card-sm"
                      style={{
                        backgroundColor: "#F0B23220",
                        color: "#F0B232",
                      }}
                    >
                      Featured Bundle
                    </span>
                  </div>
                  <h2 className="font-display text-3xl md:text-4xl uppercase font-bold text-light leading-tight">
                    {bundle.displayName}
                  </h2>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <span className="text-zinc-500 text-xs font-display uppercase tracking-wider">
                    Expires in
                  </span>
                  <BundleCountdownTimer expiresAt={bundle.expiresAt} />
                </div>
              </div>

              {/* Angular separator */}
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#F0B232]/30 to-transparent" />

              {/* Bundle items - horizontal scrollable */}
              <div className="space-y-3">
                <h3 className="font-display text-sm uppercase tracking-wider text-zinc-400">
                  Bundle Contents ({bundle.items.length} items)
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-void scrollbar-thumb-zinc-700">
                  {bundle.items.map((item) => (
                    <div
                      key={item.uuid}
                      className="flex-shrink-0 w-64 glow-border angular-card"
                      style={{ "--glow-color": item.tierColor } as React.CSSProperties}
                    >
                      <div className="angular-card bg-void-surface overflow-hidden">
                        {/* Item image */}
                        <div className="relative aspect-[16/9] bg-void/50">
                          <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.6)_100%)]" />
                          {item.displayIcon && (
                            <Image
                              src={item.displayIcon}
                              alt={item.displayName}
                              fill
                              className="object-contain p-4"
                              sizes="256px"
                            />
                          )}
                        </div>

                        {/* Item info */}
                        <div className="p-4 space-y-2">
                          <h4 className="font-display text-sm uppercase font-semibold text-light leading-tight line-clamp-2">
                            {item.displayName}
                          </h4>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                              <Image
                                src="/icons/Valorant_Points.webp"
                                alt="VP"
                                width={20}
                                height={20}
                              />
                              <span className="text-light font-bold text-sm font-mono">
                                {item.discountedPrice.toLocaleString()}
                              </span>
                            </div>

                            {item.tierName && (
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 angular-card-sm"
                                style={{
                                  backgroundColor: `${item.tierColor}20`,
                                  color: item.tierColor,
                                }}
                              >
                                {item.tierName}
                              </span>
                            )}
                          </div>

                          {/* Show discount if applicable */}
                          {item.discountPercent > 0 && (
                            <div className="text-xs text-zinc-500 line-through">
                              {item.basePrice.toLocaleString()} VP
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Angular separator */}
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#F0B232]/30 to-transparent" />

              {/* Bundle pricing */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider">
                    Bundle Total Price
                  </div>
                  <div className="flex items-center gap-3">
                    <Image
                      src="/icons/Valorant_Points.webp"
                      alt="VP"
                      width={36}
                      height={36}
                    />
                    <span className="text-light font-bold text-4xl font-mono tracking-wider">
                      {bundle.totalDiscountedPrice.toLocaleString()}
                    </span>
                  </div>
                  {bundle.totalBasePrice > bundle.totalDiscountedPrice && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-500 line-through">
                        {bundle.totalBasePrice.toLocaleString()} VP
                      </span>
                      <span className="text-sm font-bold text-[#F0B232]">
                        Save {Math.round(((bundle.totalBasePrice - bundle.totalDiscountedPrice) / bundle.totalBasePrice) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {bundle.wholesaleOnly && (
                  <div className="flex items-center gap-2 px-4 py-2 border border-amber-500/30 angular-card-sm bg-amber-500/10">
                    <span className="text-amber-400 text-xs uppercase tracking-wider">
                      Bundle Only - Items cannot be purchased separately
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
