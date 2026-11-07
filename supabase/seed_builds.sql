-- ============================================================
-- SAMPLE build project (construction stages) — LOCAL / TEST ONLY.
-- Idempotent: safe to run again; does nothing if already loaded.
--
-- client@lbh.test → "SAMPLE — Family home, Stand 412"
--   Foundation: fully done (bought by agent, inspected by admin, approved)
--   Slab: quoting — two supplier quotes waiting for the client
--   Window level, Wall plate, Roof, Finishes: locked
-- Photos for these rows are uploaded by scripts/upload-sample-files.mjs
-- ============================================================
do $$
declare
  v_admin  uuid := '00000000-0000-4000-a000-000000000001';
  v_agent  uuid := '00000000-0000-4000-a000-000000000003';
  v_client uuid := '00000000-0000-4000-a000-000000000004';
  v_req    uuid := '50000000-0000-4000-a000-000000000001';
  s1 uuid := '51000000-0000-4000-a000-000000000001';
  s2 uuid := '51000000-0000-4000-a000-000000000002';
  s3 uuid := '51000000-0000-4000-a000-000000000003';
  s4 uuid := '51000000-0000-4000-a000-000000000004';
  s5 uuid := '51000000-0000-4000-a000-000000000005';
  s6 uuid := '51000000-0000-4000-a000-000000000006';
  v_receipt uuid := '52000000-0000-4000-a000-000000000001';
  v_pay uuid := '53000000-0000-4000-a000-000000000001';
begin
  if exists (select 1 from public.service_requests where id = v_req) then
    return;
  end if;

  insert into public.service_requests (id, client_id, type, status, title, details)
  values (v_req, v_client, 'build', 'on_site', 'SAMPLE — Family home, Stand 412',
          '{"site_address":"SAMPLE Stand 412, Harare South","notes":"SAMPLE 3-bedroom house"}');

  insert into public.jobs (request_id, assigned_to, status, created_by)
  values (v_req, v_agent, 'in_progress', v_admin);

  insert into public.build_stages (id, request_id, position, name, description, status) values
    (s1, v_req, 1, 'Foundation',   'Excavation, concrete footings and foundation walls up to slab level.', 'quoting'),
    (s2, v_req, 2, 'Slab',         'Hardcore fill, damp-proof membrane, mesh and concrete floor slab.', 'locked'),
    (s3, v_req, 3, 'Window level', 'Brickwork from slab up to window-sill level.', 'locked'),
    (s4, v_req, 4, 'Wall plate',   'Brickwork up to wall-plate level, lintels and ring beam.', 'locked'),
    (s5, v_req, 5, 'Roof',         'Roof trusses, purlins and roof sheets or tiles.', 'locked'),
    (s6, v_req, 6, 'Finishes',     'Plaster, floors, windows, doors, plumbing, electrics and paint.', 'locked');

  -- Foundation: quote approved + paid
  insert into public.stage_quotes (stage_id, request_id, supplier_name, amount_cents, items, status, approved_at, approved_by_name, created_by)
  values (s1, v_req, 'SAMPLE BuildMart Harare', 185000,
          E'Cement 42.5N — 80 bags\nRiver sand — 3 loads\nStone 19mm — 3 loads\nY12 rebar — 40 lengths',
          'approved', now() - interval '20 days', 'SAMPLE Tatenda Moyo', v_admin);
  update public.build_stages set status = 'quote_approved' where id = s1;
  update public.build_stages set status = 'paid' where id = s1;
  insert into public.payments (id, request_id, stage_id, kind, method, status, amount_cents,
                               merchant_reference, created_by, confirmed_by, confirmed_at)
  values (v_pay, v_req, s1, 'materials', 'manual', 'confirmed', 185000,
          'LBH-STG-SAMPLE0001', v_client, v_admin, now() - interval '19 days');
  insert into public.invoices (request_id, payment_id, stage_id, kind, amount_cents, details)
  values (v_req, v_pay, s1, 'materials', 185000, '{"stage":"Foundation","supplier":"SAMPLE BuildMart Harare"}');

  -- Bought by the field agent, with receipt photo
  insert into public.media (id, request_id, stage_id, uploader_id, kind, storage_path, original_name,
                            uploaded_at, amount_cents, note)
  values (v_receipt, v_req, s1, v_agent, 'receipt', 'stages/' || s1 || '/sample-receipt.jpg',
          'SAMPLE receipt', now() - interval '18 days', 185000, 'SAMPLE — BuildMart receipt');
  insert into public.stage_purchases (stage_id, request_id, purchased_by, supplier_name, amount_cents, receipt_media_id, note)
  values (s1, v_req, v_agent, 'SAMPLE BuildMart Harare', 185000, v_receipt, 'SAMPLE — all items collected');

  -- Delivered + builders worked
  insert into public.media (request_id, stage_id, uploader_id, kind, storage_path, original_name, uploaded_at, note)
  values (v_req, s1, v_agent, 'delivery', 'stages/' || s1 || '/sample-delivery.jpg', 'SAMPLE delivery',
          now() - interval '17 days', 'SAMPLE — delivered to site');
  update public.build_stages set status = 'delivered' where id = s1;
  update public.build_stages set status = 'building' where id = s1;
  insert into public.media (request_id, stage_id, uploader_id, kind, storage_path, original_name, uploaded_at, note)
  values (v_req, s1, v_agent, 'progress', 'stages/' || s1 || '/sample-progress.jpg', 'SAMPLE progress',
          now() - interval '12 days', 'SAMPLE — footings poured');

  -- Inspected by ADMIN (not the buyer)
  insert into public.media (request_id, stage_id, uploader_id, kind, storage_path, original_name, uploaded_at, note)
  values (v_req, s1, v_admin, 'inspection', 'stages/' || s1 || '/sample-inspection.jpg', 'SAMPLE inspection',
          now() - interval '8 days', 'SAMPLE — foundation walls complete');
  insert into public.stage_inspections (stage_id, request_id, inspector_id, notes, materials_used)
  values (s1, v_req, v_admin, 'SAMPLE — Footings and foundation walls built to plan. Levels checked.',
          '[{"item":"Cement 42.5N","quantity":"78 bags (2 returned)"},{"item":"River sand","quantity":"3 loads"},{"item":"Stone 19mm","quantity":"3 loads"},{"item":"Y12 rebar","quantity":"40 lengths"}]');

  -- Client approved → Slab opens for quotes
  update public.build_stages set status = 'approved', approved_by_name = 'SAMPLE Tatenda Moyo' where id = s1;
  update public.build_stages set status = 'quoting' where id = s2;
  insert into public.stage_quotes (stage_id, request_id, supplier_name, amount_cents, items, created_by) values
    (s2, v_req, 'SAMPLE BuildMart Harare', 142000,
     E'Cement 42.5N — 60 bags\nRef 193 mesh — 12 sheets\nDPC membrane — 2 rolls\nHardcore — 4 loads', v_admin),
    (s2, v_req, 'SAMPLE Msasa Hardware', 136500,
     E'Cement 42.5N — 60 bags\nRef 193 mesh — 12 sheets\nDPC membrane — 2 rolls\nHardcore — 4 loads (delivery extra)', v_admin);

  perform public.log_audit('seed.builds_loaded', 'system', null, '{"note":"SAMPLE DATA"}');
end $$;
