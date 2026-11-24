"use server";

import { z } from "zod";
import { rateLimited } from "@/lib/ratelimit";
import { answerQuestion } from "@/lib/assistant";
import { ASSISTANT_MAX_QUESTION } from "@/config/assistant";
import { routing } from "@/i18n/routing";

export type AskResult =
  | { ok: true; answer: string; handoff: boolean; source: "ai" | "faq" | "none" }
  | { ok: false; error: "rate" | "invalid" | "error" };

const schema = z.object({
  question: z.string().trim().min(2).max(ASSISTANT_MAX_QUESTION),
  locale: z.enum(routing.locales as unknown as [string, ...string[]]).default("en"),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1200) }))
    .max(12)
    .default([]),
});

/** The chat assistant (no account needed). Questions are not stored. */
export async function askAssistant(input: { question: string; locale: string; history?: { role: "user" | "assistant"; content: string }[] }): Promise<AskResult> {
  try {
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, error: "invalid" };
    if (await rateLimited("assistant", 30, 3600)) return { ok: false, error: "rate" };
    const r = await answerQuestion(p.data.question, p.data.history, p.data.locale);
    return { ok: true, ...r };
  } catch (e) {
    console.error(`[assistant] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}
