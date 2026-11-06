-- ============================================================
-- LBH — Let's Build Home · initial schema
--
-- Core rules enforced at the database level (brief §1, §8, §11):
--   * Clients see only their own data (RLS).
--   * Field staff see only assigned jobs — and NEVER prices,
--     quotes or payments (no policies on those tables for field).
--   * Nobody signs off their own work: a report's publisher must
--     differ from its author (trigger, defense in depth over RLS).
--   * Money events and admin actions land in an audit log.
--   * All amounts are USD integer cents.
-- ============================================================

-- ---------- enums ----------
create type public.user_role as enum ('client','field','admin');
create type public.request_type as enum ('land_verification','materials');
create type public.request_status as enum
  ('new','call_booked','quote_sent','accepted','deposit_paid','on_site',
   'report_ready','balance_paid','done','cancelled');
create type public.booking_status as enum ('new','confirmed','completed','cancelled');
create type public.quote_status as enum ('draft','sent','accepted','declined','expired');
create type public.quote_line_kind as enum ('service_fee','travel','other');
create type public.payment_kind as enum ('deposit','balance','extra');
create type public.payment_method as enum ('paynow','manual');
create type public.payment_status as enum ('pending','submitted','confirmed','failed','cancelled');
create type public.approval_status as enum ('pending','approved','declined');
create type public.extra_cost_status as enum ('pending','forwarded','rejected');
create type public.job_status as enum ('assigned','in_progress','submitted','completed');
create type public.media_kind as enum ('photo','video','receipt','document');
create type public.report_status as enum ('draft','submitted','changes_requested','published');
create type public.report_verdict as enum ('clear','concerns','red_flags');
create type public.supplier_quote_status as enum ('pending','approved','rejected');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null default '',
  email text not null,
  whatsapp text,
  country text,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

-- Role helpers. SECURITY DEFINER so RLS policies can consult profiles
-- without recursive policy evaluation.
create function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_user_role() = 'admin' $$;

create function public.is_field()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_user_role() = 'field' $$;

-- New auth user → profile row. Role comes from app_metadata (set only via
-- service role when admin invites staff); defaults to 'client'.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, whatsapp, country, locale)
  values (
    new.id,
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'country',
    coalesce(new.raw_user_meta_data->>'locale', 'en')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- settings (single row) ----------
create table public.settings (
  id int primary key default 1 check (id = 1),
  per_km_rate_cents int not null default 50,
  deposit_pct int not null default 50 check (deposit_pct between 1 and 100),
  whatsapp_number text not null default '263770000000',
  contact_email text not null default 'info@letsbuildhome.co.zw',
  call_slots jsonb not null default '[]',
  banned_words text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.settings (id) values (1);

-- ---------- audit log ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create function public.log_audit(
  p_action text, p_entity text, p_entity_id text, p_data jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, data)
  values (auth.uid(), coalesce(public.current_user_role()::text, 'system'),
          p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb));
end $$;

-- ---------- call bookings ----------
create table public.call_bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  whatsapp text not null,
  country text not null,
  service text not null,
  description text not null default '',
  preferred_slot text not null,
  call_type text not null,
  status public.booking_status not null default 'new',
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

-- ---------- service requests ----------
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  type public.request_type not null,
  status public.request_status not null default 'new',
  title text not null,
  -- land: town, stand_number, pin_lat, pin_lng, introduced_by, told_about
  -- materials: site_address, items[{item,quantity,notes}], needed_by, delivery_instructions
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  storage_path text not null,
  file_name text not null,
  kind text not null default 'document',
  created_at timestamptz not null default now()
);

-- ---------- quotes (prices: admin + owning client only) ----------
create sequence public.quote_number_seq start 1001;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  quote_number int not null default nextval('public.quote_number_seq'),
  status public.quote_status not null default 'draft',
  deposit_pct int not null default 50 check (deposit_pct between 1 and 100),
  total_cents int not null default 0 check (total_cents >= 0),
  notes text not null default '',
  created_by uuid not null references public.profiles(id),
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  kind public.quote_line_kind not null default 'other',
  description text not null,
  qty numeric not null default 1 check (qty > 0),
  unit_cents int not null default 0 check (unit_cents >= 0),
  total_cents int not null default 0 check (total_cents >= 0),
  position int not null default 0
);

