/** Lawyer title-check: the legal checklist items, in order. */
export const LEGAL_ITEMS = [
  "title_deed",
  "agreement_of_sale",
  "council_records",
  "seller_identity",
] as const;
export type LegalItem = (typeof LEGAL_ITEMS)[number];

/** pending = not checked yet · ok = checked, fine · problem = issue found */
export const LEGAL_STATUSES = ["pending", "ok", "problem"] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export interface LegalChecklist {
  items: Partial<Record<LegalItem, { status: LegalStatus; note: string }>>;
  findings: string;
  verdict: "clear" | "concerns" | "red_flags" | null;
  saved_at?: number;
}

export function readLegal(visit: unknown): LegalChecklist {
  const v = (visit ?? {}) as { legal?: Partial<LegalChecklist> };
  const l = v.legal ?? {};
  return {
    items: (l.items ?? {}) as LegalChecklist["items"],
    findings: typeof l.findings === "string" ? l.findings : "",
    verdict: l.verdict ?? null,
    saved_at: typeof l.saved_at === "number" ? l.saved_at : undefined,
  };
}
