import type { IconName } from "@/components/ui/PortalIcons";

export type PortalRole = "client" | "field" | "admin";

/** Portal pages per role. `label` is a message key (namespace.key). */
export interface PortalNavDef {
  href: string;
  label: string;
  icon: IconName;
}

const CLIENT: PortalNavDef[] = [
  { href: "/portal", label: "portal.nav.dashboard", icon: "home" },
  { href: "/portal/build", label: "portal.nav.myBuild", icon: "hammer" },
  { href: "/portal/requests/new-land", label: "portal.nav.newLand", icon: "pin" },
  { href: "/portal/requests/new-materials", label: "portal.nav.newMaterials", icon: "truck" },
  { href: "/portal/chat", label: "portal.nav.chat", icon: "chat" },
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