-- ---------- payments / ledger / invoices ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  kind public.payment_kind not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'USD',
  merchant_reference text not null unique,
  paynow_poll_url text,
  paynow_reference text,
  proof_path text,
  proof_reference text,
  created_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  amount_cents int not null,
  direction text not null check (direction in ('in','out','credit')),
  note text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create sequence public.invoice_number_seq start 10001;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number int not null unique default nextval('public.invoice_number_seq'),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  kind public.payment_kind not null,
  amount_cents int not null check (amount_cents > 0),
  issued_at timestamptz not null default now(),
  details jsonb not null default '{}'
);

-- ---------- jobs (field assignments) ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id),
  status public.job_status not null default 'assigned',
  checklist jsonb not null default '{}',
  -- visit: arrived, council_officer_present, pegs_shown,
  --        measurements{length_m,width_m,area_sqm}, title_notes, findings
  visit jsonb not null default '{}',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Field staff may update their job's working data but never re-route it.
create function public.jobs_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.request_id is distinct from old.request_id
       or new.assigned_to is distinct from old.assigned_to
       or new.created_by is distinct from old.created_by then
      raise exception 'only admin may reassign a job';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger jobs_guard before update on public.jobs
  for each row execute function public.jobs_guard();

-- ---------- media (field uploads) ----------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  kind public.media_kind not null,
  storage_path text not null,
  original_name text not null default '',
  taken_at timestamptz,
  uploaded_at timestamptz not null default now(),
  gps_lat double precision,
  gps_lng double precision,
  distance_from_pin_m numeric,
  flagged_far boolean not null default false,
  amount_cents int,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- extra costs: field → admin → client ----------
create table public.extra_cost_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  title text not null,
  reason text not null,
  amount_cents int not null check (amount_cents > 0),
  status public.extra_cost_status not null default 'pending',
  admin_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  extra_cost_request_id uuid references public.extra_cost_requests(id) on delete set null,
  title text not null,
  reason text not null,
  field_note text not null default '',
  amount_cents int not null check (amount_cents > 0),
  status public.approval_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- reports ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  author_id uuid not null references public.profiles(id),
  status public.report_status not null default 'draft',
  verdict public.report_verdict,
  -- stand_details, legal_findings, council_confirmation, measurements,
  -- red_flags, next_steps, costs_summary
  sections jsonb not null default '{}',
  review_note text not null default '',
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- THE rule: nobody signs off their own work (brief §8), and only admin
-- publishes. Trigger = defense in depth beneath RLS.
create function public.reports_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    if not public.is_admin() then
      raise exception 'only admin may publish a report';
    end if;
    if auth.uid() is not null and new.author_id = auth.uid() then
      raise exception 'a report cannot be published by its own author';
    end if;
    new.published_by := auth.uid();
    new.published_at := now();
    if new.verdict is null then
      raise exception 'a published report needs a verdict';
    end if;
  end if;
  if not public.is_admin() then
    -- field may only move draft/changes_requested → draft/submitted
    if old.status not in ('draft','changes_requested')
       or new.status not in ('draft','submitted') then
      raise exception 'field staff may only edit drafts and submit them';
    end if;
    if new.author_id is distinct from old.author_id
       or new.request_id is distinct from old.request_id then
      raise exception 'only admin may re-route a report';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger reports_guard before update on public.reports
  for each row execute function public.reports_guard();

-- ---------- materials: supplier quote comparison ----------
create table public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  supplier_name text not null,
  amount_cents int not null check (amount_cents > 0),
  details text not null default '',
  file_path text,
  status public.supplier_quote_status not null default 'pending',
  approved_at timestamptz,
  approved_by_name text,
  created_at timestamptz not null default now()
);

-- ---------- chat ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  read_by_admin boolean not null default false,
  read_by_client boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- notify-me interest ----------
create table public.notify_interest (
  id uuid primary key default gen_random_uuid(),
  email text,
  whatsapp text,
  service text not null,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  check (email is not null or whatsapp is not null)
);

-- ---------- translation review (brief §9) ----------
create table public.translation_reviews (
  locale text not null,
  message_key text not null,
  reviewed boolean not null default false,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  primary key (locale, message_key)
);

