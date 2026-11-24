import "server-only";
import en from "../../messages/en.json";
import sn from "../../messages/sn.json";
import nd from "../../messages/nd.json";
import { ASSISTANT_FAQ_KEYS } from "@/config/assistant";

/**
 * The chat assistant: answers general questions about how LBH works.
 *
 *  - On Cloudflare it uses Workers AI (env.AI — free daily allowance), grounded
 *    only in LBH's own website text below, so it changes when the site changes.
 *  - Without Workers AI (local dev, tests) or if the AI fails, it falls back to
 *    matching the question against the FAQ.
 *  - Anything about money, prices, payments or a person's own project is handed
 *    to a person (the existing chat → admin Inbox).
 */

export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const HANDOFF = "[PERSON]";
const AI_TIMEOUT_MS = 15_000;

type Messages = typeof en;
const ALL: Record<string, Messages> = { en, sn: sn as unknown as Messages, nd: nd as unknown as Messages };

const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** LBH's own public information, as plain text for the AI. */
export function lbhKnowledge(): string {
  const s = en.site;
  const faq = s.faq as unknown as Record<string, { q: string; a: string }>;
  const sv = s.servicesPage as unknown as Record<string, Record<string, string>>;
  const how = en.howPage as unknown as Record<string, string>;
  const ba = en.baPublic as unknown as Record<string, string>;
  const lines: string[] = [];

  lines.push("ABOUT LBH: Let's Build Home (LBH) helps Zimbabweans living abroad buy land, build and finish homes in Zimbabwe, with a team on the ground. Contact: info@letsbuildhome.co.zw, the chat on the website, or WhatsApp when shown on the site.");
  lines.push("\nFREQUENT QUESTIONS:");
  for (const k of ASSISTANT_FAQ_KEYS) if (faq[k]) lines.push(`Q: ${strip(faq[k].q)}\nA: ${strip(faq[k].a)}`);

  lines.push("\nHOW IT WORKS:");
  lines.push(strip(how.intro));
  for (let i = 1; i <= 7; i++) if (how[`stage${i}Title`]) lines.push(`${i}. ${strip(how[`stage${i}Title`])}: ${strip(how[`stage${i}Text`])}`);
  lines.push(strip(how.note));

  lines.push("\nSERVICES:");
  lines.push(strip(sv.intro as unknown as string));
  for (const k of ["land", "landBuying", "materials", "onsite", "reporting", "camera"]) {
    const x = sv[k];
    if (!x) continue;
    const points = ["p1", "p2", "p3", "p4"].map((p) => x[p]).filter(Boolean).map(strip).join("; ");
    lines.push(`- ${strip(x.title)}: ${strip(x.text)}${points ? ` Includes: ${points}.` : ""}`);
  }
  lines.push(`- Interiors: ${strip(sv.interiorsTeaser as unknown as string)}`);

  lines.push("\nBUILD ACCOUNT:");
  lines.push(`${strip(ba.intro)} ${["f1", "f2", "f3", "f4", "f5", "f6"].map((f) => strip(ba[f])).join(" ")} ${strip(ba.notABank)} Free for clients building with LBH; a monthly or yearly plan for builds LBH is not managing.`);
  return lines.join("\n");
}

function systemPrompt(): string {
  return `You are the LBH assistant, an automatic helper in the chat on the Let's Build Home website.
You answer general questions about how LBH works, using ONLY the LBH information below.

Rules:
- Answer in 1–4 short, plain sentences (under 80 words). Be warm and clear.
- Reply in the language of the question (English, Shona or Ndebele). If unsure, use English.
- Never invent anything. If the answer is not in the LBH information, say you are not sure and that a person from the team can help.
- Never give or estimate prices, fees, costs, dates or timelines — prices come in a written quote after a free consultation.
- Never say a payment was received or confirmed, and never discuss a specific person's project, account, documents or money.
- No legal, tax or financial advice.
- If the person asks about prices, a payment, their own project or account, a complaint, wants to talk to someone, or you are not sure: answer briefly and end your reply with ${HANDOFF}
- You are an automatic assistant, not a person. Say so if asked.

LBH INFORMATION:
${lbhKnowledge()}`;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}
export interface AssistantAnswer {
  answer: string;
  handoff: boolean;
  source: "ai" | "faq" | "none";
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

function aiBinding(): { ai: AiBinding; model: string } | null {
  const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: { AI?: AiBinding; AI_MODEL?: string } }
    | undefined;
  const ai = ctx?.env?.AI;
  return ai ? { ai, model: ctx?.env?.AI_MODEL || DEFAULT_MODEL } : null;
}

function textOf(res: unknown): string {
  const r = res as { response?: unknown; choices?: { message?: { content?: unknown } }[] } | null;
  if (typeof r?.response === "string") return r.response;
  const c = r?.choices?.[0]?.message?.content;
  return typeof c === "string" ? c : "";
}

/** Words that say "this needs a person", in any of the site languages. */
const PERSON_WORDS = /\b(price|prices|cost|quote|fee|fees|how much|paid|payment|refund|my (project|build|stand|account|money|quote)|complain|agent|human|person|speak to|talk to|mutengo|mari|imali|intengo)\b/i;

const STOP = new Set("the and for you your are with what how does can do this that from have will about into when who which there their our lbh i me my is a an to of in on it be".split(" "));
const words = (s: string) => strip(s).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

/** No-AI fallback: best FAQ answer by word overlap (in the visitor's language). */
export function faqAnswer(question: string, locale: string): AssistantAnswer {
  const q = new Set(words(question));
  const local = ALL[locale] ?? en;
  let best: { key: string; score: number } | null = null;
  for (const k of ASSISTANT_FAQ_KEYS) {
    const scoreIn = (m: Messages, weightQ: number) => {
      const f = (m.site.faq as unknown as Record<string, { q: string; a: string }>)[k];
      if (!f) return 0;
      const fq = new Set(words(f.q));
      const fa = new Set(words(f.a));
      let s = 0;
      for (const w of q) s += (fq.has(w) ? weightQ : 0) + (fa.has(w) ? 1 : 0);
      return s;
    };
    const score = Math.max(scoreIn(local, 3), scoreIn(en, 3));
    if (!best || score > best.score) best = { key: k, score };
  }
  const handoff = PERSON_WORDS.test(question);
  if (best && best.score >= 3) {
    const f = (local.site.faq as unknown as Record<string, { a: string }>)[best.key];
    return { answer: strip(f.a), handoff, source: "faq" };
  }
  return { answer: "", handoff: true, source: "none" };
}

/** Answer one question. Never throws. */
export async function answerQuestion(question: string, history: AssistantTurn[], locale: string): Promise<AssistantAnswer> {
  const binding = aiBinding();
  if (binding) {
    try {
      const run = binding.ai.run(binding.model, {
        messages: [{ role: "system", content: systemPrompt() }, ...history.slice(-6), { role: "user", content: question }],
        max_tokens: 300,
        temperature: 0.2,
      });
      const res = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), AI_TIMEOUT_MS))]);
      const raw = textOf(res).trim();
      if (raw) {
        const handoff = raw.includes(HANDOFF) || PERSON_WORDS.test(question);
        const answer = raw.replaceAll(HANDOFF, "").trim();
        if (answer) return { answer, handoff, source: "ai" };
      }
    } catch (e) {
      console.error(`[assistant] AI failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return faqAnswer(question, locale);
}
