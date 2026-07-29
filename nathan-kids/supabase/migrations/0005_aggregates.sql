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
