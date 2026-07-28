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
