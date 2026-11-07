"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PortalRole } from "@/config/portalNav";

export interface HeaderProfile {
  id: string;
  role: PortalRole;
  full_name: string;
  email: string;
  staff_kind: "field_agent" | "lawyer" | null;
}

export type AuthState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; profile: HeaderProfile };

/**
 * Who is signed in, read in the browser (so it works on every public page,
 * however it was rendered or cached). Updates on sign-in / sign-out in any tab.
 */
export function useAuthProfile(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      // getSession reads the auth cookie (no network); RLS still checks the
      // token when the profile row is read below.
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setState({ status: "out" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, full_name, email, staff_kind")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setState(profile ? { status: "in", profile: profile as HeaderProfile } : { status: "out" });
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function initialsOf(name: string, email: string): string {
  const words = (name || "").replace(/^SAMPLE\s+/i, "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}
