"use client";

import { useTransition } from "react";

/**
 * React 19 resets a form's fields after `<form action={fn}>` finishes —
 * even when the action returned an error, so people lose what they typed.
 * Submitting through this handler keeps the values.
 */
export function useSubmitKeepingValues(formAction: (fd: FormData) => void) {
  const [, start] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    start(() => formAction(fd));
  };
}

/**
 * Wrap a form action so a dropped connection (or any thrown error) becomes
 * an error result the form can show, instead of crashing the page.
 */
export function guardAction<S>(
  fn: (prev: S | null, fd: FormData) => Promise<S>,
  onError: S
): (prev: S | null, fd: FormData) => Promise<S> {
  return async (prev, fd) => {
    try {
      return await fn(prev, fd);
    } catch (e) {
      // Next.js navigation (redirect) must pass through
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
      return onError;
    }
  };
}
