-- Bootstrap CI / Postgres nu : recrée les objets fournis par Supabase dont
-- dépendent les migrations (schéma `auth` + `auth.jwt()`, rôles anon /
-- authenticated / service_role). À exécuter AVANT les migrations quand on teste
-- sur un PostgreSQL vanilla (hors Supabase). Sur Supabase, ces objets existent
-- déjà — ne pas rejouer ce fichier en production.

create schema if not exists auth;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role; end if;
end
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
