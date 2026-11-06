# LBH — Let's Build Home

Mobile-first website and client portal (installable as a PWA) for a Zimbabwe-based
company that helps Zimbabweans living abroad **verify land, buy building materials
and follow their build — without being there.**

> Build back home — without being there.
> *Your money never moves without your permission.*

## What is in here

| Area | URL | Who |
|---|---|---|
| Public website (EN / Shona / Ndebele) | `/`, `/services`, `/how-it-works`, `/about`, `/contact`, `/book-a-call`, `/terms`, `/privacy` | Everyone |
| Client portal | `/portal` | Clients |
| Field team portal | `/field` | Lawyer, field agents (2FA required) |
| Admin dashboard | `/admin` | LBH admin (2FA required) |

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**, **next-intl** for EN/SN/ND.
- **Supabase** — Postgres with row-level security, Auth (TOTP 2FA), Storage (private buckets), Realtime (chat).
- **Paynow** for online payments (simulated test mode until merchant keys are set).
- **pdfkit** for quote / invoice / report PDFs, **sharp** for image re-encoding, **Leaflet/OpenStreetMap** for map pins.
- **Resend** for email (falls back to logging emails in the server console).

## Run it locally

Requires Node 20+ and Docker.

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage/Realtime in Docker
npx supabase db reset       # schema + clearly labelled SAMPLE data
cp .env.example .env.local  # then paste the keys printed by `npx supabase status`
npm run dev                 # http://localhost:3000
```

### Sample logins (local only — all marked SAMPLE)

Password for every account: `Lbh-Sample-2026`

| Email | Role | What to try |
|---|---|---|
| `client@lbh.test` | Client | Accept quote #1001, pay the deposit, approve the extra trip, pick a supplier, chat |
| `client2@lbh.test` | Client | Read a published land report with verdict + PDF |
| `agent@lbh.test` | Field agent | Assigned jobs, checklist, photo/receipt capture, draft report |
| `lawyer@lbh.test` | Field (lawyer) | Has no jobs — shows field staff only see their own |
| `admin@lbh.test` | Admin | Needs-you queue, quote builder, publish reports, confirm payments |

Staff accounts are asked to set up an authenticator app (Google Authenticator, Authy,
1Password…) on first login — scan the QR code, enter the 6-digit code.

### Payments in test mode

With `PAYNOW_INTEGRATION_ID` / `PAYNOW_INTEGRATION_KEY` empty **and**
`PAYMENTS_TEST_MODE=true`, "Pay online" opens a clearly labelled **simulated
checkout** where you choose success or failure. No money moves. Without that flag
(e.g. a production deploy that has no Paynow keys yet) online payment is simply
hidden and clients use "I paid via Remitly / WorldRemit / bank" instead. Once real
Paynow credentials are set (test keys first), the simulator is switched off for good.

## Tests

```bash
npm test            # unit tests + 43 database permission tests (needs `npx supabase start`)
npm run lint

# full browser end-to-end run of every flow:
npx supabase db reset && npm run build && npm run start   # in one terminal
npm run test:e2e                                          # in another
```

The permission tests sign in as each sample role and call the database directly, proving
the rules hold even if someone bypasses the website: clients only see their own data,
field staff never see prices or client contact details, nobody publishes their own
report (and the author can't be swapped to get round it), approvals and quote acceptance
only by the owning client, and **staff without 2FA get no data at all** — even with the
correct password.

## Project conventions

- **Design tokens** in `src/app/globals.css`: forest green `#163A2B`, gold `#C9A227`,
  off-white `#F8F6F1`. **No orange anywhere.**
- **No prices on public pages** — prices only appear inside a client's own quote.
  A test fails if a dollar amount appears in the public copy.
- **All text in `messages/<locale>.json`** — never hard-coded. A test enforces that all
  three files have the same keys. Shona/Ndebele are drafts (`needs_review: true`);
  admins tick strings off at `/admin/translations`.
- **Money** is USD integer cents everywhere; every money event is in the audit log.
- **Photos**: drop final photos into `public/images/` with the same names
  (`hero.jpg`, `land.jpg`, `materials.jpg`, `monitoring.jpg`, `camera.jpg`,
  `live-feed.jpg`). The current files are cut from the approved mockups as stand-ins;
  they are low resolution, so replace them before launch (hero: at least 2000 px wide,
  building on the right half of the frame).

## Deploying (when ready)

1. Create a Supabase project on a **paid plan** (backups), push the schema:
   `npx supabase link --project-ref <ref> && npx supabase db push`. Do **not** run the
   seed file in production. In the dashboard enable TOTP MFA, set the site URL, and
   configure SMTP for auth emails.
2. Deploy to **Vercel Pro** (Hobby does not allow commercial use) with the env vars
   from `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only, and
   `PAYMENTS_TEST_MODE` must be unset or `false` in production.
3. Paynow: add the merchant integration ID/key and set `PAYNOW_RESULT_URL` to
   `https://<domain>/api/paynow/result`.
4. Create the first admin: invite them in Supabase Auth, then set
   `raw_app_meta_data.role = 'admin'` for that user (later admins are invited from
   `/admin/settings`).

## Open items (owner input needed)

- Domain name (placeholder `letsbuildhome.co.zw`), contact email and WhatsApp number
  (set in `/admin/settings` and the env vars).
- Zimbabwe entity name and registration details — placeholder
  `[LBH ZIMBABWE ENTITY NAME · REG NUMBER]` appears on invoices, PDFs and Terms.
- Per-km travel rate and service fees (entered in `/admin/settings`; sample rate is $0.50/km).
- Final photos for `public/images/`.
- Native-speaker review of the Shona and Ndebele text.
- Supabase hosting region, and Paynow merchant account.
