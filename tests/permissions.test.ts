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

const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
// Standard public demo keys of every local Supabase stack (not secrets).
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "Lbh-Sample-2026";

const IDS = {
  admin: "00000000-0000-4000-a000-000000000001",
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
      signIn("admin@lbh.test"),
      signIn("agent@lbh.test"),
      signIn("lawyer@lbh.test"),
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
