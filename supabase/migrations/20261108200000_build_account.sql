-- ============================================================
-- LBH Build Account — a record of a client's build money (NOT a bank
-- account): money sent in, money spent (with receipts), per account
-- (LBH account, family members who hold money), per build stage.
--
-- Rules enforced here (the app adds friendly checks on top):
--   * an owner sees only their own Build Account; family members only
--     the Build Account they were invited to; admin (2FA) sees all
--   * only the owner (or a family member allowed to add receipts, on the
--     account they hold) can add entries, and only while the plan is
--     active (free for LBH full-build clients, else paid); otherwise the
--     Build Account is read-only — never deleted
--   * money sent in is "on its way" until confirmed: by LBH (admin) for
--     the LBH account, by the family member for the account they hold
--   * entries that come from LBH (portal payments, materials LBH bought)
--     can only be created by the server; amounts can't be edited
--   * receipts live in private storage: ba/<owner>/<uuid>.<ext>
-- ============================================================

-- ---------- settings (admin sets prices; nothing hard-coded) ----------
alter table public.settings
  add column if not exists build_account_enabled boolean not null default true,
  add column if not exists build_account_monthly_cents int check (build_account_monthly_cents > 0),
  add column if not exists build_account_yearly_cents int check (build_account_yearly_cents > 0);

-- ---------- price list (for "price check" alerts) ----------
create table if not exists public.price_list (
  id uuid primary key default gen_random_uuid(),
  item text not null check (char_length(item) between 1 and 120),
  unit text not null check (char_length(unit) between 1 and 40),
  area text not null default '' check (char_length(area) <= 80),
  price_cents int not null check (price_cents > 0 and price_cents <= 100000000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.price_list enable row level security;
create policy price_list_read on public.price_list for select to authenticated using (true);
create policy price_list_admin on public.price_list for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- members (family invited to a Build Account) ----------
create table if not exists public.ba_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text check (email is null or char_length(email) <= 254),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 30),
  role text not null default 'view' check (role in ('view', 'add')),
  user_id uuid references public.profiles(id) on delete set null,
  invite_token_hash text unique,
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (user_id is null or user_id <> owner_id)
);
create unique index if not exists ba_members_owner_user on public.ba_members (owner_id, user_id) where user_id is not null;

-- ---------- accounts (where the money is) ----------
create table if not exists public.ba_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('lbh', 'family', 'own')),
  holder_member_id uuid references public.ba_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists ba_accounts_one_lbh on public.ba_accounts (owner_id) where kind = 'lbh';

-- ---------- entries (the statement) ----------
create table if not exists public.ba_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.ba_accounts(id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  amount_cents int not null check (amount_cents > 0 and amount_cents <= 100000000),
  fee_cents int not null default 0 check (fee_cents >= 0 and fee_cents <= 10000000),
  occurred_on date not null default current_date,
  description text not null default '' check (char_length(description) <= 300),
  shop text not null default '' check (char_length(shop) <= 120),
  service text check (service in ('mukuru', 'worldremit', 'remitly', 'bank', 'card', 'cash', 'other')),
  stage_name text check (char_length(stage_name) <= 80),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected')),
  receipt_path text,
  receipt_source text check (receipt_source in ('photo', 'lbh')),
  lbh_media_id uuid,
  source text not null default 'manual'
    check (source in ('manual', 'scan', 'lbh_payment', 'lbh_purchase', 'lbh_fee')),
  source_ref uuid,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (receipt_path is null or (
    receipt_path ~ '^ba/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
    and starts_with(receipt_path, 'ba/' || owner_id::text || '/'))),
  check (direction = 'in' or status = 'confirmed')
);
-- automatic entries (LBH payments / purchases) are stored once per source row
alter table public.ba_entries drop constraint if exists ba_entries_source_once;
alter table public.ba_entries add constraint ba_entries_source_once unique (owner_id, source, source_ref);
create index if not exists ba_entries_owner_date on public.ba_entries (owner_id, occurred_on desc, created_at desc);

-- ---------- budgets per build stage ----------
create table if not exists public.ba_budgets (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  stage_name text not null check (char_length(stage_name) between 1 and 80),
  budget_cents int not null check (budget_cents >= 0 and budget_cents <= 1000000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, stage_name)
);

-- ---------- plans ----------
create table if not exists public.ba_subscriptions (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  override text check (override in ('free', 'paid', 'expired')),
  override_until timestamptz,
  override_note text not null default '' check (char_length(override_note) <= 300),
  plan text check (plan in ('monthly', 'yearly')),
  paid_until timestamptz,
  reminded_until timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ba_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'cancelled')),
  merchant_reference text not null unique,
  paynow_poll_url text,
  paynow_reference text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- ============================================================
-- Helper functions
-- ============================================================

/** Active family membership of the caller in this owner's Build Account. */
create or replace function public.ba_member_of(p_owner uuid)
returns public.ba_members
language sql stable security definer set search_path = public
as $$
  select * from public.ba_members
  where owner_id = p_owner and user_id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.ba_can_view(p_owner uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()
    or public.is_admin()
    or (public.ba_member_of(p_owner)).id is not null)
