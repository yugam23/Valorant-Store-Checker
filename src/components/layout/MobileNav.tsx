"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/nav";
import { AccountSwitcher } from "./AccountSwitcher";
import { WishlistButton } from "./WishlistButton";

interface MobileNavProps {
  isLoggedIn: boolean;
}

export function MobileNav({ isLoggedIn }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // iOS-safe scroll lock: position:fixed + top:-scrollY pattern
  // overflow:hidden alone does not stop scroll on iOS Safari
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Return focus to hamburger button when drawer closes (NAV-06)
  useEffect(() => {
    if (!isOpen) {
      hamburgerRef.current?.focus();
    }
  }, [isOpen]);

  // Focus trap: Tab key cycles only through focusable elements inside drawer
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements =
      drawer.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on open
    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    drawer.addEventListener("keydown", handleTabKey);
    return () => drawer.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      {/* Hamburger button — always visible on mobile */}
      <button
        ref={hamburgerRef}
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-white transition-colors"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <Menu size={24} />
      </button>

      {/* Full-screen overlay — rendered when open */}
      {isOpen && (
        <>
          {/* Backdrop — click to close */}
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed inset-0 z-50 flex flex-col bg-void-deep/95 overflow-y-auto"
          >
            {/* Header row with title and close button */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
              <span className="text-lg font-display uppercase tracking-wider text-white">
                Menu
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close navigation menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Navigation links */}
            <nav
              className="flex flex-col px-4 py-6 gap-1"
              aria-label="Mobile navigation"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-3 text-lg font-medium rounded-lg transition-all ${
                    pathname === link.href
                      ? "text-white bg-void-surface/50 border-l-2 border-valorant-red"
                      : "text-zinc-300 hover:text-white hover:bg-void-surface/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Divider */}
            <div className="mx-4 h-px bg-white/10" />

            {/* Account & Wishlist section — pushed to bottom */}
            <div className="flex flex-col px-4 py-6 gap-4 mt-auto">
              {isLoggedIn ? (
                <>
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Account
                    </span>
                    <AccountSwitcher />
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Wishlist
                    </span>
                    <WishlistButton />
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center px-4 py-3 bg-valorant-red text-white font-display uppercase tracking-wider angular-btn hover:bg-valorant-red/90 transition-colors"
                >
                  Login with Riot
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
