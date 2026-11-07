"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmPaymentByReference } from "@/lib/payments";
import { parseDollarsToCents } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import { parseUploadRefs, storeQuoteFile, uploadErrorCode } from "@/lib/uploads";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateAdmin() {
  revalidatePath("/[locale]/admin", "layout");
}

// ---------- bookings ----------
export async function setBookingStatus(
  bookingId: string,
  status: "confirmed" | "completed" | "cancelled"
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdminAction();
    const { error } = await supabase
      .from("call_bookings")
      .update({ status })
      .eq("id", bookingId);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", {
      p_action: `booking.${status}`,
      p_entity: "call_booking",
      p_entity_id: bookingId,
      p_data: {},
    });
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- quote builder (brief §8: service fee, travel = km × rate, lines) ----------
const quoteLineSchema = z.object({
  kind: z.enum(["service_fee", "travel", "other"]),
  description: z.string().trim().min(1).max(300),
  qty: z.coerce.number().positive().max(1000000),
  unit_cents: z.coerce.number().int().min(0).max(100000000),
});
const quoteSchema = z.object({
  request_id: z.string().uuid(),
  deposit_pct: z.coerce.number().int().min(1).max(100),
  notes: z.string().trim().max(2000).default(""),
  lines_json: z.string().max(20000),
  send: z.string().optional(),
});

