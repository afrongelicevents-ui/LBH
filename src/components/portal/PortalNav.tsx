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

  // Longest matching prefix wins ("/account/progress" over "/account")
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
              className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap ${
                isActive ? "bg-charcoal text-ivory" : "text-muted hover:bg-sand hover:text-ink"
              }`}
            >
              <span className="relative">
                <Icon size={18} />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] leading-[1.1rem] font-bold text-white" data-testid="nav-badge" aria-label={`${item.badge}`}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <span aria-hidden className="w-6 shrink-0 sm:hidden" />
      </nav>
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-ivory to-transparent sm:hidden"
      />
    </div>
  );
}
