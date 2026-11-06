# LBH — Let's Build Home

Mobile-first website and client portal (installable as a PWA) for a Zimbabwe-based
company that helps Zimbabweans living abroad **verify land, buy building materials
and follow their build — without being there.**

> Build back home — without being there.
> *Your money never moves without your permission.*

## Stack

- **Next.js** (App Router, TypeScript) + **Tailwind CSS v4** — deploys to Vercel
  (Pro plan before going live; Hobby does not allow commercial use).
- **next-intl** — English, Shona and Ndebele from day one. English is the master
  copy; `messages/sn.json` and `messages/nd.json` are drafts marked
  `"_meta": { "needs_review": true }` until a native speaker reviews them.
- Planned (next phases, pending owner sign-off): **Supabase** (Postgres, Auth,
  Storage, Realtime), **Paynow** for payments (sandbox first), **Resend** for email.

## Getting started

```bash
npm install
npm run dev
```

## Project conventions

- **Design tokens** live in `src/app/globals.css` (`@theme`): forest green
  `#163A2B`, gold `#C9A227`, off-white `#F8F6F1`, text `#1B1F1C`, muted
  `#5E6862`, borders `#E4E1D8`. **No orange anywhere.**
- **No prices on public pages.** Prices only ever appear inside a client's own
  quote (portal, later phase).
- All user-facing text comes from `messages/<locale>.json` — never hard-code copy.
- Photo slots: drop final photos into `public/images/` as `hero.jpg`, `land.jpg`,
  `materials.jpg`, `monitoring.jpg`, `camera.jpg`, `live-feed.jpg` (current files
  are clearly-labelled placeholders).
- Contact details (`src/config/site.ts`) are placeholders, overridable via
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`
  until the real domain / email / WhatsApp number are chosen.

## Build phases

1. ✅ **Foundation** — setup, design tokens, components, i18n (EN/SN/ND), security headers.
2. ✅ **Public website** — homepage matching the approved mockups (full-bleed hero),
   services, how it works, about, contact, book-a-call form, terms, privacy,
   floating WhatsApp button, PWA manifest.
3. ⬜ **Booking & client portal** — Supabase auth + roles, persist bookings,
   requests (land + materials), quotes + accept, chat. *(Booking form currently
   validates server-side but does not yet persist — wired to Supabase in this phase.)*
4. ⬜ **Field portal & reports** — jobs, GPS/time-stamped capture, receipts,
   draft → admin review → publish, PDF report.
5. ⬜ **Payments** — Paynow (test mode) + manual proof flow, deposits/balances,
   extra-cost approvals, invoices.
6. ⬜ **Admin dashboard** — settings, notifications.
7. ⬜ **Launch hardening** — security review, accessibility, performance,
   translation review list.

## Open items (owner input needed)

- Domain name (placeholder: `letsbuildhome.co.zw`) and contact email / WhatsApp number.
- Zimbabwe entity name and registration details (for invoices; placeholder
  `[LBH ZIMBABWE ENTITY NAME · REG NUMBER]` appears in the Terms).
- Per-km travel rate and service fees (admin settings — never public).
- Final photos for `public/images/`.
- Supabase region + database schema sign-off before Phase 3 begins.
