-- ============================================================================
-- NATHAN KIDS — Fusion de deux boutiques (data centralization)
-- ----------------------------------------------------------------------------
-- CONTEXTE
--   Deux boutiques distinctes ont été créées par erreur (chaque personne a fait
--   « Créer la boutique » au lieu de rejoindre celle de l'admin via le lien
--   d'invitation ?shop=…). Résultat : deux stocks séparés, invisibles l'un pour
--   l'autre. Ce script ABSORBE une boutique SOURCE dans une boutique CIBLE :
--   tous les produits, ventes, mouvements, crédits, clients, présences, comptes
--   et vendeuses de la SOURCE sont rattachés à la CIBLE, en conservant tout
--   l'historique (les UUID ne changent pas, seul le shop_id change). La boutique
--   SOURCE, vidée, est supprimée à la fin.
--
-- À EXÉCUTER dans : Supabase Dashboard → SQL Editor (projet nathan-kids).
--
-- ⚠️  AVANT DE LANCER
--   1) FAITES UNE SAUVEGARDE : Dashboard → Database → Backups (ou un dump).
--      Cette opération est irréversible sans sauvegarde.
--   2) Personne ne doit être en train de vendre pendant la fusion.
--   3) Renseignez src_shop et tgt_shop à l'ÉTAPE 2 (voir ÉTAPE 1 pour les trouver).
--
-- Le script est ATOMIQUE : tout réussit, ou rien n'est modifié (bloc DO = une
-- seule transaction ; la moindre erreur annule l'ensemble).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — IDENTIFIER LES DEUX BOUTIQUES (lecture seule, ne modifie rien)
-- Lancez d'abord CE bloc seul. Repérez, grâce au nombre de produits et aux
-- noms, laquelle garder (CIBLE) et laquelle absorber (SOURCE). Copiez les `id`.
-- ────────────────────────────────────────────────────────────────────────────
select
  s.id                                   as shop_id,
  s.name,
  s.created_at,
  (select count(*) from public.products p        where p.shop_id = s.id and not p.archived) as produits,
  (select count(*) from public.users u           where u.shop_id = s.id and u.active)        as utilisateurs,
  (select count(*) from public.sales sa          where sa.shop_id = s.id)                    as ventes,
  (select coalesce(string_agg(u.name, ', '), '') from public.users u
     where u.shop_id = s.id and u.active)                                                    as noms_utilisateurs
from public.shops s
order by s.created_at;


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — LA FUSION
-- Remplacez les deux UUID ci-dessous, puis lancez ce bloc.
--   • src_shop = boutique à ABSORBER (elle sera supprimée à la fin)
--   • tgt_shop = boutique OFFICIELLE à CONSERVER
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  src_shop uuid := 'COLLER-ICI-ID-BOUTIQUE-SOURCE';   -- ← à absorber (supprimée)
  tgt_shop uuid := 'COLLER-ICI-ID-BOUTIQUE-CIBLE';    -- ← à conserver
  n_prod   int;
  n_barcode_clash int;
  n_cust_dup int;
