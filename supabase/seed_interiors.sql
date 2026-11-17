-- SAMPLE interiors project for client@lbh.test (test data only)
do $$
declare
  v_client uuid := '00000000-0000-4000-a000-000000000004';
  v_req uuid := '70000000-0000-4000-a000-000000000001';
begin
  insert into public.service_requests (id, client_id, type, status, title, details)
  values (v_req, v_client, 'interiors', 'deposit_paid', 'SAMPLE — Interiors, Family home, Stand 412',
          jsonb_build_object('location', 'Harare South', 'house_status', 'nearly_finished',
                             'rooms', jsonb_build_array('living', 'kitchen', 'main_bedroom'),
                             'budget', '5k_10k', 'timeline', '1_3_months',
                             'styles', 'SAMPLE Warm, simple, wood and light colours', 'slot', 'evening'))
  on conflict (id) do nothing;

  insert into public.interior_items (id, request_id, room, name, shop, qty, price_cents, status, chosen_at)
  values
    ('71000000-0000-4000-a000-000000000001', v_req, 'living', 'SAMPLE 3-seater sofa, grey fabric', 'SAMPLE Harare Furnishers', 1, 64000, 'chosen', now() - interval '1 day'),
    ('71000000-0000-4000-a000-000000000002', v_req, 'living', 'SAMPLE 3-seater sofa, brown leather', 'SAMPLE Home Style', 1, 89000, 'declined', null),
    ('71000000-0000-4000-a000-000000000003', v_req, 'living', 'SAMPLE Curtains, linen, 2 pairs', 'SAMPLE Fabric World', 2, 9500, 'option', null),
    ('71000000-0000-4000-a000-000000000004', v_req, 'kitchen', 'SAMPLE Fridge-freezer, 300 L', 'SAMPLE Appliance Centre', 1, 72000, 'bought', now() - interval '2 days')
  on conflict (id) do nothing;
  update public.interior_items set bought_at = now() - interval '1 day' where id = '71000000-0000-4000-a000-000000000004' and bought_at is null;
end $$;
