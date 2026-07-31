-- ============================================================================
-- NATHAN KIDS — Migration 0010 : réinitialisation du PIN d'une vendeuse (admin)
-- ----------------------------------------------------------------------------
-- Permet à l'administratrice de redonner un nouveau PIN à une vendeuse qui a
-- oublié le sien, SANS passer par le SMS (pas besoin d'un fournisseur SMS).
-- Réservé à l'admin de la boutique. `search_path = public, extensions` pour que
-- pgcrypto (bcrypt via hash_pin) soit trouvé sur Supabase (cf. migration 0009).
-- ============================================================================
create or replace function public.auth_set_staff_pin(
  p_user_id uuid,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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
  if not public.pin_is_valid(p_new_pin) then
    raise exception 'validation_error: pin' using errcode = '22023';
  end if;
  if public.pin_taken(v_shop, p_new_pin) then
    raise exception 'conflict: pin already used' using errcode = '23505';
  end if;

  update public.users
     set pin_hash = public.hash_pin(p_new_pin)
   where id = p_user_id and shop_id = v_shop and role = 'staff' and active;
  if not found then
    raise exception 'not_found: staff %', p_user_id using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_user_id, 'reset', true);
end;
$$;

revoke all on function public.auth_set_staff_pin(uuid, text) from public, anon;
grant execute on function public.auth_set_staff_pin(uuid, text) to authenticated;
