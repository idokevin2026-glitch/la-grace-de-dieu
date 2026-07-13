-- La Grâce de Dieu — schéma initial
-- Montants en entiers FCFA (pas de décimales).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- profiles (clients / fidélité), 1:1 avec auth.users
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  email text,
  points integer not null default 0,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- crée automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------
-- products
-- ---------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('pagnes', 'femmes', 'hommes', 'enfants', 'accessoires')),
  price integer not null check (price >= 0),
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  description text not null default '',
  is_new boolean not null default false,
  image_url text,
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_category_idx on public.products (category);
create index products_created_at_idx on public.products (created_at desc);

-- ---------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'recue' check (status in ('recue', 'prep', 'route', 'livree')),
  subtotal integer not null,
  shipping_fee integer not null default 0,
  points_used integer not null default 0,
  points_earned integer not null default 0,
  total integer not null,
  payment_method text not null check (payment_method in ('wave', 'orange', 'mtn', 'moov', 'card', 'cod', 'transfer')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  commune text not null,
  address text not null,
  note text,
  created_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_ref_idx on public.orders (ref);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  price integer not null,
  qty integer not null check (qty > 0),
  size text,
  color text
);

create index order_items_order_id_idx on public.order_items (order_id);

create table public.order_measures (
  order_id uuid primary key references public.orders(id) on delete cascade,
  poitrine integer,
  taille integer,
  hanches integer,
  longueur integer,
  note text
);

-- ---------------------------------------------------------------
-- notifications (cloche in-app)
-- ---------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null default 'order',
  title text not null,
  body text not null,
  order_ref text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id);

-- ---------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------
create table public.favorites (
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------
-- newsletter
-- ---------------------------------------------------------------
create table public.newsletter_subscribers (
  email text primary key,
  created_at timestamptz not null default now()
);

-- =================================================================
-- RLS
-- =================================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_measures enable row level security;
alter table public.notifications enable row level security;
alter table public.favorites enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- profiles: chacun voit/modifie le sien, l'admin voit tout
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- products: lecture publique, écriture admin uniquement
create policy "products_select_all" on public.products
  for select using (true);
create policy "products_write_admin" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: le client authentifié voit ses commandes, l'admin voit tout.
-- La création se fait exclusivement via l'API serveur (clé de service),
-- jamais directement depuis le navigateur (recalcul des montants côté serveur).
create policy "orders_select_own_or_admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy "orders_update_admin" on public.orders
  for update using (public.is_admin());

create policy "order_items_select_own_or_admin" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );

create policy "order_measures_select_own_or_admin" on public.order_measures
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );

-- notifications: uniquement les siennes ; création réservée à l'admin (changement de statut de commande)
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_insert_admin" on public.notifications
  for insert with check (public.is_admin());

-- favoris: gérés uniquement par leur propriétaire
create policy "favorites_all_own" on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- newsletter: inscription publique, pas de lecture publique
create policy "newsletter_insert_public" on public.newsletter_subscribers
  for insert with check (true);
create policy "newsletter_select_admin" on public.newsletter_subscribers
  for select using (public.is_admin());

-- ---------------------------------------------------------------
-- storage: bucket public pour les photos produits
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