$$;

/** Owner, or a family member allowed to add receipts on the account they hold. */
create or replace function public.ba_can_add(p_owner uuid, p_account uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()
    or exists (
      select 1 from public.ba_members m
      join public.ba_accounts a on a.holder_member_id = m.id
      where m.owner_id = p_owner and m.user_id = auth.uid() and m.status = 'active'
        and m.role = 'add' and a.id = p_account and a.owner_id = p_owner))
$$;

/**
 * Plan of a Build Account:
 *   free     — admin marked "full build client", or the client has a
 *              construction build with LBH
 *   paid     — paid subscription (or admin override) still running
 *   expired  — had a subscription that ran out, or admin set expired
 *   none     — never subscribed
 */
create or replace function public.ba_plan(p_owner uuid)
returns text language sql stable security definer set search_path = public
as $$
  select case
    when s.override = 'free' then 'free'
    when s.override = 'expired' then 'expired'
    when s.override = 'paid' and coalesce(s.override_until, 'infinity'::timestamptz) > now() then 'paid'
    when exists (select 1 from public.service_requests r
                 where r.client_id = p_owner and r.type = 'build' and r.status <> 'cancelled') then 'free'
    when s.paid_until > now() then 'paid'
    when s.paid_until is not null or s.override = 'paid' then 'expired'
    else 'none'
  end
  from (select 1) x
  left join public.ba_subscriptions s on s.owner_id = p_owner
  -- only people who may see this Build Account learn its plan (server: no auth.uid())
  where auth.uid() is null or public.ba_can_view(p_owner)
$$;

