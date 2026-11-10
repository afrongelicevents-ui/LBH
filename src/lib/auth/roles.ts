import type { UserRole } from "@/lib/supabase/server";

export function homeForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "field":
      return "/field";
    default:
      return "/account";
  }
}

/** Staff accounts (admin + field) must be protected with 2FA (brief §11). */
export function requiresMfa(role: UserRole): boolean {
  return role === "admin" || role === "field";
}
