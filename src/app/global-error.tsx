"use client";

import { useEffect } from "react";

/**
 * Global Error Boundary — catches root layout errors.
 *
 * This file is a Next.js App Router convention. It activates when
 * the root layout itself throws, replacing the entire <html> tree.
 * It must include <html> and <body> tags because the root layout
 * is not rendered when this component is active.
 *
 * Uses system fonts (Teko/Outfit unavailable since root layout is down).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A1118",
          color: "#E8E8E8",
          fontFamily:
            "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
          padding: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            padding: "2.5rem",
            textAlign: "center",
            backgroundColor: "rgba(22, 33, 44, 0.8)",
            clipPath:
              "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          {/* Error icon */}
          <div
            style={{
              width: "4rem",
              height: "4rem",
              margin: "0 auto 1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              clipPath:
                "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
            }}
          >
            <span
              style={{
                fontSize: "2rem",
                color: "#EF4444",
                fontWeight: "bold",
              }}
            >
              !
            </span>
          </div>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.75rem",
            }}
          >
            Critical Error
          </h2>

          <p
            style={{
              color: "#9CA3AF",
              fontSize: "0.875rem",
              lineHeight: "1.6",
              marginBottom: "1.5rem",
            }}
          >
            The application encountered a critical error and could not recover
            automatically. Please try again or return to the home page.
          </p>

          {process.env.NODE_ENV === "development" && (
            <pre
              style={{
                textAlign: "left",
                fontSize: "0.75rem",
                color: "rgba(239, 68, 68, 0.8)",
                backgroundColor: "#0A1118",
                padding: "0.75rem",
                overflow: "auto",
                maxHeight: "6rem",
                marginBottom: "1.5rem",
                clipPath:
                  "polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))",
              }}
            >
              {error.message}
            </pre>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => unstable_retry()}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#FF4655",
                color: "white",
                border: "none",
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: "bold",
                fontSize: "0.875rem",
                letterSpacing: "0.05em",
                clipPath:
                  "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
              }}
            >
              Try Again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Next.js router unavailable when root layout is dead */}
            <a
              href="/"
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#1E293B",
                color: "#D1D5DB",
                textDecoration: "none",
                textTransform: "uppercase",
                fontWeight: "bold",
                fontSize: "0.875rem",
                letterSpacing: "0.05em",
                display: "inline-flex",
                alignItems: "center",
                clipPath:
                  "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