create or replace function public.ba_writable(p_owner uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.ba_plan(p_owner) in ('free', 'paid') $$;

revoke execute on function public.ba_member_of(uuid) from public, anon;
revoke execute on function public.ba_plan(uuid) from public, anon;
revoke execute on function public.ba_writable(uuid) from public, anon;
grant execute on function public.ba_member_of(uuid), public.ba_can_view(uuid),
  public.ba_can_add(uuid, uuid), public.ba_plan(uuid), public.ba_writable(uuid) to authenticated;

-- ============================================================
-- Guards
-- ============================================================
create or replace function public.ba_entries_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_acc public.ba_accounts%rowtype;
  v_by_app boolean := coalesce(current_setting('lbh.ba_action', true), '') = '1';
begin
  select * into v_acc from public.ba_accounts where id = new.account_id;
  if v_acc.id is null or v_acc.owner_id <> new.owner_id then
    raise exception 'account belongs to another Build Account';
  end if;
  if new.direction = 'out' then
    new.status := 'confirmed';
    new.fee_cents := 0;
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.source not in ('manual', 'scan') then
        raise exception 'automatic entries come from LBH only';
      end if;
      if new.source = 'scan' and new.direction <> 'out' then
        raise exception 'a scanned receipt is money spent';
      end if;
      new.created_by := auth.uid();
      new.confirmed_by := null;
      new.confirmed_at := null;
      new.lbh_media_id := null;
      new.source_ref := null;
      if new.direction = 'in' then new.status := 'pending'; end if;
      new.receipt_source := case when new.receipt_path is null then null else 'photo' end;
    elsif not v_by_app then
      raise exception 'entries are changed through the Build Account app only';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ba_entries_guard on public.ba_entries;
create trigger ba_entries_guard before insert or update on public.ba_entries
  for each row execute function public.ba_entries_guard();

-- Confirm / reject money that is "on its way"
create or replace function public.ba_confirm_transfer(p_entry uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_e public.ba_entries%rowtype;
  v_acc public.ba_accounts%rowtype;
  v_ok boolean;
begin
  select * into v_e from public.ba_entries where id = p_entry for update;
  if v_e.id is null or v_e.direction <> 'in' or v_e.status <> 'pending' then
    raise exception 'nothing to confirm';
  end if;
  select * into v_acc from public.ba_accounts where id = v_e.account_id;
  v_ok := case
    when v_acc.kind = 'lbh' then public.is_admin()
    when v_acc.holder_member_id is not null then exists (
      select 1 from public.ba_members m
      where m.id = v_acc.holder_member_id and m.user_id = auth.uid() and m.status = 'active')
    else v_e.owner_id = auth.uid()
  end;
  if not v_ok then
    raise exception 'only the person who receives the money can confirm it';
  end if;
  perform set_config('lbh.ba_action', '1', true);
  update public.ba_entries
     set status = case when p_approve then 'confirmed' else 'rejected' end,
         confirmed_by = auth.uid(), confirmed_at = now()
   where id = p_entry;
end $$;
revoke execute on function public.ba_confirm_transfer(uuid, boolean) from public, anon;
grant execute on function public.ba_confirm_transfer(uuid, boolean) to authenticated;

-- Attach a receipt photo to money spent
create or replace function public.ba_attach_receipt(p_entry uuid, p_path text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_e public.ba_entries%rowtype;
begin
  select * into v_e from public.ba_entries where id = p_entry for update;
  if v_e.id is null or v_e.direction <> 'out' or v_e.source not in ('manual', 'scan') then
    raise exception 'no receipt can be added here';
  end if;
  if not public.ba_can_add(v_e.owner_id, v_e.account_id) or not public.ba_writable(v_e.owner_id) then
    raise exception 'not allowed';
  end if;
  perform set_config('lbh.ba_action', '1', true);
  update public.ba_entries set receipt_path = p_path, receipt_source = 'photo' where id = p_entry;
end $$;
revoke execute on function public.ba_attach_receipt(uuid, text) from public, anon;
grant execute on function public.ba_attach_receipt(uuid, text) to authenticated;

-- Accept a family invite (the token was sent by WhatsApp or email)
create or replace function public.ba_accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_m public.ba_members%rowtype;
begin
  if auth.uid() is null or coalesce(p_token, '') = '' then raise exception 'not allowed'; end if;
  select * into v_m from public.ba_members
   where invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and status = 'invited'
   for update;
  if v_m.id is null then raise exception 'invite not found or already used'; end if;
  if v_m.owner_id = auth.uid() then raise exception 'this is your own Build Account'; end if;
  update public.ba_members
     set user_id = auth.uid(), status = 'active', accepted_at = now(), invite_token_hash = null
   where id = v_m.id;
  return v_m.owner_id;
end $$;
revoke execute on function public.ba_accept_invite(text) from public, anon;
grant execute on function public.ba_accept_invite(text) to authenticated;

-- ============================================================
-- Row level security
-- ============================================================
alter table public.ba_members enable row level security;
alter table public.ba_accounts enable row level security;
alter table public.ba_entries enable row level security;
alter table public.ba_budgets enable row level security;
alter table public.ba_subscriptions enable row level security;
alter table public.ba_payments enable row level security;

-- members: owner manages; a member sees their own membership
create policy ba_members_read on public.ba_members for select to authenticated
  using (owner_id = auth.uid() or user_id = auth.uid() or public.is_admin());
create policy ba_members_owner_write on public.ba_members for insert to authenticated
  with check (owner_id = auth.uid() and user_id is null and status = 'invited');
create policy ba_members_owner_update on public.ba_members for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ba_members_owner_delete on public.ba_members for delete to authenticated
  using (owner_id = auth.uid());
create policy ba_members_admin on public.ba_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- a member can't change who they are or their own rights
revoke update on public.ba_members from authenticated;
grant update (name, email, whatsapp, role, status) on public.ba_members to authenticated;

-- accounts
create policy ba_accounts_read on public.ba_accounts for select to authenticated
  using (public.ba_can_view(owner_id));
create policy ba_accounts_owner_insert on public.ba_accounts for insert to authenticated
  with check (owner_id = auth.uid() and kind in ('family', 'own') and public.ba_writable(owner_id)
              and (holder_member_id is null or exists (
                select 1 from public.ba_members m where m.id = holder_member_id and m.owner_id = auth.uid())));
create policy ba_accounts_owner_update on public.ba_accounts for update to authenticated
  using (owner_id = auth.uid() and kind <> 'lbh')
  with check (owner_id = auth.uid() and kind in ('family', 'own')
              and (holder_member_id is null or exists (
                select 1 from public.ba_members m where m.id = holder_member_id and m.owner_id = auth.uid())));
create policy ba_accounts_admin on public.ba_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- entries
create policy ba_entries_read on public.ba_entries for select to authenticated
  using (public.ba_can_view(owner_id));
-- family members only record money SPENT; money in is recorded by the owner
create policy ba_entries_add on public.ba_entries for insert to authenticated
  with check (public.ba_can_add(owner_id, account_id) and public.ba_writable(owner_id)
              and (owner_id = auth.uid() or direction = 'out'));
create policy ba_entries_owner_delete on public.ba_entries for delete to authenticated
  using (owner_id = auth.uid() and source in ('manual', 'scan') and public.ba_writable(owner_id));
create policy ba_entries_admin on public.ba_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- budgets
create policy ba_budgets_read on public.ba_budgets for select to authenticated
  using (public.ba_can_view(owner_id));
create policy ba_budgets_owner on public.ba_budgets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.ba_writable(owner_id));

-- plans & payments: owner reads; admin manages; writes otherwise by the server
create policy ba_subscriptions_read on public.ba_subscriptions for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy ba_subscriptions_admin on public.ba_subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ba_payments_read on public.ba_payments for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy ba_payments_admin on public.ba_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A construction build makes the Build Account free, so only LBH (admin) may
-- create build requests: clients create land checks and material orders only.
drop policy if exists requests_client_insert on public.service_requests;
create policy requests_client_insert on public.service_requests
  for insert with check (client_id = auth.uid() and status = 'new' and type::text <> 'build');
