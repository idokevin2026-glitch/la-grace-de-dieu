-- ============================================================================
-- NATHAN KIDS — Migration 0002 : Row-Level Security multi-tenant + rôles
-- ----------------------------------------------------------------------------
-- Principe (ARCHITECTURE.md §2/§7) : chaque requête d'un utilisateur authentifié
-- est filtrée par SA boutique. Le `shop_id` vient TOUJOURS du JWT, jamais du
-- client. Le JWT porte les claims `shop_id`, `user_id`, `role` (émis par la
-- couche Auth PIN — Edge Function, cf. README).
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
  select coalesce(auth.jwt() ->> 'role', '');
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
