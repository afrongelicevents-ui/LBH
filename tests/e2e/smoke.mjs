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
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Newest email to `to` in the local Supabase mail catcher (Mailpit). */
async function latestEmailTo(to, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = res.ok ? await res.json() : { messages: [] };
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      return msg;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email to ${to}`);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const IDS = {
  admin: "00000000-0000-4000-a000-000000000001",
  agent: "00000000-0000-4000-a000-000000000003",
  lawyer: "00000000-0000-4000-a000-000000000002",
  jobLegal412: "30000000-0000-4000-a000-000000000003",
  reqLand: "10000000-0000-4000-a000-000000000001",
  reqMat: "10000000-0000-4000-a000-000000000002",
  reqDone: "10000000-0000-4000-a000-000000000003",
  build: "50000000-0000-4000-a000-000000000001",
  slab: "51000000-0000-4000-a000-000000000002",
  windowLevel: "51000000-0000-4000-a000-000000000003",
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

const secrets = {};
async function challengeMfa(page, secret) {
  await page.waitForURL(/\/mfa/, { timeout: 15000 });
  await page.locator('input[inputmode="numeric"]').waitFor({ timeout: 15000 });
  await page.fill('input[inputmode="numeric"]', totp(secret));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/mfa"), { timeout: 20000 }),
    page.click('form button[type="submit"]'),
  ]);
}
async function loginStaff(page, email) {
  await login(page, email);
  if (secrets[email]) await challengeMfa(page, secrets[email]);
  else secrets[email] = await enrollMfa(page);
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

/** In-app camera: open it inside `scope`, take `n` photos, close. */
async function snapPhotos(page, scope, n = 1) {
  await scope.locator('[data-testid="open-camera-photo"]').first().click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor();
  await page.waitForFunction(() => {
    const v = document.querySelector('[role="dialog"] video');
    return v && v.videoWidth > 0;
  });
  for (let i = 0; i < n; i++) {
    await dialog.locator('[data-testid="shutter"]').click();
    await page.waitForTimeout(300);
  }
  // single-photo forms close by themselves
  if (await dialog.isVisible()) await dialog.locator("button", { hasText: /Done|Cancel/ }).click();
  await scope.locator("li img").first().waitFor();
}

/** Retry a check (e.g. "the row is in the database") until it passes. */
async function eventually(check, timeout = 30000) {
  const until = Date.now() + timeout;
  for (;;) {
    try {
      return await check();
    } catch (e) {
      if (Date.now() > until) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function waitAllUploaded(page, timeout = 30000) {
  await page.getByTestId("outbox-status").getByText("All uploaded ✓").waitFor({ timeout });
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
await clearFactors(IDS.lawyer);

// Fake camera + microphone so the in-app camera can be driven in tests.
const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
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

  await step("finance tracker 'coming soon' card → Notify me saves interest", async () => {
    await page.goto(`${BASE}/en`);
    const card = page.locator("#finance");
    await card.getByText("Build Finance Tracker").waitFor();
    await card.getByText("track every dollar of your build, stage by stage", { exact: false }).waitFor();
    const email = `finance-${Date.now()}@example.test`;
    await card.locator('input[type="email"]').fill(email);
    await card.locator('button[type="submit"]').click();
    await card.getByText("Saved").waitFor({ timeout: 10000 });
    const { data } = await db.from("notify_interest").select("service").eq("email", email).single();
    assert(data?.service === "finance", "finance interest not stored");
  });

  await step("CREATE ACCOUNT next to Log in → verify email → lands in the portal", async () => {
    await page.goto(`${BASE}/en`);
    await page.locator('header a[href$="/signup"]:visible').first().click();
    await page.waitForURL(/\/signup/);
    const email = `signup-e2e-${Date.now()}@example.test`;
    await page.fill('input[name="full_name"]', "E2E New Client");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="whatsapp"]', "+44 7700 900555");
    await page.selectOption('select[name="country"]', "uk");
    await page.fill('input[name="password"]', "E2E-Signup-2026");
    await page.fill('input[name="confirm_password"]', "E2E-Signup-2026");
    await page.check('input[name="terms"]');
    await shot(page, "signup");
    await page.click('button[type="submit"]');
    await page.getByText("Check your email").waitFor({ timeout: 15000 });

    // can't log in before confirming
    await page.goto(`${BASE}/en/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "E2E-Signup-2026");
    await page.click('button[type="submit"]');
    await page.getByText("confirm your email first").waitFor({ timeout: 10000 });

    const msg = await latestEmailTo(email);
    const link = /href="([^"]+token_hash=[^"]+)"/.exec(msg.HTML)?.[1]?.replaceAll("&amp;", "&");
    assert(link, "confirmation link missing from email");
    await page.goto(link);
    await page.waitForURL(/\/portal/, { timeout: 20000 });
    await page.getByText("Your email is confirmed").waitFor();
    await page.getByRole("link", { name: "Book a free call" }).first().waitFor();
    await page.getByRole("link", { name: "Verify land" }).first().waitFor();
    await shot(page, "signup-portal");
    const { data: prof } = await db.from("profiles").select("role, full_name, whatsapp, country").eq("email", email).single();
    assert(prof.role === "client" && prof.whatsapp === "+44 7700 900555" && prof.country === "uk", "profile wrong");

    // book a call from the portal: details are prefilled
    await page.getByRole("link", { name: "Book a free call" }).first().click();
    await page.waitForURL(/book-a-call/);
    assert((await page.inputValue('input[name="email"]')) === email, "booking not prefilled");
    await page.goto(`${BASE}/en/portal/requests/new-land`);
    await page.getByRole("button", { name: "Send request" }).waitFor();
  });

  await step("staff can't sign themselves up: sign-up only ever makes clients", async () => {
    const { data } = await db.from("profiles").select("role").like("email", "signup-e2e-%");
    assert(data.length >= 1 && data.every((p) => p.role === "client"), "non-client created");
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
let offlineShotAt = 0;
{
  // Device GPS ~2 km from the stand pin → photo must be flagged
  const ctx = await newCtx({
    permissions: ["geolocation"],
    geolocation: { latitude: -17.9077, longitude: 31.0405 },
  });
  const page = await ctx.newPage();

  await step("login forces TOTP enrollment, then lands on My jobs", async () => {
    await loginStaff(page, "agent@lbh.test");
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
    await page.getByText("Saved on this phone").first().waitFor({ timeout: 10000 });
    await eventually(async () => {
      const { data } = await db.from("jobs").select("visit, status").eq("id", IDS.jobLand).single();
      assert(data.visit?.measurements?.area_sqm === 300 && data.status === "in_progress", "visit not saved");
    });
    await waitAllUploaded(page);
  });

  await step("camera only: no gallery/file picker for field photos, video or receipts", async () => {
    const capture = page.locator("section", { hasText: "Photos, video & receipts" });
    assert((await capture.locator('input[type="file"]').count()) === 0, "a file picker is offered to field staff");
    assert((await page.locator('input[type="file"]').count()) === 0, "a file picker exists on the field job page");
    await capture.locator('[data-testid="open-camera-photo"]').first().waitFor();
    await capture.locator('[data-testid="open-camera-video"]').waitFor();
  });

  await step("take 2 photos in the app: time + GPS recorded, flagged >300 m from pin", async () => {
    const photoForm = page.getByTestId("media-form-photo");
    const before = Date.now();
    await snapPhotos(page, photoForm, 2);
    await photoForm.locator('button[type="submit"]').click();
    await photoForm.getByText("Saved on this phone").waitFor({ timeout: 10000 });
    const data = await eventually(async () => {
      const { data } = await db.from("media").select("*").eq("job_id", IDS.jobLand).eq("kind", "photo");
      assert(data.length === 2, `${data.length} photos stored`);
      return data;
    });
    await waitAllUploaded(page);
    for (const m of data) {
      assert(m.capture_source === "camera", "not marked as in-app camera");
      assert(Math.abs(Date.parse(m.taken_at) - before) < 60000, `capture time wrong (${m.taken_at})`);
      assert(Math.abs(m.gps_lat - -17.9077) < 0.0001, `device GPS not stored (${m.gps_lat})`);
      assert(m.flagged_far === true, `not flagged (distance ${m.distance_from_pin_m})`);
    }
    await page.getByText("in-app camera").first().waitFor();
  });

  await step("record a short video in the app", async () => {
    const form = page.getByTestId("media-form-video");
    await form.locator('[data-testid="open-camera-video"]').click();
    await page.waitForFunction(() => {
      const v = document.querySelector('[role="dialog"] video');
      return v && v.videoWidth > 0;
    });
    await page.getByTestId("start-recording").click();
    await page.waitForTimeout(2500);
    await page.getByTestId("stop-recording").click();
    await form.locator("li video").waitFor({ timeout: 10000 });
    await form.locator('button[type="submit"]').click();
    const data = await eventually(async () => {
      const { data } = await db.from("media").select("kind, capture_source, storage_path").eq("job_id", IDS.jobLand).eq("kind", "video");
      assert(data.length === 1 && data[0].capture_source === "camera", "video not stored");
      return data;
    }, 60000);
    assert(/\.(webm|mp4)$/.test(data[0].storage_path), `video type ${data[0].storage_path}`);
    await waitAllUploaded(page);
  });

  await step("photograph a fuel receipt with amount", async () => {
    const form = page.getByTestId("media-form-receipt");
    await snapPhotos(page, form, 1);
    await form.locator('input[name="amount"]').fill("18.50");
    await form.locator('input[name="note"]').fill("Fuel — E2E");
    await form.locator('button[type="submit"]').click();
    const data = await eventually(async () => {
      const { data } = await db.from("media").select("amount_cents, flagged_far").eq("job_id", IDS.jobLand).eq("kind", "receipt").single();
      assert(data, "receipt not stored");
      return data;
    });
    await waitAllUploaded(page);
    assert(data.amount_cents === 1850, "receipt amount wrong");
    assert(data.flagged_far === false, "receipts must not get the distance flag");
  });

  await step("OFFLINE: photos + checklist + notes wait on the phone → 'Waiting to upload (2)'", async () => {
    await ctx.setOffline(true);
    const photoForm = page.getByTestId("media-form-photo");
    await snapPhotos(page, photoForm, 1);
    offlineShotAt = Date.now();
    await photoForm.locator('input[name="note"]').fill("E2E offline photo");
    await photoForm.locator('button[type="submit"]').click();
    await page.fill('textarea[name="findings"]', "E2E — written with no signal.");
    await page.click('button:has-text("Save visit")');
    await page.getByTestId("outbox-status").getByText("Waiting to upload (2)").waitFor({ timeout: 10000 });
    await page.getByText("no signal").first().waitFor();
    await shot(page, "field-offline-waiting");
    const { data } = await db.from("media").select("id").eq("job_id", IDS.jobLand).eq("note", "E2E offline photo");
    assert((data ?? []).length === 0, "uploaded while offline?!");
  });

  await step("OFFLINE: the job page still opens with no signal (cached) and keeps the queue", async () => {
    await page.reload();
    await page.getByText("Stand / request details").waitFor({ timeout: 15000 });
    await page.getByTestId("outbox-status").getByText("Waiting to upload (2)").waitFor({ timeout: 10000 });
    const findings = await page.locator('textarea[name="findings"]').inputValue();
    assert(findings === "E2E — written with no signal.", `unsent notes not shown after reload (${findings})`);
  });

  await step("signal returns → uploads automatically with the ORIGINAL time + GPS → 'All uploaded ✓'", async () => {
    await page.waitForTimeout(3000); // time passes before the signal comes back
    await ctx.setOffline(false);
    await waitAllUploaded(page, 45000);
    const { data: m } = await db.from("media").select("*").eq("job_id", IDS.jobLand).eq("note", "E2E offline photo").single();
    assert(Math.abs(Date.parse(m.taken_at) - offlineShotAt) < 5000, `capture time not kept (${m.taken_at})`);
    assert(Date.parse(m.uploaded_at) - Date.parse(m.taken_at) > 2500, "uploaded_at should be later than taken_at");
    assert(Math.abs(m.gps_lat - -17.9077) < 0.0001, "GPS not kept");
    const { data: j } = await db.from("jobs").select("visit").eq("id", IDS.jobLand).single();
    assert(j.visit.findings === "E2E — written with no signal.", "offline checklist not saved");
    assert(j.visit.measurements.area_sqm === 300, "offline save lost earlier measurements");
    await shot(page, "field-all-uploaded");
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
console.log("\nLawyer (lawyer@lbh.test) — title checks");
{
  const ctx = await newCtx({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await step("lawyer sees their sample title-check jobs (Stand 412 + Stand 88)", async () => {
    await loginStaff(page, "lawyer@lbh.test");
    await page.waitForURL(/\/field/);
    await page.getByText("SAMPLE — Stand 412").waitFor();
    await page.getByText("SAMPLE — Stand 88").waitFor();
    assert((await page.getByText("Title check (legal)").count()) === 2, "job type not shown");
    await shot(page, "lawyer-jobs");
  });

  await step("legal checklist: title deed, agreement of sale, council records, seller identity, findings, verdict", async () => {
    await page.goto(`${BASE}/en/field/jobs/${IDS.jobLegal412}`);
    const form = page.getByTestId("legal-form");
    for (const label of ["Title deed", "Agreement of sale", "Council records", "Seller identity"]) {
      await form.getByText(label, { exact: true }).waitFor();
    }
    await form.locator('input[name="title_deed_status"][value="ok"]').check();
    await form.locator('textarea[name="title_deed_note"]').fill("E2E — deed 1234/2019 matches seller.");
    await form.locator('input[name="agreement_of_sale_status"][value="ok"]').check();
    await form.locator('input[name="council_records_status"][value="problem"]').check();
    await form.locator('textarea[name="council_records_note"]').fill("E2E — cession pending.");
    await form.locator('input[name="seller_identity_status"][value="ok"]').check();
    await form.locator('textarea[name="findings"]').fill("E2E — clean title, cession pending.");
    await form.locator('select[name="verdict"]').selectOption("concerns");
    await shot(page, "lawyer-checklist");
    await form.locator('button[type="submit"]').click();
    const data = await eventually(async () => {
      const { data } = await db.from("jobs").select("visit, checklist, status").eq("id", IDS.jobLegal412).single();
      assert(data.visit?.legal?.items?.council_records?.status === "problem", "status not saved");
      return data;
    });
    await waitAllUploaded(page);
    assert(data.visit.legal.verdict === "concerns" && data.visit.legal.findings.includes("cession"), "findings/verdict not saved");
    assert(data.checklist.title_deed === "ok" && data.status === "in_progress", "checklist summary not saved");
    const text = await page.locator("body").innerText();
    assert(!text.includes("$"), "a price leaked to the lawyer");
  });

  await step("the completed Stand 88 title check shows the filled sample checklist", async () => {
    await page.goto(`${BASE}/en/field/jobs/30000000-0000-4000-a000-000000000004`);
    const form = page.getByTestId("legal-form");
    assert(await form.locator('input[name="council_records_status"][value="problem"]').isChecked(), "sample status missing");
    assert((await form.locator('textarea[name="findings"]').inputValue()).includes("cession"), "sample findings missing");
  });
  await ctx.close();
}

// ======================================================================
console.log("\nAdmin (admin@lbh.test) — 2FA required");
{
  const ctx = await newCtx();
  const page = await ctx.newPage();

  await step("login forces TOTP enrollment, then Needs-you queue", async () => {
    await loginStaff(page, "admin@lbh.test");
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
console.log("\nBuild stages (Foundation → Finishes)");
{
  const stageStatus = async (id) => (await db.from("build_stages").select("status").eq("id", id).single()).data?.status;
  const waitStatus = async (page, id, want) => {
    for (let i = 0; i < 40; i++) {
      if ((await stageStatus(id)) === want) return;
      await page.waitForTimeout(500);
    }
    throw new Error(`stage is ${await stageStatus(id)}, expected ${want}`);
  };
  const slabCard = (page) => page.locator("#stage-2");

  const cctx = await newCtx();
  const cpage = await cctx.newPage();
  await step("client: My build shows Foundation approved, Slab quotes, later stages locked", async () => {
    await login(cpage, "client@lbh.test");
    await cpage.goto(`${BASE}/en/portal/build`);
    await cpage.waitForURL(/\/portal\/build\/50000000/);
    await cpage.getByText("1 of 6 stages done").waitFor();
    await cpage.locator("#stage-1").getByText("Approved by SAMPLE Tatenda Moyo").waitFor();
    await slabCard(cpage).getByText("SAMPLE Msasa Hardware").waitFor();
    await cpage.locator("#stage-3").getByText("Unlocks when").waitFor();
    await shot(cpage, "client-build");
  });

  await step("client chooses ONE supplier for Slab, then pays (test mode)", async () => {
    const msasa = slabCard(cpage).locator("li", { hasText: "SAMPLE Msasa Hardware" });
    await msasa.locator('button:has-text("Choose this supplier")').click();
    await msasa.locator('button:has-text("Yes, choose")').click();
    await waitStatus(cpage, IDS.slab, "quote_approved");
    await cpage.reload();
    await Promise.all([
      cpage.waitForURL(/\/pay\/simulate/, { timeout: 20000 }),
      slabCard(cpage).locator('button:has-text("Pay online")').click(),
    ]);
    await cpage.getByText("$1,365.00").waitFor();
    await Promise.all([
      cpage.waitForURL(/\/pay\/return/, { timeout: 20000 }),
      cpage.click('button:has-text("Simulate successful payment")'),
    ]);
    await waitStatus(cpage, IDS.slab, "paid");
  });

  const fctx = await newCtx();
  const fpage = await fctx.newPage();
  await step("field agent: no prices; records purchase with receipt photo", async () => {
    await loginStaff(fpage, "agent@lbh.test");
    const { data: job } = await db.from("jobs").select("id").eq("request_id", IDS.build).single();
    await fpage.goto(`${BASE}/en/field/jobs/${job.id}`);
    await slabCard(fpage).getByText("Paid — LBH is buying").waitFor();
    const text = await fpage.locator("body").innerText();
    assert(!text.includes("1,365") && !text.includes("1,420") && !text.includes("$"), "a price leaked to field staff");
    const card = slabCard(fpage);
    await card.locator('input[name="supplier_name"]').fill("SAMPLE Msasa Hardware");
    await card.locator('input[name="amount"]').fill("1365");
    assert((await card.locator('input[type="file"]').count()) === 0, "file picker offered to field staff");
    await snapPhotos(fpage, card, 1);
    await card.locator('button:has-text("Record purchase")').click();
    await waitStatus(fpage, IDS.slab, "purchased");
    const { data: rc } = await db.from("media").select("capture_source, taken_at").eq("stage_id", IDS.slab).eq("kind", "receipt").single();
    assert(rc.capture_source === "camera" && rc.taken_at, "stage receipt not from the in-app camera");
  });

  await step("field agent: delivery photo → delivered → builders started → progress photo", async () => {
    await fpage.reload();
    const card = slabCard(fpage);
    const delivery = card.locator("form", { has: fpage.locator('button:has-text("Add delivery photo")') });
    await snapPhotos(fpage, delivery, 1);
    await delivery.locator('button[type="submit"]').click();
    await card.locator('button:has-text("Mark materials delivered")').waitFor({ timeout: 30000 });
    await card.locator('button:has-text("Mark materials delivered")').click();
    await waitStatus(fpage, IDS.slab, "delivered");
    await fpage.reload();
    await slabCard(fpage).locator('button:has-text("Builders have started")').click();
    await waitStatus(fpage, IDS.slab, "building");
    await fpage.reload();
    const progress = slabCard(fpage).locator("form", { has: fpage.locator('button:has-text("Add progress photos")') });
    await snapPhotos(fpage, progress, 1);
    await progress.locator('button[type="submit"]').click();
    await eventually(async () => {
      const { data: pr } = await db.from("media").select("id").eq("stage_id", IDS.slab).eq("kind", "progress");
      assert((pr ?? []).length >= 1, "progress photo not stored");
    });
    await waitAllUploaded(fpage);
  });

  await step("the agent who BOUGHT the materials cannot inspect", async () => {
    await fpage.reload();
    await slabCard(fpage).getByText("someone else must inspect").waitFor();
    assert((await slabCard(fpage).locator('button:has-text("Submit inspection")').count()) === 0, "inspection form shown to buyer");
  });

  const actx = await newCtx();
  const apage = await actx.newPage();
  await step("admin inspects: photos + all materials used → ready for client", async () => {
    await loginStaff(apage, "admin@lbh.test");
    await apage.goto(`${BASE}/en/admin/builds/${IDS.build}`);
    const card = slabCard(apage);
    await card.locator('input[name="photos"]').last().setInputFiles(photoPath);
    await card.locator('textarea[name="notes"]').fill("E2E — slab level and thickness checked.");
    await card.locator('button:has-text("Submit inspection")').click();
    await waitStatus(apage, IDS.slab, "inspected");
    await shot(apage, "admin-build");
  });

  await step("locked stages can't take supplier quotes", async () => {
    await apage.reload();
    assert((await apage.locator("#stage-4").locator('button:has-text("Add quote")').count()) === 0, "quote form on locked stage");
  });

  await step("client sees inspection + materials, taps Approve stage → Window level unlocks", async () => {
    await cpage.goto(`${BASE}/en/portal/build/${IDS.build}`);
    const card = slabCard(cpage);
    await card.getByText("slab level and thickness checked").waitFor();
    await card.getByText("All materials used on this stage").first().waitFor();
    await card.locator('button:has-text("Approve stage")').click();
    await card.locator('button:has-text("Yes, approve")').click();
    await waitStatus(cpage, IDS.slab, "approved");
    assert((await stageStatus(IDS.windowLevel)) === "quoting", "next stage did not unlock");
    const { data: locked } = await db.from("build_stages").select("status").eq("request_id", IDS.build).gt("position", 3);
    assert(locked.every((s) => s.status === "locked"), "later stages unlocked too early");
  });

  await step("admin can now add a supplier quote to Window level", async () => {
    await apage.goto(`${BASE}/en/admin/builds/${IDS.build}`);
    const form = apage.locator("#stage-3 form", { has: apage.locator('button:has-text("Add quote")') });
    await form.locator('input[name="supplier_name"]').fill("E2E Brick Supplier");
    await form.locator('input[name="amount"]').fill("2100");
    await form.locator('button:has-text("Add quote")').click();
    await form.getByText("Saved.").waitFor({ timeout: 15000 });
  });
  await cctx.close(); await fctx.close(); await actx.close();
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
    const { data: m } = await db.from("media").select("storage_path").eq("job_id", IDS.jobLand).eq("kind", "photo").limit(1).single();
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
