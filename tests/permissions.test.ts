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
      const { data } = await client.from("service_requests").select("id, client_id");
      const ids = (data ?? []).map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([IDS.reqLand, IDS.reqMat]));
      expect(ids).not.toContain(IDS.reqDone); // client2's
      expect((data ?? []).every((r) => r.client_id === IDS.client)).toBe(true);
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
      const { data: agentJobs } = await agent.from("jobs").select("id, assigned_to");
      expect((agentJobs ?? []).length).toBeGreaterThanOrEqual(2);
      expect((agentJobs ?? []).every((j) => j.assigned_to === IDS.agent)).toBe(true);
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
          storage_path: `jobs/${IDS.jobLand}/${crypto.randomUUID()}.jpg`,
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

  // ---------- construction build stages ----------
  describe("build stages: strict order, client decides, buyer never inspects", () => {
    let req: string, s1: string, s2: string, s3: string, quoteA: string;

    beforeAll(async () => {
      req = crypto.randomUUID();
      [s1, s2, s3] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
      await service.from("service_requests").insert({
        id: req, client_id: IDS.client, type: "build", status: "on_site", title: "TEST build " + req.slice(0, 6),
      });
      await service.from("jobs").insert({ request_id: req, assigned_to: IDS.agent, created_by: IDS.admin });
      const { error } = await service.from("build_stages").insert([
        { id: s1, request_id: req, position: 1, name: "Foundation", status: "locked" },
        { id: s2, request_id: req, position: 2, name: "Slab", status: "locked" },
        { id: s3, request_id: req, position: 3, name: "Window level", status: "locked" },
      ]);
      if (error) throw new Error(error.message);
    });

    it("admin starts the build → first stage opens for quotes", async () => {
      const { error } = await admin.rpc("start_build", { p_request_id: req });
      expect(error).toBeNull();
      const { data } = await service.from("build_stages").select("status").eq("id", s1).single();
      expect(data?.status).toBe("quoting");
    });

    it("locked stages can't be bought for (no quotes on a locked stage)", async () => {
      const { error } = await admin.from("stage_quotes").insert({ stage_id: s2, request_id: req, supplier_name: "X", amount_cents: 100 });
      expect(error).not.toBeNull();
    });

    it("admin adds supplier quotes to the current stage", async () => {
      const { data, error } = await admin.from("stage_quotes")
        .insert({ stage_id: s1, request_id: req, supplier_name: "TEST Supplier A", amount_cents: 50000, items: "Cement x 10" })
        .select("id").single();
      expect(error).toBeNull();
      quoteA = data!.id;
      await admin.from("stage_quotes").insert({ stage_id: s1, request_id: req, supplier_name: "TEST Supplier B", amount_cents: 55000 });
    });

    it("field staff see the stages but NEVER the quote prices; others see nothing", async () => {
      const { data: st } = await agent.from("build_stages").select("id").eq("request_id", req);
      expect(st?.length).toBe(3);
      const { data: q } = await agent.from("stage_quotes").select("amount_cents").eq("request_id", req);
      expect(q ?? []).toEqual([]);
      const { data: other } = await lawyer.from("build_stages").select("id").eq("request_id", req);
      expect(other ?? []).toEqual([]);
      const { data: c2 } = await client2.from("build_stages").select("id").eq("request_id", req);
      expect(c2 ?? []).toEqual([]);
    });

    it("admin cannot approve a quote or skip steps for the client", async () => {
      const { error: e1 } = await admin.from("stage_quotes").update({ status: "approved" }).eq("id", quoteA);
      expect(e1).not.toBeNull();
      const { error: e2 } = await admin.from("build_stages").update({ status: "quote_approved" }).eq("id", s1);
      expect(e2).not.toBeNull();
    });

    it("another client cannot approve this client's quote", async () => {
      const { error } = await client2.rpc("approve_stage_quote", { p_quote_id: quoteA });
      expect(error).not.toBeNull();
    });

    it("client approves ONE quote → materials payment created, other quote rejected", async () => {
      const { data: paymentId, error } = await client.rpc("approve_stage_quote", { p_quote_id: quoteA });
      expect(error).toBeNull();
      const { data: p } = await service.from("payments").select("kind, amount_cents, stage_id, status").eq("id", paymentId).single();
      expect(p).toEqual({ kind: "materials", amount_cents: 50000, stage_id: s1, status: "pending" });
      const { data: qs } = await service.from("stage_quotes").select("status").eq("stage_id", s1).order("amount_cents");
      expect(qs?.map((q) => q.status)).toEqual(["approved", "rejected"]);
    });

    it("nothing can be bought before the client has paid", async () => {
      const { error } = await agent.from("stage_purchases").insert({ stage_id: s1, request_id: req, purchased_by: IDS.agent, supplier_name: "X", amount_cents: 1 });
      expect(error).not.toBeNull();
    });

    it("payment confirmed (server) → stage paid", async () => {
      const { error } = await service.from("build_stages").update({ status: "paid" }).eq("id", s1);
      expect(error).toBeNull();
    });

    it("field agent buys the materials with a receipt photo → purchased", async () => {
      const { data: m, error: mErr } = await agent.from("media").insert({
        stage_id: s1, request_id: req, uploader_id: IDS.agent, kind: "receipt",
        storage_path: `stages/${s1}/${crypto.randomUUID()}.jpg`, amount_cents: 50000,
      }).select("id").single();
      expect(mErr).toBeNull();
      const { error } = await agent.from("stage_purchases").insert({
        stage_id: s1, request_id: req, purchased_by: IDS.admin /* forged */, supplier_name: "TEST Supplier A",
        amount_cents: 50000, receipt_media_id: m!.id,
      });
      expect(error).toBeNull();
      const { data: pur } = await service.from("stage_purchases").select("purchased_by").eq("stage_id", s1).single();
      expect(pur?.purchased_by).toBe(IDS.agent); // buyer is always the real user
      const { data: st } = await service.from("build_stages").select("status").eq("id", s1).single();
      expect(st?.status).toBe("purchased");
    });

    it("can't mark delivered without a delivery photo", async () => {
      const { error } = await agent.rpc("advance_stage_work", { p_stage_id: s1, p_to: "delivered" });
      expect(error).not.toBeNull();
    });

    it("delivery photo → delivered → builders working", async () => {
      await agent.from("media").insert({ stage_id: s1, request_id: req, uploader_id: IDS.agent, kind: "delivery", storage_path: `stages/${s1}/${crypto.randomUUID()}.jpg` });
      expect((await agent.rpc("advance_stage_work", { p_stage_id: s1, p_to: "delivered" })).error).toBeNull();
      expect((await agent.rpc("advance_stage_work", { p_stage_id: s1, p_to: "building" })).error).toBeNull();
    });

    it("the person who bought the materials CANNOT inspect the stage", async () => {
      await agent.from("media").insert({ stage_id: s1, request_id: req, uploader_id: IDS.agent, kind: "inspection", storage_path: `stages/${s1}/${crypto.randomUUID()}.jpg` });
      const { error } = await agent.from("stage_inspections").insert({
        stage_id: s1, request_id: req, inspector_id: IDS.agent, notes: "x",
        materials_used: [{ item: "Cement", quantity: "10" }],
      });
      expect(error?.message).toMatch(/bought/);
    });

    it("client cannot approve a stage before it is inspected", async () => {
      const { error } = await client.rpc("approve_stage", { p_stage_id: s1 });
      expect(error).not.toBeNull();
    });

    it("inspection needs the full materials list", async () => {
      const { error } = await admin.from("stage_inspections").insert({
        stage_id: s1, request_id: req, inspector_id: IDS.admin, notes: "x", materials_used: [],
      });
      expect(error).not.toBeNull();
    });

    it("someone else (admin) inspects → inspected", async () => {
      const { error } = await admin.from("stage_inspections").insert({
        stage_id: s1, request_id: req, inspector_id: IDS.admin, notes: "OK",
        materials_used: [{ item: "Cement", quantity: "10 bags" }],
      });
      expect(error).toBeNull();
    });

    it("admin cannot approve the stage on the client's behalf", async () => {
      const { error } = await admin.from("build_stages").update({ status: "approved" }).eq("id", s1);
      expect(error).not.toBeNull();
    });

    it("client approves the stage → next stage unlocks; the one after stays locked", async () => {
      const { error } = await client.rpc("approve_stage", { p_stage_id: s1 });
      expect(error).toBeNull();
      const { data } = await service.from("build_stages").select("position, status, approved_by_name").eq("request_id", req).order("position");
      expect(data?.map((d) => d.status)).toEqual(["approved", "quoting", "locked"]);
      expect(data?.[0].approved_by_name).toBe("SAMPLE Tatenda Moyo");
    });

    it("admin can rename/reorder/remove only stages that haven't started", async () => {
      expect((await admin.from("build_stages").update({ name: "Slab & floor" }).eq("id", s2)).error).toBeNull();
      expect((await admin.rpc("move_stage", { p_stage_id: s3, p_dir: -1 })).error).not.toBeNull(); // s2 started
      expect((await admin.from("build_stages").update({ name: "Changed" }).eq("id", s1)).error).not.toBeNull(); // approved
      await admin.from("build_stages").delete().eq("id", s1);
      const { data } = await service.from("build_stages").select("id").eq("id", s1);
      expect(data?.length).toBe(1);
    });

    it("purchases and inspections can't be edited or deleted (buyer ≠ inspector can't be dodged)", async () => {
      const { data: pur } = await service.from("stage_purchases").select("id").eq("stage_id", s1).single();
      const up = await admin.from("stage_purchases").update({ purchased_by: IDS.lawyer }).eq("id", pur!.id);
      expect(up.error).not.toBeNull();
      const del = await admin.from("stage_purchases").delete().eq("id", pur!.id);
      expect(del.error).not.toBeNull();
      const { data: still } = await service.from("stage_purchases").select("purchased_by").eq("id", pur!.id).single();
      expect(still?.purchased_by).toBe(IDS.agent);
      const ins = await admin.from("stage_inspections").update({ inspector_id: IDS.agent }).eq("stage_id", s1);
      expect(ins.error).not.toBeNull();
    });

    it("admin can't make themselves the client to approve on the client's behalf", async () => {
      const { error } = await admin.from("service_requests").update({ client_id: IDS.admin }).eq("id", req);
      expect(error).not.toBeNull();
      const { error: e2 } = await admin.rpc("approve_stage", { p_stage_id: s2 });
      expect(e2?.message).toMatch(/only the client|not your project/);
    });

    it("field staff get purchases without amounts, and can't read others' receipt amounts", async () => {
      const { data: direct } = await lawyer.from("stage_purchases").select("amount_cents").eq("request_id", req);
      expect(direct ?? []).toEqual([]);
      await service.from("jobs").insert({ request_id: req, assigned_to: IDS.lawyer, created_by: IDS.admin });
      const { data: viaRpc } = await lawyer.rpc("stage_purchases_for_field", { p_request_id: req });
      expect(viaRpc?.length).toBe(1);
      expect(Object.keys(viaRpc![0])).not.toContain("amount_cents");
      const { data: receipts } = await lawyer.from("media").select("amount_cents").eq("stage_id", s1).eq("kind", "receipt");
      expect(receipts ?? []).toEqual([]); // the agent's receipt, not the lawyer's
      await service.from("jobs").delete().eq("request_id", req).eq("assigned_to", IDS.lawyer);
    });

    it("media can't be attached across projects or with a crafted path", async () => {
      const cross = await agent.from("media").insert({
        job_id: IDS.jobLand, stage_id: s2, request_id: req, uploader_id: IDS.agent, kind: "inspection",
        storage_path: `stages/${s2}/${crypto.randomUUID()}.jpg`,
      });
      expect(cross.error).not.toBeNull();
      const dotdot = await agent.from("media").insert({
        stage_id: s2, request_id: req, uploader_id: IDS.agent, kind: "progress",
        storage_path: `stages/${s2}/../../jobs/${IDS.jobLand}/x.jpg`,
      });
      expect(dotdot.error).not.toBeNull();
    });

    it("clients and field staff cannot change stages directly", async () => {
      await client.from("build_stages").update({ name: "hacked" }).eq("id", s3);
      await agent.from("build_stages").update({ name: "hacked" }).eq("id", s3);
      const { data } = await service.from("build_stages").select("name").eq("id", s3).single();
      expect(data?.name).toBe("Window level");
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
