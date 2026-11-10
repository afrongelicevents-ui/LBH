import type { IconName } from "@/components/ui/PortalIcons";

export type PortalRole = "client" | "field" | "admin";

/** Portal pages per role. `label` is a message key (namespace.key). */
export interface PortalNavDef {
  href: string;
  label: string;
  icon: IconName;
}

const CLIENT: PortalNavDef[] = [
  { href: "/account", label: "portal.nav.dashboard", icon: "home" },
  { href: "/account/progress", label: "portal.nav.myBuild", icon: "hammer" },
  { href: "/account/build-account", label: "portal.nav.buildAccount", icon: "card" },
  { href: "/account/projects/new-land", label: "portal.nav.newLand", icon: "pin" },
  { href: "/account/projects/new-materials", label: "portal.nav.newMaterials", icon: "truck" },
  { href: "/account/support", label: "portal.nav.chat", icon: "chat" },
];

const FIELD: PortalNavDef[] = [{ href: "/field", label: "portal.nav.myJobs", icon: "briefcase" }];

const ADMIN: PortalNavDef[] = [
  { href: "/admin", label: "admin.nav.needsYou", icon: "home" },
  { href: "/admin/requests", label: "admin.nav.requests", icon: "doc" },
  { href: "/admin/builds", label: "admin.nav.builds", icon: "hammer" },
  { href: "/admin/bookings", label: "admin.nav.bookings", icon: "calendar" },
  { href: "/admin/clients", label: "admin.nav.clients", icon: "users" },
  { href: "/admin/chats", label: "admin.nav.chats", icon: "chat" },
  { href: "/admin/payments", label: "admin.nav.payments", icon: "card" },
  { href: "/admin/interest", label: "admin.nav.interest", icon: "bell" },
  { href: "/admin/settings", label: "admin.nav.settings", icon: "cog" },
  { href: "/admin/settings/photos", label: "admin.nav.photos", icon: "camera" },
  { href: "/admin/settings/projects", label: "admin.nav.projects", icon: "camera" },
  { href: "/admin/settings/build-account", label: "admin.nav.buildAccount", icon: "card" },
  { href: "/admin/settings/price-list", label: "admin.nav.priceList", icon: "list" },
  { href: "/admin/translations", label: "admin.nav.translations", icon: "globe" },
  { href: "/admin/audit", label: "admin.nav.audit", icon: "list" },
];

export function portalNavFor(role: PortalRole): PortalNavDef[] {
  return role === "admin" ? ADMIN : role === "field" ? FIELD : CLIENT;
}

/** Portal name key under portal.shell.area */
export function areaFor(role: PortalRole, staffKind: string | null | undefined) {
  return role === "admin" ? "admin" : role === "field" ? (staffKind === "lawyer" ? "lawyer" : "field") : "client";
}
