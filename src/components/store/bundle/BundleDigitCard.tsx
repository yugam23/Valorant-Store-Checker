"use client";

function BundleDigitCard({ value }: { value: string }) {
  return (
    <span className="inline-block w-8 h-10 sm:w-10 sm:h-12 leading-10 sm:leading-[3rem] text-center text-xl sm:text-2xl font-mono font-bold text-light bg-void-deep angular-card-sm">
      {value}
    </span>
  );
}

export { BundleDigitCard };
