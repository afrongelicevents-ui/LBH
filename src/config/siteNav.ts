/**
 * One navigation for the whole LBH website + customer account.
 * Labels are message keys under "site.nav". Admin and field staff keep
 * their own separate areas (/admin, /field) and never see the customer menu.
 */
export interface SiteNavItem {
  href: string;
  key: string;
}

/**
 * Public pages in the ☰ menu (FAQ is linked from the footer). Projects is
 * always listed; until real LBH projects are published the page says so.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function publicNav(_showProjects?: boolean): SiteNavItem[] {
  return [
    { href: "/", key: "home" },
    { href: "/services", key: "services" },
    { href: "/how-it-works", key: "howItWorks" },
    { href: "/build-account", key: "buildAccount" },
    { href: "/projects", key: "projects" },
    { href: "/about", key: "about" },
    { href: "/contact", key: "contact" },
  ];
}

/** Shown in the desktop header bar (the ☰ menu has everything). */
export const HEADER_LINKS: SiteNavItem[] = [
  { href: "/services", key: "services" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/build-account", key: "buildAccount" },
  { href: "/projects", key: "projects" },
  { href: "/about", key: "about" },
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
