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
