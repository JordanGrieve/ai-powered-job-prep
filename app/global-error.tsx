"use client";

import { useEffect } from "react";

// global-error replaces the root layout entirely, so it must ship its own
// <html>/<body>. It only fires for failures in the root layout itself.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root] layout error", error.digest, error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.875rem", margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "42ch", margin: 0, opacity: 0.7 }}>
          The application failed to load. Please try again.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", opacity: 0.6, fontFamily: "monospace" }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid currentColor",
            background: "transparent",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
