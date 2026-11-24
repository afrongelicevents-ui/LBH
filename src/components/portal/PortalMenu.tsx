"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { CloseIcon, ICONS, LogOutIcon, MenuIcon, HomeIcon } from "@/components/ui/PortalIcons";
import SignOutButton from "./SignOutButton";
import type { NavItem } from "./PortalShell";

/** Hamburger menu: who is signed in, every portal page, sign out. */
export default function PortalMenu({
  items,
  name,
  email,
  portalName,
  signOutAction,
  labels,
}: {
  items: NavItem[];
  name: string;
  email: string;
  portalName: string;
  signOutAction: () => Promise<void>;
  labels: { menu: string; close: string; signOut: string; website: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // close when the page changes
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  // the "Menu" tab in the bottom tab bar opens this menu
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener("lbh:open-portal-menu", openMenu);
    return () => window.removeEventListener("lbh:open-portal-menu", openMenu);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? labels.close : labels.menu}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-paper text-ink hover:border-line"
      >
        {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-[rgba(10,9,7,0.45)]"
          />
          <div
            role="menu"
            className="fixed inset-x-3 bottom-3 z-50 max-h-[80svh] overflow-hidden rounded-[28px] border border-rule bg-paper shadow-(--shadow-card-hover) sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-80 sm:rounded-[22px]"
          >
            <div className="border-b border-rule px-4 py-3">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="truncate text-xs text-muted">{email}</p>
              <p className="mt-0.5 text-xs font-semibold text-forest">{portalName}</p>
            </div>
            <ul className="max-h-[56svh] overflow-y-auto py-1 sm:max-h-[60vh]">
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link href={item.href} role="menuitem" className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-[15px] font-semibold text-ink hover:bg-sand">
                      <Icon size={18} className="text-forest" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/" role="menuitem" className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-[15px] font-semibold text-ink hover:bg-sand">
                  <HomeIcon size={18} className="text-forest" />
                  {labels.website}
                </Link>
              </li>
            </ul>
            <div className="flex items-center gap-2 border-t border-rule px-4 py-3">
              <LogOutIcon size={18} className="text-muted" />
              <SignOutButton action={signOutAction} label={labels.signOut} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
