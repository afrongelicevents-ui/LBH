"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUserProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  captureProvenance,
  discardIncoming,
  parseUploadRefs,
  storePrivate,
  takeIncoming,
  uploadErrorCode,
} from "@/lib/uploads";
import { LEGAL_ITEMS, LEGAL_STATUSES } from "@/lib/legal";
import { distanceMeters, FAR_PHOTO_THRESHOLD_M } from "@/lib/geo";
import { parseDollarsToCents } from "@/lib/money";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireFieldJob(jobId: string) {
  const { supabase, user, profile, aal } = await getUserProfile();
  if (!user || !profile || profile.role !== "field" || aal !== "aal2") {
    throw new Error("not authorised");
  }
  const { data: job } = await supabase
    .from("jobs")
    .select("id, request_id, assigned_to, job_type, status, checklist, visit, service_requests(details)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.assigned_to !== user.id) throw new Error("job not found");
  return { supabase, user, job };
}

/** Short error code for a thrown failure ("auth" = log in again). */
function failCode(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "not authorised") return "auth";
  if (m === "job not found") return "notfound";
  return "error";
}

/**
 * Saves made offline arrive later, possibly after a newer save from the
 * same phone. The phone's save time decides: older saves are ignored.
 */
function savedAtFrom(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < Date.now() + 10 * 60 * 1000 ? n : Date.now();
}

// ---------- visit checklist + measurements (brief §6) ----------
const visitSchema = z.object({
  arrived: z.coerce.boolean(),
  council_officer_present: z.coerce.boolean(),
  pegs_shown: z.coerce.boolean(),
  length_m: z.coerce.number().min(0).max(10000).optional().or(z.literal("")),
  width_m: z.coerce.number().min(0).max(10000).optional().or(z.literal("")),
  area_sqm: z.coerce.number().min(0).max(100000000).optional().or(z.literal("")),
  title_notes: z.string().trim().max(4000).default(""),
  findings: z.string().trim().max(8000).default(""),
});

export async function saveVisit(
  jobId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, job } = await requireFieldJob(jobId);
    const raw = Object.fromEntries(formData.entries());
    const savedAt = savedAtFrom(formData.get("saved_at"));
    const prevVisit = (job.visit ?? {}) as Record<string, unknown>;
    if (typeof prevVisit.saved_at === "number" && prevVisit.saved_at > savedAt) {
      return { ok: true }; // a newer save is already stored
    }
    const parsed = visitSchema.safeParse({
      ...raw,
      arrived: raw.arrived === "on",
      council_officer_present: raw.council_officer_present === "on",
      pegs_shown: raw.pegs_shown === "on",
    });
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    const { error } = await supabase
      .from("jobs")
      .update({
        status: job.status === "assigned" ? "in_progress" : job.status,
        visit: {
          arrived: d.arrived,
          council_officer_present: d.council_officer_present,
          pegs_shown: d.pegs_shown,
          measurements: {
            length_m: d.length_m === "" ? null : d.length_m,
            width_m: d.width_m === "" ? null : d.width_m,
            area_sqm: d.area_sqm === "" ? null : d.area_sqm,
          },
          title_notes: d.title_notes,
          findings: d.findings,
          saved_at: savedAt,
          ...(prevVisit.legal ? { legal: prevVisit.legal } : {}),
        },
        checklist: {
          arrived: d.arrived,
          council_officer_present: d.council_officer_present,
          pegs_shown: d.pegs_shown,
          measurements_taken: d.length_m !== "" || d.width_m !== "",
        },
      })
      .eq("id", jobId);
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/field", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[visit] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: failCode(e) };
  }
}

// ---------- lawyer title check: legal checklist ----------
const legalSchema = z.object({
  findings: z.string().trim().max(8000).default(""),
  verdict: z.enum(["clear", "concerns", "red_flags"]).optional().or(z.literal("")),
});

