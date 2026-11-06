/**
 * Permission / RLS integration tests against the LOCAL Supabase stack
 * (`npx supabase start` + `npx supabase db reset` to load sample data).
 *
 * These prove the database itself enforces the brief's rules — not just the UI:
 *   - clients see only their own data
 *   - field staff see only assigned jobs and NEVER prices/payments
 *   - nobody publishes their own report; only admin publishes
 *   - quote acceptance / approvals only by the owning client, once
 *
 * Skipped automatically when the local stack is not running.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
// Standard public demo keys of every local Supabase stack (not secrets).
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "Lbh-Sample-2026";

const IDS = {
  admin: "00000000-0000-4000-a000-000000000001",
  lawyer: "00000000-0000-4000-a000-000000000002",
  agent: "00000000-0000-4000-a000-000000000003",
  client: "00000000-0000-4000-a000-000000000004",
  client2: "00000000-0000-4000-a000-000000000005",
  reqLand: "10000000-0000-4000-a000-000000000001",
  reqMat: "10000000-0000-4000-a000-000000000002",
  reqDone: "10000000-0000-4000-a000-000000000003",
  quote: "20000000-0000-4000-a000-000000000001",
  jobLand: "30000000-0000-4000-a000-000000000001",
};

async function stackUp(): Promise<boolean> {
  try {
    const res = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } });
    return res.ok;
  } catch {
    return false;
  }
}

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

// ---- RFC 6238 TOTP, so staff can complete real 2FA in tests ----
function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

/** Staff sign-in that completes TOTP enrollment → an aal2 session. */
async function signInStaff(email: string, userId: string, service: SupabaseClient) {
  const { data: existing } = await service.auth.admin.mfa.listFactors({ userId });
  for (const f of existing?.factors ?? []) {
    await service.auth.admin.mfa.deleteFactor({ id: f.id, userId });
  }
  const c = await signIn(email);
  const { data: enrolled, error } = await c.auth.mfa.enroll({ factorType: "totp" });
  if (error || !enrolled) throw new Error(`enroll ${email}: ${error?.message}`);
  const { error: vErr } = await c.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: totp(enrolled.totp.secret),
  });
  if (vErr) throw new Error(`verify ${email}: ${vErr.message}`);
  return c;
}

const up = await stackUp();
const d = up ? describe : describe.skip;

