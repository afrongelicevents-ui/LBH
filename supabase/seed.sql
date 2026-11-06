-- ============================================================
-- LBH sample data — LOCAL / TEST ONLY. Everything here is
-- clearly labelled SAMPLE. Never run against production.
--
-- Sample logins (password for all: Lbh-Sample-2026):
--   admin@lbh.test   — admin
--   lawyer@lbh.test  — field (lawyer)
--   agent@lbh.test   — field (field agent)
--   client@lbh.test  — client (diaspora, UK)
--   client2@lbh.test — client with a published report
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  v_admin  uuid := '00000000-0000-4000-a000-000000000001';
  v_lawyer uuid := '00000000-0000-4000-a000-000000000002';
  v_agent  uuid := '00000000-0000-4000-a000-000000000003';
  v_client uuid := '00000000-0000-4000-a000-000000000004';
  v_client2 uuid := '00000000-0000-4000-a000-000000000005';
  v_pwd text := crypt('Lbh-Sample-2026', gen_salt('bf'));
  v_req_land uuid := '10000000-0000-4000-a000-000000000001';
  v_req_mat uuid := '10000000-0000-4000-a000-000000000002';
  v_req_done uuid := '10000000-0000-4000-a000-000000000003';
  v_quote uuid := '20000000-0000-4000-a000-000000000001';
  v_quote2 uuid := '20000000-0000-4000-a000-000000000002';
  v_job uuid := '30000000-0000-4000-a000-000000000001';
  v_job_done uuid := '30000000-0000-4000-a000-000000000002';
  v_report uuid := '40000000-0000-4000-a000-000000000001';
