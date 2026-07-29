# NATHAN KIDS — Application (Phase 2)

Application **cloud, multi-boutiques, offline-first** de gestion de stock / caisse
pour une boutique d'articles enfants (vêtements + cosmétiques) en Afrique de
l'Ouest. Migre le prototype mono-poste (`Nathan Kids Stock.dc.html`, localStorage)
vers **Supabase (PostgreSQL + PostgREST + RLS)** + une **PWA** installable.

> L'application vit dans son propre sous-dossier ; le site **La Grâce de Dieu**
> à la racine du dépôt n'est pas modifié.

## État (ordre d'ARCHITECTURE.md §9)

| # | Étape | État |
|---|---|---|
| 1 | Schéma + migrations + RLS multi-tenant | ✅ testé |
| 2 | Auth PIN (bcrypt, rôles, JWT) | ✅ testé (SQL) + Edge Function |
| 3 | Produits (CRUD, réassort, ajustement, inventaire) | ✅ RPC + écrans |
| 4 | Ventes (`finalize_sale`) + crédits + clients | ✅ testé + écrans |
| 5 | Caisse/banque + fiche du jour | ✅ testé + écrans |
| 6 | Présences (attendance) | ✅ login/logout auto |
| 7 | Offline-first (outbox + idempotence + `/sync`) | ✅ testé (Node) |
| 8 | Front PWA | ✅ parcours quotidien complet |

Répertoires : **`supabase/`** (migrations + Edge Function `auth`) et **`web/`**
(PWA — voir `web/README.md`). Inclus aussi : inventaire physique multi-produits,
scan code-barres (EAN-13 valide), export PDF/Excel, **rate-limiting `/auth/*`**,
**journal d'audit**, **refresh tokens à rotation/révocation** et **OTP SMS** au
reset du PIN. Il ne reste qu'à **brancher un fournisseur SMS** (Twilio / Orange /
MTN) via les secrets de l'Edge Function — l'intégration est prête (dégradation
gracieuse sans fournisseur).

## Ce qui est livré

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0001_init.sql` | Schéma PostgreSQL complet (DDL de `DATA_MODEL.md`). |
| `supabase/migrations/0002_rls.sql`  | Row-Level Security multi-tenant + finances réservées à l'admin + vue `products_api` (masquage `cost`/marge pour `staff`). |
| `supabase/migrations/0003_functions.sql` | Fonctions métier **atomiques** (RPC) transcrites de `BUSINESS_LOGIC.md`. |
| `supabase/migrations/0004_auth.sql` | Auth PIN (cœur SQL) : signup/login/reset, PIN **bcrypt** (pgcrypto), rôles, pointage auto (`BUSINESS_LOGIC.md §9`). |
| `supabase/migrations/0005_aggregates.sql` | Agrégats `sales_daily` (fiche du jour) + `sync_since` (pull offline). |
| `supabase/migrations/0006_security.sql` | Journal d'audit (déclencheurs) + limiteur anti-brute-force (`rate_check`) — ARCHITECTURE.md §7. |
| `supabase/migrations/0007_refresh_tokens.sql` | Refresh tokens opaques à **rotation** + révocation + détection de rejeu. |
| `supabase/migrations/0008_otp.sql` | **OTP SMS** pour le reset du PIN (code haché, expirant, tentatives limitées). |
| `supabase/functions/auth/` | Edge Function : login PIN → signature du JWT Supabase (voir `functions/README.md`). |
| `supabase/seed/seed.sql` | Boutique NATHAN KIDS + admin Mme Silué + comptes + 12 produits du proto. |
| `web/` | **PWA** installable (JS pur, offline-first) recâblée sur l'API (voir `web/README.md`). |

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
`user_id`, `user_role` — émis par la couche Auth PIN (voir « Suite » ci-dessous).

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
Authorization: Bearer <access_token>   # claims: shop_id, user_id, user_role (+ role=authenticated)
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
supabase/migrations/0004_auth.sql
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

## Auth PIN (0004_auth.sql)

Cœur SQL de l'authentification (`BUSINESS_LOGIC.md §9`), testé :

| Fonction | API_SPEC | Rôle |
|---|---|---|
| `auth_signup(shopName, owner, phone, pin)` | `POST /auth/signup` | Crée boutique + admin + comptes ; renvoie l'identité. |
| `auth_login(shopId, pin)` | `POST /auth/login` | PIN comparé admin puis staff (bcrypt) ; ouvre une présence si `staff`. |
| `auth_add_staff(name, pin)` | `POST /staff` | Admin ; refuse un PIN déjà pris (`conflict`). |
| `auth_remove_staff(userId)` | `DELETE /staff/:id` | Admin ; désactive (garde l'historique). |
| `auth_reset_pin(shopId, step, phone, newPin)` | `POST /auth/reset-pin` | Vérifie le téléphone admin puis pose le PIN. |
| `attendance_logout()` | `POST /attendance/logout` | Clôt la présence de l'utilisateur courant. |

Le PIN est **bcrypt** (`pgcrypto`). bcrypt salant chaque hash, l'unicité du PIN
et le « login par PIN » se font par **balayage bcrypt** des utilisateurs de la
boutique (et non via une clé SQL) — d'où l'absence de `unique(shop_id, pin_hash)`.

> Ce que la couche Next.js ajoute par-dessus : appeler ces fonctions puis
> **signer le JWT** (HS256, secret Supabase) portant `shop_id`/`user_id`/`user_role`
> (+ `role='authenticated'`), rafraîchir les tokens, et le **rate-limiting**
> anti-brute-force sur `/auth/*`. L'OTP SMS au reset reste à brancher (ARCHITECTURE.md §3).

## Suite

1. **Couche Next.js / API** (en cours) : routes `/api/auth/*` signant le JWT,
   client Supabase par token, proxy des RPC ci-dessus.
2. **Agrégats REST** non couverts par PostgREST/RPC : `GET /sales/daily`, `GET /sync`.
3. **Offline-first** : outbox client + `Idempotency-Key` (déjà géré côté vente
   via `p_idempotency_key`) + pull incrémental `/sync` (ARCHITECTURE.md §4).
4. **Front PWA** : recâbler l'UX du prototype (`Nathan Kids Stock.dc.html`) sur l'API.

## Références

Documents de spécification d'origine : `API_SPEC.md`, `ARCHITECTURE.md`,
`BUSINESS_LOGIC.md`, `DATA_MODEL.md` (fournis avec la tâche). En cas de doute,
**le prototype fait foi** (`Nathan Kids Stock.dc.html`).
