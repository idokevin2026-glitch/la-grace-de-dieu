-- ============================================================================
-- NATHAN KIDS — Migration 0011 : nouvelles catégories « chaussures » et « sacs »
-- ----------------------------------------------------------------------------
-- La colonne products.category était limitée à ('vetements','cosmetiques') par
-- une contrainte CHECK. On l'élargit pour la rentrée des classes (chaussures,
-- sacs). Idempotent : on retire l'ancienne contrainte si elle existe, puis on
-- pose la nouvelle.
-- ============================================================================
alter table public.products drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in ('vetements', 'cosmetiques', 'chaussures', 'sacs'));
