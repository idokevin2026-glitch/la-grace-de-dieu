-- ============================================================================
-- NATHAN KIDS — Consolidation des boutiques en double (cas réel La Grâce de Dieu)
-- ----------------------------------------------------------------------------
-- 6 boutiques « NATHAN KIDS » ont été créées par erreur. On réunit TOUT dans la
-- vraie boutique de la propriétaire (Mme Silué, admin, 12 produits) et on
-- supprime les 5 autres. Script ATOMIQUE (bloc DO = une transaction) :
-- tout réussit, ou rien n'est modifié.
--
-- Décisions actées avec l'ingénieur (Kevin) :
--   • CIBLE conservée        : 5ccb3e8e-4224-4e0e-9bed-c8225de3402e (Mme Silué, admin)
--   • Produits de test à jeter : ceux de la boutique 695b6939… (eau, savon) → archivés
--   • Compte Kevin           : conservé ACTIF et passé ADMIN (accès maintenance)
--   • Autres comptes         : désactivés (ne restent actifs que Mme Silué + Kevin)
--
-- ⚠️  LANCER D'ABORD la sauvegarde (backup_before_merge.sql), PUIS ce script.
-- ============================================================================

do $$
declare
  tgt        uuid := '5ccb3e8e-4224-4e0e-9bed-c8225de3402e';  -- boutique à CONSERVER
  test_shop  uuid := '695b6939-5039-4eff-9cf9-98f9c78964cf';  -- boutique de test (Kevin)
  n int;
begin
  -- Garde-fou : la cible doit exister.
  if not exists (select 1 from public.shops where id = tgt) then
    raise exception 'Boutique CIBLE % introuvable. Abandon.', tgt;
  end if;
  raise notice 'Consolidation vers la boutique CIBLE %', tgt;

  -- ── 0) Produits de test (eau, savon…) de la boutique de Kevin → ARCHIVÉS ────
  -- (archivés, pas supprimés : cachés du stock mais récupérables si besoin)
  update public.products set archived = true where shop_id = test_shop;
  get diagnostics n = row_count;
  raise notice '• Produits de test archivés : %', n;

  -- ── 1) PRODUITS : neutraliser les code-barres en doublon ────────────────────
  -- Tout finit dans une seule boutique → unique(shop_id, barcode) exige des
  -- code-barres uniques. On vide (NULL) tout code-barres présent plus d'une fois.
  update public.products p set barcode = null
   where p.barcode is not null
     and (select count(*) from public.products q where q.barcode = p.barcode) > 1;
  get diagnostics n = row_count;
  if n > 0 then raise notice '• Code-barres en doublon neutralisés : %', n; end if;

  -- ── 2) CLIENTS : dédoublonnage par nom (insensible à la casse) ──────────────
  -- Client canonique = plus petit id pour un même nom. On repointe ventes/crédits
  -- vers lui, on supprime les doublons, puis on déplace le reste vers la cible.
  -- keep_id = plus petit id par nom (first_value car min() n'existe pas pour uuid).
  update public.sales sa set customer_id = c.keep_id
    from (select id, first_value(id) over (partition by lower(name) order by id) as keep_id
            from public.customers) c
   where sa.customer_id = c.id and c.id <> c.keep_id;

  update public.credits cr set customer_id = c.keep_id
    from (select id, first_value(id) over (partition by lower(name) order by id) as keep_id
            from public.customers) c
   where cr.customer_id = c.id and c.id <> c.keep_id;

  delete from public.customers dup
   using (select id, first_value(id) over (partition by lower(name) order by id) as keep_id
            from public.customers) c
   where dup.id = c.id and c.id <> c.keep_id;

  update public.customers set shop_id = tgt where shop_id <> tgt;

  -- ── 3) VENTES, CRÉDITS, JOURNAUX, PRODUITS → rattachés à la CIBLE ───────────
  -- sale_lines n'a pas de shop_id : suit automatiquement ses ventes.
  update public.sales               set shop_id = tgt where shop_id <> tgt;
  update public.credits             set shop_id = tgt where shop_id <> tgt;
  update public.stock_movements     set shop_id = tgt where shop_id <> tgt;
  update public.money_movements     set shop_id = tgt where shop_id <> tgt;
  update public.attendance_sessions set shop_id = tgt where shop_id <> tgt;
  update public.products            set shop_id = tgt where shop_id <> tgt;
  if to_regclass('public.auth_audit') is not null then
    update public.auth_audit set shop_id = tgt where shop_id is not null and shop_id <> tgt;
  end if;

  -- ── 4) UTILISATEURS : déplacés vers la CIBLE et désactivés ─────────────────
  -- Tous les comptes des autres boutiques rejoignent la cible mais sont
  -- DÉSACTIVÉS (pour éviter les conflits de PIN). Restent actifs :
  --   • Mme Silué de la cible (jamais touchée ici, déjà admin) ;
  --   • Kevin, réactivé et passé admin juste après.
  update public.users set active = false, shop_id = tgt where shop_id <> tgt;

  update public.users set active = true, role = 'admin'
   where shop_id = tgt and lower(name) = 'kevin';
  get diagnostics n = row_count;
  raise notice '• Compte(s) Kevin gardé(s) actif(s) en admin : %', n;

  -- ── 5) COMPTES CAISSE / BANQUE : addition des soldes ───────────────────────
  -- La cible possède déjà 'cash' et 'bank' (créés à l'inscription). On y ajoute
  -- la somme des soldes des autres boutiques, puis on supprime leurs lignes.
  update public.accounts t
     set balance = t.balance + s.sum_balance
    from (select kind, sum(balance) as sum_balance
            from public.accounts where shop_id <> tgt group by kind) s
   where t.shop_id = tgt and t.kind = s.kind;
  delete from public.accounts where shop_id <> tgt;

  -- ── 6) Sessions / codes OTP des autres boutiques : nettoyage ───────────────
  if to_regclass('public.refresh_tokens') is not null then
    delete from public.refresh_tokens where shop_id <> tgt;
  end if;
  if to_regclass('public.otp_codes') is not null then
    delete from public.otp_codes where shop_id <> tgt;
  end if;

  -- ── 7) Suppression des 5 boutiques désormais vides ─────────────────────────
  delete from public.shops where id <> tgt;
  get diagnostics n = row_count;
  raise notice '• Boutiques en double supprimées : %', n;

  raise notice '✅ Consolidation terminée : tout est sur la boutique %.', tgt;
  raise notice 'ℹ️  Sessions révoquées → chacun se reconnecte. Mme Silué garde son accès (boutique inchangée). Kevin : se reconnecter à CETTE boutique via le lien d''invitation.';
  raise notice '⚠️  Vérifiez que Mme Silué et Kevin n''ont pas le MÊME code PIN (sinon réinitialisez-en un : écran Équipe → 🔑).';
end $$;

-- ── VÉRIFICATION (lecture seule, à lancer après) ─────────────────────────────
-- Il ne doit rester qu'UNE boutique, avec tout le stock et 2 comptes actifs.
select
  s.id as shop_id, s.name,
  (select count(*) from public.products p where p.shop_id = s.id and not p.archived) as produits_actifs,
  (select count(*) from public.products p where p.shop_id = s.id and p.archived)     as produits_archives,
  (select count(*) from public.users u    where u.shop_id = s.id and u.active)        as comptes_actifs
from public.shops s;
