"use client";

import Image from "next/image";
import type { BundleData } from "@/types/store";
import { getEditionIconPath } from "@/lib/edition-icons";
import { BundleCountdownTimer, BundleHeroImage } from "./index";

export interface FeaturedBundleCardProps {
  bundle: BundleData;
}

/** Single bundle card */
function FeaturedBundleCard({ bundle }: FeaturedBundleCardProps) {

  return (
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
          <BundleHeroImage bundle={bundle} />

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
                        {item.displayIcon ? (
                          <Image
                            src={item.displayIcon}
                            alt={item.displayName}
                            fill
                            className="object-contain p-4"
                            sizes="256px"
                          />
                        ) : (
                          /* Placeholder for items without icons */
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                              <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
                              </svg>
                              <span className="text-[10px] font-display uppercase tracking-wider text-zinc-600">
                                {item.itemType || "Item"}
                              </span>
                            </div>
                          </div>
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

                          {item.tierName ? (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 angular-card-sm flex items-center gap-1"
                              style={{
                                backgroundColor: `${item.tierColor}20`,
                                color: item.tierColor,
                              }}
                            >
                              {getEditionIconPath(item.tierName) && (
                                <Image
                                  src={getEditionIconPath(item.tierName)!}
                                  alt=""
                                  width={12}
                                  height={12}
                                  className="flex-shrink-0"
                                />
                              )}
                              {item.tierName}
                            </span>
                          ) : item.itemType && item.itemType !== "Skin" ? (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 angular-card-sm"
                              style={{
                                backgroundColor: `${item.tierColor}20`,
                                color: item.tierColor,
                              }}
                            >
                              {item.itemType}
                            </span>
                          ) : null}
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
  );
}

export { FeaturedBundleCard };
