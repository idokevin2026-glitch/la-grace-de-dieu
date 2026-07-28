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