begin
  -- ----- users (trigger creates profiles; role from app_metadata) -----
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change, email_change_token_new)
  values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
     'admin@lbh.test', v_pwd, now(),
     '{"provider":"email","providers":["email"],"role":"admin"}',
     '{"full_name":"SAMPLE Admin (LBH)"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_lawyer, 'authenticated', 'authenticated',
     'lawyer@lbh.test', v_pwd, now(),
     '{"provider":"email","providers":["email"],"role":"field"}',
     '{"full_name":"SAMPLE Lawyer"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_agent, 'authenticated', 'authenticated',
     'agent@lbh.test', v_pwd, now(),
     '{"provider":"email","providers":["email"],"role":"field"}',
     '{"full_name":"SAMPLE Field Agent"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_client, 'authenticated', 'authenticated',
     'client@lbh.test', v_pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"SAMPLE Tatenda Moyo","country":"uk","whatsapp":"+44 7700 900123"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_client2, 'authenticated', 'authenticated',
     'client2@lbh.test', v_pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"SAMPLE Nomsa Dube","country":"sa","whatsapp":"+27 82 000 0000"}',
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email),
         'email', now(), now(), now()
  from auth.users u
  where u.email like '%@lbh.test'
  on conflict do nothing;

  -- ----- settings: sample call slots -----
  update public.settings set
    call_slots = '[
      {"id":"slot-1","label":"SAMPLE Mon 10:00 (CAT)"},
      {"id":"slot-2","label":"SAMPLE Wed 18:00 (CAT)"},
      {"id":"slot-3","label":"SAMPLE Sat 09:00 (CAT)"}
    ]'::jsonb,
    per_km_rate_cents = 50,
    deposit_pct = 50
  where id = 1;

  -- ----- a new call booking in the admin "Needs you" queue -----
  insert into public.call_bookings
    (client_id, name, email, whatsapp, country, service, description,
     preferred_slot, call_type, status)
  values
    (null, 'SAMPLE Kuda Ncube', 'sample-kuda@example.test', '+1 555 0100', 'usa',
     'land', 'SAMPLE — I was offered a stand in Ruwa and want it checked.',
     'morning', 'phone', 'new');

  -- ----- land verification request: quote SENT (client can accept + pay) ---
  insert into public.service_requests (id, client_id, type, status, title, details)
  values (v_req_land, v_client, 'land_verification', 'quote_sent',
    'SAMPLE — Stand 412, Harare South',
    '{"town":"Harare South","stand_number":"412",
      "pin_lat":-17.9257,"pin_lng":31.0405,
      "introduced_by":"SAMPLE — A family friend",
      "told_about":"SAMPLE — Told it is 300 sqm with title deed ready"}');

  insert into public.quotes
    (id, request_id, status, deposit_pct, total_cents, notes, created_by, sent_at)
  values
    (v_quote, v_req_land, 'sent', 50, 42000,
     'SAMPLE quote — figures are test data only.', v_admin, now());

  insert into public.quote_lines (quote_id, kind, description, qty, unit_cents, total_cents, position)
  values
    (v_quote, 'service_fee', 'SAMPLE Land verification & due diligence (lawyer included)', 1, 30000, 30000, 1),
    (v_quote, 'travel', 'SAMPLE Estimated travel: 60 km × $0.50/km × 4 trips', 240, 50, 12000, 2);

  -- ----- materials request with supplier quotes to compare -----
  insert into public.service_requests (id, client_id, type, status, title, details)
  values (v_req_mat, v_client, 'materials', 'deposit_paid',
    'SAMPLE — Foundation materials, Stand 412',
    '{"site_address":"SAMPLE Stand 412, Harare South",
      "items":[{"item":"Cement PC15 42.5N","quantity":"60 bags","notes":""},
               {"item":"River sand","quantity":"2 loads","notes":"SAMPLE"},
               {"item":"Brickforce","quantity":"20 rolls","notes":""}],
      "needed_by":"2026-12-01",
      "delivery_instructions":"SAMPLE — Deliver to site, call caretaker"}');

  insert into public.supplier_quotes (request_id, supplier_name, amount_cents, details, status)
  values
    (v_req_mat, 'SAMPLE Supplier A (Harare)', 98000, 'SAMPLE — 60 bags + sand + brickforce, delivery included', 'pending'),
    (v_req_mat, 'SAMPLE Supplier B (Msasa)', 91500, 'SAMPLE — same list, delivery extra', 'pending');

  -- pending extra-cost approval on the materials request
  insert into public.approvals
    (request_id, title, reason, field_note, amount_cents, status, created_by)
  values
    (v_req_mat, 'SAMPLE Extra trip — council fee office',
     'SAMPLE — Council requires an in-person payment of the inspection fee; one extra trip needed.',
     'SAMPLE field note: office only takes cash, Tuesday mornings.',
     3500, 'pending', v_admin);

  -- ----- completed land verification for client2: published report -----
  insert into public.service_requests (id, client_id, type, status, title, details)
  values (v_req_done, v_client2, 'land_verification', 'report_ready',
    'SAMPLE — Stand 88, Bulawayo (Emganwini)',
    '{"town":"Emganwini, Bulawayo","stand_number":"88",
      "pin_lat":-20.2101,"pin_lng":28.5302,
      "introduced_by":"SAMPLE — Agent on social media",
      "told_about":"SAMPLE — Told it is fully serviced"}');

  insert into public.quotes
    (id, request_id, status, deposit_pct, total_cents, notes, created_by, sent_at,
     accepted_at, accepted_by_name)
  values
    (v_quote2, v_req_done, 'accepted', 50, 38000, 'SAMPLE quote.', v_admin,
     now() - interval '20 days', now() - interval '18 days', 'SAMPLE Nomsa Dube');

  insert into public.payments
    (request_id, quote_id, kind, method, status, amount_cents, merchant_reference,
     created_by, confirmed_by, confirmed_at)
  values
    (v_req_done, v_quote2, 'deposit', 'manual', 'confirmed', 19000,
     'LBH-SAMPLE-DEP-0001', v_client2, v_admin, now() - interval '17 days');

  insert into public.jobs (id, request_id, assigned_to, status, checklist, visit, created_by)
  values
    (v_job_done, v_req_done, v_agent, 'completed',
     '{"arrived":true,"council_officer_present":true,"pegs_shown":true,
       "measurements_taken":true,"documents_checked":true}',
     '{"arrived":true,"council_officer_present":true,"pegs_shown":true,
       "measurements":{"length_m":20,"width_m":15,"area_sqm":300},
       "title_notes":"SAMPLE — Title deed matches seller name.",
       "findings":"SAMPLE — Pegs in place, area matches documents."}',
     v_admin),
    (v_job, v_req_land, v_agent, 'assigned', '{}', '{}', v_admin);

  insert into public.reports
    (id, request_id, job_id, author_id, status, verdict, sections,
     published_by, published_at)
  values
    (v_report, v_req_done, v_job_done, v_agent, 'published', 'concerns',
     '{"stand_details":"SAMPLE — Stand 88, Emganwini, Bulawayo. GPS -20.2101, 28.5302.",
       "legal_findings":"SAMPLE — Title is clean; cession pending at council.",
       "council_confirmation":"SAMPLE — Officer present; pegs confirmed on 2026-10-20.",
       "measurements":"SAMPLE — 20 m × 15 m = 300 sqm, matches agreement of sale.",
       "red_flags":"SAMPLE — Area is NOT fully serviced: water connection pending. Seller claim was inaccurate.",
       "next_steps":"SAMPLE — Ask seller for the council service-connection schedule before paying more.",
       "costs_summary":"SAMPLE — Travel reconciled: $5.00 under estimate, credited."}',
     v_admin, now() - interval '2 days');

  insert into public.ledger_entries (request_id, amount_cents, direction, note, created_by)
  values (v_req_done, 500, 'credit', 'SAMPLE — travel reconciliation credit', v_admin);

  -- chat thread for client 1
  insert into public.messages (client_id, sender_id, body, read_by_admin, read_by_client)
  values
    (v_client, v_client, 'SAMPLE — Hello, I sent my agreement of sale. When is the site visit?', true, true),
    (v_client, v_admin, 'SAMPLE — Received! Your quote is ready in the portal — once the deposit is in, we book the council officer.', false, true);

  -- notify-me interest
  insert into public.notify_interest (email, whatsapp, service, locale)
  values ('sample-interest@example.test', null, 'camera', 'en');

  perform public.log_audit('seed.loaded', 'system', null,
    '{"note":"SAMPLE DATA — local/test only"}');
end $$;
