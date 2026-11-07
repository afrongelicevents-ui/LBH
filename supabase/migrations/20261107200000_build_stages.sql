-- ============================================================
-- Construction build stages
--
-- A build project is a service_request of type 'build' with ordered stages
-- (default: Foundation → Slab → Window level → Wall plate → Roof → Finishes).
-- Each stage moves strictly through:
--   locked → quoting → quote_approved → paid → purchased → delivered
--          → building → inspected → approved   (then the next stage unlocks)
--
-- Enforced HERE, not just in the UI:
--   * every status change must be the next one in that order, and is
--     performed only by the function responsible for it (flag below)
--   * only the client approves a supplier quote and approves a stage
--   * supplier quotes only on the stage that is currently quoting —
--     locked stages can't be bought for
--   * whoever bought a stage's materials cannot inspect that stage
--   * field staff never see stage quote prices
-- ============================================================

alter type public.request_type add value if not exists 'build';
alter type public.payment_kind add value if not exists 'materials';
alter type public.media_kind add value if not exists 'delivery';
alter type public.media_kind add value if not exists 'progress';
alter type public.media_kind add value if not exists 'inspection';

create type public.stage_status as enum (
  'locked','quoting','quote_approved','paid','purchased',
  'delivered','building','inspected','approved'
);

create table public.build_stages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  position int not null check (position > 0),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  status public.stage_status not null default 'locked',
  approved_at timestamptz,
  approved_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, position) deferrable initially deferred
);

