"use client";

import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Portal tabs. On phones it's one compact scrollable row: the current tab is
 * highlighted and scrolled into view, and a fade on the right shows there
 * are more tabs.
 */
export default function PortalNav({
  items,
  label,
}: {
  items: { href: string; label: string }[];
  label: string;
}) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Longest matching prefix wins ("/portal/build" over "/portal")
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <div className="relative mx-auto max-w-7xl">
      <nav
        aria-label={label}
        className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:px-4 lg:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap sm:text-sm ${
                isActive ? "bg-accent text-white" : "text-ink hover:bg-offwhite"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <span aria-hidden className="w-6 shrink-0 sm:hidden" />
      </nav>
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent sm:hidden"
      />
    </div>
  );
}