export async function saveQuote(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const parsed = quoteSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    let lines: z.infer<typeof quoteLineSchema>[];
    try {
      lines = z.array(quoteLineSchema).min(1).max(50).parse(JSON.parse(d.lines_json));
    } catch {
      return { ok: false, error: "invalid" };
    }
    const withTotals = lines.map((l, i) => ({
      ...l,
      total_cents: Math.round(l.qty * l.unit_cents),
      position: i + 1,
    }));
    const total = withTotals.reduce((s, l) => s + l.total_cents, 0);
    if (total <= 0) return { ok: false, error: "invalid" };

    const sending = d.send === "1";
    const { data: quote, error } = await supabase
      .from("quotes")
      .insert({
        request_id: d.request_id,
        status: sending ? "sent" : "draft",
        deposit_pct: d.deposit_pct,
        total_cents: total,
        notes: d.notes,
        created_by: user.id,
        sent_at: sending ? new Date().toISOString() : null,
      })
      .select("id, quote_number")
      .single();
    if (error || !quote) return { ok: false, error: "db" };

    const { error: linesErr } = await supabase.from("quote_lines").insert(
      withTotals.map((l) => ({
        quote_id: quote.id,
        kind: l.kind,
        description: l.description,
        qty: l.qty,
        unit_cents: l.unit_cents,
        total_cents: l.total_cents,
        position: l.position,
      }))
    );
    if (linesErr) return { ok: false, error: "db" };

    if (sending) {
      await supabase
        .from("service_requests")
        .update({ status: "quote_sent" })
        .eq("id", d.request_id)
        .in("status", ["new", "call_booked"]);

      // notify client
      const { data: req } = await supabase
        .from("service_requests")
        .select("title, profiles:client_id(email, full_name)")
        .eq("id", d.request_id)
        .single();
      const client = req?.profiles as unknown as { email?: string; full_name?: string } | null;
      if (client?.email) {
        await sendEmail({
          to: client.email,
          subject: `LBH — your written quote #${quote.quote_number} is ready`,
          text: `Hi ${client.full_name ?? ""},\n\nYour written quote for "${req?.title}" is ready in your LBH portal:\n${site.url}\n\nNothing happens until you accept it.\n\nLBH — Let's Build Home`,
        });
      }
    }

    await supabase.rpc("admin_log_audit", {
      p_action: sending ? "quote.sent" : "quote.drafted",
      p_entity: "quote",
      p_entity_id: quote.id,
      p_data: { total_cents: total, deposit_pct: d.deposit_pct },
    });
    revalidateAdmin();
    return { ok: true, id: quote.id };
  } catch (e) {
    console.error(`[quote] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "auth" };
  }
}

export async function sendDraftQuote(quoteId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdminAction();
    const { data: q, error } = await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("status", "draft")
      .select("request_id")
      .single();
    if (error || !q) return { ok: false, error: "db" };
    await supabase
      .from("service_requests")
      .update({ status: "quote_sent" })
      .eq("id", q.request_id)
      .in("status", ["new", "call_booked"]);
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- assign field staff ----------
export async function assignStaff(
  requestId: string,
  staffId: string,
  jobType: "site_visit" | "title_check" = "site_visit",
  dueDate: string = ""
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!["site_visit", "title_check"].includes(jobType)) return { ok: false, error: "invalid" };
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) {
      return { ok: false, error: "invalid" };
    }
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, role, staff_kind")
      .eq("id", staffId)
      .single();
    if (!staff || staff.role !== "field") return { ok: false, error: "invalid" };
    // title checks go to a lawyer; site visits to a field agent
    if ((jobType === "title_check") !== (staff.staff_kind === "lawyer")) {
      return { ok: false, error: "wrongKind" };
    }
    const { data: dup } = await supabase
      .from("jobs")
      .select("id")
      .eq("request_id", requestId)
      .eq("assigned_to", staffId)
      .eq("job_type", jobType)
      .limit(1);
    if (dup && dup.length > 0) return { ok: false, error: "alreadyAssigned" };

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        request_id: requestId,
        assigned_to: staffId,
        job_type: jobType,
        due_date: dueDate || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !job) return { ok: false, error: "db" };

    await supabase
      .from("service_requests")
      .update({ status: "on_site" })
      .eq("id", requestId)
      .eq("status", "deposit_paid");

    await supabase.rpc("admin_log_audit", {
      p_action: "job.assigned",
      p_entity: "job",
      p_entity_id: job.id,
      p_data: { request_id: requestId, assigned_to: staffId, job_type: jobType, due_date: dueDate || null },
    });
    revalidateAdmin();
    return { ok: true, id: job.id };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- extra costs: forward to client / reject ----------
export async function forwardExtraCost(ecrId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const { data: ecr, error } = await supabase
      .from("extra_cost_requests")
      .update({ status: "forwarded" })
      .eq("id", ecrId)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error || !ecr) return { ok: false, error: "db" };

    const { error: aprErr } = await supabase.from("approvals").insert({
      request_id: ecr.request_id,
      extra_cost_request_id: ecr.id,
      title: ecr.title,
      reason: ecr.reason,
      field_note: ecr.reason,
      amount_cents: ecr.amount_cents,
      created_by: user.id,
    });
    if (aprErr) {
      // put it back so admin can try again
      await supabase.from("extra_cost_requests").update({ status: "pending" }).eq("id", ecr.id);
      return { ok: false, error: "db" };
    }

    const { data: req } = await supabase
      .from("service_requests")
      .select("title, profiles:client_id(email, full_name)")
      .eq("id", ecr.request_id)
      .single();
    const client = req?.profiles as unknown as { email?: string; full_name?: string } | null;
    if (client?.email) {
      await sendEmail({
        to: client.email,
        subject: "LBH — approval needed before we continue",
        text: `Hi ${client.full_name ?? ""},\n\nAn extra cost needs your approval for "${req?.title}": ${ecr.title} — $${(ecr.amount_cents / 100).toFixed(2)}.\n\nNothing proceeds until you approve or decline it in your portal:\n${site.url}\n\nLBH — Let's Build Home`,
      });
    }

    await supabase.rpc("admin_log_audit", {
      p_action: "extra_cost.forwarded",
      p_entity: "extra_cost_request",
      p_entity_id: ecrId,
      p_data: { amount_cents: ecr.amount_cents },
    });
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function rejectExtraCost(ecrId: string, note: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdminAction();
    const { error } = await supabase
      .from("extra_cost_requests")
      .update({ status: "rejected", admin_note: note.slice(0, 1000) })
      .eq("id", ecrId)
      .eq("status", "pending");
    if (error) return { ok: false, error: "db" };
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- supplier quotes (materials) ----------
const supplierSchema = z.object({
  request_id: z.string().uuid(),
  supplier_name: z.string().trim().min(2).max(200),
  amount: z.string().trim().min(1).max(20),
  details: z.string().trim().max(2000).default(""),
});

export async function addSupplierQuote(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const parsed = supplierSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const cents = parseDollarsToCents(parsed.data.amount);
    if (!cents) return { ok: false, error: "invalid" };
    // Optional: photo/PDF of the supplier's own quote
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    const filePath = ref ? await storeQuoteFile(user.id, ref, parsed.data.request_id) : null;
    const { error } = await supabase.from("supplier_quotes").insert({
      request_id: parsed.data.request_id,
      supplier_name: parsed.data.supplier_name,
      amount_cents: cents,
      details: parsed.data.details,
      file_path: filePath,
    });
    if (error) return { ok: false, error: "db" };
    revalidateAdmin();
    return { ok: true };
  } catch (e) {
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? "auth" : code };
  }
}

