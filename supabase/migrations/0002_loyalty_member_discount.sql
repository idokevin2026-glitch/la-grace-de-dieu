-- La Grâce de Dieu — remise permanente de fidélité (Cercle)
-- Ajoute le montant de la remise liée au niveau (Ivoire -5 %, Or -10 %)
-- afin de l'afficher séparément sur le récapitulatif et le reçu.
-- Montant en entier FCFA. Le code applique déjà la remise au total ;
-- cette colonne sert au détail comptable / à l'affichage.

alter table public.orders
  add column if not exists member_discount integer not null default 0
  check (member_discount >= 0);
