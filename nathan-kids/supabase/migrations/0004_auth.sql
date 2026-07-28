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
