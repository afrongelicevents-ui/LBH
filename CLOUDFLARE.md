# Running LBH on Cloudflare Workers

Branch `cloudflare`. Built with OpenNext (`@opennextjs/cloudflare`).

- Build: `npm run cf:build` · Local run: `npm run cf:preview` · Deploy: `npm run cf:deploy`
- Config: `wrangler.jsonc` (worker `lbh`, Images binding, daily cron 07:17 UTC), `worker.ts` (app + cron), `open-next.config.ts`
- Needs the **Workers Paid** plan ($5/month): pages need more than the free plan's 10 ms CPU.
- Tested: full e2e suite (`tests/e2e/smoke.mjs`) passes against `wrangler dev` with local Supabase (104/104).

## Settings
Build-time (Workers Builds → build variables), inlined into the browser code:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`

Runtime (Worker → Settings → Variables and secrets), same values as on Vercel:
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PAYNOW_RESULT_URL`, `PAYMENTS_TEST_MODE`, `CRON_SECRET`, plus the five `NEXT_PUBLIC_*` above.

Workers Builds: build command `npm run cf:build`, deploy command `npx wrangler deploy`.

## What changed vs Vercel
- Photos re-encoded with the Cloudflare Images binding (sharp still used under Node) — `src/lib/imageOps.ts`
- EXIF read with `exifr`; receipts read on the phone (tesseract.js, files in `/ocr`, copied at build)
- PDFs use pdfkit's self-contained build on Cloudflare (`CF_BUILD=1` alias in `next.config.ts`)
- `cookie@0.7` pinned for OpenNext (cookie@1 crashed the middleware on any request with cookies)
