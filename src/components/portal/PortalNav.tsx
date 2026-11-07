"use client";

import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { ICONS } from "@/components/ui/PortalIcons";
import type { NavItem } from "./PortalShell";

/**
 * Portal tabs with icons. One scrollable row on phones; the active tab is
 * dark green, scrolled into view, with a green line under it.
 */
export default function PortalNav({ items, label }: { items: NavItem[]; label: string }) {
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
        className="flex gap-1 overflow-x-auto px-2 pt-1 pb-2 [scrollbar-width:none] sm:px-4 lg:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.href === active;
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[12px] font-semibold whitespace-nowrap sm:min-w-[92px] sm:text-[13px] ${
                isActive ? "bg-forest text-white shadow-(--shadow-card)" : "text-ink hover:bg-offwhite"
              }`}
            >
              <Icon size={20} />
              {item.label}
              {isActive && (
                <span aria-hidden className="absolute -bottom-2 left-1/2 h-1 w-3/4 -translate-x-1/2 rounded-full bg-ok-line" />
              )}
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
