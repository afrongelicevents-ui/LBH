/**
 * Auth emails end to end against the LOCAL Supabase stack (Mailpit inbox):
 * sign-up with a new email, log in, password reset, the "booked a call
 * first, then signs up" case, an email that already has an account, and the
 * invite / magic-link / change-email messages. Saves a screenshot of every
 * email (tokens blanked) and checks where each link lands.
 *
 *   npx supabase start
 *   eval "$(npx supabase status -o env)"      # API_URL, ANON_KEY, SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run dev   # with the same keys
 *   node tests/e2e/auth-emails.mjs ./auth-email-shots
 *
 * Each run makes 3 sign-ups; the site allows 5 per hour per IP, so clear
 * public.rate_limits in the local database between repeated runs.
 */
import { createRequire } from "node:module";
// Resolved like require() so a globally-installed Playwright also works.
const { chromium } = createRequire(import.meta.url)("playwright");
import { createClient } from "@supabase/supabase-js";
const OUT = process.argv[2] ?? "."; (await import("node:fs")).mkdirSync(OUT, { recursive: true }); const B = "http://localhost:3000"; const MP = "http://127.0.0.1:54324";
const admin = createClient(process.env.API_URL, process.env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anonC = () => createClient(process.env.API_URL, process.env.ANON_KEY, { auth: { persistSession: false } });
const log = (...a) => console.log("•", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitMail(to, subj, after = 0) {
  for (let i = 0; i < 40; i++) {
    const r = await (await fetch(`${MP}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
    const m = (r.messages ?? []).filter((x) => new Date(x.Created).getTime() > after && (!subj || x.Subject.includes(subj)));
    if (m.length) return (await fetch(`${MP}/api/v1/message/${m[0].ID}`)).json();
    await sleep(500);
  }
  throw new Error(`no email "${subj}" for ${to}`);
}
async function mailsFor(to, after) {
  const r = await (await fetch(`${MP}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
  return (r.messages ?? []).filter((x) => new Date(x.Created).getTime() > after).map((x) => x.Subject);
}
const linkOf = (msg) => /href="([^"]*\/api\/auth\/confirm[^"]*)"/.exec(msg.HTML)[1].replace(/&amp;/g, "&");
async function shotMail(browser, msg, name) {
  const p = await browser.newPage({ viewport: { width: 640, height: 760 }, deviceScaleFactor: 2 });
  // show it as a mail client would: From / To / Subject, then the message
  const head = `<div style="font:14px -apple-system,Segoe UI,Arial;padding:14px 18px;border-bottom:1px solid #ddd;background:#fff">
    <div><b>From:</b> ${msg.From.Name ? msg.From.Name + " " : ""}&lt;${msg.From.Address}&gt;</div><div><b>To:</b> ${msg.To[0].Address}</div>
    <div style="margin-top:4px;font-size:16px"><b>${msg.Subject}</b></div></div>`;
  const html = msg.HTML.replace(/<body([^>]*)>/, `<body$1>${head}`).replace(/token_hash=[^&"]+/g, "token_hash=…");
  await p.setContent(html, { waitUntil: "load" }).catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/email-${name}.png`, fullPage: true }); await p.close();
}
const browser = await chromium.launch();
const ts = Date.now(); const email = `new-customer-${ts}@example.test`; const pw1 = "Test-password-123"; const pw2 = "Another-pass-456";
let t0 = Date.now();

async function fillSignup(page, mail) {
  await page.goto(`${B}/en/signup`);
  await page.fill('input[name="full_name"]', "Tendai Test"); await page.fill('input[name="email"]', mail);
  await page.fill('input[name="whatsapp"]', "+44 7700 900111"); await page.selectOption('select[name="country"]', "uk");
  await page.fill('input[name="password"]', pw1); await page.fill('input[name="confirm_password"]', pw1);
  await page.check('input[name="terms"]'); await page.click('button[type="submit"]');
}

// 1. brand-new email → confirmation email → link opens the account
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await fillSignup(page, email); await page.getByText("Check your email").waitFor({ timeout: 15000 });
  const m = await waitMail(email, "", t0);
  log("1 new sign-up → email:", JSON.stringify(m.Subject), "| other emails:", JSON.stringify(await mailsFor(email, t0)));
  if (!/Confirm your Let's Build Home account/.test(m.Subject)) throw new Error("wrong email for new sign-up");
  await shotMail(browser, m, "1-confirm-signup");
  const href = linkOf(m); log("  link host:", new URL(href).host, new URL(href).pathname, "type=" + new URL(href).searchParams.get("type"));
  await page.goto(href); await page.waitForURL(/\/account/, { timeout: 20000 });
  log("  after confirm →", new URL(page.url()).pathname + new URL(page.url()).search);
  await page.screenshot({ path: `${OUT}/flow-1-confirmed.png` }); await ctx.close();
}
// 2. log in with the password
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(`${B}/en/login`); await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw1);
  await page.click('button[type="submit"]'); await page.waitForURL(/\/account/, { timeout: 20000 });
  log("2 log in → ", new URL(page.url()).pathname); await ctx.close();
}
// 3. password reset → reset email → choose a new password → log in with it
{
  t0 = Date.now(); await sleep(1100);
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(`${B}/en/login`); await page.fill('input[type="email"]', email);
  await page.getByText("Forgotten your password").click(); await page.getByText("we sent you a reset link").waitFor({ timeout: 15000 });
  const m = await waitMail(email, "Reset", t0); log("3 reset → email:", JSON.stringify(m.Subject));
  await shotMail(browser, m, "2-reset-password");
  await page.goto(linkOf(m)); await page.waitForURL(/\/account\/password/, { timeout: 20000 });
  log("  link opens →", new URL(page.url()).pathname);
  const pwInputs = page.locator('input[type="password"]'); await pwInputs.nth(0).fill(pw2); await pwInputs.nth(1).fill(pw2);
  await page.click('button[type="submit"]'); await page.waitForURL(/\/(login|account)(?!\/password)/, { timeout: 20000 });
  await ctx.close();
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  await p2.goto(`${B}/en/login`); await p2.fill('input[type="email"]', email); await p2.fill('input[type="password"]', pw2);
  await p2.click('button[type="submit"]'); await p2.waitForURL(/\/account/, { timeout: 20000 });
  log("  log in with the NEW password →", new URL(p2.url()).pathname); await c2.close();
}
// 4. the bug: someone booked a call first (account created, never confirmed) then signs up
{
  const booked = `booked-first-${ts}@example.test`;
  const { error } = await admin.auth.admin.createUser({ email: booked, email_confirm: false, user_metadata: { full_name: "Booked First" } });
  if (error) throw error;
  t0 = Date.now(); await sleep(1100);
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await fillSignup(page, booked); await page.getByText("Check your email").waitFor({ timeout: 15000 });
  const m = await waitMail(booked, "", t0); await sleep(1500);
  log("4 booked-a-call email signs up → emails:", JSON.stringify(await mailsFor(booked, t0)));
  if (!/Confirm/.test(m.Subject)) throw new Error("booked user got the wrong email");
  await page.goto(linkOf(m)); await page.waitForURL(/\/account/, { timeout: 20000 });
  log("  confirm link →", new URL(page.url()).pathname, "(signed in)"); await ctx.close();
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  await p2.goto(`${B}/en/login`); await p2.fill('input[type="email"]', booked); await p2.fill('input[type="password"]', pw1);
  await p2.click('button[type="submit"]'); await p2.waitForURL(/\/account/, { timeout: 20000 });
  log("  logs in with the password chosen at sign-up ✓"); await c2.close();
}
// 5. email that already has an account → clear message, no email sent
{
  t0 = Date.now(); await sleep(1100);
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  await fillSignup(page, email); const box = page.getByTestId("signup-exists"); await box.waitFor({ timeout: 15000 });
  log("5 existing email → message:", JSON.stringify((await box.locator("p").first().innerText())));
  await box.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/flow-5-exists.png` });
  await sleep(2500); log("  emails sent:", JSON.stringify(await mailsFor(email, t0))); await ctx.close();
}
// 6. the other branded emails: invite, magic link, change email
{
  t0 = Date.now(); await sleep(1100);
  const inv = `invited-${ts}@example.test`;
  const { error: e1 } = await admin.auth.admin.inviteUserByEmail(inv, { redirectTo: `${B}/account/password` }); if (e1) throw e1;
  const mi = await waitMail(inv, "invited", t0); log("6 invite email:", JSON.stringify(mi.Subject)); await shotMail(browser, mi, "5-invite");
  const ctx = await browser.newContext(); const page = await ctx.newPage(); await page.goto(linkOf(mi)); await page.waitForURL(/\/account\/password/, { timeout: 20000 });
  log("  invite link opens →", new URL(page.url()).pathname); await ctx.close();

  t0 = Date.now(); await sleep(1100);
  const { error: e2 } = await anonC().auth.signInWithOtp({ email, options: { shouldCreateUser: false } }); if (e2) throw e2;
  const mm = await waitMail(email, "sign-in link", t0); log("  magic link email:", JSON.stringify(mm.Subject)); await shotMail(browser, mm, "3-magic-link");
  const c3 = await browser.newContext(); const p3 = await c3.newPage(); await p3.goto(linkOf(mm)); await p3.waitForURL(/\/account/, { timeout: 20000 });
  log("  magic link opens →", new URL(p3.url()).pathname); await c3.close();

  t0 = Date.now(); await sleep(1100);
  const u = anonC(); const { error: e3 } = await u.auth.signInWithPassword({ email, password: pw2 }); if (e3) throw e3;
  const newMail = `changed-${ts}@example.test`; const { error: e4 } = await u.auth.updateUser({ email: newMail }); if (e4) throw e4;
  const mc = await waitMail(newMail, "new email", t0); log("  change-email email:", JSON.stringify(mc.Subject)); await shotMail(browser, mc, "4-change-email");
}
await browser.close(); console.log("ALL PASSED");
