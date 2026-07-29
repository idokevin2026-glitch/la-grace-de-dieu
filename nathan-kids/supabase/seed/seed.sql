-- ============================================================================
-- NATHAN KIDS — Seed de démarrage (dev / démo)
-- ----------------------------------------------------------------------------
-- Crée la boutique NATHAN KIDS, l'admin Mme Silué, les 2 comptes (caisse/banque)
-- et le catalogue des 12 produits du prototype.
--
-- ⚠ Le PIN admin est ici un HACHÉ FACTICE (placeholder). En production, l'admin
-- est créé par la couche Auth (POST /auth/signup) qui hache le PIN via bcrypt/
-- argon2 (ARCHITECTURE.md §3) — ne jamais stocker un PIN en clair.
-- ============================================================================

do $$
declare
  v_shop uuid;
begin
  -- Boutique -------------------------------------------------------------
  insert into public.shops (name, phone, open_time, close_time)
    values ('NATHAN KIDS', '+225 00 00 00 00', '08:00', '19:00')
    returning id into v_shop;

  -- Admin (PIN haché — placeholder à remplacer par la vraie Auth) ---------
  insert into public.users (shop_id, name, role, pin_hash, phone)
    values (v_shop, 'Mme Silué', 'admin', '$2a$10$SEED_PLACEHOLDER_REPLACE_ME', '+225 00 00 00 00');

  -- Comptes caisse / banque (soldes de départ à 0) ------------------------
  insert into public.accounts (shop_id, kind, balance) values
    (v_shop, 'cash', 0),
    (v_shop, 'bank', 0);

  -- Catalogue (12 produits du proto) --------------------------------------
  insert into public.products (shop_id, name_fr, name_en, category, price, cost, stock, threshold, supplier) values
    (v_shop, 'Robe fleurie fille',  'Floral girl dress', 'vetements',   6500, 3500, 12, 4, 'Kids Fashion Import'),
    (v_shop, 'T-shirt dino garçon', 'Dino boy t-shirt',  'vetements',   3500, 1800,  3, 5, 'Kids Fashion Import'),
    (v_shop, 'Ensemble bébé',       'Baby outfit set',   'vetements',   8000, 4500,  7, 3, 'Bébé Confort Distribution'),
    (v_shop, 'Jean enfant',         'Kids jeans',        'vetements',   5500, 3000, 15, 4, 'Kids Fashion Import'),
    (v_shop, 'Pyjama licorne',      'Unicorn pyjama',    'vetements',   4500, 2500,  2, 4, 'Bébé Confort Distribution'),
    (v_shop, 'Chaussettes (lot x3)','Socks (pack x3)',   'vetements',   2000,  900, 20, 6, 'Bébé Confort Distribution'),
    (v_shop, 'Crème hydratante bébé','Baby moisturizer', 'cosmetiques', 4000, 2200,  9, 4, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Savon doux',          'Gentle soap',       'cosmetiques', 1500,  700,  1, 5, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Huile de massage',    'Massage oil',       'cosmetiques', 3500, 1900,  6, 3, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Lait corporel',       'Body lotion',       'cosmetiques', 5000, 2800, 11, 4, 'Beauty Line Afrique'),
    (v_shop, 'Shampoing enfant',    'Kids shampoo',      'cosmetiques', 3000, 1600,  0, 4, 'Cosmetics Wholesale Dakar'),
    (v_shop, 'Parfum femme',        'Women perfume',     'cosmetiques',12000, 7000,  4, 2, 'Beauty Line Afrique');

  raise notice 'Seed NATHAN KIDS OK — shop_id = %', v_shop;
end $$;
