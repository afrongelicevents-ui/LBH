"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUserProfile } from "@/lib/supabase/server";
import {
  IMAGE_TYPES,
  VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  extForType,
  readImageExif,
  reencodeImage,
  storePrivate,
} from "@/lib/uploads";
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
    .select("id, request_id, assigned_to, status, checklist, visit, service_requests(details)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.assigned_to !== user.id) throw new Error("job not found");
  return { supabase, user, job };
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
    return { ok: false, error: "error" };
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

    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "invalid" };

    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (d.kind === "video" ? !isVideo : !isImage) {
      return { ok: false, error: "invalid" };
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) return { ok: false, error: "toobig" };
    if (isVideo && file.size > MAX_VIDEO_BYTES) return { ok: false, error: "toobig" };

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    let ext = extForType(file.type);
    let takenAt: Date | null = null;
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;

    if (isImage) {
      // Read provenance BEFORE stripping (brief §11)
      const exif = await readImageExif(buffer);
      takenAt = exif.takenAt;
      gpsLat = exif.gpsLat;
      gpsLng = exif.gpsLng;
      buffer = await reencodeImage(buffer);
      contentType = "image/jpeg";
      ext = "jpg";
    }
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
      original_name: file.name.slice(0, 200),
      taken_at: takenAt?.toISOString() ?? null,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      distance_from_pin_m: distance,
      flagged_far: flagged,
      amount_cents: amountCents,
      note: d.note,
    });
    if (error) return { ok: false, error: "db" };

    revalidatePath("/[locale]/field", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[media] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
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
  } catch {
    return { ok: false, error: "error" };
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
    return { ok: false, error: "error" };
  }
}