export async function saveLegal(
  jobId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, job } = await requireFieldJob(jobId);
    if (job.job_type !== "title_check") return { ok: false, error: "invalid" };
    const savedAt = savedAtFrom(formData.get("saved_at"));
    const prevVisit = (job.visit ?? {}) as Record<string, unknown>;
    const prevLegal = (prevVisit.legal ?? {}) as Record<string, unknown>;
    if (typeof prevLegal.saved_at === "number" && prevLegal.saved_at > savedAt) {
      return { ok: true };
    }
    const parsed = legalSchema.safeParse({
      findings: formData.get("findings") ?? "",
      verdict: formData.get("verdict") ?? "",
    });
    if (!parsed.success) return { ok: false, error: "invalid" };

    const items: Record<string, { status: string; note: string }> = {};
    const checklist: Record<string, string> = {};
    for (const key of LEGAL_ITEMS) {
      const status = String(formData.get(`${key}_status`) ?? "pending");
      if (!(LEGAL_STATUSES as readonly string[]).includes(status)) {
        return { ok: false, error: "invalid" };
      }
      const note = String(formData.get(`${key}_note`) ?? "").trim();
      if (note.length > 4000) return { ok: false, error: "invalid" };
      items[key] = { status, note };
      checklist[key] = status;
    }

    const { error } = await supabase
      .from("jobs")
      .update({
        status: job.status === "assigned" ? "in_progress" : job.status,
        visit: {
          ...prevVisit,
          legal: {
            items,
            findings: parsed.data.findings,
            verdict: parsed.data.verdict || null,
            saved_at: savedAt,
          },
        },
        checklist,
      })
      .eq("id", jobId);
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/field", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[legal] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: failCode(e) };
  }
}

// ---------- media capture (photos/videos with provenance, brief §6) ----------
const mediaMetaSchema = z.object({
  device_lat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  device_lng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  note: z.string().trim().max(500).default(""),
  kind: z.enum(["photo", "video", "receipt"]),
  amount: z.string().trim().max(20).default(""),
});

