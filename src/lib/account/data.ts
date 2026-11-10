import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Everything the customer's account sections show, read with the customer's
 * own session — row-level security in the database decides what is visible.
 * Only real records: nothing here is invented or sample data.
 */

const clean = (s: string | null | undefined) => (s ?? "").replace(/^SAMPLE\s*[—-]?\s*/, "");

export type ApprovalItem = {
  kind: "quote" | "extra" | "supplier" | "stage_choose" | "stage_approve";
  title: string;
  project: string;
  amount_cents: number | null;
  at: string;
  href: string;
  decided?: "approved" | "declined" | "accepted";
};
export type UpdateItem = { at: string; kind: "action" | "report" | "payment" | "stage" | "document" | "quote"; text: string; params: Record<string, string>; href: string };
export type DocItem = { kind: "quote" | "invoice" | "report" | "document" | "receipt"; title: string; project: string; at: string; href: string; storage?: { bucket: "documents" | "media"; path: string } };
export type ReportItem = { id: string; request_id: string; project: string; verdict: string | null; published_at: string; kind: "report" | "inspection"; href: string };

type Req = { id: string; title: string; type: string; status: string };

export const loadAccount = cache(async (supabase: SupabaseClient) => {
  const [reqs, approvals, quotes, payments, reports, stages, sq, inspections, docs, media, supplierQuotes, invoices] = await Promise.all([
    supabase.from("service_requests").select("id, title, type, status"),
    supabase.from("approvals").select("id, request_id, title, amount_cents, status, created_at, decided_at"),
    supabase.from("quotes").select("id, request_id, quote_number, status, total_cents, sent_at, accepted_at").neq("status", "draft"),
    supabase.from("payments").select("id, request_id, amount_cents, kind, status, confirmed_at, created_at"),
    supabase.from("reports").select("id, request_id, verdict, published_at").eq("status", "published"),
    supabase.from("build_stages").select("id, request_id, name, position, status, approved_at, updated_at"),
    supabase.from("stage_quotes").select("stage_id, status"),
    supabase.from("stage_inspections").select("id, stage_id, request_id, created_at"),
    supabase.from("documents").select("id, request_id, file_name, storage_path, created_at, uploader_id"),
    supabase.from("media").select("id, request_id, stage_id, kind, storage_path, taken_at, uploaded_at, note, amount_cents"),
    supabase.from("supplier_quotes").select("id, request_id, supplier_name, amount_cents, status, created_at"),
    supabase.from("invoices").select("id, request_id, invoice_number, issued_at"),
  ]);

  const requests = (reqs.data ?? []) as Req[];
  const nameOf = (id: string) => clean(requests.find((r) => r.id === id)?.title);
  const projHref = (id: string) => `/account/projects/${id}`;
  const stageName = new Map((stages.data ?? []).map((s) => [s.id as string, s.name as string]));

  // ---------- approvals ----------
  const pending: ApprovalItem[] = [];
  const history: ApprovalItem[] = [];
  for (const a of approvals.data ?? []) {
    const item: ApprovalItem = { kind: "extra", title: clean(a.title), project: nameOf(a.request_id), amount_cents: a.amount_cents, at: a.decided_at ?? a.created_at, href: `${projHref(a.request_id)}#approvals` };
    if (a.status === "pending") pending.push({ ...item, at: a.created_at });
    else history.push({ ...item, decided: a.status as "approved" | "declined" });
  }
  for (const q of quotes.data ?? []) {
    const item: ApprovalItem = { kind: "quote", title: `#${q.quote_number}`, project: nameOf(q.request_id), amount_cents: q.total_cents, at: q.accepted_at ?? q.sent_at ?? "", href: projHref(q.request_id) };
    if (q.status === "sent") pending.push(item);
    else if (q.status === "accepted") history.push({ ...item, decided: "accepted" });
  }
  for (const s of supplierQuotes.data ?? []) {
    const item: ApprovalItem = { kind: "supplier", title: clean(s.supplier_name), project: nameOf(s.request_id), amount_cents: s.amount_cents, at: s.created_at, href: projHref(s.request_id) };
    if (s.status === "pending") pending.push(item);
    else history.push({ ...item, decided: s.status === "approved" ? "approved" : "declined" });
  }
  for (const st of stages.data ?? []) {
    const href = `/account/progress/${st.request_id}#stage-${st.position}`;
    const base = { title: st.name as string, project: nameOf(st.request_id), amount_cents: null, href };
    const hasQuotes = (sq.data ?? []).some((q) => q.stage_id === st.id);
    if (st.status === "quoting" && hasQuotes) pending.push({ ...base, kind: "stage_choose", at: st.updated_at });
    if (st.status === "inspected") pending.push({ ...base, kind: "stage_approve", at: st.updated_at });
    if (st.status === "approved" && st.approved_at) history.push({ ...base, kind: "stage_approve", at: st.approved_at, decided: "approved" });
  }
  const byDate = (a: { at: string }, b: { at: string }) => (b.at || "").localeCompare(a.at || "");
  pending.sort(byDate);
  history.sort(byDate);

  // ---------- reports ----------
  const reportItems: ReportItem[] = [
    ...(reports.data ?? []).filter((r) => r.published_at).map((r) => ({
      id: r.id, request_id: r.request_id, project: nameOf(r.request_id), verdict: r.verdict, published_at: r.published_at as string, kind: "report" as const, href: `${projHref(r.request_id)}/report`,
    })),
    ...(inspections.data ?? []).map((i) => ({
      id: i.id, request_id: i.request_id, project: `${nameOf(i.request_id)} · ${stageName.get(i.stage_id) ?? ""}`, verdict: null, published_at: i.created_at, kind: "inspection" as const, href: `/account/progress/${i.request_id}`,
    })),
  ].sort((a, b) => b.published_at.localeCompare(a.published_at));

  // ---------- documents ----------
  const documents: DocItem[] = [
    ...(quotes.data ?? []).map((q) => ({ kind: "quote" as const, title: `#${q.quote_number}`, project: nameOf(q.request_id), at: q.sent_at ?? "", href: `/api/pdf/quote/${q.id}` })),
    ...(invoices.data ?? []).map((i) => ({ kind: "invoice" as const, title: `#${i.invoice_number}`, project: nameOf(i.request_id), at: i.issued_at, href: `/api/pdf/invoice/${i.id}` })),
    ...(reports.data ?? []).filter((r) => r.published_at).map((r) => ({ kind: "report" as const, title: nameOf(r.request_id), project: nameOf(r.request_id), at: r.published_at as string, href: `/api/pdf/report/${r.id}` })),
    ...(docs.data ?? []).map((d) => ({ kind: "document" as const, title: d.file_name, project: nameOf(d.request_id), at: d.created_at, href: "", storage: { bucket: "documents" as const, path: d.storage_path } })),
    ...(media.data ?? []).filter((m) => m.kind === "receipt").map((m) => ({ kind: "receipt" as const, title: clean(m.note) || "", project: nameOf(m.request_id), at: m.taken_at ?? m.uploaded_at, href: "", storage: { bucket: "media" as const, path: m.storage_path } })),
  ].sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  // ---------- photos ----------
  const photos = (media.data ?? [])
    .filter((m) => m.kind === "photo")
    .map((m) => ({ id: m.id as string, request_id: m.request_id as string, project: nameOf(m.request_id), stage: m.stage_id ? stageName.get(m.stage_id) ?? null : null, path: m.storage_path as string, at: (m.taken_at ?? m.uploaded_at) as string }))
    .sort((a, b) => b.at.localeCompare(a.at));

  // ---------- updates (genuine events) ----------
  const updates: UpdateItem[] = [
    ...pending.map((p) => ({ at: p.at, kind: "action" as const, text: `approval.${p.kind}`, params: { title: p.title, project: p.project }, href: p.href })),
    ...reportItems.map((r) => ({ at: r.published_at, kind: "report" as const, text: r.kind === "report" ? "report" : "inspection", params: { project: r.project }, href: r.href })),
    ...(payments.data ?? []).filter((p) => p.status === "confirmed" && p.confirmed_at).map((p) => ({ at: p.confirmed_at as string, kind: "payment" as const, text: "payment", params: { project: nameOf(p.request_id), amount_cents: String(p.amount_cents) }, href: `${projHref(p.request_id)}#payments` })),
    ...(stages.data ?? []).filter((s) => s.status !== "locked").map((s) => ({ at: s.updated_at as string, kind: "stage" as const, text: `stage.${s.status}`, params: { stage: s.name as string, project: nameOf(s.request_id) }, href: `/account/progress/${s.request_id}` })),
    ...(quotes.data ?? []).filter((q) => q.sent_at).map((q) => ({ at: q.sent_at as string, kind: "quote" as const, text: "quote", params: { number: String(q.quote_number), project: nameOf(q.request_id) }, href: projHref(q.request_id) })),
    ...(docs.data ?? []).map((d) => ({ at: d.created_at as string, kind: "document" as const, text: "document", params: { name: d.file_name as string, project: nameOf(d.request_id) }, href: projHref(d.request_id) })),
  ]
    .filter((u) => u.at)
    .sort((a, b) => b.at.localeCompare(a.at));

  const confirmedPayments = (payments.data ?? []).filter((p) => p.status === "confirmed");

  return {
    requests,
    pending,
    history,
    reports: reportItems,
    documents,
    photos,
    updates,
    payments: payments.data ?? [],
    hasBuild: requests.some((r) => r.type === "build"),
    counts: {
      approvals: pending.length + history.length,
      reports: reportItems.length,
      documents: documents.length,
      photos: photos.length,
      updates: updates.length,
      finance: confirmedPayments.length + (invoices.data?.length ?? 0),
    },
  };
});

export type AccountData = Awaited<ReturnType<typeof loadAccount>>;

/** Menu keys of account sections with nothing real to show yet (hidden from the menu). */
export function emptySections(d: AccountData): string[] {
  const hide: string[] = [];
  if (!d.hasBuild) hide.push("progress");
  if (d.counts.approvals === 0) hide.push("approvals");
  if (d.counts.reports === 0) hide.push("reports");
  if (d.counts.documents === 0) hide.push("documents");
  if (d.counts.photos === 0) hide.push("photos");
  if (d.counts.updates === 0) hide.push("updates");
  if (d.counts.finance === 0) hide.push("finance");
  return hide;
}
