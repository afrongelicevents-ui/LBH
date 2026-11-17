-- Interiors & Furnishing (2026-11-17)
--  * new request type "interiors" (clients may create it themselves, like land/materials)
--  * interior_items: options LBH proposes per room (shop + price); the client
--    chooses or declines; LBH then buys and delivers. Bought items appear in
--    the Build Account (LBH purchase with receipt).
--  * interior_photos: photos per room (private media bucket, signed links)
--  * website photo slots for the interiors page and its before/after gallery

alter type public.request_type add value if not exists 'interiors';

-- ---------- website photo slots ----------
alter table public.site_photos drop constraint if exists site_photos_slot_check;
alter table public.site_photos add constraint site_photos_slot_check
  check (slot in ('hero','land','materials','monitoring','camera','live_feed','logo','onsite','reporting',
                  'interiors','interiors_before_1','interiors_after_1','interiors_before_2','interiors_after_2',
                  'interiors_before_3','interiors_after_3'));

-- ---------- items ----------
create table if not exists public.interior_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  room text not null check (char_length(room) between 1 and 60),
  name text not null check (char_length(name) between 1 and 160),
  shop text not null default '' check (char_length(shop) <= 120),
  qty int not null default 1 check (qty between 1 and 999),
  price_cents int not null check (price_cents > 0 and price_cents <= 100000000),
  link text not null default '' check (char_length(link) <= 500 and (link = '' or link ~ '^https?://')),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'option' check (status in ('option', 'chosen', 'declined', 'bought', 'delivered')),
  receipt_media_id uuid references public.media(id) on delete set null,
  chosen_at timestamptz,
  bought_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interior_items_request on public.interior_items (request_id, room);

-- ---------- photos per room ----------
create table if not exists public.interior_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  room text not null check (char_length(room) between 1 and 60),
  storage_path text not null unique
    check (storage_path ~ ('^interiors/' || request_id::text || '/[0-9a-f-]{36}\.jpg$')),
  caption text not null default '' check (char_length(caption) <= 200),
  taken_on date,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists interior_photos_request on public.interior_photos (request_id, room);

alter table public.interior_items enable row level security;
alter table public.interior_photos enable row level security;

-- client reads their own; admin manages; clients never write directly (choices go through the RPC below)
drop policy if exists interior_items_client on public.interior_items;
create policy interior_items_client on public.interior_items for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = interior_items.request_id and r.client_id = auth.uid()));
drop policy if exists interior_items_admin on public.interior_items;
create policy interior_items_admin on public.interior_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists interior_photos_client on public.interior_photos;
create policy interior_photos_client on public.interior_photos for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = interior_photos.request_id and r.client_id = auth.uid()));
drop policy if exists interior_photos_admin on public.interior_photos;
create policy interior_photos_admin on public.interior_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.interior_items, public.interior_photos to authenticated;
grant insert, update, delete on public.interior_items, public.interior_photos to authenticated;

create or replace function public.interior_items_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists interior_items_touch on public.interior_items;
create trigger interior_items_touch before update on public.interior_items
  for each row execute function public.interior_items_touch();

-- The client chooses or declines an option (only before LBH buys it).
create or replace function public.interior_choose(p_item uuid, p_choose boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v public.interior_items%rowtype;
begin
  select i.* into v from public.interior_items i
    join public.service_requests r on r.id = i.request_id
   where i.id = p_item and r.client_id = auth.uid()
   for update of i;
  if v.id is null then raise exception 'not found'; end if;
  if v.status not in ('option', 'chosen', 'declined') then raise exception 'already bought'; end if;
  update public.interior_items
     set status = case when p_choose then 'chosen' else 'declined' end,
         chosen_at = case when p_choose then now() else null end
   where id = p_item;
end $$;
revoke execute on function public.interior_choose(uuid, boolean) from public, anon;
grant execute on function public.interior_choose(uuid, boolean) to authenticated;
