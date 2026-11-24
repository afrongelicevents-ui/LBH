"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";
const KEY = "lbh-theme";

function current(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Light / dark switch: remembered on this device; until used, follows the phone. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the theme the head script already applied
    setTheme(current());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (localStorage.getItem(KEY)) return; // a saved choice wins
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
      setTheme(current());
    };
    const sync = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      document.documentElement.dataset.theme = e.newValue === "dark" || (!e.newValue && mq.matches) ? "dark" : "light";
      setTheme(current());
    };
    mq.addEventListener("change", follow);
    window.addEventListener("storage", sync);
    return () => {
      mq.removeEventListener("change", follow);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = () => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: still switches for this page */
    }
    setTheme(next);
  };
  return { theme, toggle };
}

function Moon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
function Sun() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Round icon button (header). `onPhoto` = glassy white version for the photo hero. */
export default function ThemeToggle({ onPhoto = false, className = "" }: { onPhoto?: boolean; className?: string }) {
  const t = useTranslations("common");
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? t("lightMode") : t("darkMode")}
      title={theme === "dark" ? t("lightMode") : t("darkMode")}
      data-testid="theme-toggle"
      className={
        onPhoto
          ? `ws-icon-btn ${className}`
          : `inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-paper text-charcoal hover:border-line ${className}`
      }
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

/** Menu row version ("Light / dark mode ◐"). */
export function ThemeRow({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} className={`flex min-h-12 w-full items-center justify-between gap-3 text-left ${className}`} data-testid="theme-row">
      <span>{t("themeRow")}</span>
      <span className="inline-flex items-center gap-2 text-sm text-slate">
        {theme === "dark" ? t("dark") : t("light")}
        {theme === "dark" ? <Sun /> : <Moon />}
      </span>
    </button>
  );
}
