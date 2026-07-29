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