// ---------- report review: changes / publish (no self sign-off) ----------
export async function requestReportChanges(
  reportId: string,
  note: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdminAction();
    const { error } = await supabase
      .from("reports")
      .update({ status: "changes_requested", review_note: note.slice(0, 2000) })
      .eq("id", reportId)
      .eq("status", "submitted");
    if (error) return { ok: false, error: "db" };
    // The job goes back to the field user's "In progress" list
    const { data: rep } = await supabase.from("reports").select("job_id").eq("id", reportId).single();
    if (rep?.job_id) {
      await supabase.from("jobs").update({ status: "in_progress" }).eq("id", rep.job_id).eq("status", "submitted");
    }
    await supabase.rpc("admin_log_audit", {
      p_action: "report.changes_requested",
      p_entity: "report",
      p_entity_id: reportId,
      p_data: {},
    });
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function publishReport(reportId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();

    // The reports_guard trigger enforces publisher ≠ author and verdict set;
    // this update runs as the admin user so auth.uid() is correct.
    const { data: report, error } = await supabase
      .from("reports")
      .update({ status: "published" })
      .eq("id", reportId)
      .in("status", ["submitted", "changes_requested", "draft"])
      .select("id, request_id, author_id, job_id")
      .single();
    if (error || !report) {
      return { ok: false, error: error?.message.includes("own author") ? "self" : "db" };
    }
    if (report.job_id) {
      await supabase.from("jobs").update({ status: "completed" }).eq("id", report.job_id);
    }

    await supabase
      .from("service_requests")
      .update({ status: "report_ready" })
      .eq("id", report.request_id);

    // Create the balance payment + invoice (quote total − confirmed payments)
    const admin = createAdminClient();
    const { data: quote } = await admin
      .from("quotes")
      .select("id, quote_number, total_cents, deposit_pct")
      .eq("request_id", report.request_id)
      .eq("status", "accepted")
      .maybeSingle();
    if (quote) {
      const { data: paid } = await admin
        .from("payments")
        .select("amount_cents")
        .eq("request_id", report.request_id)
        .eq("status", "confirmed")
        .in("kind", ["deposit", "balance"]);
      const paidTotal = (paid ?? []).reduce((s, p) => s + p.amount_cents, 0);
      const { data: existingBalance } = await admin
        .from("payments")
        .select("id")
        .eq("request_id", report.request_id)
        .eq("kind", "balance")
        .in("status", ["pending", "submitted", "confirmed"])
        .maybeSingle();
      const balance = quote.total_cents - paidTotal;
      if (balance > 0 && !existingBalance) {
        const ref = `LBH-${quote.quote_number}-BAL-${Math.random().toString(36).slice(2, 10)}`;
        const { data: pay } = await admin
          .from("payments")
          .insert({
            request_id: report.request_id,
            quote_id: quote.id,
            kind: "balance",
            method: "paynow",
            status: "pending",
            amount_cents: balance,
            merchant_reference: ref,
          })
          .select("id")
          .single();
        if (pay) {
          await admin.from("invoices").insert({
            request_id: report.request_id,
            quote_id: quote.id,
            payment_id: pay.id,
            kind: "balance",
            amount_cents: balance,
            details: { quote_number: quote.quote_number },
          });
        }
      }
    }

    // notify client
    const { data: req } = await supabase
      .from("service_requests")
      .select("title, profiles:client_id(email, full_name)")
      .eq("id", report.request_id)
      .single();
    const client = req?.profiles as unknown as { email?: string; full_name?: string } | null;
    if (client?.email) {
      await sendEmail({
        to: client.email,
        subject: "LBH — your report is ready",
        text: `Hi ${client.full_name ?? ""},\n\nYour report for "${req?.title}" has been reviewed and published. Read it in your portal:\n${site.url}\n\nLBH — Let's Build Home`,
      });
    }

    await supabase.rpc("admin_log_audit", {
      p_action: "report.published",
      p_entity: "report",
      p_entity_id: reportId,
      p_data: { published_by: user.id, author_id: report.author_id },
    });
    revalidateAdmin();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[publish] ${msg}`);
    return { ok: false, error: msg.includes("own author") ? "self" : "auth" };
  }
}

// ---------- payments: confirm manual proof ----------
export async function confirmManualPayment(paymentId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const { data: payment } = await supabase
      .from("payments")
      .select("merchant_reference, status")
      .eq("id", paymentId)
      .single();
    if (!payment || payment.status !== "submitted") {
      return { ok: false, error: "invalid" };
    }
    const res = await confirmPaymentByReference(payment.merchant_reference, {
      confirmedBy: user.id,
      viaWebhook: false,
    });
    if (res !== "confirmed") return { ok: false, error: "db" };
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- request lifecycle ----------
export async function setRequestStatus(
  requestId: string,
  status: "call_booked" | "done" | "cancelled"
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdminAction();
    const { error } = await supabase
      .from("service_requests")
      .update({ status })
      .eq("id", requestId);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", {
      p_action: `request.${status}`,
      p_entity: "service_request",
      p_entity_id: requestId,
      p_data: {},
    });
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- settings ----------
const settingsSchema = z.object({
  per_km_rate: z.string().trim().max(20),
  deposit_pct: z.coerce.number().int().min(1).max(100),
  whatsapp_number: z.string().trim().regex(/^[0-9]{6,15}$/),
  contact_email: z.string().trim().email().max(254),
  call_slots: z.string().max(10000),
  banned_words: z.string().max(5000),
});

export async function saveSettings(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;
    const rate = parseDollarsToCents(d.per_km_rate);
    if (rate === null) return { ok: false, error: "invalid" };

    let slots: unknown = [];
    try {
      slots = d.call_slots
        ? d.call_slots
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((label, i) => ({ id: `slot-${i + 1}`, label: label.slice(0, 120) }))
        : [];
    } catch {
      return { ok: false, error: "invalid" };
    }

    const { error } = await supabase
      .from("settings")
      .update({
        per_km_rate_cents: rate,
        deposit_pct: d.deposit_pct,
        whatsapp_number: d.whatsapp_number,
        contact_email: d.contact_email,
        call_slots: slots,
        banned_words: d.banned_words
          .split(",")
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", {
      p_action: "settings.updated",
      p_entity: "settings",
      p_entity_id: "1",
      p_data: {},
    });
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- staff invitation ----------
const staffSchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["field", "lawyer", "admin"]),
});

export async function inviteStaff(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const parsed = staffSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: d.email.toLowerCase(),
      email_confirm: false,
      // a lawyer is a field user who sees the Lawyer Portal
      app_metadata: d.role === "lawyer" ? { role: "field", staff_kind: "lawyer" } : { role: d.role },
      user_metadata: { full_name: d.full_name },
    });
    if (error) return { ok: false, error: "exists" };

    const { data: link } = await admin.auth.admin.generateLink({
      type: "invite",
      email: d.email.toLowerCase(),
      options: { redirectTo: `${site.url}/account/password` },
    });
    await sendEmail({
      to: d.email,
      subject: "LBH — your staff account",
      text: `Hi ${d.full_name},\n\nAn LBH ${d.role} account was created for you. Set your password here:\n${link?.properties?.action_link ?? site.url}\n\nYou will be asked to set up two-factor authentication on first login.\n\nLBH`,
    });

    await supabase.rpc("admin_log_audit", {
      p_action: "staff.invited",
      p_entity: "profile",
      p_entity_id: created.user.id,
      p_data: { role: d.role, invited_by: user.id },
    });
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- translation review ----------
export async function markTranslationReviewed(
  locale: string,
  messageKey: string,
  reviewed: boolean
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const { error } = await supabase.from("translation_reviews").upsert({
      locale,
      message_key: messageKey,
      reviewed,
      reviewed_by: reviewed ? user.id : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
    });
    if (error) return { ok: false, error: "db" };
    revalidateAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
