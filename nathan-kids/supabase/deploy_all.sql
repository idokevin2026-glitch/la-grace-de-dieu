-- ============================================================================
-- NATHAN KIDS — Script de déploiement TOUT-EN-UN (Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Concaténation, DANS L'ORDRE, des 8 migrations + le seed de démo.
-- À coller tel quel dans le SQL Editor d'un projet Supabase NEUF, puis Run.
--
-- NB : sur Supabase, le schéma `auth`, la fonction `auth.jwt()` et les rôles
-- anon/authenticated/service_role existent déjà — NE PAS exécuter
-- ci/bootstrap.sql (réservé aux tests sur PostgreSQL vanilla).
-- Généré automatiquement — ne pas éditer à la main ; modifier les migrations.
-- ============================================================================


-- ####################################################################
-- ## migrations/0001_init.sql
-- ####################################################################

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

-- ####################################################################
-- ## migrations/0002_rls.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0002 : Row-Level Security multi-tenant + rôles
-- ----------------------------------------------------------------------------
-- Principe (ARCHITECTURE.md §2/§7) : chaque requête d'un utilisateur authentifié
-- est filtrée par SA boutique. Le `shop_id` vient TOUJOURS du JWT, jamais du
-- client. Le JWT porte les claims `shop_id`, `user_id`, `user_role` (émis par la
-- couche Auth PIN, cf. README).
--
-- NB : le claim standard `role` est réservé par Supabase au rôle Postgres
-- (`authenticated`/`anon`) ; le rôle APPLICATIF (admin/staff) est donc porté par
-- un claim distinct `user_role`.
--
-- Les fonctions métier (0003) sont SECURITY DEFINER et re-filtrent explicitement
-- par `auth_shop_id()` ; ces politiques protègent les accès directs via PostgREST.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers : lecture des claims du JWT
-- ---------------------------------------------------------------------------
create or replace function public.auth_shop_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'shop_id', '')::uuid;
$$;

create or replace function public.auth_user_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'user_id', '')::uuid;
$$;

create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'user_role', '');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.auth_role() = 'admin';
$$;

-- ---------------------------------------------------------------------------
-- Activation RLS
-- ---------------------------------------------------------------------------
alter table public.shops               enable row level security;
alter table public.users               enable row level security;
alter table public.products            enable row level security;
alter table public.customers           enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_lines          enable row level security;
alter table public.credits             enable row level security;
alter table public.stock_movements     enable row level security;
alter table public.accounts            enable row level security;
alter table public.money_movements     enable row level security;
alter table public.attendance_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- shops : on ne voit que sa propre boutique (lecture seule via API ;
-- création/maj passent par la couche Auth avec la clé de service).
-- ---------------------------------------------------------------------------
create policy shops_select_own on public.shops
  for select using (id = public.auth_shop_id());

-- ---------------------------------------------------------------------------
-- users : liste de l'équipe visible dans la boutique ; la gestion
-- (création/désactivation de vendeuses) est réservée à l'admin.
-- ---------------------------------------------------------------------------
create policy users_select_shop on public.users
  for select using (shop_id = public.auth_shop_id());
