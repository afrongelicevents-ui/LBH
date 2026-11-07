"use client";

import { useEffect, useRef, useState } from "react";
import { latestPending, type OutboxAction } from "@/lib/field/outbox";
import { useOutbox } from "./OutboxProvider";

/**
 * A field form that saves to the phone first (works with no signal) and is
 * sent by the outbox. After a reload, values still waiting to upload are
 * put back into the form so nothing looks lost.
 */
export function useOfflineForm(action: OutboxAction, target: string, label: string) {
  const outbox = useOutbox();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState<null | "queued">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!outbox) return;
    let cancelled = false;
    latestPending(outbox.userId, action, target)
      .then((op) => {
        const form = formRef.current;
        if (!op || !form || cancelled) return;
        for (const el of Array.from(form.elements)) {
          const input = el as HTMLInputElement;
          if (!input.name || input.type === "submit" || input.type === "hidden") continue;
          if (input.type === "checkbox") input.checked = op.fields[input.name] === "on";
          else if (input.type === "radio") input.checked = op.fields[input.name] === input.value;
          else if (input.name in op.fields) input.value = op.fields[input.name];
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // run once per form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, target]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!outbox) return; // not in the field area: normal form action runs
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    const fields: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") fields[k] = v;
    fields.saved_at = String(Date.now());
    setBusy(true);
    try {
      await outbox.enqueue({ action, target, label, fields, files: [] });
      setSaved("queued");
    } finally {
      setBusy(false);
    }
  }

  return { formRef, onSubmit, saved, busy, offline: Boolean(outbox) };
}
