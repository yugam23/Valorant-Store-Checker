"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { BundleDigitCard } from "./BundleDigitCard";
import { BundleSeparator } from "./BundleSeparator";

export interface BundleCountdownTimerProps {
  expiresAt: string | Date;
}

function BundleCountdownTimer({ expiresAt }: BundleCountdownTimerProps) {
  const timeLeft = useCountdown(expiresAt);

  const h = String(timeLeft.hours).padStart(2, "0");
  const m = String(timeLeft.minutes).padStart(2, "0");
  const s = String(timeLeft.seconds).padStart(2, "0");

  return (
    <div className="flex items-center gap-0.5" role="timer" aria-live="polite" aria-label={`${h}:${m}:${s} remaining`}>
      <BundleDigitCard value={h[0] ?? "0"} />
      <BundleDigitCard value={h[1] ?? "0"} />
      <BundleSeparator />
      <BundleDigitCard value={m[0] ?? "0"} />
      <BundleDigitCard value={m[1] ?? "0"} />
      <BundleSeparator />
      <BundleDigitCard value={s[0] ?? "0"} />
      <BundleDigitCard value={s[1] ?? "0"} />
    </div>
  );
}

export { BundleCountdownTimer };
