import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrl } from "@/lib/uploads";
import type { StageStatus } from "@/lib/stages";

export interface StageMedia {
  id: string;
  kind: string;
  url: string | null;
  note: string;
  taken_at: string | null;
  uploaded_at: string;
  amount_cents: number | null;
}

export interface StageView {
  id: string;
  position: number;
  name: string;
  description: string;
  status: StageStatus;
  approved_at: string | null;
  approved_by_name: string | null;
  quotes: {
    id: string;
    supplier_name: string;
    amount_cents: number;
    items: string;
    status: string;
    approved_by_name: string | null;
    /** supplier's own quote (photo/PDF), signed short-lived URL */
    file_url: string | null;
    file_is_pdf: boolean;
  }[];
  payment: { id: string; status: string; amount_cents: number; merchant_reference: string } | null;
  purchases: { id: string; supplier_name: string; amount_cents: number; purchased_by: string; created_at: string; note: string }[];
  inspection: { notes: string; materials_used: { item: string; quantity: string }[]; inspector_id: string; created_at: string } | null;
  media: StageMedia[];
}

export interface BuildView {
  id: string;
  title: string;
  status: string;
  details: Record<string, unknown>;
  client_id: string;
  stages: StageView[];
}

/**
 * Load one build with everything the stage cards need. Runs on the viewer's
 * own RLS-bound client, so each role only gets what it is allowed to see;
 * `withPrices` additionally avoids even asking for quotes/payments for
 * field staff (who may never see prices).
 */
export async function loadBuild(
  supabase: SupabaseClient,
  requestId: string,
  opts: { withPrices: boolean }
): Promise<BuildView | null> {
  const { data: req } = await supabase
    .from("service_requests")
    .select("id, title, status, details, client_id, type")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.type !== "build") return null;

  const [{ data: stages }, quotesRes, paymentsRes, { data: purchases }, { data: inspections }, { data: media }] =
    await Promise.all([
      supabase
        .from("build_stages")
        .select("id, position, name, description, status, approved_at, approved_by_name")
        .eq("request_id", requestId)
        .order("position"),
      opts.withPrices
        ? supabase
            .from("stage_quotes")
            .select("id, stage_id, supplier_name, amount_cents, items, status, approved_by_name, file_path")
            .eq("request_id", requestId)
            .order("amount_cents")
        : Promise.resolve({ data: [] as never[] }),
      opts.withPrices
        ? supabase
            .from("payments")
            .select("id, stage_id, status, amount_cents, merchant_reference, created_at")
            .eq("request_id", requestId)
            .eq("kind", "materials")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      opts.withPrices
        ? supabase
            .from("stage_purchases")
            .select("id, stage_id, supplier_name, amount_cents, purchased_by, created_at, note")
            .eq("request_id", requestId)
            .order("created_at")
        : // field staff: same rows, never the amounts
          supabase.rpc("stage_purchases_for_field", { p_request_id: requestId }).then((r) => ({
            ...r,
            data: ((r.data ?? []) as { id: string; stage_id: string; supplier_name: string; purchased_by: string; created_at: string; note: string }[])
              .map((p) => ({ ...p, amount_cents: 0 }))
              .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          })),
      supabase
        .from("stage_inspections")
        .select("stage_id, notes, materials_used, inspector_id, created_at")
        .eq("request_id", requestId),
      supabase
        .from("media")
        .select("id, stage_id, kind, storage_path, note, taken_at, uploaded_at, amount_cents")
        .eq("request_id", requestId)
        .not("stage_id", "is", null)
        .order("uploaded_at"),
    ]);

  const quotes = await Promise.all(
    ((quotesRes.data ?? []) as (Omit<StageView["quotes"][number], "file_url" | "file_is_pdf"> & {
      stage_id: string;
      file_path: string | null;
    })[]).map(async ({ file_path, ...q }) => ({
      ...q,
      file_url: file_path ? await signedUrl("documents", file_path, 900) : null,
      file_is_pdf: Boolean(file_path?.endsWith(".pdf")),
    }))
  );

  const signed = await Promise.all(
    (media ?? []).map(async (m) => ({ ...m, url: await signedUrl("media", m.storage_path, 900) }))
  );

  return {
    id: req.id,
    title: req.title,
    status: req.status,
    details: (req.details ?? {}) as Record<string, unknown>,
    client_id: req.client_id,
    stages: (stages ?? []).map((s) => ({
      ...s,
      status: s.status as StageStatus,
      quotes: quotes.filter((q) => q.stage_id === s.id).map(({ stage_id: _sid, ...q }) => q),
      payment:
        ((paymentsRes.data ?? []) as (StageView["payment"] & { stage_id: string })[]).find(
          (p) => p && p.stage_id === s.id
        ) ?? null,
      purchases: (purchases ?? []).filter((p) => p.stage_id === s.id),
      inspection:
        ((inspections ?? []).find((i) => i.stage_id === s.id) as StageView["inspection"]) ?? null,
      media: signed
        .filter((m) => m.stage_id === s.id)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          url: m.url,
          note: m.note,
          taken_at: m.taken_at,
          uploaded_at: m.uploaded_at,
          amount_cents: opts.withPrices ? m.amount_cents : null,
        })),
    })),
  };
}
