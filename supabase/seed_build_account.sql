-- ============================================================
-- SAMPLE data for the LBH Build Account — LOCAL / TEST ONLY.
-- Safe to re-run. Everything is labelled SAMPLE.
--
--   client@lbh.test  → has a construction build with LBH → Build Account FREE
--     accounts: LBH account (filled automatically from portal payments and
--               materials LBH bought) + "SAMPLE Brother Farai" family account
--     client2@lbh.test is invited as Farai (can add receipts) and holds
--     the family account
--   client2@lbh.test → no build → sees the paid plan
-- ============================================================
do $$
declare
  v_client  uuid := '00000000-0000-4000-a000-000000000004';
  v_client2 uuid := '00000000-0000-4000-a000-000000000005';
  v_member  uuid := '60000000-0000-4000-a000-000000000001';
  v_lbh     uuid := '61000000-0000-4000-a000-000000000001';
  v_family  uuid := '61000000-0000-4000-a000-000000000002';
begin
  if not exists (select 1 from public.profiles where id = v_client) then return; end if;

  update public.settings set
    build_account_monthly_cents = coalesce(build_account_monthly_cents, 500),
    build_account_yearly_cents = coalesce(build_account_yearly_cents, 5000)
  where id = 1;

  insert into public.price_list (item, unit, area, price_cents)
  select * from (values
    ('SAMPLE Cement 42.5N', 'bag (50 kg)', 'Harare', 1150),
    ('SAMPLE River sand', 'load (7 t)', 'Harare', 9000),
    ('SAMPLE Pit sand', 'load (7 t)', 'Harare', 8000),
    ('SAMPLE Common bricks', '1,000 bricks', 'Harare', 9500),
    ('SAMPLE Cement blocks 6"', '1,000 blocks', 'Harare', 75000),
    ('SAMPLE Stone 19mm', 'load (7 t)', 'Harare', 11000),
    ('SAMPLE Brickforce', 'roll', 'Harare', 400),
    ('SAMPLE Y12 rebar', 'length (6 m)', 'Harare', 750)
  ) as v(item, unit, area, price_cents)
  where not exists (select 1 from public.price_list);

  insert into public.ba_members (id, owner_id, name, whatsapp, role, user_id, status, accepted_at)
  values (v_member, v_client, 'SAMPLE Brother Farai', '+263 77 000 0001', 'add', v_client2, 'active', now())
  on conflict (id) do nothing;

  insert into public.ba_accounts (id, owner_id, name, kind) values
    (v_lbh, v_client, 'LBH account', 'lbh')
  on conflict do nothing;
  insert into public.ba_accounts (id, owner_id, name, kind, holder_member_id) values
    (v_family, v_client, 'SAMPLE Brother Farai', 'family', v_member)
  on conflict (id) do nothing;

  insert into public.ba_entries
    (id, owner_id, account_id, direction, amount_cents, fee_cents, occurred_on, description, service,
     status, confirmed_by, confirmed_at, source, created_by)
  values
    ('62000000-0000-4000-a000-000000000001', v_client, v_family, 'in', 60000, 1800, current_date - 20,
     'SAMPLE Sent to Farai for bricks', 'mukuru', 'confirmed', v_client2, now() - interval '19 days', 'manual', v_client),
    ('62000000-0000-4000-a000-000000000002', v_client, v_family, 'in', 30000, 900, current_date - 2,
     'SAMPLE Sent to Farai for the builders', 'worldremit', 'pending', null, null, 'manual', v_client)
  on conflict (id) do nothing;

  insert into public.ba_entries
    (id, owner_id, account_id, direction, amount_cents, occurred_on, description, shop, stage_name, items,
     source, created_by)
  values
    ('62000000-0000-4000-a000-000000000003', v_client, v_family, 'out', 19000, current_date - 15,
     'SAMPLE Common bricks', 'SAMPLE Ruwa Brick Supply', 'Window level',
     '[{"name":"SAMPLE Common bricks","qty":2,"unit_cents":9500,"total_cents":19000}]', 'manual', v_client2),
    ('62000000-0000-4000-a000-000000000004', v_client, v_family, 'out', 13500, current_date - 9,
     'SAMPLE Cement — no receipt yet', 'SAMPLE Corner shop', 'Window level',
     '[{"name":"SAMPLE Cement 42.5N","qty":10,"unit_cents":1350,"total_cents":13500}]', 'manual', v_client2)
  on conflict (id) do nothing;

  insert into public.ba_budgets (owner_id, stage_name, budget_cents) values
    (v_client, 'Foundation', 180000), (v_client, 'Slab', 150000), (v_client, 'Window level', 30000)
  on conflict do nothing;
end $$;