create table public.stage_quotes (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.build_stages(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  supplier_name text not null check (char_length(supplier_name) between 1 and 200),
  amount_cents int not null check (amount_cents > 0),
  items text not null default '' check (char_length(items) <= 4000),
  status public.supplier_quote_status not null default 'pending',
  approved_at timestamptz,
  approved_by_name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.stage_purchases (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.build_stages(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  purchased_by uuid not null references public.profiles(id),
  supplier_name text not null check (char_length(supplier_name) between 1 and 200),
  amount_cents int not null check (amount_cents >= 0),
  receipt_media_id uuid references public.media(id) on delete set null,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table public.stage_inspections (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.build_stages(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  inspector_id uuid not null references public.profiles(id),
  notes text not null default '' check (char_length(notes) <= 4000),
  -- [{ "item": "Cement 42.5N", "quantity": "60 bags" }, ...]
  materials_used jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.payments add column stage_id uuid references public.build_stages(id) on delete set null;
alter table public.invoices add column stage_id uuid references public.build_stages(id) on delete set null;
alter table public.media add column stage_id uuid references public.build_stages(id) on delete set null;

create index on public.build_stages (request_id, position);
create index on public.stage_quotes (stage_id);
create index on public.stage_purchases (stage_id);
create index on public.stage_inspections (stage_id);
create index on public.media (stage_id);
create index on public.payments (stage_id);

-- ---------- helpers ----------
create function public.is_assigned_to_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_field() and exists (
    select 1 from public.jobs j
    where j.request_id = p_request_id and j.assigned_to = auth.uid())
$$;

create function public.can_work_on_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin() or public.is_assigned_to_request(p_request_id) $$;

-- Only the function responsible for a step may move a stage, by setting this
-- transaction-local flag to the target status. (Not reachable via the API:
-- set_config is not exposed.) The trusted server (service role, no auth.uid)
-- may move stages too, but only in order.
create function public._stage_set(p_stage_id uuid, p_status public.stage_status)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('lbh.stage_transition', p_status::text, true);
  update public.build_stages set status = p_status where id = p_stage_id;
  perform set_config('lbh.stage_transition', '', true);
end $$;
revoke execute on function public._stage_set(uuid, public.stage_status) from public, anon, authenticated;

create function public.build_stages_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_order text[] := array['locked','quoting','quote_approved','paid','purchased',
                          'delivered','building','inspected','approved'];
  v_from int; v_to int;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'locked' then
      raise exception 'only a stage that has not started can be removed';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.status <> 'locked' then
      raise exception 'new stages start locked';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.request_id is distinct from old.request_id then
    raise exception 'a stage cannot move to another project';
  end if;
  if new.position is distinct from old.position and old.status <> 'locked' then
    raise exception 'only stages that have not started can be reordered';
  end if;
  if old.status = 'approved' and (new.name is distinct from old.name
       or new.description is distinct from old.description) then
    raise exception 'an approved stage cannot be edited';
  end if;

  if new.status is distinct from old.status then
    v_from := array_position(v_order, old.status::text);
    v_to   := array_position(v_order, new.status::text);
    if v_to <> v_from + 1 then
      raise exception 'stage must move one step at a time (% → %)', old.status, new.status;
    end if;
    if auth.uid() is not null
       and coalesce(current_setting('lbh.stage_transition', true), '') <> new.status::text then
      raise exception 'this stage step must be done through its own action';
    end if;
    if new.status = 'quoting' and exists (
      select 1 from public.build_stages s
      where s.request_id = new.request_id and s.position < new.position
        and s.status <> 'approved') then
      raise exception 'earlier stages must be approved first';
    end if;
    if new.status = 'approved' then
      new.approved_at := now();
    end if;
  end if;
  if auth.uid() is not null and new.approved_by_name is distinct from old.approved_by_name
     and coalesce(current_setting('lbh.stage_transition', true), '') <> 'approved' then
    raise exception 'approval details are set by the client approval';
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger build_stages_guard
  before insert or update or delete on public.build_stages
  for each row execute function public.build_stages_guard();

-- ---------- supplier quotes: only for the stage that is quoting ----------
create function public.stage_quotes_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_stage public.build_stages%rowtype;
begin
  select * into v_stage from public.build_stages where id = new.stage_id;
  new.request_id := v_stage.request_id;
  if tg_op = 'INSERT' then
    if v_stage.status <> 'quoting' then
      raise exception 'supplier quotes can only be added to the stage that is currently quoting';
    end if;
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.status := 'pending';
      new.approved_at := null;
      new.approved_by_name := null;
    end if;
  elsif auth.uid() is not null and (
        new.status is distinct from old.status
     or new.amount_cents is distinct from old.amount_cents
     or new.stage_id is distinct from old.stage_id) then
    if coalesce(current_setting('lbh.stage_transition', true), '') <> 'quote_approved' then
      raise exception 'quotes are decided by the client';
    end if;
  end if;
  return new;
end $$;

create trigger stage_quotes_guard
  before insert or update on public.stage_quotes
  for each row execute function public.stage_quotes_guard();

-- ---------- purchases: only after payment; purchaser recorded ----------
create function public.stage_purchases_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_stage public.build_stages%rowtype;
begin
  select * into v_stage from public.build_stages where id = new.stage_id for update;
  new.request_id := v_stage.request_id;
  if v_stage.status not in ('paid', 'purchased') then
    raise exception 'materials can only be bought for a stage the client has paid for';
  end if;
  if auth.uid() is not null then
    new.purchased_by := auth.uid();
  end if;
  if new.receipt_media_id is not null and not exists (
      select 1 from public.media m
      where m.id = new.receipt_media_id and m.stage_id = new.stage_id and m.kind = 'receipt') then
    raise exception 'receipt photo must belong to this stage';
  end if;
  return new;
end $$;

create trigger stage_purchases_guard
  before insert on public.stage_purchases
  for each row execute function public.stage_purchases_guard();

create function public.stage_purchases_after()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select status from public.build_stages where id = new.stage_id) = 'paid' then
    perform public._stage_set(new.stage_id, 'purchased');
  end if;
  perform public.log_audit('stage.purchase', 'build_stage', new.stage_id::text,
    jsonb_build_object('supplier', new.supplier_name, 'amount_cents', new.amount_cents,
                       'purchased_by', new.purchased_by));
  return new;
end $$;

create trigger stage_purchases_after
  after insert on public.stage_purchases
  for each row execute function public.stage_purchases_after();

-- ---------- inspections: the buyer can never inspect ----------
create function public.stage_inspections_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_stage public.build_stages%rowtype;
begin
  select * into v_stage from public.build_stages where id = new.stage_id for update;
  new.request_id := v_stage.request_id;
  if v_stage.status <> 'building' then
    raise exception 'a stage can be inspected only after the builders have worked on it';
  end if;
  if auth.uid() is not null then
    new.inspector_id := auth.uid();
  end if;
  if exists (select 1 from public.stage_purchases p
             where p.stage_id = new.stage_id and p.purchased_by = new.inspector_id) then
    raise exception 'the person who bought this stage''s materials cannot inspect it';
  end if;
  if jsonb_typeof(new.materials_used) <> 'array' or jsonb_array_length(new.materials_used) = 0 then
    raise exception 'list all materials used on this stage';
  end if;
  if not exists (select 1 from public.media m
                 where m.stage_id = new.stage_id and m.kind = 'inspection') then
    raise exception 'add at least one inspection photo';
  end if;
  return new;
end $$;

create trigger stage_inspections_guard
  before insert on public.stage_inspections
  for each row execute function public.stage_inspections_guard();

create function public.stage_inspections_after()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public._stage_set(new.stage_id, 'inspected');
  perform public.log_audit('stage.inspected', 'build_stage', new.stage_id::text,
    jsonb_build_object('inspector', new.inspector_id));
  return new;
end $$;

create trigger stage_inspections_after
  after insert on public.stage_inspections
  for each row execute function public.stage_inspections_after();

-- ---------- media for stages: pinned to the stage's project ----------
create or replace function public.media_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.stage_id is not null then
    select request_id into new.request_id from public.build_stages where id = new.stage_id;
    if auth.uid() is not null
       and new.storage_path not like 'stages/' || new.stage_id::text || '/%' then
      raise exception 'invalid storage path';
    end if;
  elsif new.job_id is not null then
    select request_id into new.request_id from public.jobs where id = new.job_id;
    if auth.uid() is not null
       and new.storage_path not like 'jobs/' || new.job_id::text || '/%' then
      raise exception 'invalid storage path';
    end if;
  end if;
  return new;
end $$;

-- ============================================================
-- RPCs
-- ============================================================

-- Admin starts a build: first stage opens for supplier quotes.
create function public.start_build(p_request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_first uuid;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select id into v_first from public.build_stages
   where request_id = p_request_id order by position limit 1;
  if v_first is null then raise exception 'no stages'; end if;
  if (select status from public.build_stages where id = v_first) = 'locked' then
    perform public._stage_set(v_first, 'quoting');
  end if;
  perform public.log_audit('build.started', 'service_request', p_request_id::text, '{}');
end $$;

-- Client approves ONE supplier quote for the current stage → materials payment.
create function public.approve_stage_quote(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_q public.stage_quotes%rowtype;
  v_stage public.build_stages%rowtype;
  v_name text;
  v_payment uuid;
begin
  perform public.assert_access_ok();
  select * into v_q from public.stage_quotes where id = p_quote_id for update;
  if not found then raise exception 'quote not found'; end if;
  select * into v_stage from public.build_stages where id = v_q.stage_id for update;
  if (select client_id from public.service_requests where id = v_stage.request_id)
     is distinct from auth.uid() then
    raise exception 'not your project';
  end if;
  if v_stage.status <> 'quoting' or v_q.status <> 'pending' then
    raise exception 'this quote is not open for approval';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  perform set_config('lbh.stage_transition', 'quote_approved', true);
  update public.stage_quotes
     set status = 'approved', approved_at = now(), approved_by_name = v_name
   where id = p_quote_id;
  update public.stage_quotes set status = 'rejected'
   where stage_id = v_q.stage_id and id <> p_quote_id and status = 'pending';
  perform set_config('lbh.stage_transition', '', true);
  perform public._stage_set(v_stage.id, 'quote_approved');

  insert into public.payments
    (request_id, stage_id, kind, method, status, amount_cents, merchant_reference, created_by)
  values
    (v_stage.request_id, v_stage.id, 'materials', 'paynow', 'pending', v_q.amount_cents,
     'LBH-STG-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), auth.uid())
  returning id into v_payment;

  insert into public.invoices (request_id, payment_id, stage_id, kind, amount_cents, details)
  values (v_stage.request_id, v_payment, v_stage.id, 'materials', v_q.amount_cents,
          jsonb_build_object('stage', v_stage.name, 'supplier', v_q.supplier_name));

  perform public.log_audit('stage.quote_approved', 'build_stage', v_stage.id::text,
    jsonb_build_object('quote', p_quote_id, 'amount_cents', v_q.amount_cents, 'by', v_name));
  return v_payment;
end $$;

-- Staff: materials delivered / builders started.
create function public.advance_stage_work(p_stage_id uuid, p_to public.stage_status)
returns void language plpgsql security definer set search_path = public
as $$
declare v_stage public.build_stages%rowtype;
begin
  select * into v_stage from public.build_stages where id = p_stage_id for update;
  if not found then raise exception 'stage not found'; end if;
  if not public.can_work_on_request(v_stage.request_id) then
    raise exception 'not authorised';
  end if;
  if p_to = 'delivered' then
    if v_stage.status <> 'purchased' then raise exception 'buy the materials first'; end if;
    if not exists (select 1 from public.media where stage_id = p_stage_id and kind = 'delivery') then
      raise exception 'add a delivery photo first';
    end if;
  elsif p_to = 'building' then
    if v_stage.status <> 'delivered' then raise exception 'materials must be delivered first'; end if;
  else
    raise exception 'not allowed';
  end if;
  perform public._stage_set(p_stage_id, p_to);
  perform public.log_audit('stage.' || p_to::text, 'build_stage', p_stage_id::text, '{}');
end $$;

-- Client: "Approve stage" → next stage unlocks.
create function public.approve_stage(p_stage_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_stage public.build_stages%rowtype;
  v_next uuid;
  v_name text;
begin
  perform public.assert_access_ok();
  select * into v_stage from public.build_stages where id = p_stage_id for update;
  if not found then raise exception 'stage not found'; end if;
  if (select client_id from public.service_requests where id = v_stage.request_id)
     is distinct from auth.uid() then
    raise exception 'not your project';
  end if;
  if v_stage.status <> 'inspected' then
    raise exception 'this stage is not ready for your approval';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  perform set_config('lbh.stage_transition', 'approved', true);
  update public.build_stages set status = 'approved', approved_by_name = v_name where id = p_stage_id;
  perform set_config('lbh.stage_transition', '', true);

  select id into v_next from public.build_stages
   where request_id = v_stage.request_id and position > v_stage.position
   order by position limit 1;
  if v_next is not null then
    perform public._stage_set(v_next, 'quoting');
  else
    update public.service_requests set status = 'done' where id = v_stage.request_id;
  end if;

  perform public.log_audit('stage.approved', 'build_stage', p_stage_id::text,
    jsonb_build_object('by', v_name));
end $$;

revoke execute on function public.start_build(uuid) from public, anon;
revoke execute on function public.approve_stage_quote(uuid) from public, anon;
revoke execute on function public.advance_stage_work(uuid, public.stage_status) from public, anon;
revoke execute on function public.approve_stage(uuid) from public, anon;
grant execute on function public.start_build(uuid) to authenticated;
grant execute on function public.approve_stage_quote(uuid) to authenticated;
grant execute on function public.advance_stage_work(uuid, public.stage_status) to authenticated;
grant execute on function public.approve_stage(uuid) to authenticated;

-- ============================================================
-- Row-level security
-- ============================================================
alter table public.build_stages enable row level security;
alter table public.stage_quotes enable row level security;
alter table public.stage_purchases enable row level security;
alter table public.stage_inspections enable row level security;

-- build_stages: admin manages; client + assigned field staff read.
create policy stages_admin_all on public.build_stages
  for all using (public.is_admin()) with check (public.is_admin());
create policy stages_client_select on public.build_stages
  for select using (exists (select 1 from public.service_requests r
                            where r.id = build_stages.request_id and r.client_id = auth.uid()));
create policy stages_field_select on public.build_stages
  for select using (public.is_assigned_to_request(request_id));

-- stage_quotes: prices — admin + owning client only (never field).
create policy squotes_admin_all on public.stage_quotes
  for all using (public.is_admin()) with check (public.is_admin());
create policy squotes_client_select on public.stage_quotes
  for select using (exists (select 1 from public.service_requests r
                            where r.id = stage_quotes.request_id and r.client_id = auth.uid()));

-- purchases: admin all; assigned field read/insert; client reads own.
create policy spurch_admin_all on public.stage_purchases
  for all using (public.is_admin()) with check (public.is_admin());
create policy spurch_field_select on public.stage_purchases
  for select using (public.is_assigned_to_request(request_id));
create policy spurch_field_insert on public.stage_purchases
  for insert with check (public.is_assigned_to_request(
    (select s.request_id from public.build_stages s where s.id = stage_id)));
create policy spurch_client_select on public.stage_purchases
  for select using (exists (select 1 from public.service_requests r
                            where r.id = stage_purchases.request_id and r.client_id = auth.uid()));

-- inspections: admin all; assigned field read/insert; client reads own.
create policy sinsp_admin_all on public.stage_inspections
  for all using (public.is_admin()) with check (public.is_admin());
create policy sinsp_field_select on public.stage_inspections
  for select using (public.is_assigned_to_request(request_id));
create policy sinsp_field_insert on public.stage_inspections
  for insert with check (public.is_assigned_to_request(
    (select s.request_id from public.build_stages s where s.id = stage_id)));
create policy sinsp_client_select on public.stage_inspections
  for select using (exists (select 1 from public.service_requests r
                            where r.id = stage_inspections.request_id and r.client_id = auth.uid()));

-- stage media: assigned field staff may add/read; clients see their stages' photos.
create policy media_field_stage_insert on public.media
  for insert with check (
    uploader_id = auth.uid() and stage_id is not null
    and public.is_assigned_to_request(
      (select s.request_id from public.build_stages s where s.id = stage_id)));
create policy media_field_stage_select on public.media
  for select using (stage_id is not null and public.is_assigned_to_request(request_id));
create policy media_client_stage_select on public.media
  for select using (stage_id is not null and exists (
    select 1 from public.service_requests r
    where r.id = media.request_id and r.client_id = auth.uid()));

-- 2FA for staff on the new tables too (see security_hardening migration).
do $$
declare t text;
begin
  foreach t in array array['build_stages','stage_quotes','stage_purchases','stage_inspections'] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (public.access_ok()) with check (public.access_ok())',
      t || '_require_aal2_for_staff', t);
  end loop;
end $$;

-- Admin: reorder two not-yet-started stages in one transaction.
create function public.move_stage(p_stage_id uuid, p_dir int)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_stage public.build_stages%rowtype;
  v_other public.build_stages%rowtype;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select * into v_stage from public.build_stages where id = p_stage_id for update;
  if not found then raise exception 'stage not found'; end if;
  if p_dir < 0 then
    select * into v_other from public.build_stages
     where request_id = v_stage.request_id and position < v_stage.position
     order by position desc limit 1 for update;
  else
    select * into v_other from public.build_stages
     where request_id = v_stage.request_id and position > v_stage.position
     order by position asc limit 1 for update;
  end if;
  if v_other.id is null then return; end if;
  if v_stage.status <> 'locked' or v_other.status <> 'locked' then
    raise exception 'only stages that have not started can be reordered';
  end if;
  update public.build_stages set position = v_other.position where id = v_stage.id;
  update public.build_stages set position = v_stage.position where id = v_other.id;
end $$;
revoke execute on function public.move_stage(uuid, int) from public, anon;
grant execute on function public.move_stage(uuid, int) to authenticated;
