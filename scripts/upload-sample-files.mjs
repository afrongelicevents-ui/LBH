/**
 * Uploads the photos referenced by supabase/seed_builds.sql (SAMPLE data).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-sample-files.mjs
 *
 * Defaults to the local stack. Safe to run again (upsert).
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // standard public demo key of every LOCAL Supabase stack
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const STAGE = "51000000-0000-4000-a000-000000000001";

const receiptSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="450" y="90" font-family="Arial" font-size="44" font-weight="bold" text-anchor="middle" fill="#1B1F1C">SAMPLE BuildMart Harare</text>
  <text x="450" y="140" font-family="Arial" font-size="26" text-anchor="middle" fill="#5E6862">TAX INVOICE — SAMPLE / TEST ONLY</text>
  <line x1="60" y1="180" x2="840" y2="180" stroke="#1B1F1C" stroke-width="3"/>
  ${[
    ["Cement 42.5N x 80", "1,040.00"],
    ["River sand x 3 loads", "270.00"],
    ["Stone 19mm x 3 loads", "300.00"],
    ["Y12 rebar x 40", "240.00"],
  ]
    .map(
      ([a, b], i) =>
        `<text x="70" y="${260 + i * 70}" font-family="Arial" font-size="32" fill="#1B1F1C">${a}</text>
         <text x="830" y="${260 + i * 70}" font-family="Arial" font-size="32" text-anchor="end" fill="#1B1F1C">${b}</text>`
    )
    .join("")}
  <line x1="60" y1="560" x2="840" y2="560" stroke="#1B1F1C" stroke-width="3"/>
  <text x="70" y="630" font-family="Arial" font-size="40" font-weight="bold" fill="#1B1F1C">TOTAL USD</text>
  <text x="830" y="630" font-family="Arial" font-size="40" font-weight="bold" text-anchor="end" fill="#1B1F1C">1,850.00</text>
  <text x="450" y="1100" font-family="Arial" font-size="28" text-anchor="middle" fill="#5E6862">SAMPLE RECEIPT — NOT A REAL TRANSACTION</text>
</svg>`;

const files = [
  ["sample-receipt.jpg", () => sharp(Buffer.from(receiptSvg)).jpeg({ quality: 85 }).toBuffer()],
  ["sample-delivery.jpg", () => sharp("public/images/materials.jpg").resize(1200).jpeg({ quality: 82 }).toBuffer()],
  ["sample-progress.jpg", () => sharp("public/images/monitoring.jpg").resize(1200).jpeg({ quality: 82 }).toBuffer()],
  ["sample-inspection.jpg", () => sharp("public/images/live-feed.jpg").resize(1200).jpeg({ quality: 82 }).toBuffer()],
];

for (const [name, make] of files) {
  const path = `stages/${STAGE}/${name}`;
  const { error } = await db.storage
    .from("media")
    .upload(path, await make(), { contentType: "image/jpeg", upsert: true });
  console.log(error ? `✗ ${path}: ${error.message}` : `✓ ${path}`);
  if (error) process.exitCode = 1;
}
