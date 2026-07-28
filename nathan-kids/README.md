# NATHAN KIDS — Backend (Phase 2)

Fondation base de données pour l'application de gestion de stock / caisse d'une
boutique d'articles enfants (vêtements + cosmétiques) en Afrique de l'Ouest.
Ce dossier implémente **l'étape 1 de l'ordre de mise en œuvre** d'`ARCHITECTURE.md`
(schéma + migrations + RLS multi-tenant) **et le cœur transactionnel** de l'étape
métier (fonctions atomiques `finalize_sale`, `pay_credit`, `restock`…).

> Cette fondation vit dans son propre sous-dossier ; le site **La Grâce de Dieu**
> à la racine du dépôt n'est pas modifié.

## Ce qui est livré

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0001_init.sql` | Schéma PostgreSQL complet (DDL de `DATA_MODEL.md`). |
| `supabase/migrations/0002_rls.sql`  | Row-Level Security multi-tenant + finances réservées à l'admin + vue `products_api` (masquage `cost`/marge pour `staff`). |
| `supabase/migrations/0003_functions.sql` | Fonctions métier **atomiques** (RPC) transcrites de `BUSINESS_LOGIC.md`. |
| `supabase/seed/seed.sql` | Boutique NATHAN KIDS + admin Mme Silué + comptes + 12 produits du proto. |

## Modèle retenu

Option A d'`ARCHITECTURE.md` : **PostgreSQL managé (Supabase) + PostgREST + RLS**.
La logique transactionnelle sensible (`finalizeSale`, `payDebt`, `restock`,
`adjust`, `inventory`, `money_move`) est en **fonctions SQL `SECURITY DEFINER`**,
appelées en RPC (`POST /rest/v1/rpc/<fonction>`). Chaque fonction est une
transaction unique et re-filtre explicitement par la boutique du JWT.

### Multi-tenant

Chaque table métier porte `shop_id`. Les politiques RLS filtrent par
`auth_shop_id()` = claim `shop_id` du JWT. **Le `shop_id` n'est jamais transmis
par le client** ; il est déduit du token (voir `auth_shop_id()`, `auth_user_id()`,
`auth_role()`, `is_admin()` dans `0002_rls.sql`). Le JWT porte `shop_id`,
`user_id`, `role` — émis par la couche Auth PIN (voir « Suite » ci-dessous).

### Rôles & finances

- `accounts` et `money_movements` : **RLS admin uniquement** (un `staff` ne lit
  jamais les soldes ni les mouvements de caisse).
- `products` : la colonne `cost` (donc la marge) est **masquée** aux `staff` via
  la vue `products_api` (`security_invoker`) — le front `staff` lit la vue, pas
  la table.

## Fonctions RPC

| Fonction | Signature | Règle |
|---|---|---|
| `finalize_sale` | `(p_lines jsonb, p_method text, p_customer_name text, p_idempotency_key uuid)` | Vente atomique : décrément stock + mouvements `sale`, MAJ `cash`/`bank`, création `credit` si `method='credit'`, upsert client, libellé auto, idempotence. |
| `pay_credit` | `(p_credit_id uuid)` | Solde le crédit + crédite la caisse ; `conflict` si déjà soldé. |
| `restock` | `(p_product_id uuid, p_qty int, p_new_cost int)` | `stock += qty`, `cost` si fourni, mouvement `restock`. |
| `adjust_stock` | `(p_product_id uuid, p_delta int)` | `stock = max(0, stock+delta)`, mouvement `adjust` **si** le stock change. |
| `inventory_count` | `(p_counts jsonb)` | Pour chaque écart : `stock = counted` + mouvement `inv`. |
| `money_move` | `(p_type text, p_target text, p_amount int)` | Caisse/banque (admin) ; `deposit`/`withdraw`/`toBank`. |

`p_lines` / `p_counts` : `[{ "productId": "uuid", "qty": 2 }, …]` (resp. `counted`).

### Exemple d'appel (PostgREST)

```http
POST /rest/v1/rpc/finalize_sale
Authorization: Bearer <access_token>   # claims: shop_id, user_id, role
Content-Type: application/json

{ "p_lines": [ { "productId": "…", "qty": 2 } ],
  "p_method": "especes",
  "p_customer_name": null,
  "p_idempotency_key": "b1f0…-uuid-client" }
```

## Appliquer

Dans le **SQL Editor** Supabase (ou `psql`), exécuter **dans l'ordre** :

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_functions.sql
supabase/seed/seed.sql        # facultatif (démo)
```

En CLI Supabase, les fichiers de `migrations/` sont pris en charge par
`supabase db push` ; `seed.sql` par `supabase db reset` (config à ajouter selon
votre workflow).

## Invariants garantis (DATA_MODEL.md)

1. `products.stock >= 0` toujours (contrainte `check` + `greatest(0, …)`).
2. Toute écriture de stock ⇒ **une** ligne `stock_movements` (même transaction).
3/4. Cohérence `accounts.balance` (`cash`/`bank`) : toutes les fonctions qui
   bougent un solde journalisent le mouvement correspondant, dans la même
   transaction que l'opération source.
5. Une vente `credit` ne touche ni `cash` ni `bank` (crédit créé à la place).
6. `profit` = Σ `(unit_price − unit_cost) × qty` des lignes.

> **Job de réconciliation** (recommandé, non inclus) : recalculer périodiquement
> `accounts.balance` depuis les journaux et alerter en cas d'écart
> (ARCHITECTURE.md §5).

## Suite (non inclus dans cette fondation)

Ces briques nécessitent un runtime qui émet/valide les JWT — à implémenter
ensuite, en s'appuyant sur ce socle :

1. **Auth PIN** (Edge Functions) : `signup`/`login`/`refresh`/`reset-pin`, PIN
   **haché** (bcrypt/argon2), anti-brute-force, JWT court portant `shop_id`,
   `user_id`, `role`, ouverture d'`attendance_session` au login `staff`, OTP SMS
   au reset (ARCHITECTURE.md §3).
2. **Endpoints REST restants** d'`API_SPEC.md` non couverts par PostgREST/RPC
   (agrégats : `GET /sales/daily`, `GET /sync`).
3. **Offline-first** : outbox client + `Idempotency-Key` (déjà géré côté vente
   via `p_idempotency_key`) + pull incrémental `/sync` (ARCHITECTURE.md §4).
4. **Front** : recâbler l'UX du prototype (`Nathan Kids Stock.dc.html`) sur l'API.

## Références

Documents de spécification d'origine : `API_SPEC.md`, `ARCHITECTURE.md`,
`BUSINESS_LOGIC.md`, `DATA_MODEL.md` (fournis avec la tâche). En cas de doute,
**le prototype fait foi** (`Nathan Kids Stock.dc.html`).
