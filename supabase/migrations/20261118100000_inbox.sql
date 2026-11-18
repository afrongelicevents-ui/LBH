-- Inbox, live chat for visitors, alerts and office hours (2026-11-18)
--  * visitor_chats / visitor_chat_messages: website visitors chat without an
--    account. Visitors never touch these tables directly: the website server
--    reads and writes them with the service role after checking the visitor's
--    secret thread token (only its SHA-256 hash is stored).
--  * inbox_assignments: who on the team owns a booking / visitor chat /
--    customer chat.
--  * admin_alerts: in-app notifications for the admin team (new booking, new
--    chat message); each admin marks them seen.
--  * settings: promised reply time, office hours, alert email addresses.

-- ---------- settings ----------
alter table public.settings
  add column if not exists reply_hours int not null default 24 check (reply_hours between 1 and 168),
  -- {"mon":{"open":"08:00","close":"17:00"}, … "sun":null}  (times in office_tz)
  add column if not exists office_hours jsonb not null default
    '{"mon":{"open":"08:00","close":"17:00"},"tue":{"open":"08:00","close":"17:00"},"wed":{"open":"08:00","close":"17:00"},"thu":{"open":"08:00","close":"17:00"},"fri":{"open":"08:00","close":"17:00"},"sat":{"open":"09:00","close":"13:00"},"sun":null}'::jsonb,
  add column if not exists office_tz text not null default 'Africa/Harare' check (char_length(office_tz) between 3 and 60),
  -- empty = every admin account's email
  add column if not exists alert_emails text[] not null default '{}';

-- ---------- visitor chats ----------
create table if not exists public.visitor_chats (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 120),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  locale text not null default 'en' check (locale in ('en', 'sn', 'nd')),
  page text not null default '' check (char_length(page) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  -- set when the visitor writes and nobody has answered yet; cleared by an LBH reply
  waiting_since timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint visitor_chats_contact check (email <> '' or phone <> '')
);
create index if not exists visitor_chats_open on public.visitor_chats (status, waiting_since);

create table if not exists public.visitor_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.visitor_chats(id) on delete cascade,
  -- 'visitor' | 'lbh' (a team member) | 'auto' (the instant confirmation)
  author text not null check (author in ('visitor', 'lbh', 'auto')),
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists visitor_chat_messages_chat on public.visitor_chat_messages (chat_id, created_at);

alter table public.visitor_chats enable row level security;
alter table public.visitor_chat_messages enable row level security;
-- admins only (with 2FA, via is_admin); visitors go through the server
drop policy if exists visitor_chats_admin on public.visitor_chats;
create policy visitor_chats_admin on public.visitor_chats for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists visitor_chat_messages_admin on public.visitor_chat_messages;
create policy visitor_chat_messages_admin on public.visitor_chat_messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.visitor_chats, public.visitor_chat_messages from anon;
grant select, insert, update, delete on public.visitor_chats, public.visitor_chat_messages to authenticated;

-- ---------- assignments ----------
create table if not exists public.inbox_assignments (
  kind text not null check (kind in ('booking', 'visitor_chat', 'client_chat')),
  ref uuid not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (kind, ref)
);
alter table public.inbox_assignments enable row level security;
drop policy if exists inbox_assignments_admin on public.inbox_assignments;
create policy inbox_assignments_admin on public.inbox_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.inbox_assignments from anon;
grant select, insert, update, delete on public.inbox_assignments to authenticated;

-- ---------- in-app alerts for the admin team ----------
create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('booking', 'visitor_chat', 'client_chat')),
  ref uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  seen_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_alerts_recent on public.admin_alerts (created_at desc);
alter table public.admin_alerts enable row level security;
drop policy if exists admin_alerts_admin on public.admin_alerts;
create policy admin_alerts_admin on public.admin_alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.admin_alerts from anon;
grant select, insert, update, delete on public.admin_alerts to authenticated;

-- An admin marks every alert as seen (only adds their own id).
create or replace function public.admin_alerts_seen()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  update public.admin_alerts set seen_by = array_append(seen_by, auth.uid())
   where not (auth.uid() = any(seen_by));
end $$;
revoke execute on function public.admin_alerts_seen() from public, anon;
grant execute on function public.admin_alerts_seen() to authenticated;

-- A new customer chat message raises an alert (one per waiting customer, not per message).
create or replace function public.messages_alert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  if new.sender_id = new.client_id and not exists (
       select 1 from public.admin_alerts a
        where a.kind = 'client_chat' and a.ref = new.client_id
          and a.created_at > now() - interval '30 minutes') then
    select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = new.client_id;
    insert into public.admin_alerts (kind, ref, title)
    values ('client_chat', new.client_id, left('New message from ' || coalesce(v_name, 'a customer'), 300));
  end if;
  return new;
end $$;
drop trigger if exists messages_alert on public.messages;
create trigger messages_alert after insert on public.messages
  for each row execute function public.messages_alert();

-- Every new call booking raises an alert, whichever form created it.
create or replace function public.call_bookings_alert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.admin_alerts (kind, ref, title)
  values ('booking', new.id, left('New booking: ' || new.name || ' (' || new.service || ')', 300));
  return new;
end $$;
drop trigger if exists call_bookings_alert on public.call_bookings;
create trigger call_bookings_alert after insert on public.call_bookings
  for each row execute function public.call_bookings_alert();
