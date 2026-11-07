"use client";

/** Last-resort error screen (the root layout itself failed). Plain HTML, no i18n. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#163A2B" }}>
        <h1>Something went wrong</h1>
        <p>Please check your connection and try again.</p>
        <button type="button" onClick={reset} style={{ padding: "10px 18px", borderRadius: 999, background: "#163A2B", color: "#fff", border: 0 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
