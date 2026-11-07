/**
 * End-to-end smoke test: drives the REAL app in a browser through every
 * "Done means" flow of the brief, against the local Supabase stack.
 *
 *   npx supabase db reset          # fresh sample data
 *   npm run build && npm run start # app on http://localhost:3000
 *   npm run test:e2e
 *
 * Mutates sample data — run `npx supabase db reset` before re-running.
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// Resolved like require() so a globally-installed Playwright also works.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "Lbh-Sample-2026";
const SHOTS = process.env.E2E_SHOTS_DIR ?? null;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const IDS = {
  admin: "00000000-0000-4000-a000-000000000001",
  agent: "00000000-0000-4000-a000-000000000003",
  reqLand: "10000000-0000-4000-a000-000000000001",
  reqMat: "10000000-0000-4000-a000-000000000002",
  reqDone: "10000000-0000-4000-a000-000000000003",
  jobLand: "30000000-0000-4000-a000-000000000001",
};

// ---------- tiny test harness ----------
let passed = 0;
const failures = [];
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------- RFC 6238 TOTP ----------
function base32Decode(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret, offsetSteps = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + offsetSteps;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
}

// ---------- helpers ----------
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

async function login(page, email) {
  await page.goto(`${BASE}/en/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function enrollMfa(page) {
  await page.waitForURL(/\/mfa/, { timeout: 15000 });
  const secretEl = page.locator("code");
  await secretEl.waitFor({ timeout: 15000 });
  const secret = (await secretEl.textContent()).trim();
  await page.fill('input[inputmode="numeric"]', totp(secret));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/mfa"), { timeout: 20000 }),
    page.click('form button[type="submit"]'),
  ]);
  return secret;
}

async function clearFactors(userId) {
  const { data } = await db.auth.admin.mfa.listFactors({ userId });
  for (const f of data?.factors ?? []) {
    await db.auth.admin.mfa.deleteFactor({ id: f.id, userId });
  }
}

// ---------- fixtures ----------
const dir = mkdtempSync(join(tmpdir(), "lbh-e2e-"));
const photoPath = join(dir, "site-photo.jpg");
// A realistic phone photo: ~8 MB (well over Vercel's 4.5 MB request limit),
// with capture time + GPS in EXIF like a real camera writes them.
{
  const w = 3600, h = 2800;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 255) | 0;
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .withExif({
      IFD0: { Make: "E2E Phone" },
      IFD2: { DateTimeOriginal: "2026:11:05 10:15:00" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "17/1 54/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "31/1 2/1 0/1" },
    })
    .jpeg({ quality: 92 })
    .toFile(photoPath);
}
const pdfPath = join(dir, "title-deed.pdf");
writeFileSync(
  pdfPath,
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
);

await clearFactors(IDS.admin);
await clearFactors(IDS.agent);

const browser = await chromium.launch();
const newCtx = (opts = {}) =>
  browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });

// ======================================================================
console.log("\nPublic website");
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const cspErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) cspErrors.push(m.text());
  });

  await step("homepage renders with no prices", async () => {
    await page.goto(`${BASE}/en`);
    const text = await page.locator("body").innerText();
    assert(text.includes("Build safely"), "hero headline missing");
    assert(!/\$\s?\d/.test(text), "a price appears on the homepage");
  });

  await step("language switcher → Shona → Ndebele", async () => {
    await page.click('button:has-text("Shona")');
    await page.waitForURL(/\/sn/);
    assert((await page.locator("h1").innerText()).includes("Vaka"), "Shona headline missing");
    await page.click('button:has-text("Ndebele")');
    await page.waitForURL(/\/nd/);
    assert((await page.locator("h1").innerText()).includes("Yakha"), "Ndebele headline missing");
  });

  await step("book a free call → stored for admin", async () => {
    const email = `e2e-${Date.now()}@example.test`;
    await page.goto(`${BASE}/en/book-a-call`);
    await page.fill('input[name="name"]', "E2E Test Booker");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="whatsapp"]', "+44 7700 900999");
    await page.selectOption('select[name="country"]', "uk");
    await page.selectOption('select[name="service"]', "land");
    await page.selectOption('select[name="slot"]', "evening");
    await page.fill('textarea[name="description"]', "E2E booking test");
    await page.click('button[type="submit"]');
    await page.getByText("your call request is in").waitFor({ timeout: 15000 });
    const { data } = await db.from("call_bookings").select("id, client_id").eq("email", email).single();
    assert(data?.id, "booking row not created");
    assert(data?.client_id, "client account not created from email");
  });

  await step("notify-me saves interest", async () => {
    await page.goto(`${BASE}/en/services`);
    const email = `notify-${Date.now()}@example.test`;
    await page.locator('#camera input[type="email"]').fill(email);
    await page.locator('#camera button[type="submit"]').click();
    await page.getByText("Saved").first().waitFor({ timeout: 10000 });
    const { data } = await db.from("notify_interest").select("id").eq("email", email);
    assert(data?.length === 1, "interest not stored");
  });

  await step("no CSP violations on public pages", async () => {
    assert(cspErrors.length === 0, cspErrors[0] ?? "");
  });
  await ctx.close();
}

// ======================================================================
console.log("\nClient portal (client@lbh.test)");
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const cspErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) cspErrors.push(m.text());
  });

  await step("log in → portal dashboard with timeline", async () => {
    await login(page, "client@lbh.test");
    await page.waitForURL(/\/portal/);
    await page.getByText("SAMPLE — Stand 412").waitFor();
    await page.getByText("Quote sent").first().waitFor();
    await shot(page, "client-dashboard");
  });

  await step("cannot open the admin or field area", async () => {
    await page.goto(`${BASE}/en/admin`);
    await page.waitForURL(/\/portal/);
    await page.goto(`${BASE}/en/field`);
    await page.waitForURL(/\/portal/);
  });

  await step("view quote and ACCEPT it (written acceptance)", async () => {
    await page.goto(`${BASE}/en/portal/requests/${IDS.reqLand}`);
    await page.getByText("$420.00").first().waitFor();
    await page.click('button:has-text("Accept this quote")');
    await Promise.all([
      page.waitForURL(/\/portal$/, { timeout: 20000 }),
      page.click('button:has-text("Yes, I accept")'),
    ]);
    const { data: q } = await db.from("quotes").select("status, accepted_by_name").eq("request_id", IDS.reqLand).single();
    assert(q.status === "accepted" && q.accepted_by_name === "SAMPLE Tatenda Moyo", "acceptance not recorded");
  });

  await step("quote PDF downloads", async () => {
    const { data: q } = await db.from("quotes").select("id").eq("request_id", IDS.reqLand).single();
    const res = await page.request.get(`${BASE}/api/pdf/quote/${q.id}`);
    assert(res.status() === 200, `status ${res.status()}`);
    assert(res.headers()["content-type"] === "application/pdf", "not a PDF");
    assert((await res.body()).subarray(0, 4).toString() === "%PDF", "invalid PDF bytes");
  });

  await step("pay the 50% deposit (Paynow TEST mode) → confirmed server-side", async () => {
    await page.goto(`${BASE}/en/portal/requests/${IDS.reqLand}`);
    await Promise.all([
      page.waitForURL(/\/pay\/simulate/, { timeout: 20000 }),
      page.click('button:has-text("Pay online")'),
    ]);
    await page.getByText("Test mode").first().waitFor();
    await page.getByText("$210.00").waitFor();
    await shot(page, "pay-simulate");
    await Promise.all([
      page.waitForURL(/\/pay\/return/, { timeout: 20000 }),
      page.click('button:has-text("Simulate successful payment")'),
    ]);
    await page.getByRole("heading", { name: /payment received/ }).waitFor();
    const { data: p } = await db.from("payments").select("status").eq("request_id", IDS.reqLand).eq("kind", "deposit").single();
    assert(p.status === "confirmed", `payment ${p.status}`);
    const { data: r } = await db.from("service_requests").select("status").eq("id", IDS.reqLand).single();
    assert(r.status === "deposit_paid", `request ${r.status}`);
    const { data: ledger } = await db.from("ledger_entries").select("amount_cents").eq("request_id", IDS.reqLand);
    assert(ledger?.some((l) => l.amount_cents === 21000), "ledger entry missing");
  });

  await step("APPROVE an extra cost → creates a payable extra", async () => {
    await page.goto(`${BASE}/en/portal/requests/${IDS.reqMat}`);
    await page.getByText("SAMPLE Extra trip").waitFor();
    await page.locator('#approvals button:has-text("Approve")').click();
    await page.locator("#approvals").getByText("Approved", { exact: true }).waitFor({ timeout: 10000 });
    const { data } = await db.from("approvals").select("status").eq("request_id", IDS.reqMat).single();
    assert(data.status === "approved", "approval not recorded");
  });

  await step("pay the extra by manual proof (Remitly/bank) → submitted", async () => {
    await page.reload();
    await page.locator('button:has-text("I paid via")').first().click();
    await page.fill('input[name="reference"]', "REMITLY-E2E-123");
    await page.setInputFiles('input[name="proof"]', photoPath);
    await page.click('button:has-text("Send proof")');
    await page.getByText("Proof under review").first().waitFor({ timeout: 20000 });
    const { data } = await db.from("payments").select("status, proof_path").eq("request_id", IDS.reqMat).eq("kind", "extra").single();
    assert(data.status === "submitted" && data.proof_path, "proof not stored");
  });

  await step("approve ONE supplier quote (materials)", async () => {
    await page.reload();
    await page.locator('#suppliers button:has-text("Approve this supplier")').first().click();
    await page.locator("#suppliers").getByText("Approved", { exact: true }).waitFor({ timeout: 10000 });
    const { data } = await db.from("supplier_quotes").select("status").eq("request_id", IDS.reqMat);
    const approved = data.filter((s) => s.status === "approved").length;
    assert(approved === 1, `${approved} approved`);
  });

  await step("new land verification request with document upload + map", async () => {
    await page.goto(`${BASE}/en/portal/requests/new-land`);
    await page.fill('input[name="town"]', "E2E Ruwa");
    await page.fill('input[name="stand_number"]', "E2E-77");
    await page.locator(".leaflet-container").click({ position: { x: 150, y: 100 } });
    await page.setInputFiles('input[name="documents"]', pdfPath);
    await page.fill('input[name="introduced_by"]', "E2E agent");
    await page.click('button:has-text("Send request")');
    await page.waitForURL(/\/portal\/requests\/[0-9a-f-]{36}$/, { timeout: 20000 });
    await page.getByText("title-deed.pdf").waitFor();
    const { data } = await db.from("service_requests").select("details").eq("title", "E2E-77, E2E Ruwa").single();
    assert(typeof data.details.pin_lat === "number", "map pin not stored");
  });

  await step("chat with LBH", async () => {
    await page.goto(`${BASE}/en/portal/chat`);
    await page.fill('input[placeholder="Type a message…"]', "E2E hello from the client");
    await page.click('button[aria-label="Send"]');
    await page.getByText("E2E hello from the client").waitFor({ timeout: 10000 });
  });

  await step("no CSP violations in the portal", async () => {
    assert(cspErrors.length === 0, cspErrors[0] ?? "");
  });
  await ctx.close();
}

// ======================================================================
console.log("\nField portal (agent@lbh.test) — 2FA required");
{
  // Device GPS ~2 km from the stand pin → photo must be flagged
  const ctx = await newCtx({
    permissions: ["geolocation"],
    geolocation: { latitude: -17.9077, longitude: 31.0405 },
  });
  const page = await ctx.newPage();

  await step("login forces TOTP enrollment, then lands on My jobs", async () => {
    await login(page, "agent@lbh.test");
    await enrollMfa(page);
    await page.waitForURL(/\/field/);
    await page.getByText("SAMPLE — Stand 412").waitFor();
  });

  await step("job page shows stand + documents but NO prices", async () => {
    await page.goto(`${BASE}/en/field/jobs/${IDS.jobLand}`);
    await page.getByText("Stand / request details").waitFor();
    const text = await page.locator("body").innerText();
    assert(!text.includes("420") && !text.includes("210.00"), "a price leaked to field staff");
    await shot(page, "field-job");
  });

  await step("save visit checklist + measurements", async () => {
    await page.check('input[name="arrived"]');
    await page.check('input[name="council_officer_present"]');
    await page.check('input[name="pegs_shown"]');
    await page.fill('input[name="length_m"]', "20");
    await page.fill('input[name="width_m"]', "15");
    await page.fill('input[name="area_sqm"]', "300");
    await page.click('button:has-text("Save visit")');
    await page.getByText("Saved.").first().waitFor({ timeout: 10000 });
    const { data } = await db.from("jobs").select("visit, status").eq("id", IDS.jobLand).single();
    assert(data.visit.measurements.area_sqm === 300 && data.status === "in_progress", "visit not saved");
  });

  await step("upload a BIG phone photo (~8 MB): time + GPS read, flagged >300 m from pin", async () => {
    const photoForm = page.locator("form", { has: page.locator('input[name="kind"][value="photo"]') });
    await photoForm.locator('input[type="file"]').setInputFiles(photoPath);
    await page.waitForTimeout(1500); // GPS capture
    await photoForm.locator('button[type="submit"]').click();
    await photoForm.getByText("Saved.").waitFor({ timeout: 20000 });
    const { data } = await db.from("media").select("*").eq("job_id", IDS.jobLand).eq("kind", "photo").single();
    assert(data.gps_lat !== null && data.uploaded_at, "GPS/time not stored");
    assert(data.taken_at && data.taken_at.startsWith("2026-11-05"), `EXIF capture time not read (${data.taken_at})`);
    assert(Math.abs(data.gps_lat - -17.9) < 0.001, `EXIF GPS not read (${data.gps_lat})`);
    assert(data.flagged_far === true, `not flagged (distance ${data.distance_from_pin_m})`);
  });

  await step("upload a fuel receipt with amount", async () => {
    const form = page.locator("form", { has: page.locator('input[name="kind"][value="receipt"]') });
    await form.locator('input[type="file"]').setInputFiles(photoPath);
    await form.locator('input[name="amount"]').fill("18.50");
    await form.locator('input[name="note"]').fill("Fuel — E2E");
    await form.locator('button[type="submit"]').click();
    await form.getByText("Saved.").waitFor({ timeout: 20000 });
    const { data } = await db.from("media").select("amount_cents, flagged_far").eq("job_id", IDS.jobLand).eq("kind", "receipt").single();
    assert(data.amount_cents === 1850, "receipt amount wrong");
    assert(data.flagged_far === false, "receipts must not get the distance flag");
  });

  await step("request an extra trip → goes to admin", async () => {
    await page.fill('input[name="title"]', "E2E extra trip to council");
    await page.fill('textarea[name="reason"]', "Officer was absent; must return Tuesday.");
    await page.locator('form:has(input[name="title"]) input[name="amount"]').fill("30");
    await page.click('button:has-text("Send to admin")');
    await page.getByText("Sent to admin").waitFor({ timeout: 10000 });
  });

  await step("submit draft report to ADMIN (not client)", async () => {
    await page.selectOption('select[name="verdict"]', "concerns");
    await page.fill('textarea[name="stand_details"]', "E2E — Stand 412, Harare South.");
    await page.fill('textarea[name="red_flags"]', "E2E — boundary peg on the east side is missing.");
    await page.click('button:has-text("Submit to admin")');
    await page.getByText("Submitted — with admin for review").waitFor({ timeout: 15000 });
    const { data } = await db.from("reports").select("status").eq("job_id", IDS.jobLand).single();
    assert(data.status === "submitted", `report ${data.status}`);
  });
  await ctx.close();
}

// ======================================================================
console.log("\nAdmin (admin@lbh.test) — 2FA required");
{
  const ctx = await newCtx();
  const page = await ctx.newPage();

  await step("login forces TOTP enrollment, then Needs-you queue", async () => {
    await login(page, "admin@lbh.test");
    await enrollMfa(page);
    await page.waitForURL(/\/admin/);
    await page.getByText("Reports to review").waitFor();
    await shot(page, "admin-needs-you");
  });

  await step("confirm the manual payment proof", async () => {
    await page.goto(`${BASE}/en/admin/requests/${IDS.reqMat}`);
    await page.locator('#payments button:has-text("Confirm received")').click();
    await page.waitForTimeout(1500);
    const { data } = await db.from("payments").select("status").eq("request_id", IDS.reqMat).eq("kind", "extra").single();
    assert(data.status === "confirmed", `payment ${data.status}`);
  });

  await step("forward field extra-cost to client for approval", async () => {
    await page.goto(`${BASE}/en/admin/requests/${IDS.reqLand}`);
    await page.locator('#extras button:has-text("Send to client")').click();
    await page.waitForTimeout(1500);
    const { data } = await db.from("approvals").select("status").eq("request_id", IDS.reqLand);
    assert(data.length === 1 && data[0].status === "pending", "approval not created");
  });

  await step("build + send a quote (travel = km × rate)", async () => {
    const { data: req } = await db.from("service_requests").select("id").eq("title", "E2E-77, E2E Ruwa").single();
    await page.goto(`${BASE}/en/admin/requests/${req.id}`);
    const rows = page.locator("form:has(input[name=request_id]) .grid");
    await rows.nth(0).locator("input").nth(2).fill("250"); // service fee unit
    await rows.nth(1).locator("input").nth(1).fill("120"); // 120 km
    await page.getByText("Total: $310.00").waitFor(); // 250 + 120 × 0.50
    await page.click('button:has-text("Send to client")');
    await page.getByText("Quote saved.").waitFor({ timeout: 10000 });
    const { data: q } = await db.from("quotes").select("total_cents, status").eq("request_id", req.id).single();
    assert(q.total_cents === 31000 && q.status === "sent", "quote wrong");
  });

  await step("publish the field report (different person than author)", async () => {
    await page.goto(`${BASE}/en/admin/requests/${IDS.reqLand}`);
    await page.locator('#report button:has-text("Publish to client")').click();
    let data;
    for (let i = 0; i < 30; i++) {
      ({ data } = await db.from("reports").select("status, published_by").eq("job_id", IDS.jobLand).single());
      if (data?.status === "published") break;
      await page.waitForTimeout(500);
    }
    assert(data.status === "published" && data.published_by === IDS.admin, "not published");
    const { data: bal } = await db.from("payments").select("amount_cents").eq("request_id", IDS.reqLand).eq("kind", "balance").single();
    assert(bal.amount_cents === 21000, "balance payment not created");
  });

  await step("payments CSV export", async () => {
    const res = await page.request.get(`${BASE}/api/admin/payments-csv`);
    assert(res.status() === 200 && (await res.text()).startsWith("created_at,"), "csv failed");
  });

  await step("audit log records money events", async () => {
    await page.goto(`${BASE}/en/admin/audit`);
    await page.getByText("payment.confirmed").first().waitFor();
  });
  await ctx.close();
}

// ======================================================================
console.log("\nClient reads the published report");
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  await step("verdict at the top + dated photo gallery + disclaimer", async () => {
    await login(page, "client@lbh.test");
    await page.goto(`${BASE}/en/portal/requests/${IDS.reqLand}/report`);
    await page.getByText("⚠️ Concerns").waitFor();
    await page.getByText("boundary peg on the east side").waitFor();
    await page.getByText("Dated photos & video").waitFor();
    await page.getByText("taken far from the stand pin").first().waitFor();
    await page.getByText(/(Taken|Uploaded) \d/).first().waitFor();
    await page.getByText("not a guarantee").waitFor();
    await shot(page, "client-report");
  });

  await step("report PDF downloads", async () => {
    const { data: r } = await db.from("reports").select("id").eq("job_id", IDS.jobLand).single();
    const res = await page.request.get(`${BASE}/api/pdf/report/${r.id}`);
    assert(res.status() === 200 && res.headers()["content-type"] === "application/pdf", "pdf failed");
  });

  await step("client cannot download another client's report PDF", async () => {
    const { data: r } = await db.from("reports").select("id").eq("request_id", IDS.reqDone).single();
    const res = await page.request.get(`${BASE}/api/pdf/report/${r.id}`);
    assert(res.status() === 404, `status ${res.status()}`);
  });

  await step("photos shown to the client have EXIF stripped", async () => {
    const { data: m } = await db.from("media").select("storage_path").eq("job_id", IDS.jobLand).eq("kind", "photo").single();
    const { data: blob } = await db.storage.from("media").download(m.storage_path);
    const meta = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
    assert(!meta.exif, "EXIF still present");
  });
  await ctx.close();
}

await browser.close();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed:\n - " + failures.join("\n - "));
  process.exit(1);
}