-- ---------- rate limiting (service-role only; no policies) ----------
create table public.rate_limits (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  insert into public.rate_limits (bucket, count, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    count = case
      when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then 1 else public.rate_limits.count + 1 end,
    window_start = case
      when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then now() else public.rate_limits.window_start end
  returning count into v_count;
  return v_count > p_max;
end $$;

-- ---------- indexes ----------
create index on public.service_requests (client_id);
create index on public.documents (request_id);
create index on public.quotes (request_id);
create index on public.quote_lines (quote_id);
create index on public.payments (request_id);
create index on public.jobs (assigned_to);
create index on public.jobs (request_id);
create index on public.media (job_id);
create index on public.media (request_id);
create index on public.approvals (request_id);
create index on public.extra_cost_requests (job_id);
create index on public.reports (request_id);
create index on public.supplier_quotes (request_id);
create index on public.messages (client_id, created_at);
create index on public.audit_log (entity, entity_id);

-- ============================================================
-- RPCs — client actions that must be atomic + audited
-- ============================================================

-- Written acceptance of a quote: records name + timestamp (brief §5.2),
-- advances the request, creates the pending deposit payment + invoice.
create function public.accept_quote(p_quote_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_req public.service_requests%rowtype;
  v_name text;
  v_deposit int;
  v_payment_id uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'quote not found'; end if;

  select * into v_req from public.service_requests where id = v_quote.request_id;
  if v_req.client_id is distinct from auth.uid() then
    raise exception 'not your quote';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'quote is not open for acceptance';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  v_deposit := ceil(v_quote.total_cents * v_quote.deposit_pct / 100.0)::int;

  update public.quotes
     set status = 'accepted', accepted_at = now(), accepted_by_name = v_name,
         updated_at = now()
   where id = p_quote_id;

  update public.service_requests
     set status = 'accepted', updated_at = now()
   where id = v_quote.request_id;

  insert into public.payments
    (request_id, quote_id, kind, method, status, amount_cents,
     merchant_reference, created_by)
  values
    (v_quote.request_id, p_quote_id, 'deposit', 'paynow', 'pending', v_deposit,
     'LBH-' || v_quote.quote_number || '-DEP-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
     auth.uid())
  returning id into v_payment_id;

  insert into public.invoices (request_id, quote_id, payment_id, kind, amount_cents, details)
  values (v_quote.request_id, p_quote_id, v_payment_id, 'deposit', v_deposit,
          jsonb_build_object('quote_number', v_quote.quote_number));

  perform public.log_audit('quote.accepted', 'quote', p_quote_id::text,
    jsonb_build_object('accepted_by_name', v_name, 'deposit_cents', v_deposit));
  return v_payment_id;
end $$;

-- Client decision on an extra-cost approval. Nothing proceeds until approved.
create function public.decide_approval(p_approval_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_appr public.approvals%rowtype;
  v_req public.service_requests%rowtype;
begin
  select * into v_appr from public.approvals where id = p_approval_id for update;
  if not found then raise exception 'approval not found'; end if;
  select * into v_req from public.service_requests where id = v_appr.request_id;
  if v_req.client_id is distinct from auth.uid() then
    raise exception 'not your approval';
  end if;
  if v_appr.status <> 'pending' then
    raise exception 'already decided';
  end if;

  update public.approvals
     set status = case when p_approve then 'approved' else 'declined' end::public.approval_status,
         decided_at = now()
   where id = p_approval_id;

  if p_approve then
    insert into public.payments
      (request_id, kind, method, status, amount_cents, merchant_reference, created_by)
    values
      (v_appr.request_id, 'extra', 'paynow', 'pending', v_appr.amount_cents,
       'LBH-EXTRA-' || substr(replace(gen_random_uuid()::text,'-',''),1,10), auth.uid());
  end if;

  perform public.log_audit(
    case when p_approve then 'approval.approved' else 'approval.declined' end,
    'approval', p_approval_id::text,
    jsonb_build_object('amount_cents', v_appr.amount_cents));
end $$;

-- Client approves ONE supplier quote for a materials request (brief §5.2).
create function public.approve_supplier_quote(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_sq public.supplier_quotes%rowtype;
  v_req public.service_requests%rowtype;
  v_name text;
begin
  select * into v_sq from public.supplier_quotes where id = p_id for update;
  if not found then raise exception 'supplier quote not found'; end if;
  select * into v_req from public.service_requests where id = v_sq.request_id;
  if v_req.client_id is distinct from auth.uid() then
    raise exception 'not your request';
  end if;
  if v_sq.status <> 'pending' then raise exception 'already decided'; end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  update public.supplier_quotes
     set status = 'approved', approved_at = now(), approved_by_name = v_name
   where id = p_id;
  update public.supplier_quotes
     set status = 'rejected'
   where request_id = v_sq.request_id and id <> p_id and status = 'pending';

  perform public.log_audit('supplier_quote.approved', 'supplier_quote', p_id::text,
    jsonb_build_object('supplier', v_sq.supplier_name, 'amount_cents', v_sq.amount_cents));
end $$;

-- ============================================================
-- Row-level security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.call_bookings enable row level security;
alter table public.service_requests enable row level security;
alter table public.documents enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.jobs enable row level security;
alter table public.media enable row level security;
alter table public.extra_cost_requests enable row level security;
alter table public.approvals enable row level security;
alter table public.reports enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.messages enable row level security;
alter table public.notify_interest enable row level security;
alter table public.translation_reviews enable row level security;
alter table public.rate_limits enable row level security;

-- profiles: own row; admin sees all; nobody changes their own role.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
-- field staff can see client names on their assigned jobs (first name shown in UI)
create policy profiles_field_assigned_clients on public.profiles
  for select using (
    public.is_field() and exists (
      select 1 from public.jobs j
      join public.service_requests r on r.id = j.request_id
      where j.assigned_to = auth.uid() and r.client_id = profiles.id
    )
  );

-- settings: admin writes; any signed-in user may read (public contact info
-- is read via the server with the service role; prices like per-km rate are
-- admin-only, so restrict reads to admin).
create policy settings_admin_all on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- audit log: admin reads; writes only via log_audit() (security definer).
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin());

-- call bookings: created via server action (service role). Clients see own.
create policy bookings_client_select on public.call_bookings
  for select using (client_id = auth.uid());
create policy bookings_admin_all on public.call_bookings
  for all using (public.is_admin()) with check (public.is_admin());

-- service requests
create policy requests_client_select on public.service_requests
  for select using (client_id = auth.uid());
create policy requests_client_insert on public.service_requests
  for insert with check (client_id = auth.uid() and status = 'new');
create policy requests_admin_all on public.service_requests
  for all using (public.is_admin()) with check (public.is_admin());
create policy requests_field_assigned on public.service_requests
  for select using (
    public.is_field() and exists (
      select 1 from public.jobs j
      where j.request_id = service_requests.id and j.assigned_to = auth.uid()
    )
  );

-- documents: client own request; field on assigned jobs; admin all.
create policy documents_client on public.documents
  for select using (exists (
    select 1 from public.service_requests r
    where r.id = documents.request_id and r.client_id = auth.uid()));
create policy documents_client_insert on public.documents
  for insert with check (
    uploader_id = auth.uid() and exists (
      select 1 from public.service_requests r
      where r.id = documents.request_id and r.client_id = auth.uid()));
create policy documents_field on public.documents
  for select using (
    public.is_field() and exists (
      select 1 from public.jobs j
      where j.request_id = documents.request_id and j.assigned_to = auth.uid()));
create policy documents_admin_all on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- quotes + lines: admin all; client reads non-draft quotes on own requests.
-- NO field policies — field staff never see prices (brief §3).
create policy quotes_admin_all on public.quotes
  for all using (public.is_admin()) with check (public.is_admin());
create policy quotes_client_select on public.quotes
  for select using (
    status <> 'draft' and exists (
      select 1 from public.service_requests r
      where r.id = quotes.request_id and r.client_id = auth.uid()));
create policy quote_lines_admin_all on public.quote_lines
  for all using (public.is_admin()) with check (public.is_admin());
create policy quote_lines_client_select on public.quote_lines
  for select using (exists (
    select 1 from public.quotes q
    join public.service_requests r on r.id = q.request_id
    where q.id = quote_lines.quote_id
      and q.status <> 'draft' and r.client_id = auth.uid()));

-- payments: admin all; client reads own. Status changes only server-side.
create policy payments_admin_all on public.payments
  for all using (public.is_admin()) with check (public.is_admin());
create policy payments_client_select on public.payments
  for select using (exists (
    select 1 from public.service_requests r
    where r.id = payments.request_id and r.client_id = auth.uid()));

-- ledger: admin only.
create policy ledger_admin_all on public.ledger_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- invoices: admin all; client reads own.
create policy invoices_admin_all on public.invoices
  for all using (public.is_admin()) with check (public.is_admin());
create policy invoices_client_select on public.invoices
  for select using (exists (
    select 1 from public.service_requests r
    where r.id = invoices.request_id and r.client_id = auth.uid()));

-- jobs: admin all; field sees/updates own (guard trigger limits columns).
create policy jobs_admin_all on public.jobs
  for all using (public.is_admin()) with check (public.is_admin());
create policy jobs_field_select on public.jobs
  for select using (assigned_to = auth.uid());
create policy jobs_field_update on public.jobs
  for update using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- media: admin all; field for own jobs; client sees own request's media
-- once the report is published, and receipts always (brief §5.2, §7).
create policy media_admin_all on public.media
  for all using (public.is_admin()) with check (public.is_admin());
create policy media_field_select on public.media
  for select using (
    public.is_field() and exists (
      select 1 from public.jobs j
      where j.id = media.job_id and j.assigned_to = auth.uid()));
create policy media_field_insert on public.media
  for insert with check (
    uploader_id = auth.uid() and exists (
      select 1 from public.jobs j
      where j.id = media.job_id and j.assigned_to = auth.uid()));
create policy media_client_select on public.media
  for select using (
    exists (
      select 1 from public.service_requests r
      where r.id = media.request_id and r.client_id = auth.uid())
    and (
      kind = 'receipt'
      or exists (
        select 1 from public.reports rep
        where rep.request_id = media.request_id and rep.status = 'published')));

-- extra cost requests: admin all; field creates/sees own.
create policy ecr_admin_all on public.extra_cost_requests
  for all using (public.is_admin()) with check (public.is_admin());
create policy ecr_field_select on public.extra_cost_requests
  for select using (requested_by = auth.uid());
create policy ecr_field_insert on public.extra_cost_requests
  for insert with check (
    requested_by = auth.uid() and exists (
      select 1 from public.jobs j
      where j.id = extra_cost_requests.job_id and j.assigned_to = auth.uid()));

-- approvals: admin all; client reads own (decisions via decide_approval RPC).
create policy approvals_admin_all on public.approvals
  for all using (public.is_admin()) with check (public.is_admin());
create policy approvals_client_select on public.approvals
  for select using (exists (
    select 1 from public.service_requests r
    where r.id = approvals.request_id and r.client_id = auth.uid()));

-- reports: admin all; field drafts own; client reads published own.
create policy reports_admin_all on public.reports
  for all using (public.is_admin()) with check (public.is_admin());
create policy reports_field_select on public.reports
  for select using (author_id = auth.uid());
create policy reports_field_insert on public.reports
  for insert with check (
    author_id = auth.uid() and status = 'draft' and exists (
      select 1 from public.jobs j
      where j.id = reports.job_id and j.assigned_to = auth.uid()));
create policy reports_field_update on public.reports
  for update using (author_id = auth.uid() and status in ('draft','changes_requested'))
  with check (author_id = auth.uid());
create policy reports_client_select on public.reports
  for select using (
    status = 'published' and exists (
      select 1 from public.service_requests r
      where r.id = reports.request_id and r.client_id = auth.uid()));

-- supplier quotes: admin all; client reads own (approval via RPC).
create policy sq_admin_all on public.supplier_quotes
  for all using (public.is_admin()) with check (public.is_admin());
create policy sq_client_select on public.supplier_quotes
  for select using (exists (
    select 1 from public.service_requests r
    where r.id = supplier_quotes.request_id and r.client_id = auth.uid()));

-- messages: client own thread; admin all; field none.
create policy messages_admin_all on public.messages
  for all using (public.is_admin()) with check (public.is_admin());
create policy messages_client_select on public.messages
  for select using (client_id = auth.uid());
create policy messages_client_insert on public.messages
  for insert with check (client_id = auth.uid() and sender_id = auth.uid());

-- notify interest: inserts via server action (service role); admin reads.
create policy notify_admin_all on public.notify_interest
  for all using (public.is_admin()) with check (public.is_admin());

-- translation reviews: admin only.
create policy tr_admin_all on public.translation_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- rate_limits: no policies — service role only.

-- ---------- realtime for chat ----------
alter publication supabase_realtime add table public.messages;

-- ---------- storage buckets (private; server-mediated access only) ----------
insert into storage.buckets (id, name, public)
values ('documents','documents',false), ('media','media',false), ('proofs','proofs',false)
on conflict (id) do nothing;

-- ---------- updated_at helpers ----------
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger touch_service_requests before update on public.service_requests
  for each row execute function public.touch_updated_at();
create trigger touch_quotes before update on public.quotes
  for each row execute function public.touch_updated_at();
create trigger touch_payments before update on public.payments
  for each row execute function public.touch_updated_at();