begin
  -- ---- Garde-fous -----------------------------------------------------------
  if src_shop = tgt_shop then
    raise exception 'src_shop et tgt_shop sont identiques : rien à fusionner.';
  end if;
  if not exists (select 1 from public.shops where id = src_shop) then
    raise exception 'Boutique SOURCE % introuvable.', src_shop;
  end if;
  if not exists (select 1 from public.shops where id = tgt_shop) then
    raise exception 'Boutique CIBLE % introuvable.', tgt_shop;
  end if;

  raise notice 'Fusion : SOURCE % → CIBLE %', src_shop, tgt_shop;

  -- ---- 1) PRODUITS ----------------------------------------------------------
  -- Collision de code-barres (même EAN dans les 2 boutiques) : on retire le
  -- code-barres du produit SOURCE pour respecter unique(shop_id, barcode). Le
  -- produit est déplacé quand même (comme article distinct) — à réconcilier à la
  -- main ensuite si besoin. Les code-barres NULL ne collisionnent jamais.
  update public.products p
     set barcode = null
   where p.shop_id = src_shop
     and p.barcode is not null
     and exists (select 1 from public.products t
                  where t.shop_id = tgt_shop and t.barcode = p.barcode);
  get diagnostics n_barcode_clash = row_count;
  if n_barcode_clash > 0 then
    raise notice '⚠️  % produit(s) SOURCE avaient un code-barres déjà présent dans la CIBLE : code-barres retiré, produit déplacé à part (à vérifier).', n_barcode_clash;
  end if;

  update public.products set shop_id = tgt_shop where shop_id = src_shop;
  get diagnostics n_prod = row_count;
  raise notice '• Produits déplacés : %', n_prod;

  -- ---- 2) CLIENTS (dédoublonnage par nom, insensible à la casse) ------------
  -- Un même client (même nom) peut exister dans les 2 boutiques. On repointe les
  -- ventes/crédits de la SOURCE vers le client existant de la CIBLE, puis on
  -- supprime le doublon SOURCE. Les clients uniques sont simplement déplacés.
  update public.sales sa
     set customer_id = t.id
    from public.customers dup
    join public.customers t
      on t.shop_id = tgt_shop and lower(t.name) = lower(dup.name)
   where dup.shop_id = src_shop and sa.customer_id = dup.id;

  update public.credits c
     set customer_id = t.id
    from public.customers dup
    join public.customers t
      on t.shop_id = tgt_shop and lower(t.name) = lower(dup.name)
   where dup.shop_id = src_shop and c.customer_id = dup.id;

  delete from public.customers dup
   where dup.shop_id = src_shop
     and exists (select 1 from public.customers t
                  where t.shop_id = tgt_shop and lower(t.name) = lower(dup.name));
  get diagnostics n_cust_dup = row_count;
  if n_cust_dup > 0 then
    raise notice '• Clients en doublon fusionnés : %', n_cust_dup;
  end if;

  update public.customers set shop_id = tgt_shop where shop_id = src_shop;

  -- ---- 3) VENTES, CRÉDITS, JOURNAUX -----------------------------------------
  -- sale_lines n'a pas de shop_id : suit automatiquement ses ventes.
  update public.sales               set shop_id = tgt_shop where shop_id = src_shop;
  update public.credits             set shop_id = tgt_shop where shop_id = src_shop;
  update public.stock_movements     set shop_id = tgt_shop where shop_id = src_shop;
  update public.money_movements     set shop_id = tgt_shop where shop_id = src_shop;
  update public.attendance_sessions set shop_id = tgt_shop where shop_id = src_shop;

  -- Journal d'audit : conservé (rattaché à la CIBLE) si la table existe.
  if to_regclass('public.auth_audit') is not null then
    update public.auth_audit set shop_id = tgt_shop where shop_id = src_shop;
  end if;

  -- ---- 4) UTILISATEURS (vendeuses + admin de la SOURCE) ---------------------
  -- On rattache les comptes à la CIBLE en gardant leurs rôles ET leurs PIN : les
  -- vendeuses continuent de se connecter comme avant, mais sur la bonne boutique.
  -- NB : l'admin de la SOURCE reste admin dans la CIBLE (co-administration). Pour
  -- le rétrograder en vendeuse, décommentez le bloc « rétrograder » plus bas.
  update public.users set shop_id = tgt_shop where shop_id = src_shop;

  --  -- Rétrograder les admins venus de la SOURCE en vendeuses (optionnel) :
  --  update public.users u set role = 'staff'
  --   where u.shop_id = tgt_shop and u.role = 'admin'
  --     and u.id <> 'ID-DE-L-ADMIN-PRINCIPAL-A-GARDER';

  -- ---- 5) COMPTES CAISSE / BANQUE (addition des soldes) ---------------------
  -- unique(shop_id, kind) interdit deux lignes 'cash' : on ADDITIONNE le solde
  -- SOURCE dans la ligne CIBLE correspondante, puis on supprimera les lignes
  -- SOURCE (cascade à la suppression de la boutique). Si la CIBLE n'a pas un
  -- type que la SOURCE possède, on déplace simplement cette ligne.
  update public.accounts t
     set balance = t.balance + s.balance
    from public.accounts s
   where s.shop_id = src_shop and t.shop_id = tgt_shop and t.kind = s.kind;

  update public.accounts s
     set shop_id = tgt_shop
   where s.shop_id = src_shop
     and not exists (select 1 from public.accounts t
                      where t.shop_id = tgt_shop and t.kind = s.kind);

  delete from public.accounts where shop_id = src_shop;   -- restes additionnés

  -- ---- 6) SESSIONS / OTP DE LA SOURCE (nettoyage) ---------------------------
  -- Les refresh tokens portent l'ancien shop_id : on les révoque pour forcer une
  -- reconnexion propre sur la CIBLE. Idem pour d'éventuels codes OTP en attente.
  if to_regclass('public.refresh_tokens') is not null then
    delete from public.refresh_tokens where shop_id = src_shop;
  end if;
  if to_regclass('public.otp_codes') is not null then
    delete from public.otp_codes where shop_id = src_shop;
  end if;

  -- ---- 7) SUPPRESSION DE LA BOUTIQUE SOURCE (désormais vide) ----------------
  -- La cascade nettoie tout reliquat éventuel encore rattaché à la SOURCE.
  delete from public.shops where id = src_shop;

  raise notice '✅ Fusion terminée. Tout est désormais sur la boutique CIBLE %.', tgt_shop;
  raise notice '⚠️  IMPORTANT : vérifiez qu''aucune vendeuse n''a le MÊME code PIN qu''une autre sur la boutique fusionnée. En cas de doublon de PIN, réinitialisez-en un (écran Équipe → 🔑). Toutes les sessions ont été révoquées : chacun se reconnecte avec son PIN via le lien d''invitation.';
end $$;


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — VÉRIFICATION (lecture seule, après la fusion)
-- La boutique SOURCE ne doit plus apparaître ; la CIBLE contient tout.
-- ────────────────────────────────────────────────────────────────────────────
select
  s.id                                   as shop_id,
  s.name,
  (select count(*) from public.products p where p.shop_id = s.id and not p.archived) as produits,
  (select count(*) from public.users u    where u.shop_id = s.id and u.active)        as utilisateurs,
  (select count(*) from public.sales sa   where sa.shop_id = s.id)                    as ventes
from public.shops s
order by s.created_at;
