"use client";

import { useRef } from "react";

/**
 * Sign-out button. Before signing out it deletes the field pages kept for
 * offline use, so the next person on this phone can't open them.
 * (Photos still waiting to upload stay on the phone and are sent the next
 * time the same person logs in.)
 */
export default function SignOutButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  const cleared = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (cleared.current) return;
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const keys = (await caches?.keys?.()) ?? [];
      await Promise.all(keys.filter((k) => k.startsWith("lbh-field-")).map((k) => caches.delete(k)));
    } catch {
      /* no cache API */
    }
    cleared.current = true;
    form.requestSubmit();
  }

  return (
    <form action={action} onSubmit={onSubmit}>
      <button type="submit" className="btn btn-outline-green min-h-10 px-3.5 py-1 text-xs">
        {label}
      </button>
    </form>
  );
}
