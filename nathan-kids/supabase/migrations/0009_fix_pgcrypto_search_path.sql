-- ============================================================================
-- NATHAN KIDS — Migration 0009 : correctif search_path pgcrypto (Supabase)
-- ----------------------------------------------------------------------------
-- Sur Supabase, l'extension pgcrypto (crypt/gen_salt) est installée dans le
-- schéma `extensions`, pas `public`. Les fonctions d'auth qui l'utilisent
-- doivent donc inclure `extensions` dans leur search_path — sinon, à l'exécution
-- (appel RPC via PostgREST), on obtient : « function gen_salt(...) does not exist ».
--
-- Idempotent : à exécuter sur une base déjà déployée avant ce correctif.
-- (Les fresh installs ont déjà le bon search_path via 0004.)
-- ============================================================================

alter function public.hash_pin(text)          set search_path = public, extensions;
alter function public.pin_taken(uuid, text)   set search_path = public, extensions;
alter function public.auth_login(uuid, text)  set search_path = public, extensions;
