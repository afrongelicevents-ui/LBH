-- ============================================================
-- LBH sample data — lawyer title-check jobs. LOCAL / TEST ONLY.
-- Everything is clearly labelled SAMPLE. Safe to re-run.
--
-- lawyer@lbh.test gets:
--   * an open title check for Stand 412 (Harare South)
--   * a completed title check for Stand 88 (Bulawayo) with the
--     legal checklist filled in
-- ============================================================

do $$
declare
  v_admin  uuid := '00000000-0000-4000-a000-000000000001';
  v_lawyer uuid := '00000000-0000-4000-a000-000000000002';
  v_req_land uuid := '10000000-0000-4000-a000-000000000001';
  v_req_done uuid := '10000000-0000-4000-a000-000000000003';
begin
  if not exists (select 1 from public.profiles where id = v_lawyer)
     or not exists (select 1 from public.service_requests where id = v_req_land) then
    return; -- base sample data not loaded
  end if;

  insert into public.jobs
    (id, request_id, assigned_to, job_type, status, checklist, visit, created_by)
  values
    ('30000000-0000-4000-a000-000000000003', v_req_land, v_lawyer, 'title_check',
     'assigned', '{}', '{}', v_admin),
    ('30000000-0000-4000-a000-000000000004', v_req_done, v_lawyer, 'title_check',
     'completed',
     '{"title_deed":"ok","agreement_of_sale":"ok","council_records":"problem","seller_identity":"ok"}',
     '{"legal":{
        "items":{
          "title_deed":{"status":"ok","note":"SAMPLE — Deed of transfer 1234/2019 in the seller''s name, checked at the Deeds Office."},
          "agreement_of_sale":{"status":"ok","note":"SAMPLE — Signed by both parties and witnessed; stand number and size match the deed."},
          "council_records":{"status":"problem","note":"SAMPLE — Council records show the cession to the seller is still pending."},
          "seller_identity":{"status":"ok","note":"SAMPLE — National ID seen in person; matches the name on the deed."}
        },
        "findings":"SAMPLE — Title is clean, but the council cession is not complete. Do not pay the balance until the council confirms the cession.",
        "verdict":"concerns",
        "saved_at":0}}',
     v_admin)
  on conflict (id) do nothing;
end $$;