create policy users_write_admin on public.users
  for all
  using (shop_id = public.auth_shop_id() and public.is_admin())
  with check (shop_id = public.auth_shop_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- products : isolées par boutique (lecture + écriture directe autorisées ;
-- les mouvements de stock passent de préférence par les fonctions 0003).
-- Le masquage du `cost`/marge pour les `staff` se fait via la vue products_api.
-- ---------------------------------------------------------------------------
create policy products_shop_isolation on public.products
  for all
  using (shop_id = public.auth_shop_id())
  with check (shop_id = public.auth_shop_id());

-- ---------------------------------------------------------------------------
-- customers : isolés par boutique.
-- ---------------------------------------------------------------------------
create policy customers_shop_isolation on public.customers
  for all
  using (shop_id = public.auth_shop_id())
  with check (shop_id = public.auth_shop_id());

-- ---------------------------------------------------------------------------
-- sales / sale_lines : journaux append-only, isolés par boutique.
-- La finalisation passe par finalize_sale() (0003) ; ici lecture + garde-fou.
-- ---------------------------------------------------------------------------
create policy sales_shop_isolation on public.sales
  for all
  using (shop_id = public.auth_shop_id())
  with check (shop_id = public.auth_shop_id());

create policy sale_lines_shop_isolation on public.sale_lines
  for all
  using (exists (
    select 1 from public.sales s
    where s.id = sale_id and s.shop_id = public.auth_shop_id()
  ))
  with check (exists (
    select 1 from public.sales s
    where s.id = sale_id and s.shop_id = public.auth_shop_id()
  ));

-- ---------------------------------------------------------------------------
-- credits : isolés par boutique (recouvrement via pay_credit()).
-- ---------------------------------------------------------------------------
create policy credits_shop_isolation on public.credits
  for all
  using (shop_id = public.auth_shop_id())
  with check (shop_id = public.auth_shop_id());

-- ---------------------------------------------------------------------------
-- stock_movements : journal isolé par boutique.
-- ---------------------------------------------------------------------------
create policy stock_movements_shop_isolation on public.stock_movements
  for all
  using (shop_id = public.auth_shop_id())
  with check (shop_id = public.auth_shop_id());

-- ---------------------------------------------------------------------------
-- accounts + money_movements : FINANCES — admin uniquement (API_SPEC).
-- Un `staff` ne doit jamais lire les soldes ni les mouvements de caisse.
-- ---------------------------------------------------------------------------
create policy accounts_admin_only on public.accounts
  for all
  using (shop_id = public.auth_shop_id() and public.is_admin())
  with check (shop_id = public.auth_shop_id() and public.is_admin());

create policy money_movements_admin_only on public.money_movements
  for all
  using (shop_id = public.auth_shop_id() and public.is_admin())
  with check (shop_id = public.auth_shop_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- attendance_sessions : visibles dans la boutique (l'admin consulte le pointage).
-- ---------------------------------------------------------------------------
create policy attendance_shop_isolation on public.attendance_sessions
  for all
  using (shop_id = public.auth_shop_id())
  with check (shop_id = public.auth_shop_id());

-- ---------------------------------------------------------------------------
-- Vue products_api : masque `cost` et la marge aux `staff`.
-- security_invoker => la RLS de products s'applique sous l'identité de l'appelant.
-- Le front (staff) doit lire cette vue plutôt que la table directement.
-- ---------------------------------------------------------------------------
create or replace view public.products_api
with (security_invoker = true) as
select
  p.id,
  p.shop_id,
  p.name_fr,
  p.name_en,
  p.category,
  p.price,
  case when public.is_admin() then p.cost end                       as cost,
  case when public.is_admin() then (p.price - p.cost) end           as margin,
  p.stock,
  p.threshold,
  p.supplier,
  p.barcode,
  p.archived,
  (p.stock > 0 and p.stock <= p.threshold)                          as low_stock,
  (p.stock = 0)                                                     as out_of_stock,
  p.created_at,
  p.updated_at
from public.products p;

-- ####################################################################
-- ## migrations/0003_functions.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0003 : fonctions métier atomiques (RPC)
-- ----------------------------------------------------------------------------
-- Transcription fidèle de BUSINESS_LOGIC.md, garantissant les invariants de
-- DATA_MODEL.md. Chaque fonction est une TRANSACTION unique (tout ou rien) et
-- appelable via PostgREST : POST /rest/v1/rpc/<fonction>.
--
-- Sécurité : SECURITY DEFINER (contourne la RLS) MAIS re-filtre EXPLICITEMENT
-- par `auth_shop_id()` sur chaque table. Le `shop_id` vient du JWT, jamais d'un
-- paramètre client (ARCHITECTURE.md §2). L'exécution est réservée au rôle
-- `authenticated` (grants en fin de fichier).
--
-- Codes d'erreur (mappés vers l'enveloppe API par la passerelle) :
--   validation_error   -> SQLSTATE 22023
--   unauthenticated    -> SQLSTATE 28000
--   forbidden          -> SQLSTATE 42501
--   not_found          -> SQLSTATE P0002 (no_data_found)
--   conflict           -> SQLSTATE 23505-like, ici P0003 dédié
--   insufficient_stock -> SQLSTATE P0001 (raise_exception) + message dédié
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. finalize_sale — BUSINESS_LOGIC.md §1
--    p_lines : jsonb [{ "productId": uuid, "qty": int }, ...]
-- ---------------------------------------------------------------------------
create or replace function public.finalize_sale(
  p_lines           jsonb,
  p_method          text,
  p_customer_name   text default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop        uuid := public.auth_shop_id();
  v_seller      uuid := public.auth_user_id();
  v_line        jsonb;
  v_prod        public.products%rowtype;
  v_qty         integer;
  v_total       integer := 0;
  v_profit      integer := 0;
  v_sale_id     uuid;
  v_customer_id uuid := null;
  v_credit_id   uuid := null;
  v_label       text := null;
  v_line_count  integer := 0;
  v_existing    public.sales%rowtype;
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Garde-fous d'entrée (BUSINESS_LOGIC.md §1.1/§1.2)
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'validation_error: lines' using errcode = '22023';
  end if;
  if p_method not in ('especes','wave','om','card','credit') then
    raise exception 'validation_error: method' using errcode = '22023';
  end if;
  if p_method = 'credit' and (p_customer_name is null or btrim(p_customer_name) = '') then
    raise exception 'validation_error: customerName' using errcode = '22023';
  end if;

  -- Idempotence (ARCHITECTURE.md §4) : rejouer renvoie la vente déjà créée.
  if p_idempotency_key is not null then
    select * into v_existing
      from public.sales
     where shop_id = v_shop and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'id', v_existing.id, 'label', v_existing.label,
        'total', v_existing.total, 'profit', v_existing.profit,
        'method', v_existing.method, 'createdAt', v_existing.created_at,
        'creditId', (select id from public.credits where sale_id = v_existing.id),
        'replayed', true);
    end if;
  end if;

  -- Client : upsert par nom insensible à la casse si un nom est fourni (§1.7)
  if p_customer_name is not null and btrim(p_customer_name) <> '' then
    insert into public.customers (shop_id, name)
      values (v_shop, btrim(p_customer_name))
      on conflict (shop_id, lower(name)) do update set name = customers.name
      returning id into v_customer_id;
  end if;

  -- Coquille de vente (label/total/profit remplis après le parcours des lignes)
  insert into public.sales (shop_id, seller_id, customer_id, label, total, profit, method, idempotency_key)
    values (v_shop, v_seller, v_customer_id, '', 0, 0, p_method, p_idempotency_key)
    returning id into v_sale_id;

  -- Parcours des lignes (§1.3)
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := (v_line ->> 'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'validation_error: qty' using errcode = '22023';
    end if;

    -- Verrou FOR UPDATE : évite les décréments concurrents incohérents (ARCHITECTURE.md §5)
    select * into v_prod
      from public.products
     where id = (v_line ->> 'productId')::uuid and shop_id = v_shop
     for update;
    if not found then
      raise exception 'not_found: product %', v_line ->> 'productId' using errcode = 'P0002';
    end if;

    -- Vérif stock AVANT validation (BUSINESS_LOGIC.md §1 ⚠ + invariant stock >= 0)
    if v_prod.stock < v_qty then
      raise exception 'insufficient_stock: product % (stock %, demandé %)',
        v_prod.id, v_prod.stock, v_qty using errcode = 'P0001';
    end if;

    v_total  := v_total  + v_prod.price * v_qty;
    v_profit := v_profit + (v_prod.price - v_prod.cost) * v_qty;

    update public.products
       set stock = stock - v_qty
     where id = v_prod.id;

    insert into public.sale_lines (sale_id, product_id, qty, unit_price, unit_cost)
      values (v_sale_id, v_prod.id, v_qty, v_prod.price, v_prod.cost);

    -- Un mouvement de stock par écriture (invariant §2)
    insert into public.stock_movements
      (shop_id, product_id, product_name, direction, qty, reason, sale_id, user_id)
      values (v_shop, v_prod.id, v_prod.name_fr, 'out', v_qty, 'sale', v_sale_id, v_seller);

    -- Libellé auto (§1.4) : nom du 1er article (×qty si qty>1)
    if v_line_count = 0 then
      v_label := case when v_qty > 1
                      then v_prod.name_fr || ' ×' || v_qty
                      else v_prod.name_fr end;
    end if;
    v_line_count := v_line_count + 1;
  end loop;

  -- « +N » où N = (nombre de lignes − 1)
  if v_line_count > 1 then
    v_label := v_label || ' +' || (v_line_count - 1);
  end if;

  update public.sales
     set label = v_label, total = v_total, profit = v_profit
   where id = v_sale_id;

  -- Impact trésorerie selon le mode (§1.6)
  if p_method = 'especes' then
    update public.accounts set balance = balance + v_total
     where shop_id = v_shop and kind = 'cash';
  elsif p_method in ('wave','om','card') then
    update public.accounts set balance = balance + v_total
     where shop_id = v_shop and kind = 'bank';
  elsif p_method = 'credit' then
    -- ni cash ni bank ne bougent ; on crée le crédit
    insert into public.credits (shop_id, sale_id, customer_id, customer_name, amount)
      values (v_shop, v_sale_id, v_customer_id, btrim(p_customer_name), v_total)
      returning id into v_credit_id;
  end if;

  return jsonb_build_object(
    'id', v_sale_id, 'label', v_label, 'total', v_total, 'profit', v_profit,
    'method', p_method, 'createdAt', now(), 'creditId', v_credit_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. pay_credit — BUSINESS_LOGIC.md §3
--    Solde le crédit + crédite la caisse ; 409 si déjà soldé.
-- ---------------------------------------------------------------------------
create or replace function public.pay_credit(p_credit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop   uuid := public.auth_shop_id();
  v_credit public.credits%rowtype;
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select * into v_credit
    from public.credits
   where id = p_credit_id and shop_id = v_shop
   for update;
  if not found then
    raise exception 'not_found: credit %', p_credit_id using errcode = 'P0002';
  end if;
  if v_credit.paid then
    raise exception 'conflict: credit already paid' using errcode = 'P0003';
  end if;

  update public.credits
     set paid = true, paid_at = now()
   where id = v_credit.id;

  update public.accounts
     set balance = balance + v_credit.amount
   where shop_id = v_shop and kind = 'cash';

  return jsonb_build_object('id', v_credit.id, 'paid', true, 'amount', v_credit.amount);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. restock — BUSINESS_LOGIC.md §4
-- ---------------------------------------------------------------------------
create or replace function public.restock(
  p_product_id uuid,
  p_qty        integer,
  p_new_cost   integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid := public.auth_shop_id();
  v_prod public.products%rowtype;
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'validation_error: qty' using errcode = '22023';
  end if;

  select * into v_prod from public.products
   where id = p_product_id and shop_id = v_shop for update;
  if not found then
    raise exception 'not_found: product %', p_product_id using errcode = 'P0002';
  end if;

  update public.products
     set stock = stock + p_qty,
         cost  = case when p_new_cost is not null and p_new_cost > 0 then p_new_cost else cost end
   where id = v_prod.id;

  insert into public.stock_movements
    (shop_id, product_id, product_name, direction, qty, reason, user_id)
    values (v_shop, v_prod.id, v_prod.name_fr, 'in', p_qty, 'restock', public.auth_user_id());

  return jsonb_build_object(
    'id', v_prod.id, 'stock', v_prod.stock + p_qty,
    'cost', case when p_new_cost is not null and p_new_cost > 0 then p_new_cost else v_prod.cost end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. adjust — BUSINESS_LOGIC.md §5
--    stock = max(0, stock + delta) ; mouvement UNIQUEMENT si le stock change.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta      integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop      uuid := public.auth_shop_id();
  v_prod      public.products%rowtype;
  v_new_stock integer;
  v_change    integer;
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_delta is null then
    raise exception 'validation_error: delta' using errcode = '22023';
  end if;

  select * into v_prod from public.products
   where id = p_product_id and shop_id = v_shop for update;
  if not found then
    raise exception 'not_found: product %', p_product_id using errcode = 'P0002';
  end if;

  v_new_stock := greatest(0, v_prod.stock + p_delta);
  v_change    := v_new_stock - v_prod.stock;   -- variation réelle (plafonnée à 0)

  if v_change <> 0 then
    update public.products set stock = v_new_stock where id = v_prod.id;
    insert into public.stock_movements
      (shop_id, product_id, product_name, direction, qty, reason, user_id)
      values (v_shop, v_prod.id, v_prod.name_fr,
              case when v_change > 0 then 'in' else 'out' end,
              abs(v_change), 'adjust', public.auth_user_id());
  end if;

  return jsonb_build_object('id', v_prod.id, 'stock', v_new_stock, 'changed', v_change <> 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. inventory_count — BUSINESS_LOGIC.md §6
--    p_counts : jsonb [{ "productId": uuid, "counted": int }, ...]
--    Pour chaque écart counted<>stock : stock=counted + mouvement 'inv'.
-- ---------------------------------------------------------------------------
create or replace function public.inventory_count(p_counts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop     uuid := public.auth_shop_id();
  v_item     jsonb;
  v_prod     public.products%rowtype;
  v_counted  integer;
  v_change   integer;
  v_adjusted integer := 0;
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_counts is null or jsonb_typeof(p_counts) <> 'array' then
    raise exception 'validation_error: counts' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_counts)
  loop
    v_counted := (v_item ->> 'counted')::integer;
    if v_counted is null or v_counted < 0 then
      raise exception 'validation_error: counted' using errcode = '22023';
    end if;

    select * into v_prod from public.products
     where id = (v_item ->> 'productId')::uuid and shop_id = v_shop for update;
    if not found then
      raise exception 'not_found: product %', v_item ->> 'productId' using errcode = 'P0002';
    end if;

    v_change := v_counted - v_prod.stock;
    if v_change <> 0 then
      update public.products set stock = v_counted where id = v_prod.id;
      insert into public.stock_movements
        (shop_id, product_id, product_name, direction, qty, reason, user_id)
        values (v_shop, v_prod.id, v_prod.name_fr,
                case when v_change > 0 then 'in' else 'out' end,
                abs(v_change), 'inv', public.auth_user_id());
      v_adjusted := v_adjusted + 1;
    end if;
  end loop;

  return jsonb_build_object('adjusted', v_adjusted);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. money_move — BUSINESS_LOGIC.md §7 — FINANCES : admin uniquement.
--    type ∈ {deposit, withdraw, toBank}, target ∈ {cash, bank} (ignoré si toBank).
-- ---------------------------------------------------------------------------
create or replace function public.money_move(
  p_type   text,
  p_target text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid := public.auth_shop_id();
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'validation_error: amount' using errcode = '22023';
  end if;
  if p_type not in ('deposit','withdraw','toBank') then
    raise exception 'validation_error: type' using errcode = '22023';
  end if;

  if p_type = 'toBank' then
    update public.accounts set balance = balance - p_amount where shop_id = v_shop and kind = 'cash';
    update public.accounts set balance = balance + p_amount where shop_id = v_shop and kind = 'bank';
  else
    if p_target not in ('cash','bank') then
      raise exception 'validation_error: target' using errcode = '22023';
    end if;
    if p_type = 'deposit' then
      update public.accounts set balance = balance + p_amount where shop_id = v_shop and kind = p_target;
    else -- withdraw
      update public.accounts set balance = balance - p_amount where shop_id = v_shop and kind = p_target;
    end if;
  end if;

  insert into public.money_movements (shop_id, amount, type, target, user_id)
    values (v_shop, p_amount, p_type,
            case when p_type = 'toBank' then null else p_target end,
            public.auth_user_id());

  return jsonb_build_object('type', p_type, 'target', p_target, 'amount', p_amount);
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution : uniquement les utilisateurs authentifiés.
-- (Les rôles admin/staff sont vérifiés à l'intérieur des fonctions.)
-- ---------------------------------------------------------------------------
revoke all on function public.finalize_sale(jsonb, text, text, uuid)  from public, anon;
revoke all on function public.pay_credit(uuid)                        from public, anon;
revoke all on function public.restock(uuid, integer, integer)         from public, anon;
revoke all on function public.adjust_stock(uuid, integer)             from public, anon;
revoke all on function public.inventory_count(jsonb)                  from public, anon;
revoke all on function public.money_move(text, text, integer)         from public, anon;

grant execute on function public.finalize_sale(jsonb, text, text, uuid) to authenticated;
grant execute on function public.pay_credit(uuid)                       to authenticated;
grant execute on function public.restock(uuid, integer, integer)        to authenticated;
grant execute on function public.adjust_stock(uuid, integer)            to authenticated;
grant execute on function public.inventory_count(jsonb)                 to authenticated;
grant execute on function public.money_move(text, text, integer)        to authenticated;

-- ####################################################################
-- ## migrations/0004_auth.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0004 : Auth PIN (cœur SQL) — BUSINESS_LOGIC.md §9
-- ----------------------------------------------------------------------------
-- Le PIN 4 chiffres est haché avec bcrypt (pgcrypto : crypt()/gen_salt('bf')).
-- Comme bcrypt sale chaque hash, on ne peut ni contraindre l'unicité par une
-- clé SQL, ni « retrouver par hash » : on VÉRIFIE en balayant les utilisateurs
-- actifs de la boutique (peu nombreux). La couche Next.js appelle ces fonctions
-- puis signe le JWT (claims shop_id/user_id/user_role) — cf. README.
--
-- Ces fonctions sont SECURITY DEFINER. signup / login / reset sont PRÉ-AUTH
-- (pas de JWT encore) → exécutables par `anon`. add_staff / logout exigent un JWT.
-- Anti-brute-force : à imposer côté passerelle (rate-limit /auth/*), cf. §7.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers PIN
-- ---------------------------------------------------------------------------
create or replace function public.pin_is_valid(p_pin text)
returns boolean language sql immutable as $$
  select p_pin ~ '^\d{4}$';
$$;

create or replace function public.hash_pin(p_pin text)
returns text language sql volatile as $$
  select crypt(p_pin, gen_salt('bf', 10));      -- bcrypt, coût 10
$$;

-- Vrai si un utilisateur ACTIF de la boutique possède déjà ce PIN.
create or replace function public.pin_taken(p_shop uuid, p_pin text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.users
     where shop_id = p_shop and active
       and pin_hash = crypt(p_pin, pin_hash)     -- comparaison bcrypt
  );
$$;

-- ---------------------------------------------------------------------------
-- auth_signup — API_SPEC POST /auth/signup
--   Crée boutique + admin + comptes (cash/bank à 0). Retourne l'identité.
-- ---------------------------------------------------------------------------
create or replace function public.auth_signup(
  p_shop_name text,
  p_owner     text,
  p_phone     text,
  p_pin       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid;
  v_user uuid;
begin
  if coalesce(btrim(p_shop_name),'') = '' or coalesce(btrim(p_owner),'') = '' then
    raise exception 'validation_error: shopName/owner' using errcode = '22023';
  end if;
  if not public.pin_is_valid(p_pin) then
    raise exception 'validation_error: pin' using errcode = '22023';
  end if;

  insert into public.shops (name, phone)
    values (btrim(p_shop_name), nullif(btrim(p_phone),''))
    returning id into v_shop;

  insert into public.users (shop_id, name, role, pin_hash, phone)
    values (v_shop, btrim(p_owner), 'admin', public.hash_pin(p_pin), nullif(btrim(p_phone),''))
    returning id into v_user;

  insert into public.accounts (shop_id, kind, balance)
    values (v_shop, 'cash', 0), (v_shop, 'bank', 0);

  return jsonb_build_object(
    'shopId', v_shop, 'shopName', btrim(p_shop_name),
    'userId', v_user, 'name', btrim(p_owner), 'role', 'admin');
end;
$$;

-- ---------------------------------------------------------------------------
-- auth_login — API_SPEC POST /auth/login  (BUSINESS_LOGIC.md §9)
--   Compare le PIN d'abord à l'admin, puis aux vendeuses. Si staff : ouvre
--   une session de présence. Retourne l'identité (+ attendanceSessionId).
-- ---------------------------------------------------------------------------
create or replace function public.auth_login(
  p_shop_id uuid,
  p_pin     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    public.users%rowtype;
  v_session uuid := null;
begin
  if not public.pin_is_valid(p_pin) then
    raise exception 'invalid_pin' using errcode = '28P01';
  end if;

  -- admin d'abord, puis staff (ordre de priorité §9)
  select * into v_user
    from public.users
   where shop_id = p_shop_id and active
     and pin_hash = crypt(p_pin, pin_hash)
   order by (role = 'admin') desc
   limit 1;
  if not found then
    raise exception 'invalid_pin' using errcode = '28P01';
  end if;

  -- effet de bord : login staff => ouverture d'une session de présence
  if v_user.role = 'staff' then
    insert into public.attendance_sessions (shop_id, user_id)
      values (v_user.shop_id, v_user.id)
      returning id into v_session;
  end if;

  return jsonb_build_object(
    'shopId', v_user.shop_id, 'userId', v_user.id,
    'name', v_user.name, 'role', v_user.role,
    'attendanceSessionId', v_session);
end;
$$;

-- ---------------------------------------------------------------------------
-- auth_add_staff — API_SPEC POST /staff (admin uniquement)
--   Refuse un PIN déjà utilisé dans la boutique (409 conflict).
-- ---------------------------------------------------------------------------
create or replace function public.auth_add_staff(
  p_name text,
  p_pin  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid := public.auth_shop_id();
  v_user uuid;
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name),'') = '' then
    raise exception 'validation_error: name' using errcode = '22023';
  end if;
  if not public.pin_is_valid(p_pin) then
    raise exception 'validation_error: pin' using errcode = '22023';
  end if;
  if public.pin_taken(v_shop, p_pin) then
    raise exception 'conflict: pin already used' using errcode = '23505';
  end if;

  insert into public.users (shop_id, name, role, pin_hash)
    values (v_shop, btrim(p_name), 'staff', public.hash_pin(p_pin))
    returning id into v_user;

  return jsonb_build_object('id', v_user, 'name', btrim(p_name), 'active', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- auth_remove_staff — API_SPEC DELETE /staff/:id (désactive, garde l'historique)
-- ---------------------------------------------------------------------------
create or replace function public.auth_remove_staff(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid := public.auth_shop_id();
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  update public.users set active = false
   where id = p_user_id and shop_id = v_shop and role = 'staff';
  if not found then
    raise exception 'not_found: staff %', p_user_id using errcode = 'P0002';
  end if;

  -- clôturer une éventuelle session de présence ouverte
  update public.attendance_sessions
     set logout_at = now(), active = false
   where user_id = p_user_id and shop_id = v_shop and active;

  return jsonb_build_object('id', p_user_id, 'active', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- auth_reset_pin — API_SPEC POST /auth/reset-pin (admin, PIN oublié)
--   step='verify' : vérifie le téléphone de l'admin.
--   step='set'    : (re)vérifie le téléphone puis pose le nouveau PIN.
--   ⚠ En prod : renforcer par OTP SMS (ARCHITECTURE.md §3) — ici simple
--   correspondance du numéro, comme le proto, mais à ne pas garder tel quel.
-- ---------------------------------------------------------------------------
create or replace function public.auth_reset_pin(
  p_shop_id uuid,
  p_step    text,
  p_phone   text,
  p_new_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.users%rowtype;
begin
  select * into v_admin
    from public.users
   where shop_id = p_shop_id and role = 'admin' and active
   limit 1;
  if not found or v_admin.phone is null
     or regexp_replace(v_admin.phone,'\D','','g') <> regexp_replace(coalesce(p_phone,''),'\D','','g') then
    raise exception 'not_found: phone mismatch' using errcode = 'P0002';
  end if;

  if p_step = 'verify' then
    return jsonb_build_object('ok', true);
  elsif p_step = 'set' then
    if not public.pin_is_valid(p_new_pin) then
      raise exception 'validation_error: newPin' using errcode = '22023';
    end if;
    update public.users set pin_hash = public.hash_pin(p_new_pin) where id = v_admin.id;
    return jsonb_build_object('ok', true);
  else
    raise exception 'validation_error: step' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- attendance_logout — API_SPEC POST /attendance/logout (BUSINESS_LOGIC.md §9)
--   Clôt la session active de l'utilisateur courant.
-- ---------------------------------------------------------------------------
create or replace function public.attendance_logout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid := public.auth_shop_id();
  v_user uuid := public.auth_user_id();
  v_closed integer;
begin
  if v_shop is null or v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  update public.attendance_sessions
     set logout_at = now(), active = false
   where shop_id = v_shop and user_id = v_user and active;
  get diagnostics v_closed = row_count;

  return jsonb_build_object('closed', v_closed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------
revoke all on function public.hash_pin(text)                                   from public, anon, authenticated;
revoke all on function public.pin_taken(uuid, text)                            from public, anon, authenticated;
revoke all on function public.auth_signup(text, text, text, text)              from public;
revoke all on function public.auth_login(uuid, text)                           from public;
revoke all on function public.auth_reset_pin(uuid, text, text, text)           from public;
revoke all on function public.auth_add_staff(text, text)                       from public, anon;
revoke all on function public.auth_remove_staff(uuid)                          from public, anon;
revoke all on function public.attendance_logout()                              from public, anon;

-- Pré-auth (appelées sans JWT) : autorisées à `anon` ET `authenticated`.
grant execute on function public.auth_signup(text, text, text, text)     to anon, authenticated;
grant execute on function public.auth_login(uuid, text)                  to anon, authenticated;
grant execute on function public.auth_reset_pin(uuid, text, text, text)  to anon, authenticated;
-- Post-auth : JWT requis.
grant execute on function public.auth_add_staff(text, text)              to authenticated;
grant execute on function public.auth_remove_staff(uuid)                 to authenticated;
grant execute on function public.attendance_logout()                     to authenticated;

-- ####################################################################
-- ## migrations/0005_aggregates.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0005 : agrégats (fiche du jour + sync offline)
-- ----------------------------------------------------------------------------
-- Endpoints de lecture non couverts nativement par PostgREST :
--   * sales_daily(date)  -> API_SPEC GET /sales/daily  (BUSINESS_LOGIC.md §8)
--   * sync_since(ts)      -> API_SPEC GET /sync         (ARCHITECTURE.md §4)
-- Toujours filtrés par la boutique du JWT. Les chiffres financiers (profit,
-- soldes, mouvements de caisse) ne sont renvoyés qu'à l'admin.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sales_daily — fiche du jour agrégée
--   p_tz : fuseau pour délimiter la journée (défaut Abidjan = UTC).
-- ---------------------------------------------------------------------------
create or replace function public.sales_daily(
  p_date date,
  p_tz   text default 'UTC'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_shop    uuid := public.auth_shop_id();
  v_from    timestamptz;
  v_to      timestamptz;
  v_revenue integer := 0;
  v_profit  integer := 0;
  v_count   integer := 0;
  v_credits integer := 0;
  v_admin   boolean := public.is_admin();
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  v_from := (p_date::text || ' 00:00')::timestamp at time zone p_tz;
  v_to   := v_from + interval '1 day';

  select coalesce(sum(total),0), coalesce(sum(profit),0), count(*),
         coalesce(sum(total) filter (where method = 'credit'), 0)
    into v_revenue, v_profit, v_count, v_credits
    from public.sales
   where shop_id = v_shop and created_at >= v_from and created_at < v_to;

  return jsonb_build_object(
    'date',    p_date,
    'revenue', v_revenue,
    'profit',  case when v_admin then v_profit end,      -- masqué au staff
    'count',   v_count,
    'avgBasket', case when v_count > 0 then round(v_revenue::numeric / v_count) else 0 end,
    'creditsGiven', v_credits,
    'byPayment', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'amount', amount) order by amount desc)
        from (
          select method, sum(total) as amount
            from public.sales
           where shop_id = v_shop and created_at >= v_from and created_at < v_to
           group by method
        ) bp), '[]'::jsonb),
    'itemsSold', coalesce((
      select jsonb_agg(jsonb_build_object(
               'productId', product_id, 'name', name, 'qty', qty, 'amount', amount) order by qty desc)
        from (
          select l.product_id,
                 max(p.name_fr) as name,
                 sum(l.qty) as qty,
                 sum(l.qty * l.unit_price) as amount
            from public.sale_lines l
            join public.sales s on s.id = l.sale_id
            left join public.products p on p.id = l.product_id
           where s.shop_id = v_shop and s.created_at >= v_from and s.created_at < v_to
           group by l.product_id
        ) it), '[]'::jsonb),
    'operations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'time', to_char(created_at at time zone p_tz, 'HH24:MI'),
               'label', label, 'method', method, 'amount', total) order by created_at)
        from public.sales
       where shop_id = v_shop and created_at >= v_from and created_at < v_to), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_since — pull incrémental offline-first
--   Renvoie tout ce qui a changé depuis p_since (journaux append-only + état).
--   L'état dérivé (stock/soldes) est la VÉRITÉ SERVEUR (ARCHITECTURE.md §4).
-- ---------------------------------------------------------------------------
create or replace function public.sync_since(p_since timestamptz default '-infinity')
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_shop  uuid := public.auth_shop_id();
  v_admin boolean := public.is_admin();
begin
  if v_shop is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'now', now(),
    'products', coalesce((
      select jsonb_agg(to_jsonb(pa)) from public.products_api pa
       where pa.shop_id = v_shop and pa.updated_at > p_since), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'label', s.label, 'total', s.total,
               'profit', case when v_admin then s.profit end,
               'method', s.method, 'customerId', s.customer_id,
               'createdAt', s.created_at,
               'lines', (select jsonb_agg(jsonb_build_object(
                            'productId', l.product_id, 'qty', l.qty, 'unitPrice', l.unit_price))
                           from public.sale_lines l where l.sale_id = s.id)))
        from public.sales s
       where s.shop_id = v_shop and s.created_at > p_since), '[]'::jsonb),
    'credits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'customerName', customer_name, 'amount', amount,
               'paid', paid, 'createdAt', created_at, 'paidAt', paid_at))
        from public.credits
       where shop_id = v_shop and (created_at > p_since or coalesce(paid_at, '-infinity') > p_since)), '[]'::jsonb),
    'stockMovements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'productId', product_id, 'productName', product_name,
               'direction', direction, 'qty', qty, 'reason', reason, 'createdAt', created_at))
        from public.stock_movements
       where shop_id = v_shop and created_at > p_since), '[]'::jsonb),
    -- Finances : admin uniquement
    'accounts', case when v_admin then coalesce((
      select jsonb_object_agg(kind, balance) from public.accounts where shop_id = v_shop), '{}'::jsonb) end,
    'moneyMovements', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'amount', amount, 'type', type, 'target', target, 'createdAt', created_at))
        from public.money_movements
       where shop_id = v_shop and created_at > p_since), '[]'::jsonb) end,
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'userId', a.user_id, 'name', u.name,
               'loginAt', a.login_at, 'logoutAt', a.logout_at, 'active', a.active))
        from public.attendance_sessions a join public.users u on u.id = a.user_id
       where a.shop_id = v_shop and (a.login_at > p_since or coalesce(a.logout_at, '-infinity') > p_since)), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke all on function public.sales_daily(date, text)      from public, anon;
revoke all on function public.sync_since(timestamptz)      from public, anon;
grant execute on function public.sales_daily(date, text)   to authenticated;
grant execute on function public.sync_since(timestamptz)   to authenticated;

-- ####################################################################
-- ## migrations/0006_security.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0006 : durcissement sécurité (ARCHITECTURE.md §7)
-- ----------------------------------------------------------------------------
--   * Journal d'audit des opérations sensibles (déclencheurs) : recouvrement
--     de crédit, retrait/mouvement de caisse, désactivation de vendeuse.
--   * Limiteur anti-brute-force générique (`rate_check`) appelé par l'Edge
--     Function auth sur /login et /reset-pin, keyé par IP (pas par boutique,
--     pour éviter qu'un attaquant verrouille toute la boutique).
--   * `log_event` : journalisation des tentatives de login (succès/échec) par
--     l'Edge Function (un échec de login lève une exception côté RPC et serait
--     donc annulé s'il était journalisé dans la même transaction).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Journal d'audit (append-only)
-- ---------------------------------------------------------------------------
create table public.auth_audit (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid references public.shops(id) on delete cascade,
  user_id     uuid,
  event       text not null,          -- login_ok | login_fail | pin_reset | credit_paid | money_* | staff_deactivated
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index auth_audit_shop_idx on public.auth_audit (shop_id, created_at desc);

alter table public.auth_audit enable row level security;
-- Seul l'admin de la boutique lit son journal d'audit.
create policy auth_audit_admin_read on public.auth_audit
  for select using (shop_id = public.auth_shop_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Déclencheurs d'audit sur les mutations sensibles committées
-- ---------------------------------------------------------------------------
create or replace function public.audit_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Brancher d'abord sur la table : chaque champ (NEW.paid, NEW.active…)
  -- n'est référencé que pour la table qui le possède (sinon PL/pgSQL lève
  -- « record NEW has no field … »).
  if TG_TABLE_NAME = 'credits' then
    if NEW.paid and not OLD.paid then
      insert into public.auth_audit(shop_id, event, detail)
        values (NEW.shop_id, 'credit_paid', jsonb_build_object('creditId', NEW.id, 'amount', NEW.amount));
    end if;
  elsif TG_TABLE_NAME = 'money_movements' then
    insert into public.auth_audit(shop_id, user_id, event, detail)
      values (NEW.shop_id, NEW.user_id, 'money_' || NEW.type,
              jsonb_build_object('amount', NEW.amount, 'target', NEW.target));
  elsif TG_TABLE_NAME = 'users' then
    if OLD.active and not NEW.active then
      insert into public.auth_audit(shop_id, user_id, event, detail)
        values (NEW.shop_id, NEW.id, 'staff_deactivated', jsonb_build_object('name', NEW.name));
    end if;
  end if;
  return NEW;
end;
$$;

create trigger audit_credit    after update on public.credits          for each row execute function public.audit_sensitive();
create trigger audit_money     after insert on public.money_movements  for each row execute function public.audit_sensitive();
create trigger audit_users     after update on public.users            for each row execute function public.audit_sensitive();

-- ---------------------------------------------------------------------------
-- log_event : journalisation par la couche de confiance (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.log_event(
  p_event  text,
  p_detail jsonb default null,
  p_shop   uuid  default null,
  p_user   uuid  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auth_audit(shop_id, user_id, event, detail)
    values (p_shop, p_user, p_event, p_detail);
end;
$$;

-- ---------------------------------------------------------------------------
-- Limiteur anti-brute-force générique
--   rate_check(key, max, window_sec, lock_sec) -> true si l'appel est AUTORISÉ.
--   Fenêtre glissante : au-delà de `max` échecs dans `window_sec`, verrouille
--   pendant `lock_sec`. La clé est fournie par l'appelant (ex. login:<ip>:<shop>).
-- ---------------------------------------------------------------------------
create table public.rate_limit (
  key           text primary key,
  count         integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);
alter table public.rate_limit enable row level security;   -- aucun accès direct (service_role bypass)

create or replace function public.rate_check(
  p_key        text,
  p_max        integer default 5,
  p_window_sec integer default 300,
  p_lock_sec   integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rate_limit%rowtype;
begin
  insert into public.rate_limit(key) values (p_key)
    on conflict (key) do update set key = excluded.key
    returning * into r;

  if r.locked_until is not null and r.locked_until > now() then
    return false;                                   -- toujours verrouillé
  end if;

  if now() - r.window_start > make_interval(secs => p_window_sec) then
    update public.rate_limit set count = 1, window_start = now(), locked_until = null where key = p_key;
    return true;                                     -- nouvelle fenêtre
  end if;

  if r.count + 1 > p_max then
    update public.rate_limit
       set count = r.count + 1, locked_until = now() + make_interval(secs => p_lock_sec)
     where key = p_key;
    return false;                                    -- seuil dépassé => verrou
  end if;

  update public.rate_limit set count = r.count + 1 where key = p_key;
  return true;
end;
$$;

-- Réinitialise le compteur après un login réussi (appelé par l'Edge Function).
create or replace function public.rate_reset(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit where key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Droits : ces fonctions ne sont appelées que par la couche de confiance
-- (Edge Function, clé service_role). Jamais exposées à anon/authenticated.
-- ---------------------------------------------------------------------------
revoke all on function public.log_event(text, jsonb, uuid, uuid)     from public, anon, authenticated;
revoke all on function public.rate_check(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_reset(text)                       from public, anon, authenticated;

-- La couche de confiance (Edge Function auth) s'exécute avec la clé service_role.
grant execute on function public.log_event(text, jsonb, uuid, uuid)     to service_role;
grant execute on function public.rate_check(text, integer, integer, integer) to service_role;
grant execute on function public.rate_reset(text)                       to service_role;

-- ####################################################################
-- ## migrations/0007_refresh_tokens.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0007 : refresh tokens avec rotation + révocation
-- ----------------------------------------------------------------------------
-- Remplace le refresh token JWT stateless (non révocable) par un jeton OPAQUE
-- stocké côté serveur (seul son SHA-256 est conservé). À chaque /refresh :
--   * le jeton présenté est vérifié puis RÉVOQUÉ, un nouveau est émis (rotation) ;
--   * si un jeton DÉJÀ tourné est représenté (rejeu / vol) → toute la « famille »
--     est révoquée (reuse detection).
-- Au logout, le jeton est révoqué. Un utilisateur désactivé invalide sa famille.
--
-- Appelées uniquement par la couche de confiance (Edge Function, service_role).
-- ============================================================================

create table public.refresh_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  shop_id      uuid not null references public.shops(id) on delete cascade,
  family_id    uuid not null,                       -- chaîne de rotation (session)
  token_hash   text not null unique,                -- SHA-256 du jeton opaque
  expires_at   timestamptz not null,
  revoked      boolean not null default false,
  replaced_by  uuid,                                -- jeton qui l'a remplacé
  created_at   timestamptz not null default now()
);
create index refresh_tokens_user_active_idx on public.refresh_tokens (user_id) where not revoked;
create index refresh_tokens_family_idx on public.refresh_tokens (family_id);

-- Aucun accès direct : RLS activée sans politique (service_role bypass).
alter table public.refresh_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- refresh_issue : émission d'un jeton (login/signup) — nouvelle famille.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_issue(
  p_user       uuid,
  p_shop       uuid,
  p_token_hash text,
  p_ttl_sec    integer
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.refresh_tokens (user_id, shop_id, family_id, token_hash, expires_at)
    values (p_user, p_shop, gen_random_uuid(), p_token_hash, now() + make_interval(secs => p_ttl_sec));
$$;

-- ---------------------------------------------------------------------------
-- refresh_rotate : vérifie + révoque l'ancien, émet le nouveau (même famille).
--   RENVOIE un jsonb { ok:true, userId, shopId, role }  (rotation réussie)
--   ou     { ok:false, error:'...' }                    (échec).
--   ⚠ On RENVOIE (au lieu de `raise`) sur les cas « rejeu » et « inactif » :
--   sinon l'exception annulerait la révocation de la famille faite juste avant.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_rotate(
  p_old_hash text,
  p_new_hash text,
  p_ttl_sec  integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r        public.refresh_tokens%rowtype;
  v_role   text;
  v_active boolean;
  v_new    uuid := gen_random_uuid();
begin
  select * into r from public.refresh_tokens where token_hash = p_old_hash;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown');
  end if;

  -- Rejeu d'un jeton déjà tourné/révoqué => compromission probable : on coupe
  -- toute la famille (session) et on refuse.
  if r.revoked then
    update public.refresh_tokens set revoked = true
      where family_id = r.family_id and not revoked;
    return jsonb_build_object('ok', false, 'error', 'reuse');
  end if;

  if r.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select role, active into v_role, v_active from public.users where id = r.user_id;
  if v_active is not true then
    update public.refresh_tokens set revoked = true where family_id = r.family_id and not revoked;
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  insert into public.refresh_tokens (id, user_id, shop_id, family_id, token_hash, expires_at)
    values (v_new, r.user_id, r.shop_id, r.family_id, p_new_hash, now() + make_interval(secs => p_ttl_sec));
  update public.refresh_tokens set revoked = true, replaced_by = v_new where id = r.id;

  return jsonb_build_object('ok', true, 'userId', r.user_id, 'shopId', r.shop_id, 'role', v_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- refresh_revoke : révoque un jeton précis (logout).
-- refresh_revoke_user : révoque toutes les sessions d'un utilisateur.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_revoke(p_token_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.refresh_tokens set revoked = true where token_hash = p_token_hash and not revoked;
$$;

create or replace function public.refresh_revoke_user(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.refresh_tokens set revoked = true where user_id = p_user and not revoked;
$$;

-- ---------------------------------------------------------------------------
-- Droits : couche de confiance uniquement (service_role).
-- ---------------------------------------------------------------------------
revoke all on function public.refresh_issue(uuid, uuid, text, integer)  from public, anon, authenticated;
revoke all on function public.refresh_rotate(text, text, integer)       from public, anon, authenticated;
revoke all on function public.refresh_revoke(text)                      from public, anon, authenticated;
revoke all on function public.refresh_revoke_user(uuid)                 from public, anon, authenticated;

grant execute on function public.refresh_issue(uuid, uuid, text, integer)  to service_role;
grant execute on function public.refresh_rotate(text, text, integer)       to service_role;
grant execute on function public.refresh_revoke(text)                      to service_role;
grant execute on function public.refresh_revoke_user(uuid)                 to service_role;

-- ####################################################################
-- ## migrations/0008_otp.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Migration 0008 : OTP (code SMS) pour le reset du PIN
-- ----------------------------------------------------------------------------
-- Remplace la simple correspondance du téléphone (ARCHITECTURE.md §3) par un
-- code à usage unique : l'Edge Function génère un code à 6 chiffres, l'envoie
-- au numéro de l'admin ENREGISTRÉ (pas celui fourni par le client), et n'accepte
-- le nouveau PIN qu'après vérification du code. Le code est stocké HACHÉ,
-- expire, et le nombre de tentatives est limité.
--
-- Fonctions appelées uniquement par la couche de confiance (service_role).
-- ============================================================================

create table public.otp_codes (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  purpose      text not null default 'pin_reset',
  code_hash    text not null,                       -- SHA-256(shopId:code)
  phone        text,                                -- numéro admin destinataire
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  expires_at   timestamptz not null,
  consumed     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index otp_codes_active_idx on public.otp_codes (shop_id, purpose) where not consumed;

alter table public.otp_codes enable row level security;   -- service_role only (aucune policy)

-- ---------------------------------------------------------------------------
-- otp_request : vérifie le téléphone admin, invalide les anciens codes, stocke
-- le nouveau (haché). Renvoie le numéro ENREGISTRÉ pour l'envoi SMS.
-- ---------------------------------------------------------------------------
create or replace function public.otp_request(
  p_shop      uuid,
  p_purpose   text,
  p_phone     text,
  p_code_hash text,
  p_ttl_sec   integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.users%rowtype;
begin
  select * into v_admin
    from public.users
   where shop_id = p_shop and role = 'admin' and active
   limit 1;
  if not found or v_admin.phone is null
     or regexp_replace(v_admin.phone, '\D', '', 'g') <> regexp_replace(coalesce(p_phone,''), '\D', '', 'g') then
    return jsonb_build_object('ok', false, 'error', 'phone_mismatch');
  end if;

  update public.otp_codes set consumed = true
    where shop_id = p_shop and purpose = p_purpose and not consumed;

  insert into public.otp_codes (shop_id, purpose, code_hash, phone, expires_at)
    values (p_shop, p_purpose, p_code_hash, v_admin.phone, now() + make_interval(secs => p_ttl_sec));

  return jsonb_build_object('ok', true, 'phone', v_admin.phone);
end;
$$;

-- ---------------------------------------------------------------------------
-- otp_verify : consomme le code si correct/valide. Renvoie {ok:true/false,...}.
--   (Renvoie au lieu de `raise` pour que l'incrément de `attempts` persiste.)
-- ---------------------------------------------------------------------------
create or replace function public.otp_verify(
  p_shop      uuid,
  p_purpose   text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.otp_codes%rowtype;
begin
  select * into r
    from public.otp_codes
   where shop_id = p_shop and purpose = p_purpose and not consumed
   order by created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_code');
  end if;
  if r.expires_at < now() then
    update public.otp_codes set consumed = true where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if r.attempts >= r.max_attempts then
    update public.otp_codes set consumed = true where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;
  if r.code_hash <> p_code_hash then
    update public.otp_codes set attempts = attempts + 1 where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  update public.otp_codes set consumed = true where id = r.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits : couche de confiance uniquement (service_role).
-- ---------------------------------------------------------------------------
revoke all on function public.otp_request(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.otp_verify(uuid, text, text)                 from public, anon, authenticated;
grant execute on function public.otp_request(uuid, text, text, text, integer) to service_role;
grant execute on function public.otp_verify(uuid, text, text)                 to service_role;

-- ####################################################################
-- ## seed/seed.sql
-- ####################################################################

-- ============================================================================
-- NATHAN KIDS — Seed de démarrage (dev / démo)
-- ----------------------------------------------------------------------------
-- Crée la boutique NATHAN KIDS, l'admin Mme Silué, les 2 comptes (caisse/banque)
-- et le catalogue des 12 produits du prototype.
--
-- ⚠ Le PIN admin est ici un HACHÉ FACTICE (placeholder). En production, l'admin
-- est créé par la couche Auth (POST /auth/signup) qui hache le PIN via bcrypt/
-- argon2 (ARCHITECTURE.md §3) — ne jamais stocker un PIN en clair.
-- ============================================================================

do $$
declare
  v_shop uuid;
begin
  -- Boutique -------------------------------------------------------------
  insert into public.shops (name, phone, open_time, close_time)
    values ('NATHAN KIDS', '+225 00 00 00 00', '08:00', '19:00')
    returning id into v_shop;

  -- Admin (PIN haché — placeholder à remplacer par la vraie Auth) ---------
  insert into public.users (shop_id, name, role, pin_hash, phone)
    values (v_shop, 'Mme Silué', 'admin', '$2a$10$SEED_PLACEHOLDER_REPLACE_ME', '+225 00 00 00 00');

  -- Comptes caisse / banque (soldes de départ à 0) ------------------------
  insert into public.accounts (shop_id, kind, balance) values
    (v_shop, 'cash', 0),
    (v_shop, 'bank', 0);

  -- Catalogue (12 produits du proto) --------------------------------------
  insert into public.products (shop_id, name_fr, name_en, category, price, cost, stock, threshold, supplier) values
    (v_shop, 'Robe fleurie fille',  'Floral girl dress', 'vetements',   6500, 3500, 12, 4, 'Kids Fashion Import'),
    (v_shop, 'T-shirt dino garçon', 'Dino boy t-shirt',  'vetements',   3500, 1800,  3, 5, 'Kids Fashion Import'),
    (v_shop, 'Ensemble bébé',       'Baby outfit set',   'vetements',   8000, 4500,  7, 3, 'Bébé Confort Distribution'),
    (v_shop, 'Jean enfant',         'Kids jeans',        'vetements',   5500, 3000, 15, 4, 'Kids Fashion Import'),
    (v_shop, 'Pyjama licorne',      'Unicorn pyjama',    'vetements',   4500, 2500,  2, 4, 'Bébé Confort Distribution'),
    (v_shop, 'Chaussettes (lot x3)','Socks (pack x3)',   'vetements',   2000,  900, 20, 6, 'Bébé Confort Distribution'),
    (v_shop, 'Crème hydratante bébé','Baby moisturizer', 'cosmetiques', 4000, 2200,  9, 4, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Savon doux',          'Gentle soap',       'cosmetiques', 1500,  700,  1, 5, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Huile de massage',    'Massage oil',       'cosmetiques', 3500, 1900,  6, 3, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Lait corporel',       'Body lotion',       'cosmetiques', 5000, 2800, 11, 4, 'Beauty Line Afrique'),
    (v_shop, 'Shampoing enfant',    'Kids shampoo',      'cosmetiques', 3000, 1600,  0, 4, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Parfum femme',        'Women perfume',     'cosmetiques',12000, 7000,  4, 2, 'Beauty Line Afrique');

  raise notice 'Seed NATHAN KIDS OK — shop_id = %', v_shop;
end $$;
