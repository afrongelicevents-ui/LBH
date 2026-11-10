/**
 * One navigation for the whole LBH website + customer account.
 * Labels are message keys under "site.nav". Admin and field staff keep
 * their own separate areas (/admin, /field) and never see the customer menu.
 */
export interface SiteNavItem {
  href: string;
  key: string;
}

/** The public Projects page stays out of the menu until there is enough real LBH project content. */
export const SHOW_PROJECTS_IN_NAV = false;

export const PUBLIC_NAV: SiteNavItem[] = [
  { href: "/", key: "home" },
  { href: "/services", key: "services" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/build-account", key: "buildAccount" },
  ...(SHOW_PROJECTS_IN_NAV ? [{ href: "/projects", key: "projects" }] : []),
  { href: "/about", key: "about" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
];

/** Shown in the desktop header bar (the ☰ menu has everything). */
export const HEADER_LINKS: SiteNavItem[] = [
  { href: "/services", key: "services" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/build-account", key: "buildAccount" },
  { href: "/about", key: "about" },
  { href: "/faq", key: "faq" },
];

export const ACCOUNT_NAV: SiteNavItem[] = [
  { href: "/account", key: "dashboard" },
  { href: "/account/projects", key: "projects" },
  { href: "/account/build-account", key: "buildAccount" },
  { href: "/account/progress", key: "progress" },
  { href: "/account/finance", key: "finance" },
  { href: "/account/documents", key: "documents" },
  { href: "/account/photos", key: "photos" },
  { href: "/account/reports", key: "reports" },
  { href: "/account/updates", key: "updates" },
  { href: "/account/approvals", key: "approvals" },
  { href: "/account/support", key: "support" },
  { href: "/account/settings", key: "settings" },
];
