-- ============================================================================
-- NATHAN KIDS — Backend Phase 2 — Migration 0001 : schéma initial
-- ----------------------------------------------------------------------------
-- Reprend le DDL de DATA_MODEL.md (source de vérité) avec quelques corrections :
--   * customers : index unique fonctionnel `lower(name)` (la forme
--     `unique (shop_id, lower(name))` inline n'est pas du SQL valide) ;
--   * sales : ajout d'`idempotency_key` (offline-first, cf. ARCHITECTURE.md §4) ;
--   * products / accounts : trigger `updated_at`.
--
-- Montants : entiers FCFA, jamais de décimales. Horodatage : timestamptz.
-- Multi-tenant : chaque table métier porte `shop_id` ; l'isolation est imposée
-- par la Row-Level Security (voir 0002_rls.sql).
-- ============================================================================

create extension if not exists "pgcrypto";        -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Helper : updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========= Boutique (tenant) =========
create table public.shops (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- 'NATHAN KIDS'
  phone         text,
  open_time     time,                             -- horaires d'ouverture
  close_time    time,
  created_at    timestamptz not null default now()
);

-- ========= Utilisateurs (admin + vendeuses) =========
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name          text not null,
  role          text not null check (role in ('admin','staff')),
  -- NE JAMAIS stocker le PIN en clair (le proto le fait ; corrigé ici) :
  pin_hash      text not null,                    -- bcrypt (pgcrypto) du PIN 4 chiffres
  phone         text,                             -- sert au reset PIN (admin)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
  -- NB : PAS de `unique (shop_id, pin_hash)` — bcrypt sale chaque hash, deux PIN
  -- identiques ne collisionnent donc jamais. L'unicité du PIN par boutique est
  -- imposée applicativement (scan bcrypt) dans auth_signup/auth_add_staff (0004).
);
create index users_shop_idx on public.users (shop_id);   -- login : scan des users d'une boutique

-- ========= Produits =========
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name_fr       text not null,
  name_en       text not null,
  category      text not null check (category in ('vetements','cosmetiques')),
  price         integer not null check (price >= 0),          -- prix de vente FCFA
  cost          integer not null default 0 check (cost >= 0), -- prix d'achat FCFA
  stock         integer not null default 0 check (stock >= 0),
  threshold     integer not null default 4,                   -- alerte stock bas
  supplier      text,
  barcode       text,                                          -- EAN-13
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (shop_id, barcode)
);
create index products_shop_category_idx on public.products (shop_id, category);
create index products_low_stock_idx on public.products (shop_id) where stock <= threshold;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ========= Clients =========
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name          text not null,
  phone         text,
  created_at    timestamptz not null default now()
);
-- upsert par nom insensible à la casse (cf. BUSINESS_LOGIC.md §1.7)
create unique index customers_shop_lower_name_uidx
  on public.customers (shop_id, lower(name));

-- ========= Ventes =========
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  seller_id       uuid references public.users(id),          -- qui a vendu
  customer_id     uuid references public.customers(id),       -- facultatif
  label           text not null,                              -- libellé auto (recalculable)
  total           integer not null check (total >= 0),        -- FCFA encaissé
  profit          integer not null,                           -- FCFA (Σ (price-cost)*qty)
  method          text not null check (method in ('especes','wave','om','card','credit')),
  idempotency_key uuid,                                        -- offline-first : rejeu sans doublon
  created_at      timestamptz not null default now()
);
create index sales_shop_created_idx on public.sales (shop_id, created_at desc);
-- une même clé d'idempotence ne crée qu'une vente par boutique (les NULL restent libres)
create unique index sales_idempotency_uidx
  on public.sales (shop_id, idempotency_key) where idempotency_key is not null;

create table public.sale_lines (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  qty           integer not null check (qty > 0),
  unit_price    integer not null,                    -- prix au moment de la vente
  unit_cost     integer not null                     -- coût au moment de la vente
);
create index sale_lines_sale_idx on public.sale_lines (sale_id);
create index sale_lines_product_idx on public.sale_lines (product_id);

-- ========= Crédits clients =========
create table public.credits (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  sale_id       uuid references public.sales(id),
  customer_id   uuid references public.customers(id),
  customer_name text not null,                       -- dénormalisé (proto)
  amount        integer not null check (amount > 0), -- FCFA dû
  paid          boolean not null default false,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index credits_open_idx on public.credits (shop_id) where paid = false;

-- ========= Mouvements de stock (journal immuable) =========
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  product_name  text not null,                       -- snapshot du nom (proto)
  direction     text not null check (direction in ('in','out')),
  qty           integer not null check (qty > 0),
  reason        text not null check (reason in ('sale','restock','adjust','inv')),
  sale_id       uuid references public.sales(id),    -- si reason='sale'
  user_id       uuid references public.users(id),
  created_at    timestamptz not null default now()
);
create index stock_movements_shop_created_idx on public.stock_movements (shop_id, created_at desc);
create index stock_movements_product_idx on public.stock_movements (product_id);

-- ========= Comptes caisse / banque =========
create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  kind          text not null check (kind in ('cash','bank')),
  balance       integer not null default 0,          -- FCFA
  updated_at    timestamptz not null default now(),
  unique (shop_id, kind)
);
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ========= Mouvements caisse/banque (journal) =========
create table public.money_movements (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  amount        integer not null check (amount > 0), -- FCFA
  type          text not null check (type in ('deposit','withdraw','toBank')),
  target        text check (target in ('cash','bank')), -- null pour 'toBank'
  user_id       uuid references public.users(id),
  created_at    timestamptz not null default now()
);
create index money_movements_shop_created_idx on public.money_movements (shop_id, created_at desc);

-- ========= Présences vendeuses (journal) =========
create table public.attendance_sessions (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  user_id       uuid not null references public.users(id),
  login_at      timestamptz not null default now(),
  logout_at     timestamptz,
  active        boolean not null default true
);
create index attendance_sessions_shop_active_idx on public.attendance_sessions (shop_id, active);