export async function uploadMedia(
  jobId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user, job } = await requireFieldJob(jobId);
    const parsed = mediaMetaSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    // The file was uploaded by the browser straight to private storage;
    // claim it (owner, real type, size), reading EXIF before it's stripped.
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };

    // Replayed after a dropped connection? It is already stored.
    if (ref.clientRef) {
      const { data: dup } = await createAdminClient()
        .from("media")
        .select("id")
        .eq("client_ref", ref.clientRef)
        .eq("uploader_id", user.id)
        .maybeSingle();
      if (dup) {
        await discardIncoming(user.id, [ref]);
        return { ok: true };
      }
    }

    const f = await takeIncoming(user.id, ref, "staff-media");
    if (d.kind === "video" ? f.isImage : !f.isImage) {
      return { ok: false, error: "invalid" };
    }
    // Field staff: in-app camera only; time + GPS come from the moment of capture.
    const prov = captureProvenance(ref, f.exif, { requireCamera: true });
    const buffer = f.buffer;
    const contentType = f.contentType;
    const ext = f.ext;
    const takenAt = prov.takenAt;
    let gpsLat: number | null = prov.gpsLat;
    let gpsLng: number | null = prov.gpsLat === null ? null : prov.gpsLng;

    // Device GPS captured by the browser at upload time as fallback
    if (gpsLat === null && d.device_lat !== "" && d.device_lat !== undefined) {
      gpsLat = Number(d.device_lat);
      gpsLng = d.device_lng === "" || d.device_lng === undefined ? null : Number(d.device_lng);
    }

    // Distance to the stand pin; flag photos taken too far away
    const details = ((job.service_requests as unknown as { details?: Record<string, unknown> })
      ?.details ?? {}) as Record<string, unknown>;
    let distance: number | null = null;
    let flagged = false;
    if (
      typeof details.pin_lat === "number" &&
      typeof details.pin_lng === "number" &&
      gpsLat !== null &&
      gpsLng !== null
    ) {
      distance = Math.round(
        distanceMeters(details.pin_lat, details.pin_lng, gpsLat, gpsLng)
      );
      // Receipts are often bought in town — only site photos/video are flagged.
      flagged = d.kind !== "receipt" && distance > FAR_PHOTO_THRESHOLD_M;
    }

    const amountCents =
      d.kind === "receipt" && d.amount ? parseDollarsToCents(d.amount) : null;
    if (d.kind === "receipt" && amountCents === null) {
      return { ok: false, error: "invalid" };
    }

    const path = await storePrivate("media", `jobs/${jobId}`, buffer, contentType, ext);

    const { error } = await supabase.from("media").insert({
      job_id: jobId,
      request_id: job.request_id,
      uploader_id: user.id,
      kind: d.kind,
      storage_path: path,
      original_name: f.originalName,
      taken_at: takenAt,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_accuracy_m: prov.accuracy,
      capture_source: prov.source,
      client_ref: ref.clientRef ?? null,
      distance_from_pin_m: distance,
      flagged_far: flagged,
      amount_cents: amountCents,
      note: d.note,
    });
    if (error) {
      if (error.code === "23505") return { ok: true }; // same capture stored meanwhile
      return { ok: false, error: "db" };
    }

    revalidatePath("/[locale]/field", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[media] ${e instanceof Error ? e.message : e}`);
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? failCode(e) : code };
  }
}

// ---------- extra cost / extra trip → admin (brief §6) ----------
const extraCostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  reason: z.string().trim().min(3).max(2000),
  amount: z.string().trim().min(1).max(20),
});

export async function requestExtraCost(
  jobId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user, job } = await requireFieldJob(jobId);
    const parsed = extraCostSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const amountCents = parseDollarsToCents(parsed.data.amount);
    if (!amountCents) return { ok: false, error: "invalid" };

    const { error } = await supabase.from("extra_cost_requests").insert({
      job_id: jobId,
      request_id: job.request_id,
      requested_by: user.id,
      title: parsed.data.title,
      reason: parsed.data.reason,
      amount_cents: amountCents,
    });
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/field", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: failCode(e) };
  }
}

// ---------- draft report → admin, never the client (brief §6) ----------
const reportSchema = z.object({
  verdict: z.enum(["clear", "concerns", "red_flags"]).optional().or(z.literal("")),
  stand_details: z.string().trim().max(8000).default(""),
  legal_findings: z.string().trim().max(8000).default(""),
  council_confirmation: z.string().trim().max(8000).default(""),
  measurements: z.string().trim().max(8000).default(""),
  red_flags: z.string().trim().max(8000).default(""),
  next_steps: z.string().trim().max(8000).default(""),
  costs_summary: z.string().trim().max(8000).default(""),
  submit: z.string().optional(),
});

export async function saveReportDraft(
  jobId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user, job } = await requireFieldJob(jobId);
    const parsed = reportSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;
    const submitting = d.submit === "1";

    const sections = {
      stand_details: d.stand_details,
      legal_findings: d.legal_findings,
      council_confirmation: d.council_confirmation,
      measurements: d.measurements,
      red_flags: d.red_flags,
      next_steps: d.next_steps,
      costs_summary: d.costs_summary,
    };

    const { data: existing } = await supabase
      .from("reports")
      .select("id, status")
      .eq("job_id", jobId)
      .eq("author_id", user.id)
      .maybeSingle();

    if (existing) {
      if (!["draft", "changes_requested"].includes(existing.status)) {
        return { ok: false, error: "locked" };
      }
      const { error } = await supabase
        .from("reports")
        .update({
          sections,
          verdict: d.verdict || null,
          status: submitting ? "submitted" : "draft",
        })
        .eq("id", existing.id);
      if (error) return { ok: false, error: "db" };
    } else {
      const { error } = await supabase.from("reports").insert({
        request_id: job.request_id,
        job_id: jobId,
        author_id: user.id,
        status: "draft",
        verdict: d.verdict || null,
        sections,
      });
      if (error) return { ok: false, error: "db" };
      if (submitting) {
        const { error: subErr } = await supabase
          .from("reports")
          .update({ status: "submitted" })
          .eq("job_id", jobId)
          .eq("author_id", user.id);
        if (subErr) return { ok: false, error: "db" };
      }
    }

    if (submitting) {
      await supabase.from("jobs").update({ status: "submitted" }).eq("id", jobId);
    }
    revalidatePath("/[locale]/field", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[report-draft] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: failCode(e) };
  }
}
