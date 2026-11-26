-- ======================================================================
-- LBH Shops (marketplace, catalogue model)
--
--  * Shops list their materials and prices on LBH. No money moves through
--    the shop listing: the client picks items, LBH creates an ORDER CODE,
--    and an LBH project manager (field staff) takes the code to the shop
--    and buys with the client's money that LBH already holds.
--  * Fair-price rule: the app price must equal the walk-in price. If the
--    shelf price is LOWER, the client pays the lower price and the shop gets
--    a warning. If it is HIGHER or out of stock, the client approves first.
--  * Shops are managed by LBH staff (no shop login yet). Shops apply on the
--    website; an admin approves them.
--
--  Tables: shops (public part), shop_contacts (private), shop_items,
--          shop_orders, shop_order_items.
--  Writes go through server actions (role-checked); RLS covers reads.
-- ======================================================================

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  name text not null check (char_length(name) between 2 and 100),
  area text not null default '' check (char_length(area) <= 80),        -- town / suburb
  address text not null default '' check (char_length(address) <= 200),
  about text not null default '' check (char_length(about) <= 600),
  categories text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  fair_price_agreed_at timestamptz,
  warnings int not null default 0 check (warnings >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shops_status on public.shops (status, name);
alter table public.shops enable row level security;
drop policy if exists shops_public_read on public.shops;
create policy shops_public_read on public.shops for select to anon, authenticated using (status = 'approved');
drop policy if exists shops_admin on public.shops;
create policy shops_admin on public.shops for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists shops_field_read on public.shops;
create policy shops_field_read on public.shops for select to authenticated using (public.is_field());

-- Private: who to call, the shop's own price-list notes. Admin and field staff only.
create table if not exists public.shop_contacts (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  contact_name text not null default '' check (char_length(contact_name) <= 100),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  notes text not null default '' check (char_length(notes) <= 4000)
);
alter table public.shop_contacts enable row level security;
drop policy if exists shop_contacts_admin on public.shop_contacts;
create policy shop_contacts_admin on public.shop_contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists shop_contacts_field on public.shop_contacts;
create policy shop_contacts_field on public.shop_contacts for select to authenticated using (public.is_field());

create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in
    ('cement', 'bricks', 'sand_stone', 'steel', 'roofing', 'timber', 'plumbing', 'electrical', 'paint', 'tiles', 'doors_windows', 'hardware')),
  unit text not null check (char_length(unit) between 1 and 40),
  price_cents int not null check (price_cents > 0 and price_cents <= 100000000),
  in_stock boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists shop_items_shop on public.shop_items (shop_id, category, name);
create index if not exists shop_items_cat on public.shop_items (category, price_cents);
alter table public.shop_items enable row level security;
drop policy if exists shop_items_public_read on public.shop_items;
create policy shop_items_public_read on public.shop_items for select to anon, authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved'));
drop policy if exists shop_items_admin on public.shop_items;
create policy shop_items_admin on public.shop_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^LBH-[A-Z0-9]{6}$'),
  client_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete restrict,
  -- placed → assigned (PM) → bought;  assigned → changed (client decides) → assigned | cancelled
  status text not null default 'placed' check (status in ('placed', 'assigned', 'changed', 'bought', 'cancelled')),
  total_cents int not null check (total_cents >= 0),       -- locked app prices
  paid_cents int check (paid_cents is null or paid_cents >= 0),
  client_note text not null default '' check (char_length(client_note) <= 500),
  field_note text not null default '' check (char_length(field_note) <= 500),
  assigned_to uuid references public.profiles(id) on delete set null,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bought_at timestamptz
);
create index if not exists shop_orders_client on public.shop_orders (client_id, created_at desc);
create index if not exists shop_orders_field on public.shop_orders (assigned_to, status);
create index if not exists shop_orders_status on public.shop_orders (status, created_at desc);
alter table public.shop_orders enable row level security;
drop policy if exists shop_orders_client_read on public.shop_orders;
create policy shop_orders_client_read on public.shop_orders for select to authenticated using (client_id = auth.uid());
drop policy if exists shop_orders_field_read on public.shop_orders;
create policy shop_orders_field_read on public.shop_orders for select to authenticated using (public.is_field() and assigned_to = auth.uid());
drop policy if exists shop_orders_admin on public.shop_orders;
create policy shop_orders_admin on public.shop_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  item_id uuid references public.shop_items(id) on delete set null,
  name text not null,
  unit text not null,
  qty int not null check (qty between 1 and 100000),
  price_cents int not null check (price_cents > 0),            -- locked when the order was placed
  shelf_price_cents int check (shelf_price_cents is null or shelf_price_cents > 0),  -- what the PM found
  available boolean not null default true
);
create index if not exists shop_order_items_order on public.shop_order_items (order_id);
alter table public.shop_order_items enable row level security;
drop policy if exists shop_order_items_read on public.shop_order_items;
create policy shop_order_items_read on public.shop_order_items for select to authenticated
  using (exists (select 1 from public.shop_orders o where o.id = order_id
                 and (o.client_id = auth.uid() or public.is_admin() or (public.is_field() and o.assigned_to = auth.uid()))));
drop policy if exists shop_order_items_admin on public.shop_order_items;
create policy shop_order_items_admin on public.shop_order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