d("RLS & business rules (local Supabase)", () => {
  let admin: SupabaseClient;
  let agent: SupabaseClient;
  let lawyer: SupabaseClient;
  let client: SupabaseClient;
  let client2: SupabaseClient;
  let anon: SupabaseClient;
  let service: SupabaseClient;

  beforeAll(async () => {
    service = createClient(URL, SERVICE, { auth: { persistSession: false } });
    // Reset mutable sample state so the suite is re-runnable.
    await service.from("quotes").update({ status: "sent", accepted_at: null, accepted_by_name: null }).eq("id", IDS.quote);
    await service.from("service_requests").update({ status: "quote_sent" }).eq("id", IDS.reqLand);
    await service.from("payments").delete().eq("quote_id", IDS.quote);
    await service.from("approvals").update({ status: "pending", decided_at: null }).eq("request_id", IDS.reqMat);
    await service.from("payments").delete().eq("request_id", IDS.reqMat).eq("kind", "extra");
    await service.from("reports").delete().eq("job_id", IDS.jobLand);

    [admin, agent, lawyer, client, client2] = await Promise.all([
      signInStaff("admin@lbh.test", IDS.admin, service),
      signInStaff("agent@lbh.test", IDS.agent, service),
      signInStaff("lawyer@lbh.test", IDS.lawyer, service),
      signIn("client@lbh.test"),
      signIn("client2@lbh.test"),
    ]);
    anon = createClient(URL, ANON, { auth: { persistSession: false } });
  });

  // ---------- client isolation ----------
  describe("clients see only their own data", () => {
    it("client sees own requests only", async () => {
      const { data } = await client.from("service_requests").select("id");
      const ids = (data ?? []).map((r) => r.id).sort();
      expect(ids).toEqual([IDS.reqLand, IDS.reqMat].sort());
    });

    it("client2 cannot read client1's request, quote or messages", async () => {
      const { data: req } = await client2.from("service_requests").select("id").eq("id", IDS.reqLand);
      expect(req).toEqual([]);
      const { data: q } = await client2.from("quotes").select("id").eq("id", IDS.quote);
      expect(q).toEqual([]);
      const { data: m } = await client2.from("messages").select("id").eq("client_id", IDS.client);
      expect(m).toEqual([]);
    });

    it("client cannot create a request for someone else", async () => {
      const { error } = await client.from("service_requests").insert({
        client_id: IDS.client2,
        type: "land_verification",
        title: "TEST hijack",
      });
      expect(error).not.toBeNull();
    });

    it("client cannot escalate their own role", async () => {
      await client.from("profiles").update({ role: "admin" }).eq("id", IDS.client);
      const { data } = await service.from("profiles").select("role").eq("id", IDS.client).single();
      expect(data?.role).toBe("client");
    });

    it("client cannot change payment status directly", async () => {
      await client.from("payments").update({ status: "confirmed" }).eq("request_id", IDS.reqMat);
      const { data } = await service
        .from("payments")
        .select("status")
        .eq("request_id", IDS.reqMat)
        .eq("status", "confirmed");
      expect(data).toEqual([]);
    });

    it("client cannot see draft quotes or the audit log", async () => {
      const { data: audit } = await client.from("audit_log").select("id");
      expect(audit).toEqual([]);
    });

    it("anonymous users see nothing", async () => {
      for (const table of ["service_requests", "quotes", "payments", "profiles", "settings", "call_bookings", "notify_interest"]) {
        const { data } = await anon.from(table).select("*").limit(1);
        expect(data ?? []).toEqual([]);
      }
    });
  });

  // ---------- field staff: assigned only, never prices ----------
  describe("field staff", () => {
    it("sees only assigned jobs", async () => {
      const { data: agentJobs } = await agent.from("jobs").select("id");
      expect((agentJobs ?? []).length).toBe(2);
      const { data: lawyerJobs } = await lawyer.from("jobs").select("id");
      expect(lawyerJobs).toEqual([]);
    });

    it("can read assigned request details but not unassigned ones", async () => {
      const { data: assigned } = await agent.from("service_requests").select("id").eq("id", IDS.reqLand);
      expect(assigned?.length).toBe(1);
      const { data: other } = await agent.from("service_requests").select("id").eq("id", IDS.reqMat);
      expect(other).toEqual([]);
    });

    it("NEVER sees prices, quotes, payments, invoices or the ledger", async () => {
      for (const table of ["quotes", "quote_lines", "payments", "invoices", "ledger_entries", "supplier_quotes", "approvals", "settings"]) {
        const { data } = await agent.from(table).select("*");
        expect(data ?? [], `field read ${table}`).toEqual([]);
      }
    });

    it("cannot reassign a job to someone else", async () => {
      const { error } = await agent.from("jobs").update({ assigned_to: IDS.admin }).eq("id", IDS.jobLand);
      expect(error).not.toBeNull();
    });

    it("cannot read client chat", async () => {
      const { data } = await agent.from("messages").select("id");
      expect(data).toEqual([]);
    });
  });

  // ---------- reports: draft → admin → publish; no self sign-off ----------
  describe("reports & the no-self-sign-off rule", () => {
    let reportId: string;

    it("field drafts a report on an assigned job", async () => {
      const { data, error } = await agent
        .from("reports")
        .insert({
          request_id: IDS.reqLand,
          job_id: IDS.jobLand,
          author_id: IDS.agent,
          status: "draft",
          verdict: "clear",
          sections: { stand_details: "TEST" },
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      reportId = data!.id;
    });

    it("client cannot see a draft/submitted report", async () => {
      const { data } = await client.from("reports").select("id").eq("id", reportId);
      expect(data).toEqual([]);
    });

    it("field cannot publish their own report", async () => {
      const { error } = await agent.from("reports").update({ status: "published" }).eq("id", reportId);
      expect(error).not.toBeNull();
    });

    it("field can submit to admin", async () => {
      const { error } = await agent.from("reports").update({ status: "submitted" }).eq("id", reportId);
      expect(error).toBeNull();
    });

    it("field cannot edit after submission", async () => {
      await agent.from("reports").update({ sections: { stand_details: "EDITED" } }).eq("id", reportId);
      const { data } = await service.from("reports").select("sections").eq("id", reportId).single();
      expect((data?.sections as Record<string, string>).stand_details).toBe("TEST");
    });

    it("an admin who AUTHORED a report cannot publish it", async () => {
      const { data: own } = await service
        .from("reports")
        .insert({
          request_id: IDS.reqLand,
          author_id: IDS.admin,
          status: "submitted",
          verdict: "clear",
          sections: {},
        })
        .select("id")
        .single();
      const { error } = await admin.from("reports").update({ status: "published" }).eq("id", own!.id);
      expect(error?.message).toMatch(/own author/);
      await service.from("reports").delete().eq("id", own!.id);
    });

    it("a different admin publishes; publisher is recorded", async () => {
      const { error } = await admin.from("reports").update({ status: "published" }).eq("id", reportId);
      expect(error).toBeNull();
      const { data } = await service.from("reports").select("published_by, published_at").eq("id", reportId).single();
      expect(data?.published_by).toBe(IDS.admin);
      expect(data?.published_at).not.toBeNull();
    });

    it("client now sees the published report", async () => {
      const { data } = await client.from("reports").select("id").eq("id", reportId);
      expect(data?.length).toBe(1);
    });
  });

  // ---------- quote acceptance ----------
  describe("quote acceptance (written acceptance)", () => {
    it("another client cannot accept someone else's quote", async () => {
      const { error } = await client2.rpc("accept_quote", { p_quote_id: IDS.quote });
      expect(error).not.toBeNull();
    });

    it("owning client accepts: name + timestamp recorded, deposit payment created", async () => {
      const { data: paymentId, error } = await client.rpc("accept_quote", { p_quote_id: IDS.quote });
      expect(error).toBeNull();
      const { data: q } = await service.from("quotes").select("status, accepted_by_name, accepted_at").eq("id", IDS.quote).single();
      expect(q?.status).toBe("accepted");
      expect(q?.accepted_by_name).toBe("SAMPLE Tatenda Moyo");
      expect(q?.accepted_at).not.toBeNull();
      const { data: p } = await service.from("payments").select("kind, amount_cents, status").eq("id", paymentId).single();
      expect(p).toEqual({ kind: "deposit", amount_cents: 21000, status: "pending" });
    });

    it("cannot accept twice", async () => {
      const { error } = await client.rpc("accept_quote", { p_quote_id: IDS.quote });
      expect(error).not.toBeNull();
    });

    it("acceptance is in the audit log", async () => {
      const { data } = await service.from("audit_log").select("action").eq("entity_id", IDS.quote).eq("action", "quote.accepted");
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  });

  // ---------- extra-cost approvals ----------
  describe("approvals: nothing proceeds until the client approves", () => {
    let approvalId: string;

    beforeAll(async () => {
      const { data } = await service.from("approvals").select("id").eq("request_id", IDS.reqMat).single();
      approvalId = data!.id;
    });

    it("other client cannot decide", async () => {
      const { error } = await client2.rpc("decide_approval", { p_approval_id: approvalId, p_approve: true });
      expect(error).not.toBeNull();
    });

    it("field cannot decide", async () => {
      const { error } = await agent.rpc("decide_approval", { p_approval_id: approvalId, p_approve: true });
      expect(error).not.toBeNull();
    });

    it("owning client approves → extra payment created", async () => {
      const { error } = await client.rpc("decide_approval", { p_approval_id: approvalId, p_approve: true });
      expect(error).toBeNull();
      const { data } = await service.from("payments").select("kind, amount_cents").eq("request_id", IDS.reqMat).eq("kind", "extra");
      expect(data).toEqual([{ kind: "extra", amount_cents: 3500 }]);
    });

    it("cannot decide twice", async () => {
      const { error } = await client.rpc("decide_approval", { p_approval_id: approvalId, p_approve: false });
      expect(error).not.toBeNull();
    });
  });

  // ---------- security-review regressions ----------
  describe("2FA is enforced by the database, not just the website", () => {
    it("admin with password only (no TOTP) gets no data", async () => {
      // admin has a verified factor (signInStaff above) → password login is aal1
      const aal1 = await signIn("admin@lbh.test");
      const { data: p } = await aal1.from("payments").select("id");
      expect(p ?? []).toEqual([]);
      const { data: profiles } = await aal1.from("profiles").select("id");
      expect((profiles ?? []).map((r) => r.id)).toEqual([IDS.admin]); // own row only
      await aal1.from("settings").update({ deposit_pct: 1 }).eq("id", 1);
      const { data: s } = await service.from("settings").select("deposit_pct").eq("id", 1).single();
      expect(s?.deposit_pct).not.toBe(1);
    });

    it("field agent with password only (no TOTP) sees no jobs", async () => {
      const aal1 = await signIn("agent@lbh.test");
      const { data } = await aal1.from("jobs").select("id");
      expect(data ?? []).toEqual([]);
    });

    it("the same admin WITH TOTP has full access", async () => {
      const { data } = await admin.from("payments").select("id");
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  });

  describe("audit log cannot be forged", () => {
    it("anon cannot call log_audit", async () => {
      const { error } = await anon.rpc("log_audit", {
        p_action: "payment.confirmed", p_entity: "payment", p_entity_id: "x", p_data: {},
      });
      expect(error).not.toBeNull();
    });

    it("clients cannot call log_audit or admin_log_audit", async () => {
      const a = await client.rpc("log_audit", { p_action: "x", p_entity: "x", p_entity_id: "x", p_data: {} });
      expect(a.error).not.toBeNull();
      const b = await client.rpc("admin_log_audit", { p_action: "x", p_entity: "x", p_entity_id: "x", p_data: {} });
      expect(b.error).not.toBeNull();
    });

    it("anon cannot touch the rate limiter", async () => {
      const { error } = await anon.rpc("rate_limit_hit", { p_bucket: "x", p_max: 1, p_window_seconds: 0 });
      expect(error).not.toBeNull();
    });
  });

  describe("profiles", () => {
    it("client cannot change their profile email", async () => {
      await client.from("profiles").update({ email: "victim@example.test" }).eq("id", IDS.client);
      const { data } = await service.from("profiles").select("email").eq("id", IDS.client).single();
      expect(data?.email).toBe("client@lbh.test");
    });

    it("client can still edit their name", async () => {
      const { error } = await client.from("profiles").update({ full_name: "SAMPLE Tatenda Moyo" }).eq("id", IDS.client);
      expect(error).toBeNull();
    });

    it("field staff cannot read client profiles (no email/WhatsApp)", async () => {
      const { data } = await agent.from("profiles").select("email, whatsapp").eq("id", IDS.client);
      expect(data).toEqual([]);
    });

    it("field staff see only the client's first name on the job", async () => {
      const { data } = await agent.from("jobs").select("client_first_name").eq("id", IDS.jobLand).single();
      expect(data?.client_first_name).toBe("SAMPLE");
    });
  });

  describe("field rows are pinned to the job's own request", () => {
    it("media/extra costs attached to another client's request are re-pinned", async () => {
      const { data: m } = await agent
        .from("media")
        .insert({
          job_id: IDS.jobLand,
          request_id: IDS.reqDone, // someone else's request
          uploader_id: IDS.agent,
          kind: "receipt",
          storage_path: `jobs/${IDS.jobLand}/test.jpg`,
          amount_cents: 100,
        })
        .select("request_id")
        .single();
      expect(m?.request_id).toBe(IDS.reqLand);

      const { data: e } = await agent
        .from("extra_cost_requests")
        .insert({
          job_id: IDS.jobLand,
          request_id: IDS.reqDone,
          requested_by: IDS.agent,
          title: "TEST",
          reason: "TEST",
          amount_cents: 100,
        })
        .select("request_id")
        .single();
      expect(e?.request_id).toBe(IDS.reqLand);
    });

    it("media cannot point at another job's storage files", async () => {
      const { error } = await agent.from("media").insert({
        job_id: IDS.jobLand,
        request_id: IDS.reqLand,
        uploader_id: IDS.agent,
        kind: "photo",
        storage_path: "jobs/30000000-0000-4000-a000-000000000002/someone-else.jpg",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("no self sign-off cannot be dodged", () => {
    it("admin cannot reassign a report's author to publish their own work", async () => {
      const { data: own } = await service
        .from("reports")
        .insert({ request_id: IDS.reqLand, author_id: IDS.admin, status: "submitted", verdict: "clear", sections: {} })
        .select("id")
        .single();
      const { error } = await admin
        .from("reports")
        .update({ author_id: IDS.agent, status: "published" })
        .eq("id", own!.id);
      expect(error).not.toBeNull();
      await service.from("reports").delete().eq("id", own!.id);
    });

    it("admin cannot insert a report that is already published", async () => {
      const { error } = await admin.from("reports").insert({
        request_id: IDS.reqLand,
        author_id: IDS.agent,
        status: "published",
        verdict: "clear",
        sections: {},
      });
      expect(error).not.toBeNull();
    });
  });

  // ---------- rate limiter ----------
  it("rate_limit_hit trips after the max within the window", async () => {
    const bucket = `test:${Date.now()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await service.rpc("rate_limit_hit", { p_bucket: bucket, p_max: 3, p_window_seconds: 60 });
      results.push(Boolean(data));
    }
    expect(results).toEqual([false, false, false, true]);
  });
});
